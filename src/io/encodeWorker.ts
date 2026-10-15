// Web Worker: RGBA → JPEG mit mozjpeg (WASM). Läuft einmal pro Auftrag und wird danach beendet,
// damit der WASM-Speicher (wächst, schrumpft nie) wieder freigegeben wird.
import encode, { init } from '@jsquash/jpeg/encode';
import wasmUrl from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';

export interface EncodeRequest {
  rgba: ArrayBuffer;
  width: number;
  height: number;
  quality: number;
}

export type EncodeResponse = { jpeg: ArrayBuffer } | { error: string };

self.onmessage = async (ev: MessageEvent<EncodeRequest>) => {
  const { rgba, width, height, quality } = ev.data;
  try {
    // Binärdatei selbst holen statt Emscripten die URL aus import.meta.url bauen zu lassen:
    // gilt gleich im Dev-Server und im Build, und ein falscher MIME-Typ stört nicht.
    const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
    await init({ wasmBinary } as Parameters<typeof init>[0]);
    // Das Paket erwartet ImageData; im Worker reichen die drei Felder.
    const image = { data: new Uint8ClampedArray(rgba), width, height } as unknown as ImageData;
    // Baseline statt progressiv: etwa ein Drittel schneller bei 24 MP, ~6 % größer, überall lesbar.
    const jpeg = await encode(image, { quality, progressive: false });
    (self as unknown as Worker).postMessage({ jpeg } satisfies EncodeResponse, [jpeg]);
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) } satisfies EncodeResponse);
  }
};
