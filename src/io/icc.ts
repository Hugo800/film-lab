// ICC-Profile: in APP2-Teile zerlegen, wieder zusammensetzen, Farbraum erkennen.
import type { SourceColorSpace } from '../types';

/** „ICC_PROFILE\0“ + laufende Nummer + Gesamtzahl der Teile. */
export const ICC_HEADER = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0];
const HEADER_LEN = ICC_HEADER.length + 2;
/** Nutzlast eines APP2-Segments minus Kennung (14 Byte). */
const CHUNK = 65533 - HEADER_LEN;

function hasHeader(part: Uint8Array): boolean {
  if (part.length <= HEADER_LEN) return false;
  for (let i = 0; i < ICC_HEADER.length; i++) if (part[i] !== ICC_HEADER[i]) return false;
  return true;
}

/** Setzt die Teile in der gegebenen Reihenfolge zu einem Profil zusammen; null bei Unstimmigkeit. */
export function joinIcc(parts: Uint8Array[]): Uint8Array | null {
  if (!parts.length || parts.length > 255 || !parts.every(hasHeader)) return null;
  const profile = new Uint8Array(parts.reduce((n, p) => n + p.length - HEADER_LEN, 0));
  let at = 0;
  for (const p of parts) {
    profile.set(p.subarray(HEADER_LEN), at);
    at += p.length - HEADER_LEN;
  }
  // Profilkopf: erste 4 Byte = Gesamtlänge. Länger als vorhanden = abgeschnitten.
  const declared = new DataView(profile.buffer).getUint32(0);
  return profile.length >= 128 && declared <= profile.length ? profile : null;
}

/** Zerlegt ein Profil in APP2-Nutzlasten (mit Kennung und Nummerierung). */
export function splitIcc(profile: Uint8Array): Uint8Array[] {
  const n = Math.ceil(profile.length / CHUNK);
  if (n === 0 || n > 255) return [];
  const parts: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const data = profile.subarray(i * CHUNK, (i + 1) * CHUNK);
    const part = new Uint8Array(HEADER_LEN + data.length);
    part.set(ICC_HEADER);
    part[ICC_HEADER.length] = i + 1;
    part[ICC_HEADER.length + 1] = n;
    part.set(data, HEADER_LEN);
    parts.push(part);
  }
  return parts;
}

/** Prüft und nummeriert neu. Kaputtes Profil → leere Liste (lieber kein Profil als ein falsches). */
export function normalizeIcc(parts: Uint8Array[] | undefined): Uint8Array[] {
  const profile = parts && joinIcc(parts);
  return profile ? splitIcc(profile) : [];
}

function tag(profile: Uint8Array, sig: string): Uint8Array | null {
  const v = new DataView(profile.buffer, profile.byteOffset, profile.byteLength);
  if (profile.length < 132) return null;
  const count = v.getUint32(128);
  for (let i = 0; i < count && 132 + i * 12 + 12 <= profile.length; i++) {
    const at = 132 + i * 12;
    const name = String.fromCharCode(profile[at], profile[at + 1], profile[at + 2], profile[at + 3]);
    if (name !== sig) continue;
    const off = v.getUint32(at + 4);
    const size = v.getUint32(at + 8);
    return off + size <= profile.length ? profile.subarray(off, off + size) : null;
  }
  return null;
}

/** Beschreibungstext des Profils ('desc' v2 oder 'mluc' v4), leer wenn nicht lesbar. */
export function iccDescription(profile: Uint8Array): string {
  const t = tag(profile, 'desc');
  if (!t || t.length < 12) return '';
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const type = String.fromCharCode(t[0], t[1], t[2], t[3]);
  if (type === 'desc') {
    const n = v.getUint32(8); // inkl. abschließender 0
    return n > 0 && 12 + n <= t.length ? new TextDecoder('latin1').decode(t.subarray(12, 12 + n - 1)) : '';
  }
  if (type === 'mluc') {
    if (t.length < 28 || v.getUint32(8) < 1) return '';
    const len = v.getUint32(20);
    const off = v.getUint32(24);
    if (off + len > t.length) return '';
    let s = '';
    for (let i = 0; i + 1 < len; i += 2) s += String.fromCharCode(v.getUint16(off + i));
    return s;
  }
  return '';
}

/** „Display P3“ → 'display-p3', alles andere gilt als sRGB. */
export function colorSpaceFromProfile(profile: Uint8Array): SourceColorSpace {
  return /display\s*p3|\bp3\b/i.test(iccDescription(profile)) ? 'display-p3' : 'srgb';
}

export function colorSpaceFromIcc(parts: Uint8Array[] | undefined): SourceColorSpace {
  const profile = parts && joinIcc(parts);
  return profile ? colorSpaceFromProfile(profile) : 'srgb';
}
