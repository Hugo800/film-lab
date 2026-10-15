// JPEG-Segmentebene: Kopfsegmente lesen und APPn-Segmente austauschen.
// Alles hier arbeitet nur bis zum SOS-Marker; die Bilddaten werden nie angefasst.
import type { SourceMetadata } from '../types';
import { ICC_HEADER } from './icc';

const EXIF_ID = [0x45, 0x78, 0x69, 0x66, 0, 0]; // „Exif\0\0“
const XMP_ID = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');

/** Größte Nutzlast eines Segments: 65535 minus das Längenfeld. */
export const MAX_SEGMENT_PAYLOAD = 65533;

export interface JpegSegment {
  marker: number;
  /** Index des 0xFF vor dem Marker. */
  start: number;
  /** Ende (exklusiv), inklusive Längenfeld und Nutzlast. */
  end: number;
}

export interface JpegHead {
  segments: JpegSegment[];
  /** Index des 0xFF von SOS (oder EOI); ab hier beginnen die Bilddaten. */
  scanStart: number;
}

export function isJpeg(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

/** Liest die Segmente zwischen SOI und SOS. null bei kaputter Struktur. */
export function parseJpegHead(b: Uint8Array): JpegHead | null {
  if (!isJpeg(b)) return null;
  const segments: JpegSegment[] = [];
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) return null;
    const marker = b[p + 1];
    if (marker === 0xff) {
      p++; // Füllbyte
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return { segments, scanStart: p };
    // Vor SOS sind nur Segmente mit Längenfeld erlaubt.
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) return null;
    const len = (b[p + 2] << 8) | b[p + 3];
    if (len < 2 || p + 2 + len > b.length) return null;
    segments.push({ marker, start: p, end: p + 2 + len });
    p += 2 + len;
  }
  return null;
}

function startsWith(b: Uint8Array, at: number, end: number, id: ArrayLike<number>): boolean {
  if (end - at < id.length) return false;
  for (let i = 0; i < id.length; i++) if (b[at + i] !== id[i]) return false;
  return true;
}

/** Exif-, XMP- und ICC-Segmente der Quelle (Kopien, ohne Marker und Längenfeld). */
export function extractMetadata(jpeg: Uint8Array): SourceMetadata {
  const meta: SourceMetadata = {};
  const head = parseJpegHead(jpeg);
  if (!head) return meta;
  const icc: Uint8Array[] = [];
  for (const s of head.segments) {
    const at = s.start + 4;
    if (s.marker === 0xe1) {
      if (!meta.exif && startsWith(jpeg, at, s.end, EXIF_ID)) meta.exif = jpeg.slice(at, s.end);
      else if (!meta.xmp && startsWith(jpeg, at, s.end, XMP_ID)) meta.xmp = jpeg.slice(at, s.end);
    } else if (s.marker === 0xe2 && startsWith(jpeg, at, s.end, ICC_HEADER)) {
      icc.push(jpeg.slice(at, s.end));
    }
  }
  if (icc.length) meta.icc = icc;
  return meta;
}

/** Größe aus dem SOF-Segment (unabhängig von EXIF-Orientierung). */
export function readJpegSize(jpeg: Uint8Array): { width: number; height: number } | null {
  const head = parseJpegHead(jpeg);
  if (!head) return null;
  for (const s of head.segments) {
    const m = s.marker;
    // SOF0..SOF15 ohne DHT (C4), JPG (C8), DAC (CC)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && s.end - s.start >= 9) {
      return { height: (jpeg[s.start + 5] << 8) | jpeg[s.start + 6], width: (jpeg[s.start + 7] << 8) | jpeg[s.start + 8] };
    }
  }
  return null;
}

export interface NewSegment {
  marker: number;
  payload: Uint8Array;
}

/**
 * Entfernt alle APPn-Segmente (außer APP14 „Adobe“, das die Farbdeutung der Pixel
 * beeinflusst) und setzt `segments` direkt hinter SOI. Ungültiges JPEG → unverändert.
 */
export function replaceAppSegments(jpeg: Uint8Array, segments: NewSegment[]): Uint8Array {
  const head = parseJpegHead(jpeg);
  if (!head) return jpeg;
  const kept = head.segments.filter((s) => s.marker < 0xe0 || s.marker > 0xef || s.marker === 0xee);
  let total = 2 + (jpeg.length - head.scanStart);
  for (const s of segments) total += 4 + s.payload.length;
  for (const s of kept) total += s.end - s.start;

  const out = new Uint8Array(total);
  out[0] = 0xff;
  out[1] = 0xd8;
  let p = 2;
  for (const s of segments) {
    const len = s.payload.length + 2;
    out[p] = 0xff;
    out[p + 1] = s.marker;
    out[p + 2] = len >> 8;
    out[p + 3] = len & 0xff;
    out.set(s.payload, p + 4);
    p += 4 + s.payload.length;
  }
  for (const s of kept) {
    out.set(jpeg.subarray(s.start, s.end), p);
    p += s.end - s.start;
  }
  out.set(jpeg.subarray(head.scanStart), p);
  return out;
}
