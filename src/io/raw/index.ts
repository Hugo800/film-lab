// RAW-Dekodierung (Sony .ARW u. a.) mit libraw-wasm. Wird von src/io per dynamischem import()
// geladen, damit die 1,4-MB-WASM nur bei Bedarf übertragen wird.
import LibRaw, { type LibRawSettings } from 'libraw-wasm';
import type { SourceImage } from '../../types';
import { buildExif } from './exif';
import { leseObjektivkorrektur, objektivAbbildung, streifen, type Objektivkorrektur } from './objektiv';
import type { StreifenAntwort, StreifenAuftrag } from './objektivWorker';
import { activeArea, rgbToRgba, type Area } from './pixels';

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

/** Höchstens so viele Worker für die Objektivkorrektur (je einer rechnet einen Streifen; jeder kostet Speicher). */
const MAX_WORKER = 4;

/** Einen Streifen in einem eigenen Worker entzerren. */
function streifenImWorker(auftrag: StreifenAuftrag): { promise: Promise<Uint8Array>; worker: Worker } {
  const worker = new Worker(new URL('./objektivWorker.ts', import.meta.url), { type: 'module' });
  const promise = new Promise<Uint8Array>((resolve, reject) => {
    worker.onmessage = (ev: MessageEvent<StreifenAntwort>) => {
      if ('fehler' in ev.data) reject(new Error(`Objektivkorrektur fehlgeschlagen: ${ev.data.fehler}`));
      else resolve(new Uint8Array(ev.data.rgba));
    };
    worker.onerror = (ev) => reject(new Error(`Objektivkorrektur fehlgeschlagen: ${ev.message || 'Worker konnte nicht starten'}`));
    worker.postMessage(auftrag, [auftrag.rgb]);
  });
  return { promise, worker };
}

/**
 * Wie rgbToRgba, aber mit Objektivkorrektur (Verzeichnung, Farbsäume) wie in der Kamera. Rechnet in Streifen
 * parallel: bikubisch kostet bei 24 MP in einem Worker 4–5 s, mit vier ≈ 1,2–1,6 s (Desktop-Chrome). Jeder Worker
 * bekommt nur die Quellzeilen seines Streifens, der letzte den ganzen Puffer (verschoben, nicht kopiert); `rgb` ist
 * danach unbrauchbar. Die Speicherspitze bleibt die von libraw (die ist vorher schon beendet).
 */
async function rgbToRgbaEntzerrt(rgb: Uint8Array, breite: number, hoehe: number, area: Area, korrektur: Objektivkorrektur): Promise<Uint8Array> {
  const abb = objektivAbbildung(korrektur, area.width, area.height);
  const teile = Math.max(1, Math.min(MAX_WORKER, (navigator.hardwareConcurrency || 2) - 1));
  const plan = streifen(abb, area, hoehe, teile);
  const zeile = breite * 3;
  const ganz = rgb.byteOffset === 0 && rgb.byteLength === rgb.buffer.byteLength && rgb.buffer instanceof ArrayBuffer;
  const jobs = plan.map((p, i) => {
    const letzter = i === plan.length - 1;
    const daten = letzter ? (ganz ? (rgb.buffer as ArrayBuffer) : rgb.slice().buffer) : rgb.slice(p.quelle[0] * zeile, p.quelle[1] * zeile).buffer;
    return streifenImWorker({ rgb: daten, breite, hoehe, ab: letzter ? 0 : p.quelle[0], flaeche: area, abb, zeilen: p.zeilen });
  });
  try {
    const teilbilder = await Promise.all(jobs.map((j) => j.promise));
    const out = new Uint8Array(area.width * area.height * 4);
    plan.forEach((p, i) => out.set(teilbilder[i], p.zeilen[0] * area.width * 4));
    return out;
  } finally {
    for (const j of jobs) j.worker.terminate();
  }
}

/**
 * `objektivkorrektur: false` lässt Verzeichnung und Farbsäume, wie libraw sie liefert (für Vergleiche und die
 * Beispielfotos, die mit derselben Korrektur, aber zusätzlich gedreht entstehen).
 */
export async function decodeRaw(file: File, { objektivkorrektur = true }: { objektivkorrektur?: boolean } = {}): Promise<SourceImage> {
  const raw = new LibRaw();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Vor open() lesen: der Puffer wird an den Worker übergeben (transferiert), nicht kopiert.
    const korrektur = objektivkorrektur ? leseObjektivkorrektur(bytes) : null;
    await raw.open(bytes, SETTINGS);
    const meta = await raw.metadata(true);
    const image = await raw.imageData();
    // Worker und WASM-Speicher gleich freigeben, nicht erst nach der Objektivkorrektur (Spitze bei 24 MP).
    raw.dispose();
    if (!image || image.bits !== 8 || image.colors !== 3 || !(image.data instanceof Uint8Array)) {
      throw new Error('RAW-Datei konnte nicht dekodiert werden.');
    }
    if (image.data.length < image.width * image.height * 3) {
      throw new Error('RAW-Dekodierung lieferte zu wenige Pixel.');
    }
    const area = activeArea(meta?.raw_inset_crops?.[0], image.width, image.height);
    const { width, height } = area;
    const data = korrektur
      ? await rgbToRgbaEntzerrt(image.data, image.width, image.height, area, korrektur)
      : rgbToRgba(image.data, image.width, area);
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
