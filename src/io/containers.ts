// Farbprofil-Erkennung für Nicht-JPEG-Quellen (PNG iCCP, WebP ICCP, HEIF colr).
import { unzlibSync } from 'fflate';
import type { SourceColorSpace, SourceMetadata } from '../types';
import { colorSpaceFromProfile, splitIcc } from './icc';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'avif';

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

/** Erkennt das Format an den Magic Bytes. null = unbekannt. */
export function detectFormat(b: Uint8Array): ImageFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp') {
    // Hauptmarke und kompatible Marken prüfen (iPhone: „heic“, manche Tools: „mif1“ + „heic“).
    const end = Math.min(b.length, u32(b, 0));
    const brands = [ascii(b, 8, 4)];
    for (let p = 16; p + 4 <= end; p += 4) brands.push(ascii(b, p, 4));
    if (brands.some((x) => x === 'avif' || x === 'avis')) return 'avif';
    if (brands.some((x) => HEIF_BRANDS.includes(x))) return 'heic';
  }
  return null;
}

export interface ProfileInfo {
  meta: SourceMetadata;
  colorSpace: SourceColorSpace;
}

function fromProfile(profile: Uint8Array | null): ProfileInfo {
  if (!profile || profile.length < 132) return { meta: {}, colorSpace: 'srgb' };
  return { meta: { icc: splitIcc(profile) }, colorSpace: colorSpaceFromProfile(profile) };
}

export function readPngProfile(b: Uint8Array): ProfileInfo {
  let p = 8;
  while (p + 12 <= b.length) {
    const len = u32(b, p);
    const type = ascii(b, p + 4, 4);
    if (type === 'IDAT' || type === 'IEND') break;
    if (type === 'iCCP' && p + 8 + len <= b.length) {
      const data = b.subarray(p + 8, p + 8 + len);
      const nul = data.indexOf(0);
      if (nul < 0 || data[nul + 1] !== 0) break; // nur Kompressionsmethode 0 (zlib) ist definiert
      try {
        return fromProfile(unzlibSync(data.subarray(nul + 2)));
      } catch {
        break;
      }
    }
    p += 12 + len;
  }
  return fromProfile(null);
}

export function readWebpProfile(b: Uint8Array): ProfileInfo {
  let p = 12;
  while (p + 8 <= b.length) {
    const size = (b[p + 4] | (b[p + 5] << 8) | (b[p + 6] << 16) | (b[p + 7] << 24)) >>> 0;
    if (ascii(b, p, 4) === 'ICCP' && p + 8 + size <= b.length) return fromProfile(b.slice(p + 8, p + 8 + size));
    p += 8 + size + (size & 1);
  }
  return fromProfile(null);
}

/** Läuft durch die Boxen in [from, to) und ruft `visit(typ, nutzlastStart, ende)`. */
function boxes(b: Uint8Array, from: number, to: number, visit: (type: string, start: number, end: number) => boolean | void): void {
  let p = from;
  while (p + 8 <= to) {
    let size = u32(b, p);
    let head = 8;
    if (size === 1) {
      if (p + 16 > to) return;
      size = u32(b, p + 12); // obere 32 Bit ignoriert: Boxen > 4 GB gibt es hier nicht
      head = 16;
    } else if (size === 0) {
      size = to - p;
    }
    if (size < head || p + size > to) return;
    if (visit(ascii(b, p + 4, 4), p + head, p + size)) return;
    p += size;
  }
}

/** HEIC/AVIF: erste `colr`-Box in meta/iprp/ipco. 'prof'/'rICC' = ICC-Profil, 'nclx' = Primärfarben-Code. */
export function readHeifProfile(b: Uint8Array): ProfileInfo {
  let result = fromProfile(null);
  boxes(b, 0, b.length, (type, s, e) => {
    if (type !== 'meta') return;
    boxes(b, s + 4, e, (t2, s2, e2) => {
      if (t2 !== 'iprp') return;
      boxes(b, s2, e2, (t3, s3, e3) => {
        if (t3 !== 'ipco') return;
        boxes(b, s3, e3, (t4, s4, e4) => {
          if (t4 !== 'colr' || e4 - s4 < 4) return;
          const kind = ascii(b, s4, 4);
          if (kind === 'prof' || kind === 'rICC') result = fromProfile(b.slice(s4 + 4, e4));
          // Primärfarben 12 = Display P3 (ITU-T H.273); ohne Profil bleibt nur die Kennzeichnung.
          else if (kind === 'nclx' && e4 - s4 >= 6) result = { meta: {}, colorSpace: (b[s4 + 4] << 8 | b[s4 + 5]) === 12 ? 'display-p3' : 'srgb' };
          else return;
          return true;
        });
        return true;
      });
      return true;
    });
    return true;
  });
  return result;
}
