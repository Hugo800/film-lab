// Exif-Patch für den Export: Orientation=1, neue Pixelmaße, keine alte Vorschau.
// Arbeitet auf einer Kopie und wirft bei jeder Unstimmigkeit (Aufrufer lässt das Segment dann weg).

const PREFIX = 6; // „Exif\0\0“
const TAG_IMAGE_WIDTH = 0x0100;
const TAG_IMAGE_LENGTH = 0x0101;
const TAG_ORIENTATION = 0x0112;
const TAG_EXIF_IFD = 0x8769;
const TAG_PIXEL_X = 0xa002;
const TAG_PIXEL_Y = 0xa003;
const TAG_THUMB_OFFSET = 0x0201;
const TAG_THUMB_LENGTH = 0x0202;

const SHORT = 3;
const LONG = 4;
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 };

interface Entry {
  tag: number;
  type: number;
  count: number;
  /** Position des Wertfelds (letzte 4 Byte des Eintrags), relativ zum TIFF-Anfang. */
  valueAt: number;
}

interface Ifd {
  start: number;
  end: number;
  entries: Entry[];
  next: number;
  nextAt: number;
}

class Tiff {
  readonly v: DataView;
  readonly le: boolean;
  readonly length: number;

  constructor(readonly bytes: Uint8Array) {
    this.v = new DataView(bytes.buffer, bytes.byteOffset + PREFIX, bytes.byteLength - PREFIX);
    this.length = bytes.length - PREFIX;
    if (this.length < 8) throw new Error('Exif zu kurz');
    const order = String.fromCharCode(this.v.getUint8(0), this.v.getUint8(1));
    if (order !== 'II' && order !== 'MM') throw new Error('Exif: Byteorder unbekannt');
    this.le = order === 'II';
    if (this.v.getUint16(2, this.le) !== 42) throw new Error('Exif: TIFF-Kennung falsch');
  }

  u16(at: number): number {
    return this.v.getUint16(at, this.le);
  }
  u32(at: number): number {
    return this.v.getUint32(at, this.le);
  }

  ifd(start: number): Ifd {
    if (start < 8 || start + 2 > this.length) throw new Error('Exif: IFD außerhalb');
    const n = this.u16(start);
    const nextAt = start + 2 + n * 12;
    if (nextAt + 4 > this.length) throw new Error('Exif: IFD abgeschnitten');
    const entries: Entry[] = [];
    for (let i = 0; i < n; i++) {
      const at = start + 2 + i * 12;
      entries.push({ tag: this.u16(at), type: this.u16(at + 2), count: this.u32(at + 4), valueAt: at + 8 });
    }
    return { start, end: nextAt + 4, entries, next: this.u32(nextAt), nextAt };
  }

  /** Wert eines Einzelwert-SHORT/LONG-Eintrags. */
  scalar(e: Entry): number {
    if (e.count !== 1 || (e.type !== SHORT && e.type !== LONG)) throw new Error(`Exif: Tag ${e.tag} unerwartet`);
    return e.type === SHORT ? this.u16(e.valueAt) : this.u32(e.valueAt);
  }

  /** Schreibt den Wert an Ort und Stelle; ein SHORT wird bei Bedarf zu LONG (passt in dieselben 4 Byte). */
  setScalar(e: Entry, value: number): void {
    this.scalar(e); // prüft Typ und Anzahl
    if (e.type === SHORT && value <= 0xffff) {
      this.v.setUint16(e.valueAt, value, this.le);
    } else {
      this.v.setUint16(e.valueAt - 6, LONG, this.le);
      this.v.setUint32(e.valueAt, value, this.le);
    }
  }
}

function checkPrefix(exif: Uint8Array): void {
  const id = [0x45, 0x78, 0x69, 0x66, 0, 0];
  if (exif.length < PREFIX + 8 || id.some((b, i) => exif[i] !== b)) throw new Error('Exif: Kennung fehlt');
}

/** Orientation (1..8) aus dem Exif-Segment, undefined wenn nicht vorhanden oder unlesbar. */
export function readOrientation(exif: Uint8Array | undefined): number | undefined {
  if (!exif) return undefined;
  try {
    checkPrefix(exif);
    const t = new Tiff(exif);
    const e = t.ifd(t.u32(4)).entries.find((x) => x.tag === TAG_ORIENTATION);
    const o = e && t.scalar(e);
    return o !== undefined && o >= 1 && o <= 8 ? o : undefined;
  } catch {
    return undefined;
  }
}

