// Platzhalter – wird vom IO-Modul ersetzt.
import type { SourceImage, SourceMetadata } from '../types';

export async function loadFile(_file: File): Promise<SourceImage> {
  throw new Error('loadFile: noch nicht implementiert');
}

export async function encodeJpeg(
  _rgba: Uint8Array,
  _width: number,
  _height: number,
  _quality: number,
): Promise<Uint8Array> {
  throw new Error('encodeJpeg: noch nicht implementiert');
}

export function withMetadata(
  jpeg: Uint8Array,
  _meta: SourceMetadata,
  _size: { width: number; height: number },
): Uint8Array {
  return jpeg;
}

export function isRawFile(file: File): boolean {
  return /\.(arw|srf|sr2|dng|nef|cr2|cr3|raf|orf|rw2)$/i.test(file.name);
}
