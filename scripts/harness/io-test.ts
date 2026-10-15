// Testseite für src/io: Funktionen werden von scripts/io-test.mjs über window.io aufgerufen.
import { decode as jsquashDecode } from '@jsquash/jpeg';
import { encodeJpeg, isRawFile, loadFile, withMetadata } from '../../src/io';
import { decodeImage, rotateOnCpu } from '../../src/io/decode';
import { makeOrientationExif } from '../../src/io/exif';
import { extractMetadata, replaceAppSegments } from '../../src/io/jpeg';
import type { SourceColorSpace, SourceImage } from '../../src/types';

type Rgba = { data: Uint8Array; width: number; height: number };

async function fetchFile(url: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], url.split('/').pop()!, { type: blob.type });
}

/** Liest einen ImageBitmap streifenweise als RGBA; die Rohwerte (kein Farbmanagement) hängen vom Canvas-Farbraum ab. */
function readBitmap(bmp: ImageBitmap | Rgba, colorSpace: SourceColorSpace): Rgba {
  if (!(bmp instanceof ImageBitmap)) return bmp;
  const { width, height } = bmp;
  const out = new Uint8Array(width * height * 4);
  const rows = 256;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = rows;
  const ctx = c.getContext('2d', { colorSpace, willReadFrequently: true })!;
  for (let y = 0; y < height; y += rows) {
    const h = Math.min(rows, height - y);
    ctx.clearRect(0, 0, width, rows);
    ctx.drawImage(bmp, 0, y, width, h, 0, 0, width, h);
    out.set(ctx.getImageData(0, 0, width, h).data, y * width * 4);
  }
  c.width = c.height = 0;
  return { data: out, width, height };
}

function diff(a: Rgba, b: Rgba) {
  if (a.width !== b.width || a.height !== b.height) return { error: `Maße ${a.width}×${a.height} vs ${b.width}×${b.height}` };
  let sum = 0;
  let max = 0;
  let over8 = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a.data[i * 4 + c] - b.data[i * 4 + c]);
      sum += d;
      if (d > max) max = d;
      if (d > 8) over8++;
    }
  }
  return { mean: sum / (n * 3), max, shareOver8: over8 / (n * 3) };
}

const loaded = new Map<string, SourceImage>();

