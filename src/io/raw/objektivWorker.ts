// Web Worker: Objektivkorrektur eines Streifens der RAW-Entwicklung (siehe objektiv.ts). Ein Auftrag je Worker; danach
// wird er beendet, der Speicher des Ausschnitts ist damit wieder frei.
import { entzerren, type Abbildung } from './objektiv';
import type { Area } from './pixels';

export interface StreifenAuftrag {
  /** RGB-Zeilen der Quelle ab Zeile `ab` (verschoben, nicht kopiert). */
  rgb: ArrayBuffer;
  breite: number;
  hoehe: number;
  ab: number;
  flaeche: Area;
  abb: Abbildung;
  zeilen: [number, number];
}

export type StreifenAntwort = { rgba: ArrayBuffer } | { fehler: string };

self.onmessage = (ev: MessageEvent<StreifenAuftrag>) => {
  const { rgb, breite, hoehe, ab, flaeche, abb, zeilen } = ev.data;
  try {
    const rgba = entzerren({ data: new Uint8Array(rgb), breite, hoehe, kanaele: 3, ab }, flaeche, abb, zeilen);
    const buffer = rgba.buffer as ArrayBuffer;
    (self as unknown as Worker).postMessage({ rgba: buffer } satisfies StreifenAntwort, [buffer]);
  } catch (e) {
    self.postMessage({ fehler: e instanceof Error ? e.message : String(e) } satisfies StreifenAntwort);
  }
};
