// Reine Rechenfunktionen der Engine (ohne WebGL), damit sie in Node testbar sind.
import type { LookParams } from '../types';

export interface Size {
  width: number;
  height: number;
}

/** Halboffenes Rechteck [x0, x1) × [y0, y1) in Pixeln. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Größe nach Begrenzung der längsten Kante (nie vergrößern). */
export function fitLongEdge(w: number, h: number, maxEdge: number): Size {
  const long = Math.max(w, h);
  if (!(maxEdge > 0) || maxEdge >= long) return { width: w, height: h };
  const s = maxEdge / long;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/** Bild eingepasst (contain) in eine Fläche, ganzzahlig und mittig. y0 von oben. */
export function containRect(imgW: number, imgH: number, boxW: number, boxH: number): Rect {
  const s = Math.min(boxW / imgW, boxH / imgH);
  const w = Math.max(1, Math.round(imgW * s));
  const h = Math.max(1, Math.round(imgH * s));
  const x0 = Math.floor((boxW - w) / 2);
  const y0 = Math.floor((boxH - h) / 2);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

export interface SourceTile {
  /** Bereich, dessen Zielpixel diese Kachel rendert (Quellpixel). */
  inner: Rect;
  /** Hochzuladender Ausschnitt inkl. Rand für den Verkleinerungsfilter. */
  upload: Rect;
}

/**
 * Teilt die Quelle in Kacheln mit Innenmaß `inner` und Rand `margin`.
 * Die Innenbereiche überdecken die Quelle lückenlos und ohne Überlappung.
 */
export function planSourceTiles(srcW: number, srcH: number, inner: number, margin: number): SourceTile[] {
  const tiles: SourceTile[] = [];
  const step = Math.max(1, Math.floor(inner));
  for (let y = 0; y < srcH; y += step)
    for (let x = 0; x < srcW; x += step) {
      const r = { x0: x, y0: y, x1: Math.min(srcW, x + step), y1: Math.min(srcH, y + step) };
      tiles.push({
        inner: r,
        upload: {
          x0: Math.max(0, r.x0 - margin),
          y0: Math.max(0, r.y0 - margin),
          x1: Math.min(srcW, r.x1 + margin),
          y1: Math.min(srcH, r.y1 + margin),
        },
      });
    }
  return tiles;
}

/**
 * Zielpixel j gehört zur Kachel, in deren Innenbereich sein Mittelpunkt (j+0,5)·k fällt.
 * Liefert [j0, j1) für den Quellbereich [a, b). Benachbarte Kacheln teilen sich die Grenze,
 * deshalb entsteht exakt eine Zerlegung.
 */
export function targetSpan(a: number, b: number, srcLen: number, outLen: number): [number, number] {
  const k = srcLen / outLen;
  const j0 = a <= 0 ? 0 : Math.ceil(a / k - 0.5);
  const j1 = b >= srcLen ? outLen : Math.ceil(b / k - 0.5);
  return [j0, Math.max(j0, j1)];
}

/**
 * Rand in Quellpixeln, den eine Kachel braucht: Box-Filter (k/2) plus die Nachbarpixel
 * der Schärfung (±1 Zielpixel = k Quellpixel) und bilineare Abgriffe.
 */
export function filterMargin(k: number): number {
  return Math.ceil(Math.max(1, k) * 1.5) + 2;
}

const LUMA = [0.2126, 0.7152, 0.0722];

/** Kelvin, bei denen das Foto als neutral abgeglichen gilt (Tageslicht). */
export const WB_REFERENCE_K = 5500;
/**
 * Blendenstufen je Schritt der Weißabgleich-Verschiebung (R bzw. B). Fujifilm nennt keine Größe;
 * gegen In-Kamera-Rezepte derselben Aufnahme geprüft (scripts/abgleich-pipeline.mjs wb): passt mit
 * Faktor 1,0–1,25, z. B. Kodachrome 64 → Gold 200 (+2 R) Kamera Δa* 2,3, Film Lab 2,1.
 */
export const WB_SHIFT_STOPS = 0.06;

type Mat3 = number[]; // zeilenweise, 9 Werte

const mul = (a: Mat3, b: Mat3): Mat3 =>
  [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
const apply = (m: Mat3, v: number[]) => [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);

// Lineares sRGB ↔ XYZ (D65) und Bradford-Zapfenraum.
const SRGB_TO_XYZ: Mat3 = [0.4124564, 0.3575761, 0.1804375, 0.2126729, 0.7151522, 0.072175, 0.0193339, 0.119192, 0.9503041];
const XYZ_TO_SRGB: Mat3 = [3.2404542, -1.5371385, -0.4985314, -0.969266, 1.8760108, 0.041556, 0.0556434, -0.2040259, 1.0572252];
const BRADFORD: Mat3 = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
const BRADFORD_INV: Mat3 = [0.9869929, -0.1470543, 0.1599627, 0.4323053, 0.5183603, 0.0492912, -0.0085287, 0.0400428, 0.9684867];

/** Farbort des Planck-Strahlers (Näherung nach Kim et al. 2002, 1667–25000 K) als XYZ mit Y = 1. */
export function planckXYZ(kelvin: number): number[] {
  const T = Math.min(25000, Math.max(1667, kelvin));
  const x =
    T <= 4000
      ? -0.2661239e9 / T ** 3 - 0.2343589e6 / T ** 2 + 0.8776956e3 / T + 0.17991
      : -3.0258469e9 / T ** 3 + 2.1070379e6 / T ** 2 + 0.2226347e3 / T + 0.24039;
  const y =
    T <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : T <= 4000
        ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x / y, 1, (1 - x - y) / y];
}

/**
 * Weißabgleich wie in der Kamera: Sie gleicht so ab, dass Licht von `kelvin` neutral wird.
 * Das Foto war bei WB_REFERENCE_K neutral → Bradford-Anpassung von `kelvin` auf die Referenz.
 * Höhere Kelvin = wärmer. Ergebnis zeilenweise, in linearem sRGB.
 */
function kelvinMatrix(kelvin: number): Mat3 {
  const src = apply(BRADFORD, planckXYZ(kelvin));
  const dst = apply(BRADFORD, planckXYZ(WB_REFERENCE_K));
  const d: Mat3 = [dst[0] / src[0], 0, 0, 0, dst[1] / src[1], 0, 0, 0, dst[2] / src[2]];
  return mul(XYZ_TO_SRGB, mul(BRADFORD_INV, mul(d, mul(BRADFORD, SRGB_TO_XYZ))));
}

/**
 * Farbmatrix vor der LUT (lineares sRGB, zeilenweise): Belichtung × Weißabgleich (Kelvin + Verschiebung).
 * Der Weißabgleich erhält die Luminanz von Weiß; Belichtung skaliert mit 2^EV.
 */
export function colorMatrix(p: Pick<LookParams, 'exposure' | 'wbKelvin' | 'wbShiftR' | 'wbShiftB'>): Mat3 {
  let m: Mat3 = p.wbKelvin > 0 ? kelvinMatrix(p.wbKelvin) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const shift = [2 ** (WB_SHIFT_STOPS * p.wbShiftR), 1, 2 ** (WB_SHIFT_STOPS * p.wbShiftB)];
  m = m.map((v, i) => v * shift[Math.floor(i / 3)]);
  const white = apply(m, [1, 1, 1]);
  const y = white[0] * LUMA[0] + white[1] * LUMA[1] + white[2] * LUMA[2];
  const e = 2 ** p.exposure / y;
  return m.map((v) => v * e);
}

/** Zeilenweise 3×3 → spaltenweise für uniformMatrix3fv. */
export function toColumnMajor(m: Mat3): Float32Array {
  return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
}

/** Stärke der Lichterkompression für DR100/200/400 (siehe dynRange im Shader). */
export function drStrength(dr: LookParams['dynamicRange']): number {
  return dr === 400 ? 1 : dr === 200 ? 0.5 : 0;
}

/**
 * Luminanz, die mit DR200/DR400 noch auf Weiß passt: Bei Plusbelichtung liegen die Lichter der
 * Quelle bei bis zu 2^EV; DR200 fängt eine, DR400 zwei Blendenstufen davon auf.
 */
export function drWhite(p: Pick<LookParams, 'exposure' | 'dynamicRange'>): number {
  return Math.min(2 ** Math.max(0, p.exposure), p.dynamicRange / 100);
}

/** Radius (σ) der Schärfung in Pixeln des Vollbilds. */
export const SHARP_SIGMA = 0.7;

/**
 * Seitengewicht w des 3×3-Kerns [w, 1−2w, w]² der Schärfung bei `scale` Zielpixeln je Vollbildpixel.
 * Ein diskreter Kern mit w = σ²/2 hat für kleine Frequenzen denselben Frequenzgang wie ein Gauß mit σ:
 * In der verkleinerten Vorschau wirkt die Schärfung so ungefähr wie im verkleinerten Export.
 */
export function sharpKernelWeight(scale: number): number {
  const s = SHARP_SIGMA * Math.min(1, scale);
  return Math.min(0.5, s * s) / 2;
}

/** Ein Lichteinfall: Kante, Lage, Ausdehnung und Farbe, alles relativ zur kürzeren Bildseite. */
export interface LeakSpec {
  /** 0 links, 1 rechts, 2 oben, 3 unten. */
  edge: number;
  /** Lage entlang der Kante, 0..1 der Kantenlänge. */
  pos: number;
  /** Ausdehnung entlang der Kante (Kurzseiten-Einheiten). */
  spread: number;
  /** Eindringtiefe ins Bild (Kurzseiten-Einheiten). */
  depth: number;
  color: [number, number, number];
  intensity: number;
  /** Versatz des Rauschfelds für die unregelmäßige Form. */
  noise: [number, number];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsv(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/** 1–3 warme Lichteinfälle, deterministisch aus dem Samen. */
export function leakSpecs(seed: number): LeakSpec[] {
  const rnd = mulberry32(Math.imul((seed | 0) ^ 0x5bd1e995, 0x27d4eb2d) + 0x9e3779b9);
  rnd();
  const count = 1 + Math.floor(rnd() * 3);
  const first = Math.floor(rnd() * 4);
  const out: LeakSpec[] = [];
  for (let i = 0; i < count; i++) {
    // Mehrere Einfälle bevorzugt von derselben oder der gegenüberliegenden Kante,
    // wie bei undichter Kamerarückwand.
    const edge = i === 0 ? first : rnd() < 0.6 ? first : first ^ 1;
    const hue = 0.005 + rnd() * 0.095; // tiefrot .. bernstein
    out.push({
      edge,
      pos: 0.08 + rnd() * 0.84,
      spread: 0.2 + rnd() * 0.45,
      depth: 0.15 + rnd() * 0.35,
      color: hsv(hue, 0.75 + rnd() * 0.2, 1),
      intensity: (i === 0 ? 1.1 : 0.6) + rnd() * 0.4,
      noise: [rnd() * 100, rnd() * 100],
    });
  }
  return out;
}

/**
 * Gitterpunkte des Korns pro kürzerer Bildseite. „klein“: 2 Punkte je Pixel bei 24 MP, gemittelt → fast weißes
 * Pixelrauschen wie Fujis Grain Effect (X-T30, 100 %: Autokorrelation bei 1 px ≈ 0); „groß“ ≈ 1,5 px wie bei
 * X-T5/GFX (Large ≈ 1,5 × Small, docs/kamera-looks-referenz.md 2.1).
 */
export function grainLattice(size: LookParams['grainSize']): number {
  return size === 'gross' ? 2700 : 8000;
}
