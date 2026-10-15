import { describe, expect, it } from 'vitest';
import { buildExif, formatExifDate } from './exif';

// Unabhängiger Leser, bewusst nicht aus dem Schreiber abgeleitet.
interface Parsed {
  [tag: number]: string | number | [number, number];
}

const SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };

function readIfd(view: DataView, tiff: Uint8Array, at: number): { values: Parsed; next: number; tags: number[] } {
  const n = view.getUint16(at, true);
  const values: Parsed = {};
  const tags: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = at + 2 + i * 12;
    const tag = view.getUint16(p, true);
    const type = view.getUint16(p + 2, true);
    const count = view.getUint32(p + 4, true);
    const bytes = SIZE[type] * count;
    const start = bytes <= 4 ? p + 8 : view.getUint32(p + 8, true);
    if (bytes > 4) expect(start % 2).toBe(0);
    expect(start + bytes).toBeLessThanOrEqual(tiff.length);
    tags.push(tag);
    if (type === 2) {
      expect(tiff[start + count - 1]).toBe(0);
      values[tag] = String.fromCharCode(...tiff.subarray(start, start + count - 1));
    } else if (type === 3) {
      values[tag] = view.getUint16(start, true);
    } else if (type === 4) {
      values[tag] = view.getUint32(start, true);
    } else if (type === 5) {
      values[tag] = [view.getUint32(start, true), view.getUint32(start + 4, true)];
    }
  }
  return { values, next: view.getUint32(at + 2 + n * 12, true), tags };
}

function parse(exif: Uint8Array) {
  expect(Array.from(exif.subarray(0, 6))).toEqual([0x45, 0x78, 0x69, 0x66, 0, 0]);
  const tiff = exif.subarray(6);
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  expect(String.fromCharCode(tiff[0], tiff[1])).toBe('II');
  expect(view.getUint16(2, true)).toBe(42);
  const ifd0 = readIfd(view, tiff, view.getUint32(4, true));
  expect(ifd0.next).toBe(0);
  const exifPtr = ifd0.values[0x8769] as number;
  const sub = readIfd(view, tiff, exifPtr);
  expect(sub.next).toBe(0);
  return { ifd0, sub };
}

describe('buildExif', () => {
  const full = buildExif({
    make: 'SONY',
    model: 'ILCE-6000',
    dateTime: new Date(2017, 9, 14, 12, 47, 29),
    exposureTime: 1 / 250,
    fNumber: 5.6,
    iso: 100,
    focalLength: 35,
    lensModel: 'E 35mm F1.8 OSS',
  });

  it('schreibt alle Felder lesbar', () => {
    const { ifd0, sub } = parse(full);
    expect(ifd0.values[0x010f]).toBe('SONY');
    expect(ifd0.values[0x0110]).toBe('ILCE-6000');
    expect(ifd0.values[0x0112]).toBe(1);
    expect(ifd0.values[0x0132]).toBe('2017:10:14 12:47:29');
    expect(sub.values[0x829a]).toEqual([1, 250]);
    expect(sub.values[0x829d]).toEqual([56, 10]);
    expect(sub.values[0x8827]).toBe(100);
    expect(sub.values[0x9003]).toBe('2017:10:14 12:47:29');
    expect(sub.values[0x920a]).toEqual([350, 10]);
    expect(sub.values[0xa001]).toBe(1);
    expect(sub.values[0xa434]).toBe('E 35mm F1.8 OSS');
  });

  it('sortiert die Tags aufsteigend', () => {
    const { ifd0, sub } = parse(full);
    for (const tags of [ifd0.tags, sub.tags]) {
      expect(tags).toEqual([...tags].sort((a, b) => a - b));
    }
  });

  it('lässt fehlende Felder weg, behält aber Orientation und ColorSpace', () => {
    const { ifd0, sub } = parse(buildExif({}));
    expect(ifd0.tags).toEqual([0x0112, 0x8769]);
    expect(sub.tags).toEqual([0xa001]);
  });

  it('ignoriert leere, ungültige und nicht positive Werte', () => {
    const { ifd0, sub } = parse(
      buildExif({ make: '  ', model: '', dateTime: new Date(NaN), exposureTime: 0, fNumber: NaN, iso: -1, focalLength: 0, lensModel: '' }),
    );
    expect(ifd0.tags).toEqual([0x0112, 0x8769]);
    expect(sub.tags).toEqual([0xa001]);
  });

  it('kurze Texte (bis 4 Byte inkl. Nullbyte) liegen im Eintrag selbst', () => {
    const { ifd0 } = parse(buildExif({ make: 'ABC' }));
    expect(ifd0.values[0x010f]).toBe('ABC');
  });

  it('ersetzt Nicht-ASCII durch ?', () => {
    const { ifd0 } = parse(buildExif({ model: 'Kamera Ä' }));
    expect(ifd0.values[0x0110]).toBe('Kamera ?');
  });

  it('lange Belichtungszeiten mit Nachkommastelle', () => {
    const { sub } = parse(buildExif({ exposureTime: 2.5 }));
    expect(sub.values[0x829a]).toEqual([25, 10]);
  });

  it('Belichtungszeit 1/4000 und ISO über 16 Bit', () => {
    const { sub } = parse(buildExif({ exposureTime: 1 / 4000, iso: 100000 }));
    expect(sub.values[0x829a]).toEqual([1, 4000]);
    expect(sub.values[0x8827]).toBe(65535);
  });
});

describe('formatExifDate', () => {
  it('nimmt die lokalen Felder, nullgefüllt', () => {
    expect(formatExifDate(new Date(2018, 0, 2, 3, 4, 5))).toBe('2018:01:02 03:04:05');
  });
});
