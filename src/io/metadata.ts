import type { SourceMetadata } from '../types';
import { patchExif } from './exif';
import { MAX_SEGMENT_PAYLOAD, replaceAppSegments, type NewSegment } from './jpeg';
import { normalizeIcc } from './icc';
import { patchXmp } from './xmp';

/**
 * Ersetzt die APPn-Segmente des frisch kodierten JPEGs durch Exif/XMP/ICC der Quelle
 * (Orientation=1, neue Pixelmaße). Unbrauchbare Teile werden weggelassen, nie kaputt geschrieben.
 */
export function withMetadata(jpeg: Uint8Array, meta: SourceMetadata, size: { width: number; height: number }): Uint8Array {
  const segments: NewSegment[] = [];
  const add = (marker: number, make: () => Uint8Array | undefined) => {
    try {
      const payload = make();
      if (payload && payload.length <= MAX_SEGMENT_PAYLOAD) segments.push({ marker, payload });
    } catch {
      // Segment unlesbar → weglassen.
    }
  };
  add(0xe1, () => meta.exif && patchExif(meta.exif, size));
  add(0xe1, () => meta.xmp && patchXmp(meta.xmp, size));
  for (const part of normalizeIcc(meta.icc)) add(0xe2, () => part);
  return replaceAppSegments(jpeg, segments);
}
