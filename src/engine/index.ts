// WebGL2-Pipeline: Vorschau im Canvas, Look-Kacheln und Export in voller Auflösung (gekachelt).
// Gerechnet wird in sRGB: Display-P3-Quellen werden beim Abtasten umgerechnet (siehe SAMPLE_SRC).
import { encodeJpeg, withMetadata } from '../io';
import type { Engine, ExportOptions, LookParams, Lut3D, RenderOptions, SourceImage } from '../types';
import {
  createLutTexture,
  createProgram,
  createTarget,
  createTexture,
  deleteTarget,
  uploadRegion,
  type Program,
  type Target,
} from './gl';
import {
  colorMatrix,
  containRect,
  drStrength,
  drWhite,
  effectiveParams,
  filterMargin,
  fitLongEdge,
  grainLattice,
  leakSpecs,
  planSourceTiles,
  sharpKernelWeight,
  targetSpan,
  toColumnMajor,
  type EffectiveParams,
  type Rect,
  type Size,
} from './plan';
import { BLUR, EFFECT_MAP, MAIN, RESAMPLE } from './shaders';

const TILE_LIMIT = 4096; // größter hochgeladener Quellausschnitt (Speicher auf dem iPhone)
const PREVIEW_MAX = 2560;
const HALO_SRC_EDGE = 1024; // Effektkarte (Halation, Klarheit) aus fester Größe → Export = Vorschau
const HALO_MAP_EDGE = 512;
const CLARITY_SIGMA = 0.015; // Radius der Klarheit relativ zur kürzeren Seite
const LUT_CACHE = 24;
// Mehr bringt die Vorschau nicht, kostet aber GPU-Zeit pro Regleränderung (gleiche Grenze wie die UI).
const MAX_BUFFER_PIXELS = 4_000_000;

export interface ExportPixelsOptions extends ExportOptions {
  /** Kantenlänge der Ausgabekacheln (Vorgabe 2048). */
  tileSize?: number;
}

export interface RgbaImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface FilmEngine extends Engine {
  /** Wie exportJpeg, aber liefert die RGBA-Pixel (Zeilen von oben) statt eines JPEGs. */
  exportPixels(src: SourceImage, lut: Lut3D | null, params: LookParams, opts?: ExportPixelsOptions): Promise<RgbaImage>;
  /** Erfüllt, sobald die Vorschau der aktuellen Quelle bereitsteht. */
  ready(): Promise<void>;
}

interface Resources {
  main: Program;
  resample: Program;
  effectMap: Program;
  blur: Program;
  vao: WebGLVertexArrayObject;
  black: WebGLTexture; // 1×1 Ersatz für fehlende Halation/LUT
  black3d: WebGLTexture;
  floatTargets: boolean;
  maxTexture: number;
  luts: Map<Lut3D, WebGLTexture>;
}

interface Prepared {
  preview: Target;
  haloSrc: Target;
}

const isP3 = (src: SourceImage) => src.colorSpace === 'display-p3';

function abortError(): DOMException {
  return new DOMException('Export abgebrochen', 'AbortError');
}

