// RAW-Dekodierung (Sony .ARW u. a.) mit libraw-wasm. Wird von src/io per dynamischem import()
// geladen, damit die 1,4-MB-WASM nur bei Bedarf übertragen wird.
import LibRaw, { type LibRawSettings } from 'libraw-wasm';
import type { SourceImage } from '../../types';
import { buildExif } from './exif';
import { activeArea, rgbToRgba } from './pixels';

/**
 * Kamera-Weißabgleich, sRGB, 8 Bit, AHD-Demosaic. Die Orientierung aus der RAW (userFlip -1) wendet
 * libraw schon beim Dekodieren an, das Ergebnis ist aufrecht.
 *
 * Helligkeit: feste Belichtungsanhebung (+1,3 EV) mit Highlight-Schutz statt der automatischen
 * Aufhellung von libraw. Die klemmt ~1 % der Pixel auf Weiß und hängt vom Bildinhalt ab; so
 * wirken die Looks bei allen Bildern gleich und die Lichter bleiben erhalten. `gamm` setzt die
 * Bibliothek nicht um, die Tonkurve ist deshalb die vorgegebene (BT.709, praktisch sRGB).
 */
const SETTINGS: LibRawSettings = {
  useCameraWb: true,
  outputColor: 1,
  outputBps: 8,
  userFlip: -1,
  userQual: 3,
  noAutoBright: true,
  expCorrec: true,
  expShift: 2.5,
  expPreser: 1,
};

function newId(): string {
  // crypto.randomUUID gibt es nur in sicheren Kontexten (nicht per http:// im LAN).
  return `raw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function decodeRaw(file: File): Promise<SourceImage> {
  const raw = new LibRaw();
  try {
    // Der Puffer wird an den Worker übergeben (transferiert), nicht kopiert.
    await raw.open(new Uint8Array(await file.arrayBuffer()), SETTINGS);
    const meta = await raw.metadata(true);
    const image = await raw.imageData();
    if (!image || image.bits !== 8 || image.colors !== 3 || !(image.data instanceof Uint8Array)) {
      throw new Error('RAW-Datei konnte nicht dekodiert werden.');
    }
    if (image.data.length < image.width * image.height * 3) {
      throw new Error('RAW-Dekodierung lieferte zu wenige Pixel.');
    }
    const area = activeArea(meta?.raw_inset_crops?.[0], image.width, image.height);
    const { width, height } = area;
    const data = rgbToRgba(image.data, image.width, area);
    return {
      id: newId(),
      fileName: file.name,
      width,
      height,
      colorSpace: 'srgb',
      pixels: { data, width, height },
      meta: {
        exif: buildExif({
          make: meta?.camera_make,
          model: meta?.camera_model,
          // libraw wandelt die Kamerazeit per mktime in Ortszeit; lokale Felder geben die Wanduhrzeit zurück.
          dateTime: meta?.timestamp,
          exposureTime: meta?.shutter,
          fNumber: meta?.aperture,
          iso: meta?.iso_speed,
          focalLength: meta?.focal_len,
          lensModel: meta?.lens?.Lens || meta?.lens?.makernotes?.Lens,
        }),
      },
      isRaw: true,
    };
  } catch (e) {
    throw new Error(`RAW-Datei „${file.name}“ konnte nicht gelesen werden: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    // Gibt Worker und WASM-Speicher (mehrere hundert MB bei 24 MP) frei.
    raw.dispose();
  }
}
