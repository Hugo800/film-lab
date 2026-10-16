// Bilddatei → ImageBitmap mit richtiger Drehung. Browser verhalten sich hier verschieden
// (Optionen unbekannt, EXIF-Drehung fehlt), deshalb wird einmal pro Sitzung mit einem
// winzigen JPEG (Orientation=6) ausprobiert, welcher Weg tatsächlich dreht.
import type { SourceColorSpace } from '../types';
import { makeOrientationExif } from './exif';
import { replaceAppSegments } from './jpeg';

const FULL_OPTIONS: ImageBitmapOptions = {
  imageOrientation: 'from-image',
  colorSpaceConversion: 'none',
  premultiplyAlpha: 'none',
};

interface Strategy {
  name: string;
  decode(blob: Blob): Promise<ImageBitmap>;
}

const STRATEGIES: Strategy[] = [
  { name: 'bitmap', decode: (b) => createImageBitmap(b, FULL_OPTIONS) },
  { name: 'bitmap-ohne-optionen', decode: (b) => createImageBitmap(b) },
  {
    // Das <img>-Element dreht nach CSS-Vorgabe (image-orientation: from-image) in allen aktuellen Browsern.
    name: 'img',
    decode: async (b) => {
      const url = URL.createObjectURL(b);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return await createImageBitmap(img);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  },
];

interface Probed {
  strategy: Strategy;
  rotates: boolean;
}

async function makeProbeJpeg(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein 2D-Canvas');
  ctx.fillRect(0, 0, 2, 1);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Probe-JPEG nicht erzeugbar');
  const jpeg = replaceAppSegments(new Uint8Array(await blob.arrayBuffer()), [
    { marker: 0xe1, payload: makeOrientationExif(6) },
  ]);
  return new Blob([jpeg as BlobPart], { type: 'image/jpeg' });
}

let probed: Promise<Probed[]> | undefined;

/** Alle Wege, die überhaupt dekodieren; drehende zuerst. */
function probeStrategies(): Promise<Probed[]> {
  probed ??= (async () => {
    const probe = await makeProbeJpeg().catch(() => null);
    const list: Probed[] = [];
    for (const strategy of STRATEGIES) {
      try {
        if (!probe) {
          list.push({ strategy, rotates: false });
          continue;
        }
        const bmp = await strategy.decode(probe);
        list.push({ strategy, rotates: bmp.width === 1 && bmp.height === 2 });
        bmp.close();
      } catch {
        // Weg unbrauchbar (z. B. Option wird abgelehnt).
      }
    }
    return [...list.filter((p) => p.rotates), ...list.filter((p) => !p.rotates)];
  })();
  return probed;
}

/** Nur für Tests: erzwingt eine neue Erkundung. */
export function resetProbe(): void {
  probed = undefined;
}

export interface DecodedPixels {
  pixels: ImageBitmap | { data: Uint8Array; width: number; height: number };
  /** Name des verwendeten Dekodierwegs (zur Diagnose). */
  via: string;
}

/**
 * Dekodiert `blob`. `orientation` (EXIF, nur JPEG bekannt) wird von Hand angewendet, falls kein
 * Weg des Browsers dreht. Wirft den ersten Browserfehler, wenn nichts dekodiert: Spätere Wege dekodieren
 * defekte Dateien teilweise und scheitern dann irreführend an der Speicherzuweisung.
 */
export async function decodeImage(blob: Blob, orientation: number, colorSpace: SourceColorSpace): Promise<DecodedPixels> {
  let firstError: unknown;
  for (const { strategy, rotates } of await probeStrategies()) {
    try {
      const bmp = await strategy.decode(blob);
      if (rotates || orientation === 1) return { pixels: bmp, via: strategy.name };
      const rotated = rotateOnCpu(bmp, orientation, colorSpace);
      bmp.close();
      return { pixels: rotated, via: `${strategy.name}+cpu` };
    } catch (e) {
      firstError ??= e;
    }
  }
  throw firstError ?? new Error('Kein Dekodierweg verfügbar');
}

/** Ziel-Koordinaten je EXIF-Orientierung für Quellpixel (x, y) in einem sw×sh-Bild. */
function mapper(o: number, sw: number, sh: number): (x: number, y: number) => [number, number] {
  switch (o) {
    case 2: return (x, y) => [sw - 1 - x, y];
    case 3: return (x, y) => [sw - 1 - x, sh - 1 - y];
    case 4: return (x, y) => [x, sh - 1 - y];
    case 5: return (x, y) => [y, x];
    case 6: return (x, y) => [sh - 1 - y, x];
    case 7: return (x, y) => [sh - 1 - y, sw - 1 - x];
    case 8: return (x, y) => [y, sw - 1 - x];
    default: return (x, y) => [x, y];
  }
}

/**
 * Notweg: dreht streifenweise in einen RGBA-Puffer. Ein 2D-Canvas in voller Größe wäre auf iOS
 * (max. ~16,7 MP) für 24-MP-Bilder zu groß.
 */
export function rotateOnCpu(
  bmp: ImageBitmap,
  orientation: number,
  colorSpace: SourceColorSpace,
): { data: Uint8Array; width: number; height: number } {
  const sw = bmp.width;
  const sh = bmp.height;
  const swap = orientation >= 5;
  const width = swap ? sh : sw;
  const height = swap ? sw : sh;
  const out = new Uint8Array(width * height * 4);
  const rows = 128;
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { colorSpace, willReadFrequently: true });
  if (!ctx) throw new Error('Kein 2D-Canvas');
  const map = mapper(orientation, sw, sh);
  for (let y0 = 0; y0 < sh; y0 += rows) {
    const h = Math.min(rows, sh - y0);
    ctx.clearRect(0, 0, sw, rows);
    ctx.drawImage(bmp, 0, y0, sw, h, 0, 0, sw, h);
    const src = ctx.getImageData(0, 0, sw, h).data;
    for (let r = 0; r < h; r++) {
      for (let x = 0; x < sw; x++) {
        const [dx, dy] = map(x, y0 + r);
        const s = (r * sw + x) * 4;
        const d = (dy * width + dx) * 4;
        out[d] = src[s];
        out[d + 1] = src[s + 1];
        out[d + 2] = src[s + 2];
        out[d + 3] = src[s + 3];
      }
    }
  }
  canvas.width = canvas.height = 0; // Speicher freigeben (iOS)
  return { data: out, width, height };
}
