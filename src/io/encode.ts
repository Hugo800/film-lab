import type { EncodeRequest, EncodeResponse } from './encodeWorker';

/** Emscripten meldet Speichermangel roh („Aborted(OOM)“, „Cannot enlarge memory arrays“ …); das wird verständlich. */
export function encodeErrorMessage(raw: string): string {
  if (/\bOOM\b|enlarge memory|out of memory|memory access out of bounds|allocation failed|invalid array length|bad_alloc/i.test(raw)) {
    return 'Das Foto ist zu groß für den Export in diesem Browser.';
  }
  return `JPEG-Kodierung fehlgeschlagen: ${raw}`;
}

/** RGBA8 (width*height*4) → JPEG. `rgba.buffer` wird in den Worker verschoben und ist danach leer. */
export function encodeJpeg(rgba: Uint8Array, width: number, height: number, quality: number): Promise<Uint8Array> {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return Promise.reject(new Error(`Ungültige Bildgröße ${width}×${height}`));
  }
  if (rgba.length !== width * height * 4) {
    return Promise.reject(new Error(`RGBA-Puffer hat ${rgba.length} Byte, erwartet ${width * height * 4}`));
  }
  // Nur ein eigener, ganzer Puffer lässt sich verschieben; ein Ausschnitt wird kopiert.
  const whole = rgba.byteOffset === 0 && rgba.byteLength === rgba.buffer.byteLength && rgba.buffer instanceof ArrayBuffer;
  const buffer = whole ? (rgba.buffer as ArrayBuffer) : rgba.slice().buffer;

  const worker = new Worker(new URL('./encodeWorker.ts', import.meta.url), { type: 'module' });
  return new Promise<Uint8Array>((resolve, reject) => {
    worker.onmessage = (ev: MessageEvent<EncodeResponse>) => {
      worker.terminate();
      if ('error' in ev.data) reject(new Error(encodeErrorMessage(ev.data.error)));
      else resolve(new Uint8Array(ev.data.jpeg));
    };
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(encodeErrorMessage(ev.message || 'Worker konnte nicht starten')));
    };
    const q = Math.min(100, Math.max(1, Math.round(quality)));
    const req: EncodeRequest = { rgba: buffer, width, height, quality: q };
    worker.postMessage(req, [buffer]);
  });
}
