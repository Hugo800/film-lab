// Fujifilm-Original-LUTs, die der Nutzer selbst bei Fujifilm lädt: ZIP/.cube einlesen, in sRGB-LUTs umrechnen
// (src/looks), im Browser speichern. Nichts davon wird mitgeliefert oder hochgeladen.
import { unzipSync } from 'fflate';
import { buildOfficialLuts } from '../looks';
import type { Lut3D } from '../types';
import { describeError } from './session';
import { saveOfficialLuts } from './storage';

export const FUJI_LUT_PAGE = 'https://www.fujifilm-x.com/support/download/lut/';

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Liest die Dateien (ZIP wird entpackt; die 65er-Würfel bleiben liegen, sie sind groß und unnötig). */
async function readFiles(files: File[]): Promise<{ name: string; data: Uint8Array }[]> {
  const out: { name: string; data: Uint8Array }[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.zip$/i.test(file.name)) {
      const entries = unzipSync(bytes, { filter: (f) => /\.cube$/i.test(f.name) && !/65/.test(f.name) });
      for (const [path, data] of Object.entries(entries)) out.push({ name: baseName(path), data });
    } else if (/\.cube$/i.test(file.name)) out.push({ name: file.name, data: bytes });
  }
  return out;
}

export interface ImportResult {
  luts: Map<string, Lut3D>;
  /** false = konnte nicht dauerhaft gespeichert werden. */
  stored: boolean;
}

/** Wirft mit verständlichem Text, wenn nichts Brauchbares dabei ist. */
export async function importOfficialLuts(files: File[], onProgress: (fraction: number, text: string) => void): Promise<ImportResult> {
  onProgress(0, 'Dateien werden gelesen …');
  let list: { name: string; data: Uint8Array }[];
  try {
    list = await readFiles(files);
  } catch (err) {
    throw new Error(`Die Datei lässt sich nicht öffnen (${describeError(err)}).`);
  }
  if (list.length === 0) throw new Error('Keine .cube-Dateien gefunden. Gesucht ist das ZIP-Paket der F-Log2-LUTs (z. B. „GFX ETERNA 55“) oder einzelne .cube-Dateien.');
  onProgress(0.05, `${list.length} LUT-Dateien werden umgerechnet …`);
  const luts = await buildOfficialLuts(list, (f) => onProgress(0.05 + 0.95 * Math.min(1, Math.max(0, f)), `${list.length} LUT-Dateien werden umgerechnet …`));
  if (luts.size === 0) throw new Error('Aus diesen Dateien ließ sich keine Fujifilm-Simulation gewinnen. Passt das Paket (F-Log2, 33er-Würfel)?');
  return { luts, stored: await saveOfficialLuts(luts) };
}
