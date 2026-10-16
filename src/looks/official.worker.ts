// Web Worker für buildOfficialLuts: rechnet die Fujifilm-LUTs ohne die Oberfläche zu blockieren.
import { convertOfficial, type OfficialFile } from './official';

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<OfficialFile[]>) => void) | null;
  postMessage(msg: unknown, transfer?: Transferable[]): void;
};

ctx.onmessage = (e) => {
  try {
    const map = convertOfficial(e.data, (progress) => ctx.postMessage({ progress }));
    const result = [...map.entries()];
    ctx.postMessage({ result }, result.map(([, lut]) => lut.data.buffer as ArrayBuffer));
  } catch (err) {
    ctx.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};