const io = {
  isRawFile: (name: string) => isRawFile(new File([], name)),

  async load(url: string) {
    const file = await fetchFile(url);
    const t0 = performance.now();
    const src = await loadFile(file);
    const ms = performance.now() - t0;
    loaded.set(url, src);
    const meta = src.meta;
    return {
      name: src.fileName,
      id: src.id,
      width: src.width,
      height: src.height,
      colorSpace: src.colorSpace,
      isBitmap: src.pixels instanceof ImageBitmap,
      exif: meta.exif?.length,
      xmp: meta.xmp?.length,
      icc: meta.icc?.map((p) => p.length),
      ms: Math.round(ms),
    };
  },

  /** loadFile-Pixel gegen die mozjpeg-Dekodierung der Datei (reine YCbCr→RGB-Rohwerte). */
  async compareDecode(url: string) {
    const src = loaded.get(url)!;
    const file = await fetchFile(url);
    const raw = await jsquashDecode(await file.arrayBuffer());
    const ref: Rgba = { data: new Uint8Array(raw.data.buffer), width: raw.width, height: raw.height };
    // Eine 6000×4000-Referenz ist 96 MB; Vergleich genügt auf allen Bildern.
    return { p3Canvas: diff(readBitmap(src.pixels, 'display-p3'), ref), srgbCanvas: diff(readBitmap(src.pixels, 'srgb'), ref) };
  },

  async encodeRoundtrip(url: string, quality: number) {
    const src = loaded.get(url)!;
    const file = await fetchFile(url);
    const raw = await jsquashDecode(await file.arrayBuffer());
    const { width, height } = raw;
    const rgba = new Uint8Array(raw.data.buffer.slice(0));
    const ref: Rgba = { data: new Uint8Array(raw.data.buffer), width, height };
    const t0 = performance.now();
    const jpeg = await encodeJpeg(rgba, width, height, quality);
    const encodeMs = performance.now() - t0;
    const detached = rgba.byteLength === 0;
    const final = withMetadata(jpeg, src.meta, { width, height });
    // Rückdekodierung 1: mozjpeg-Decoder, 2: Browser (ohne Farbmanagement)
    const back = await jsquashDecode(final.slice().buffer);
    const d1 = diff({ data: new Uint8Array(back.data.buffer), width: back.width, height: back.height }, ref);
    const bmp = await createImageBitmap(new Blob([final as BlobPart], { type: 'image/jpeg' }), {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'none',
    });
    const meta = extractMetadata(final);
    const result = {
      width,
      height,
      quality,
      encodeMs: Math.round(encodeMs),
      bytes: jpeg.length,
      finalBytes: final.length,
      inputDetached: detached,
      browserDecoded: `${bmp.width}×${bmp.height}`,
      meta: { exif: meta.exif?.length, xmp: meta.xmp?.length, icc: meta.icc?.map((p) => p.length) },
      diffMozjpegDecode: d1,
      heapMB: Math.round(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1e6),
    };
    bmp.close();
    return result;
  },

  /** loadFile mit erzeugten Dateien: Formate, Orientierung, Fehlertexte. */
  async loadSynthetic() {
    const c = document.createElement('canvas');
    c.width = 6;
    c.height = 3;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#c33';
    ctx.fillRect(0, 0, 6, 3);
    const blobOf = (type: string) => new Promise<Blob>((r) => c.toBlob((b) => r(b!), type, 0.9));
    const jpeg = new Uint8Array(await (await blobOf('image/jpeg')).arrayBuffer());
    const rotated = replaceAppSegments(jpeg, [{ marker: 0xe1, payload: makeOrientationExif(6) }]);
    const files: [string, BlobPart][] = [
      ['quer.jpg', jpeg as BlobPart],
      ['hochkant-exif6.jpg', rotated as BlobPart],
      ['bild.png', await blobOf('image/png')],
      ['bild.webp', await blobOf('image/webp')],
      ['falsch-benannt.png', jpeg as BlobPart],
      ['iphone.heic', new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0, 0x6d, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63, 1, 2, 3, 4])],
      ['kaputt.jpg', jpeg.subarray(0, 40) as BlobPart],
      ['text.txt', 'hallo'],
      ['leer.jpg', new Uint8Array(0)],
    ];
    const out: Record<string, unknown> = {};
    for (const [name, part] of files) {
      try {
        const src = await loadFile(new File([part], name));
        out[name] = `${src.width}×${src.height} ${src.colorSpace} ${src.pixels instanceof ImageBitmap ? 'bitmap' : 'rgba'}`;
      } catch (e) {
        out[name] = `FEHLER: ${(e as Error).message}`;
      }
    }
    return out;
  },

  /** Nur kodieren, nichts behalten – für die Speichermessung. */
  async encodeOnly(url: string, quality: number) {
    const raw = await jsquashDecode(await (await fetchFile(url)).arrayBuffer());
    const { width, height } = raw;
    const rgba = new Uint8Array(raw.data.buffer);
    const t0 = performance.now();
    const jpeg = await encodeJpeg(rgba, width, height, quality);
    return { ms: Math.round(performance.now() - t0), bytes: jpeg.length };
  },

  /** Kleines Bild mit bekannter Orientation durch den Dekodierweg schicken (Drehung und CPU-Notweg). */
  async orientationCheck() {
    const w = 8;
    const h = 4;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    // Ecke links oben rot, rechts oben grün, links unten blau, Rest grau
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(w - 2, 0, 2, 2);
    ctx.fillStyle = '#00f';
    ctx.fillRect(0, h - 2, 2, 2);
    const base = new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 1))).arrayBuffer());
    const results: Record<string, unknown> = {};
    for (let o = 1; o <= 8; o++) {
      const jpeg = replaceAppSegments(base, [{ marker: 0xe1, payload: makeOrientationExif(o) }]);
      const blob = new Blob([jpeg as BlobPart], { type: 'image/jpeg' });
      const viaBrowser = await decodeImage(blob, o, 'srgb');
      // Ausgangsbild ohne EXIF; die CPU-Drehung muss dem Ergebnis des Browsers entsprechen.
      const plain = await createImageBitmap(new Blob([base as BlobPart], { type: 'image/jpeg' }));
      const manual = rotateOnCpu(plain, o, 'srgb');
      const a = readBitmap(viaBrowser.pixels, 'srgb');
      results[o] = { via: viaBrowser.via, size: `${a.width}×${a.height}`, manualVsBrowser: diff(manual, a) };
      plain.close();
    }
    return results;
  },
};

declare global {
  interface Window {
    io: typeof io;
  }
}
window.io = io;
document.title = 'IO-Test bereit';
