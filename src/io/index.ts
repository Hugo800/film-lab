// Ein- und Ausgabe: Dateien laden, JPEG kodieren, Metadaten wieder einsetzen.
import type { SourceColorSpace, SourceImage, SourceMetadata } from '../types';
import {
  detectFormat,
  readHeifProfile,
  readPngProfile,
  readWebpProfile,
  type ImageFormat,
  type ProfileInfo,
} from './containers';
import { decodeImage } from './decode';
import { readOrientation } from './exif';
import { colorSpaceFromIcc } from './icc';
import { extractMetadata } from './jpeg';

export { encodeJpeg } from './encode';
export { withMetadata } from './metadata';

const RAW_EXTENSIONS = /\.(arw|srf|sr2|dng|nef|nrw|cr2|cr3|crw|raf|orf|rw2|pef|srw|3fr|erf|kdc|mrw)$/i;

export function isRawFile(file: File): boolean {
  return RAW_EXTENSIONS.test(file.name) || /^image\/x-[a-z]+-(arw|raw|dng|nef|cr2|raf|orf)$/i.test(file.type);
}

let counter = 0;
function newId(): string {
  // crypto.randomUUID gibt es nur in sicheren Kontexten (nicht per http:// im LAN).
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `img-${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function profileOf(format: ImageFormat, bytes: Uint8Array): { meta: SourceMetadata; colorSpace: SourceColorSpace; orientation: number } {
  if (format === 'jpeg') {
    const meta = extractMetadata(bytes);
    return { meta, colorSpace: colorSpaceFromIcc(meta.icc), orientation: readOrientation(meta.exif) ?? 1 };
  }
  let info: ProfileInfo = { meta: {}, colorSpace: 'srgb' };
  if (format === 'png') info = readPngProfile(bytes);
  else if (format === 'webp') info = readWebpProfile(bytes);
  else info = readHeifProfile(bytes);
  // Orientierung steckt hier im Container; der Browser wendet sie selbst an.
  return { ...info, orientation: 1 };
}

function describeDecodeError(format: ImageFormat, e: unknown): Error {
  const cause = e instanceof Error ? e.message : String(e);
  let text: string;
  if (format === 'heic') {
    text =
      'HEIC kann dieser Browser nicht öffnen. Am iPhone unter Einstellungen > Kamera > Formate „Kompatibelste“ wählen ' +
      'oder das Foto als JPEG exportieren; Safari öffnet HEIC direkt.';
  } else if (format === 'avif') {
    text = 'AVIF kann dieser Browser nicht öffnen. Bitte als JPEG oder PNG exportieren.';
  } else if (/memory|allocat|too large/i.test(cause)) {
    text = 'Das Bild ist zu groß für den verfügbaren Arbeitsspeicher. Andere Tabs schließen oder ein kleineres Bild wählen.';
  } else {
    text = 'Das Bild konnte nicht gelesen werden. Die Datei ist beschädigt oder in diesem Browser nicht darstellbar.';
  }
  return new Error(text, { cause: e });
}

/**
 * Lädt JPEG/PNG/HEIC/WebP (und RAW über ./raw) als aufrecht gedrehte Quelle. `objektivkorrektur` gilt nur für RAW
 * (Sony-ARW: Verzeichnung und Farbsäume wie in der Kamera); ohne Angabe bleibt sie aus.
 */
export async function loadFile(file: File, { objektivkorrektur = false }: { objektivkorrektur?: boolean } = {}): Promise<SourceImage> {
  if (isRawFile(file)) {
    const { decodeRaw } = await import('./raw');
    return decodeRaw(file, { objektivkorrektur });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectFormat(bytes);
  if (!format) {
    throw new Error(
      `„${file.name}“ ist kein unterstütztes Bildformat. Möglich sind JPEG, PNG, HEIC, WebP und RAW (ARW).`,
    );
  }
  const { meta, colorSpace, orientation } = profileOf(format, bytes);
  try {
    const { pixels } = await decodeImage(file, orientation, colorSpace);
    return {
      id: newId(),
      fileName: file.name,
      width: pixels.width,
      height: pixels.height,
      colorSpace,
      pixels,
      meta,
      isRaw: false,
    };
  } catch (e) {
    throw describeDecodeError(format, e);
  }
}