export function createEngine(canvas: HTMLCanvasElement): FilmEngine {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('WebGL2 wird von diesem Browser nicht unterstützt.');

  let res: Resources | null = null;
  let source: SourceImage | null = null;
  let lut: Lut3D | null = null;
  let prepared: Prepared | null = null;
  let generation = 0;
  let pending: Promise<void> | null = null;
  let rebuilding = false;
  let effectCache: { key: string; map: Target } | null = null;
  let last: { params: LookParams; opts: RenderOptions } | null = null;
  let disposed = false;

  function init(): Resources {
    const floatTargets = !!gl!.getExtension('EXT_color_buffer_float');
    const black = createTexture(gl!);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA8, 1, 1, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, new Uint8Array(4));
    return {
      main: createProgram(gl!, MAIN),
      resample: createProgram(gl!, RESAMPLE),
      effectMap: createProgram(gl!, EFFECT_MAP),
      blur: createProgram(gl!, BLUR),
      vao: gl!.createVertexArray()!,
      black,
      black3d: createLutTexture(gl!, 2, new Float32Array(24)),
      floatTargets,
      maxTexture: gl!.getParameter(gl!.MAX_TEXTURE_SIZE) as number,
      luts: new Map(),
    };
  }
  res = init();

  function alive(): Resources {
    if (disposed) throw new Error('Engine wurde freigegeben.');
    if (!res || gl!.isContextLost()) throw new Error('WebGL-Kontext verloren.');
    return res;
  }

  function lutTexture(r: Resources, l: Lut3D): WebGLTexture {
    let t = r.luts.get(l);
    if (t) {
      r.luts.delete(l); // ans Ende rücken (zuletzt benutzt)
      r.luts.set(l, t);
      return t;
    }
    t = createLutTexture(gl!, l.size, l.data);
    r.luts.set(l, t);
    if (r.luts.size > LUT_CACHE) {
      const [oldL, oldT] = r.luts.entries().next().value!;
      gl!.deleteTexture(oldT);
      r.luts.delete(oldL);
    }
    return t;
  }

  function draw(p: Program) {
    gl!.useProgram(p.prog);
    gl!.bindVertexArray(alive().vao);
    gl!.disable(gl!.BLEND);
    gl!.disable(gl!.SCISSOR_TEST);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  function bindTex(unit: number, target: number, tex: WebGLTexture) {
    gl!.activeTexture(gl!.TEXTURE0 + unit);
    gl!.bindTexture(target, tex);
  }

  /** Gemeinsame Abbildung Zielpixel → Quelle (siehe SAMPLE_SRC). */
  function setSampling(
    p: Program,
    srcTex: WebGLTexture,
    out: Size,
    src: Size,
    origin: [number, number],
    texSize: [number, number],
    mapScale: [number, number],
    mapOffset: [number, number],
    p3 = false,
  ) {
    bindTex(0, gl!.TEXTURE_2D, srcTex);
    gl!.uniform1i(p.loc('uSrc'), 0);
    gl!.uniform2f(p.loc('uOutSize'), out.width, out.height);
    gl!.uniform2f(p.loc('uSrcSize'), src.width, src.height);
    gl!.uniform2f(p.loc('uSrcOrigin'), origin[0], origin[1]);
    gl!.uniform2f(p.loc('uSrcTexSize'), texSize[0], texSize[1]);
    gl!.uniform2f(p.loc('uMapScale'), mapScale[0], mapScale[1]);
    gl!.uniform2f(p.loc('uMapOffset'), mapOffset[0], mapOffset[1]);
    gl!.uniform1i(p.loc('uSrcP3'), p3 ? 1 : 0);
  }

  function setDevelop(p: Program, params: EffectiveParams) {
    gl!.uniformMatrix3fv(p.loc('uColorMat'), false, toColumnMajor(colorMatrix(params)));
    gl!.uniform1f(p.loc('uDR'), drStrength(params.dynamicRange));
    gl!.uniform1f(p.loc('uDRWhite'), drWhite(params));
  }

  /** `scale` = Zielpixel je Pixel des Vollbilds (für den Radius der Schärfung). */
  function setLook(p: Program, l: Lut3D | null, params: EffectiveParams, effects: Target | null, scale: number) {
    const r = alive();
    setDevelop(p, params);
    const useLut = !!l && params.strength > 0;
    bindTex(1, gl!.TEXTURE_3D, useLut ? lutTexture(r, l!) : r.black3d);
    gl!.uniform1i(p.loc('uLut'), 1);
    gl!.uniform1i(p.loc('uUseLut'), useLut ? 1 : 0);
    gl!.uniform1f(p.loc('uLutSize'), l?.size ?? 2);
    gl!.uniform1f(p.loc('uStrength'), params.strength);
    bindTex(2, gl!.TEXTURE_2D, effects?.tex ?? r.black);
    gl!.uniform1i(p.loc('uMap'), 2);
    gl!.uniform1f(p.loc('uHalation'), effects ? params.halation : 0);
    const clarity = effects ? params.clarity : 0;
    let sharpW = params.sharpness !== 0 ? sharpKernelWeight(scale) : 0;
    if (sharpW < 0.005) sharpW = 0; // unsichtbar klein (z. B. Look-Kacheln): Abgriffe sparen
    const lab =
      params.highlightTone !== 0 || params.shadowTone !== 0 || params.color !== 0 || params.colorChrome !== 0 ||
      params.colorChromeBlue !== 0 || params.monoWarmCool !== 0 || params.monoMagentaGreen !== 0 ||
      clarity !== 0 || sharpW > 0;
    gl!.uniform1i(p.loc('uLab'), lab ? 1 : 0);
    gl!.uniform1f(p.loc('uToneH'), params.highlightTone);
    gl!.uniform1f(p.loc('uToneS'), params.shadowTone);
    gl!.uniform1f(p.loc('uColor'), params.color);
    gl!.uniform1f(p.loc('uCC'), params.colorChrome);
    gl!.uniform1f(p.loc('uCCBlue'), params.colorChromeBlue);
    gl!.uniform2f(p.loc('uMono'), params.monoWarmCool, params.monoMagentaGreen);
    gl!.uniform1f(p.loc('uClarity'), clarity);
    gl!.uniform1f(p.loc('uSharp'), params.sharpness);
    gl!.uniform1f(p.loc('uSharpW'), sharpW);
    gl!.uniform1f(p.loc('uGrain'), params.grain);
    gl!.uniform1f(p.loc('uGrainLattice'), grainLattice(params.grainSize));
    gl!.uniform1f(p.loc('uVignette'), params.vignette);
    gl!.uniform1f(p.loc('uLeak'), params.leak);
    const leaks = params.leak > 0 ? leakSpecs(params.leakSeed) : [];
    const a = new Float32Array(12);
    const b = new Float32Array(12);
    const n = new Float32Array(6);
    leaks.forEach((s, i) => {
      a.set([s.edge, s.pos, s.spread, s.depth], i * 4);
      b.set([...s.color, s.intensity], i * 4);
      n.set(s.noise, i * 2);
    });
    gl!.uniform1i(p.loc('uLeakCount'), leaks.length);
    gl!.uniform4fv(p.loc('uLeakA'), a);
    gl!.uniform4fv(p.loc('uLeakB'), b);
    gl!.uniform2fv(p.loc('uLeakN'), n);
    gl!.uniform1i(p.loc('uOriginal'), 0);
    gl!.uniform1f(p.loc('uSplit'), -1);
    gl!.uniform1f(p.loc('uLineWidth'), 0);
  }

  /**
   * Verkleinert die Quelle in neue Texturen der Größen `sizes` (immer sRGB, P3 wird umgerechnet). Die Quelle wird in Ausschnitten
   * ≤ TILE_LIMIT hochgeladen; jeder Ausschnitt rendert die Zielpixel, deren Mitte in ihm liegt.
   */
  async function resample(src: SourceImage, sizes: Size[], current: () => boolean): Promise<Target[]> {
    const r = alive();
    const targets = sizes.map((s) => createTarget(gl!, s.width, s.height));
    const kMax = Math.max(...sizes.map((s) => src.width / s.width), ...sizes.map((s) => src.height / s.height));
    const margin = filterMargin(kMax);
    const limit = Math.min(TILE_LIMIT, r.maxTexture);
    const tex = createTexture(gl!);
    try {
      for (const tile of planSourceTiles(src.width, src.height, limit - 2 * margin, margin)) {
        await uploadRegion(gl!, tex, src.pixels, tile.upload);
        if (!current()) throw abortError();
        alive();
        const u = tile.upload;
        targets.forEach((t) => {
          const [x0, x1] = targetSpan(tile.inner.x0, tile.inner.x1, src.width, t.width);
          const [y0, y1] = targetSpan(tile.inner.y0, tile.inner.y1, src.height, t.height);
          if (x1 <= x0 || y1 <= y0) return;
          gl!.bindFramebuffer(gl!.FRAMEBUFFER, t.fbo);
          gl!.viewport(x0, y0, x1 - x0, y1 - y0);
          gl!.useProgram(r.resample.prog);
          setSampling(r.resample, tex, t, src, [u.x0, u.y0], [u.x1 - u.x0, u.y1 - u.y0], [1, 1], [0, 0], isP3(src));
          draw(r.resample);
        });
      }
      return targets;
    } catch (e) {
      targets.forEach((t) => deleteTarget(gl!, t));
      throw e;
    } finally {
      gl!.deleteTexture(tex);
    }
  }

  const needsMap = (p: EffectiveParams) => p.halation > 0 || p.clarity !== 0;

  /**
   * Effektkarte: Lichter über der Schwelle (Halation, zwei Radien) und Helligkeit (Klarheit),
   * unscharf mit Radien relativ zur kürzeren Seite. Global vorab, damit Kacheln nahtlos sind.
   */
  function buildEffectMap(haloSrc: Target, params: EffectiveParams): Target {
    const r = alive();
    const s = fitLongEdge(haloSrc.width, haloSrc.height, HALO_MAP_EDGE);
    const a = createTarget(gl!, s.width, s.height, r.floatTargets);
    const b = createTarget(gl!, s.width, s.height, r.floatTargets);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, a.fbo);
    gl!.viewport(0, 0, s.width, s.height);
    gl!.useProgram(r.effectMap.prog);
    bindTex(0, gl!.TEXTURE_2D, haloSrc.tex);
    gl!.uniform1i(r.effectMap.loc('uSrc'), 0);
    gl!.uniform2f(r.effectMap.loc('uOutSize'), s.width, s.height);
    setDevelop(r.effectMap, params);
    draw(r.effectMap);
    const short = Math.min(s.width, s.height);
    const sigma = [0.005 * short, 0.02 * short, CLARITY_SIGMA * short] as const;
    for (const [from, to, dir] of [
      [a, b, [1, 0]],
      [b, a, [0, 1]],
    ] as const) {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, to.fbo);
      gl!.useProgram(r.blur.prog);
      bindTex(0, gl!.TEXTURE_2D, from.tex);
      gl!.uniform1i(r.blur.loc('uSrc'), 0);
      gl!.uniform2f(r.blur.loc('uDir'), dir[0], dir[1]);
      gl!.uniform3f(r.blur.loc('uSigma'), sigma[0], sigma[1], sigma[2]);
      draw(r.blur);
    }
    deleteTarget(gl!, b);
    return a;
  }

  function effectsFor(params: EffectiveParams): Target | null {
    if (!prepared || !needsMap(params)) return null;
    const p = params;
    const key = `${generation}|${p.exposure}|${p.wbKelvin}|${p.wbShiftR}|${p.wbShiftB}|${p.dynamicRange}`;
    if (effectCache?.key !== key) {
      deleteTarget(gl!, effectCache?.map);
      effectCache = { key, map: buildEffectMap(prepared.haloSrc, params) };
    }
    return effectCache.map;
  }

  /** Pixel pro CSS-Pixel: devicePixelRatio, aber Zeichenpuffer höchstens MAX_BUFFER_PIXELS. */
  function bufferScale(): number {
    const area = canvas.clientWidth * canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    return area > 0 ? Math.min(dpr, Math.sqrt(MAX_BUFFER_PIXELS / area)) : dpr;
  }

  function previewEdge(src: SourceImage): number {
    const scale = bufferScale();
    const w = canvas.clientWidth * scale;
    const h = canvas.clientHeight * scale;
    if (!(w > 0 && h > 0)) return Math.min(2048, Math.max(src.width, src.height));
    const rect = containRect(src.width, src.height, w, h);
    const long = Math.max(rect.x1 - rect.x0, rect.y1 - rect.y0);
    return Math.min(PREVIEW_MAX, Math.max(src.width, src.height), Math.max(256, long));
  }

  function freePrepared() {
    deleteTarget(gl!, prepared?.preview);
    deleteTarget(gl!, prepared?.haloSrc);
    deleteTarget(gl!, effectCache?.map);
    prepared = null;
    effectCache = null;
  }

  /** Lädt die Quelle neu; `onlyPreview` baut nur die Vorschau neu (größerer Canvas). */
  function prepare(src: SourceImage, onlyPreview: boolean) {
    const gen = onlyPreview ? generation : ++generation;
    const current = () => gen === generation && !disposed && !gl!.isContextLost();
    const p = (async () => {
      try {
        const sizes = [fitLongEdge(src.width, src.height, previewEdge(src))];
        if (!onlyPreview) sizes.push(fitLongEdge(src.width, src.height, HALO_SRC_EDGE));
        const [preview, haloSrc] = await resample(src, sizes, current);
        if (!current()) {
          deleteTarget(gl!, preview);
          deleteTarget(gl!, haloSrc);
          return;
        }
        if (onlyPreview && prepared) {
          deleteTarget(gl!, prepared.preview);
          prepared.preview = preview;
        } else {
          freePrepared();
          prepared = { preview, haloSrc };
        }
        if (last) render(last.params, last.opts);
      } catch (e) {
        if (current() && !(e instanceof DOMException && e.name === 'AbortError')) {
          console.warn('Engine: Quelle konnte nicht geladen werden', e);
        }
      } finally {
        if (onlyPreview) rebuilding = false;
      }
    })().finally(() => {
      if (pending === p) pending = null;
    });
    pending = p;
  }

  function setSource(src: SourceImage) {
    source = src;
    if (disposed || !res || gl!.isContextLost()) return;
    freePrepared();
    rebuilding = false;
    prepare(src, false);
  }

  function render(look: LookParams, opts: RenderOptions = {}) {
    last = { params: look, opts };
    if (disposed || !res || gl!.isContextLost()) return;
    const dpr = bufferScale();
    const cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, cw, ch);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    if (!prepared || !source) return;

    const pv = prepared.preview;
    const want = previewEdge(source);
    if (!rebuilding && want > Math.max(pv.width, pv.height) * 1.2) {
      rebuilding = true;
      prepare(source, true);
    }

    const rect = containRect(source.width, source.height, cw, ch);
    const out = { width: rect.x1 - rect.x0, height: rect.y1 - rect.y0 };
    const r = res;
    const params = effectiveParams(look);
    const effects = effectsFor(params);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(rect.x0, ch - rect.y1, out.width, out.height);
    gl!.useProgram(r.main.prog);
    setSampling(r.main, pv.tex, out, pv, [0, 0], [pv.width, pv.height], [1, -1], [-rect.x0, ch - rect.y0]);
    setLook(r.main, lut, params, effects, out.width / source.width);
    gl!.uniform1i(r.main.loc('uOriginal'), opts.showOriginal ? 1 : 0);
    gl!.uniform1f(r.main.loc('uSplit'), opts.split === undefined || opts.showOriginal ? -1 : opts.split);
    gl!.uniform1f(r.main.loc('uLineWidth'), Math.max(1, Math.round(1.5 * dpr)));
    draw(r.main);
  }

  async function ready(): Promise<void> {
    while (pending) await pending;
  }

  async function renderThumbnail(l: Lut3D | null, look: LookParams, maxEdge: number): Promise<ImageBitmap> {
    const params = effectiveParams(look);
    await ready();
    const r = alive();
    if (!prepared || !source) throw new Error('Keine Quelle geladen.');
    const pv = prepared.preview;
    const s = fitLongEdge(source.width, source.height, maxEdge);
    const t = createTarget(gl!, s.width, s.height);
    const buf = new Uint8ClampedArray(s.width * s.height * 4);
    try {
      const effects = effectsFor(params); // vor dem Binden: baut ggf. mit eigenem Framebuffer
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, t.fbo);
      gl!.viewport(0, 0, s.width, s.height);
      gl!.useProgram(r.main.prog);
      setSampling(r.main, pv.tex, s, pv, [0, 0], [pv.width, pv.height], [1, 1], [0, 0]);
      setLook(r.main, l, params, effects, s.width / source.width);
      draw(r.main);
      gl!.readPixels(0, 0, s.width, s.height, gl!.RGBA, gl!.UNSIGNED_BYTE, buf);
    } finally {
      deleteTarget(gl!, t);
    }
    return createImageBitmap(new ImageData(buf, s.width, s.height));
  }

  /** Eine Exportkachel: Ausschnitt `rect` der Quelle, gerechnet wie in exportPixels, als outW×outH. */
  async function renderRegion(
    src: SourceImage,
    l: Lut3D | null,
    look: LookParams,
    rect: Rect,
    outW: number,
    outH: number,
    opts: { showOriginal?: boolean; signal?: AbortSignal } = {},
  ): Promise<ImageBitmap> {
    const params = effectiveParams(look);
    const signal = opts.signal;
    const check = () => {
      if (signal?.aborted) throw abortError();
      return alive();
    };
    const r = check();
    const s = outW / (rect.x1 - rect.x0); // Zielpixel je Quellpixel
    const sy = outH / (rect.y1 - rect.y0);
    const margin = filterMargin(1 / s);
    const u = {
      x0: Math.max(0, rect.x0 - margin),
      y0: Math.max(0, rect.y0 - margin),
      x1: Math.min(src.width, rect.x1 + margin),
      y1: Math.min(src.height, rect.y1 + margin),
    };
    const limit = Math.min(TILE_LIMIT, r.maxTexture);
    if (u.x1 - u.x0 > limit || u.y1 - u.y0 > limit) throw new Error(`Ausschnitt zu groß (höchstens ${limit} px samt Rand).`);

    // Effektkarte: für die aktive Quelle die gecachte (gleiche Größe wie im Export), sonst eigene.
    if (src === source) await ready();
    const cached = src === source && !!prepared;
    let own: Target | null = null;
    let fbo: Target | null = null;
    const tex = createTexture(gl!);
    const buf = new Uint8ClampedArray(outW * outH * 4);
    try {
      if (!cached && needsMap(params)) {
        const [haloSrc] = await resample(src, [fitLongEdge(src.width, src.height, HALO_SRC_EDGE)], () => !signal?.aborted);
        own = buildEffectMap(haloSrc, params);
        deleteTarget(gl!, haloSrc);
      }
      await uploadRegion(gl!, tex, src.pixels, u);
      check();
      if (cached && (src !== source || !prepared)) throw abortError(); // Quelle inzwischen gewechselt
      // Ab hier ohne await: die gecachte Karte kann sich sonst durch render() ändern.
      const effects = cached ? effectsFor(params) : own;
      fbo = createTarget(gl!, outW, outH);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo.fbo);
      gl!.viewport(0, 0, outW, outH);
      gl!.useProgram(r.main.prog);
      const full = { width: src.width * s, height: src.height * sy }; // gedachtes Gesamtbild in Zielpixeln
      setSampling(r.main, tex, full, src, [u.x0, u.y0], [u.x1 - u.x0, u.y1 - u.y0], [1, 1], [rect.x0 * s, rect.y0 * sy], isP3(src));
      setLook(r.main, l, params, effects, s);
      gl!.uniform1i(r.main.loc('uOriginal'), opts.showOriginal ? 1 : 0);
      draw(r.main);
      gl!.readPixels(0, 0, outW, outH, gl!.RGBA, gl!.UNSIGNED_BYTE, buf);
    } finally {
      if (!gl!.isContextLost()) {
        gl!.deleteTexture(tex);
        deleteTarget(gl!, fbo);
        deleteTarget(gl!, own);
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      }
    }
    return createImageBitmap(new ImageData(buf, outW, outH));
  }

  async function exportPixels(
    src: SourceImage,
    l: Lut3D | null,
    look: LookParams,
    opts: ExportPixelsOptions = {},
  ): Promise<RgbaImage> {
    const params = effectiveParams(look);
    const signal = opts.signal;
    const check = () => {
      if (signal?.aborted) throw abortError();
      alive();
    };
    check();
    const r = alive();
    const outSize = fitLongEdge(src.width, src.height, opts.maxEdge ?? Infinity);
    const { width: outW, height: outH } = outSize;
    const k = Math.max(src.width / outW, src.height / outH);
    const margin = filterMargin(k);
    const limit = Math.min(TILE_LIMIT, r.maxTexture);
    const inner = Math.max(64, Math.min(limit - 2 * margin, Math.floor((opts.tileSize ?? 2048) * k)));
    const tiles = planSourceTiles(src.width, src.height, inner, margin);
    const spans = tiles.map((t) => ({
      x: targetSpan(t.inner.x0, t.inner.x1, src.width, outW),
      y: targetSpan(t.inner.y0, t.inner.y1, src.height, outH),
    }));
    const tileW = Math.max(...spans.map((s) => s.x[1] - s.x[0]));
    const tileH = Math.max(...spans.map((s) => s.y[1] - s.y[0]));

    let effects: Target | null = null;
    let fbo: Target | null = null;
    const tex = createTexture(gl!);
    try {
      if (needsMap(params)) {
        const [haloSrc] = await resample(src, [fitLongEdge(src.width, src.height, HALO_SRC_EDGE)], () => !signal?.aborted);
        effects = buildEffectMap(haloSrc, params);
        deleteTarget(gl!, haloSrc);
      }
      fbo = createTarget(gl!, tileW, tileH);
      const out = new Uint8Array(outW * outH * 4);
      for (let i = 0; i < tiles.length; i++) {
        check();
        const { x, y } = spans[i];
        if (x[1] <= x[0] || y[1] <= y[0]) continue;
        const u = tiles[i].upload;
        await uploadRegion(gl!, tex, src.pixels, u);
        check();
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo.fbo);
        gl!.viewport(0, 0, x[1] - x[0], y[1] - y[0]);
        gl!.useProgram(r.main.prog);
        setSampling(r.main, tex, outSize, src, [u.x0, u.y0], [u.x1 - u.x0, u.y1 - u.y0], [1, 1], [x[0], y[0]], isP3(src));
        setLook(r.main, l, params, effects, outW / src.width);
        draw(r.main);
        // Kachelzeile 0 ist Bildzeile y0 (Bildkoordinaten von oben) → direkt in den Gesamtpuffer.
        gl!.pixelStorei(gl!.PACK_ALIGNMENT, 1);
        gl!.pixelStorei(gl!.PACK_ROW_LENGTH, outW);
        gl!.readPixels(0, 0, x[1] - x[0], y[1] - y[0], gl!.RGBA, gl!.UNSIGNED_BYTE, out, (y[0] * outW + x[0]) * 4);
        gl!.pixelStorei(gl!.PACK_ROW_LENGTH, 0);
        check();
        opts.onProgress?.(((i + 1) / tiles.length) * 0.85);
        // Dem Browser Luft lassen (Fortschrittsanzeige, Eingaben).
        await new Promise((res) => setTimeout(res, 0));
      }
      return { data: out, width: outW, height: outH };
    } finally {
      if (!gl!.isContextLost()) {
        gl!.deleteTexture(tex);
        deleteTarget(gl!, fbo);
        deleteTarget(gl!, effects);
      }
    }
  }

  async function exportJpeg(
    src: SourceImage,
    l: Lut3D | null,
    params: LookParams,
    opts: ExportOptions = {},
  ): Promise<Blob> {
    const { data, width, height } = await exportPixels(src, l, params, opts);
    if (opts.signal?.aborted) throw abortError();
    // `data` ist ein eigener, ganzer Puffer: encodeJpeg verschiebt ihn in den Worker (danach leer).
    const jpeg = await encodeJpeg(data, width, height, opts.quality ?? 92);
    if (opts.signal?.aborted) throw abortError();
    // Ausgabe ist sRGB: das ICC-Profil der Quelle (z. B. Display P3) passt nicht mehr.
    const withMeta = withMetadata(jpeg, { ...src.meta, icc: undefined }, { width, height });
    opts.onProgress?.(1);
    return new Blob([withMeta as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
  }

  function onLost(e: Event) {
    e.preventDefault(); // sonst wird der Kontext nie wiederhergestellt
    res = null;
    prepared = null;
    effectCache = null;
    pending = null;
    generation++;
  }

  function onRestored() {
    if (disposed) return;
    res = init();
    if (source) setSource(source);
    if (last) render(last.params, last.opts);
  }

  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  function dispose() {
    if (disposed) return;
    generation++;
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    if (res && !gl!.isContextLost()) {
      freePrepared();
      for (const t of res.luts.values()) gl!.deleteTexture(t);
      gl!.deleteTexture(res.black);
      gl!.deleteTexture(res.black3d);
      gl!.deleteVertexArray(res.vao);
      for (const p of [res.main, res.resample, res.effectMap, res.blur]) gl!.deleteProgram(p.prog);
    }
    disposed = true;
    res = null;
    prepared = null;
    source = null;
    last = null;
  }

  return {
    setSource,
    setLut(l) {
      lut = l;
    },
    render,
    exportJpeg,
    exportPixels,
    renderThumbnail,
    renderRegion,
    ready,
    dispose,
  };
}