type Range = [number, number];
const overlaps = (a: Range, b: Range) => a[0] < b[1] && b[0] < a[1];

/** Bereiche der Datenwerte, die nicht ins Wertfeld passen (> 4 Byte). */
function valueRanges(t: Tiff, ifd: Ifd): Range[] {
  const out: Range[] = [];
  for (const e of ifd.entries) {
    const size = (TYPE_SIZE[e.type] ?? 0) * e.count;
    if (size > 4) out.push([t.u32(e.valueAt), t.u32(e.valueAt) + size]);
  }
  return out;
}

/** Nullt die Bytes der alten Vorschau in IFD1, sofern sie nichts anderes überdecken. */
function wipeThumbnail(t: Tiff, ifd1: Ifd, protectedRanges: Range[]): void {
  const off = ifd1.entries.find((e) => e.tag === TAG_THUMB_OFFSET);
  const len = ifd1.entries.find((e) => e.tag === TAG_THUMB_LENGTH);
  if (!off || !len) return;
  const range: Range = [t.scalar(off), t.scalar(off) + t.scalar(len)];
  if (range[0] < 8 || range[1] > t.length || range[1] <= range[0]) return;
  if (protectedRanges.some((r) => overlaps(r, range)) || overlaps([ifd1.start, ifd1.end], range)) return;
  t.bytes.fill(0, PREFIX + range[0], PREFIX + range[1]);
}

/**
 * Liefert eine gepatchte Kopie: IFD0 Orientation=1, ImageWidth/Length und ExifIFD
 * PixelX/YDimension = neue Maße (falls vorhanden), IFD1 samt Vorschaubild entkoppelt.
 * Wirft bei kaputter Struktur.
 */
export function patchExif(exif: Uint8Array, size: { width: number; height: number }): Uint8Array {
  checkPrefix(exif);
  const copy = exif.slice();
  const t = new Tiff(copy);
  const ifd0 = t.ifd(t.u32(4));
  const prot: Range[] = [[0, 8], [ifd0.start, ifd0.end], ...valueRanges(t, ifd0)];

  let exifIfd: Ifd | undefined;
  for (const e of ifd0.entries) {
    if (e.tag === TAG_ORIENTATION) t.setScalar(e, 1);
    else if (e.tag === TAG_IMAGE_WIDTH) t.setScalar(e, size.width);
    else if (e.tag === TAG_IMAGE_LENGTH) t.setScalar(e, size.height);
    else if (e.tag === TAG_EXIF_IFD && e.type === LONG && e.count === 1) exifIfd = t.ifd(t.u32(e.valueAt));
  }
  if (exifIfd) {
    prot.push([exifIfd.start, exifIfd.end], ...valueRanges(t, exifIfd));
    for (const e of exifIfd.entries) {
      if (e.tag === TAG_PIXEL_X) t.setScalar(e, size.width);
      else if (e.tag === TAG_PIXEL_Y) t.setScalar(e, size.height);
    }
  }
  if (ifd0.next !== 0) {
    let ifd1: Ifd | undefined;
    try {
      ifd1 = t.ifd(ifd0.next);
    } catch {
      // IFD1 unlesbar: Zeiger kappen reicht, das Vorschaubild bleibt unadressiert.
    }
    if (ifd1) wipeThumbnail(t, ifd1, prot);
    t.v.setUint32(ifd0.nextAt, 0, t.le);
  }
  return copy;
}

/** Minimales Exif mit nur Orientation (Little Endian) – für den Orientierungs-Test des Browsers. */
export function makeOrientationExif(orientation: number): Uint8Array {
  const b = new Uint8Array(PREFIX + 8 + 2 + 12 + 4);
  b.set([0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 42, 0, 8, 0, 0, 0]);
  const v = new DataView(b.buffer);
  const at = PREFIX + 8;
  v.setUint16(at, 1, true);
  v.setUint16(at + 2, TAG_ORIENTATION, true);
  v.setUint16(at + 4, SHORT, true);
  v.setUint32(at + 6, 1, true);
  v.setUint16(at + 10, orientation, true);
  return b;
}
