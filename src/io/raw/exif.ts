// Minimaler Exif-Schreiber: "Exif\0\0" + TIFF (Little-Endian) mit IFD0 und Exif-IFD.
// Genau die Felder, die für ein exportiertes Foto sinnvoll sind – kein allgemeiner TIFF-Writer.

export interface ExifFields {
  make?: string;
  model?: string;
  /** Aufnahmezeit als Wanduhrzeit der Kamera, in den lokalen Feldern des Date (die Kamera kennt keine Zeitzone). */
  dateTime?: Date;
  /** Sekunden. */
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  /** Millimeter. */
  focalLength?: number;
  lensModel?: string;
}

const ASCII = 2;
const SHORT = 3;
const LONG = 4;
const RATIONAL = 5;

interface Entry {
  tag: number;
  type: number;
  count: number;
  bytes: Uint8Array;
}

function ascii(tag: number, text: string): Entry {
  // Exif-ASCII ist 7-Bit, nullterminiert; alles andere wird zu '?'.
  const bytes = new Uint8Array(text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    bytes[i] = c >= 0x20 && c < 0x7f ? c : 0x3f;
  }
  return { tag, type: ASCII, count: bytes.length, bytes };
}

function u16(tag: number, value: number): Entry {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return { tag, type: SHORT, count: 1, bytes };
}

function rational(tag: number, numerator: number, denominator: number): Entry {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, numerator, true);
  view.setUint32(4, denominator, true);
  return { tag, type: RATIONAL, count: 1, bytes };
}

/** Belichtungszeit als Bruch: kurze Zeiten als 1/N (wie Kameras), lange mit einer Nachkommastelle. */
function exposureRational(seconds: number): [number, number] {
  if (seconds < 1) return [1, Math.round(1 / seconds)];
  return [Math.round(seconds * 10), 10];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatExifDate(d: Date): string {
  return (
    `${String(d.getFullYear()).padStart(4, '0')}:${pad2(d.getMonth() + 1)}:${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

const isNum = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isText = (v: string | undefined): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Liefert den Inhalt eines EXIF-APP1-Segments (ohne Marker und Längenfeld).
 * Orientation ist immer 1 (die RAW-Pixel sind bereits aufrecht), ColorSpace immer 1 (sRGB).
 */
export function buildExif(fields: ExifFields): Uint8Array {
  const ifd0: Entry[] = [];
  const exif: Entry[] = [];
  const validDate = fields.dateTime && !Number.isNaN(fields.dateTime.getTime()) ? fields.dateTime : undefined;

  if (isText(fields.make)) ifd0.push(ascii(0x010f, fields.make.trim()));
  if (isText(fields.model)) ifd0.push(ascii(0x0110, fields.model.trim()));
  ifd0.push(u16(0x0112, 1));
  if (validDate) ifd0.push(ascii(0x0132, formatExifDate(validDate)));
  // Zeigerwert (Offset des Exif-IFD) wird unten eingesetzt.
  const pointer: Entry = { tag: 0x8769, type: LONG, count: 1, bytes: new Uint8Array(4) };
  ifd0.push(pointer);

  if (isNum(fields.exposureTime)) exif.push(rational(0x829a, ...exposureRational(fields.exposureTime)));
  if (isNum(fields.fNumber)) exif.push(rational(0x829d, Math.round(fields.fNumber * 10), 10));
  if (isNum(fields.iso)) exif.push(u16(0x8827, Math.min(65535, Math.round(fields.iso))));
  if (validDate) exif.push(ascii(0x9003, formatExifDate(validDate)));
  if (isNum(fields.focalLength)) exif.push(rational(0x920a, Math.round(fields.focalLength * 10), 10));
  exif.push(u16(0xa001, 1));
  if (isText(fields.lensModel)) exif.push(ascii(0xa434, fields.lensModel.trim()));

  const ifdSize = (list: Entry[]) => 2 + list.length * 12 + 4;
  const exifIfdOffset = 8 + ifdSize(ifd0);
  new DataView(pointer.bytes.buffer).setUint32(0, exifIfdOffset, true);

  // Werte über 4 Byte kommen hinter beide IFDs, auf gerade Adressen.
  let dataOffset = exifIfdOffset + ifdSize(exif);
  const offsets = new Map<Entry, number>();
  for (const e of [...ifd0, ...exif]) {
    if (e.bytes.length > 4) {
      offsets.set(e, dataOffset);
      dataOffset += e.bytes.length + (e.bytes.length & 1);
    }
  }

  const tiff = new Uint8Array(dataOffset);
  const view = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49], 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);

  const writeIfd = (list: Entry[], at: number) => {
    // Einträge müssen nach Tag aufsteigend stehen.
    const sorted = [...list].sort((a, b) => a.tag - b.tag);
    view.setUint16(at, sorted.length, true);
    sorted.forEach((e, i) => {
      const p = at + 2 + i * 12;
      view.setUint16(p, e.tag, true);
      view.setUint16(p + 2, e.type, true);
      view.setUint32(p + 4, e.count, true);
      const external = offsets.get(e);
      if (external === undefined) {
        tiff.set(e.bytes, p + 8);
      } else {
        view.setUint32(p + 8, external, true);
        tiff.set(e.bytes, external);
      }
    });
    // Nächster IFD: keiner (Offset 0) – das Feld bleibt durch new Uint8Array bereits 0.
  };
  writeIfd(ifd0, 8);
  writeIfd(exif, exifIfdOffset);

  const out = new Uint8Array(6 + tiff.length);
  out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 0);
  out.set(tiff, 6);
  return out;
}
