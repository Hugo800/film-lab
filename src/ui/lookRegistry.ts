// Einheitliche Sicht auf eingebaute Looks, eigene LUTs und „Ohne“.
import { LOOKS } from '../looks';
import { DEFAULT_PARAMS, type LookCategory, type LookParams, type Lut3D } from '../types';

export const NONE_ID = 'none';

export type EntryCategory = LookCategory | 'ohne';

export interface LookEntry {
  id: string;
  name: string;
  description: string;
  category: EntryCategory;
}

export const CATEGORY_ORDER: LookCategory[] = ['farbe', 'diafilm', 'kino', 'schwarzweiss', 'eigene'];

export const CATEGORY_LABELS: Record<EntryCategory, string> = {
  ohne: 'Original',
  farbe: 'Farbe',
  diafilm: 'Dia',
  kino: 'Kino',
  schwarzweiss: 'Schwarzweiß',
  eigene: 'Eigene',
};

const builtinLuts = new Map<string, Lut3D>();
const customLuts = new Map<string, Lut3D>();

export function registerCustomLut(id: string, lut: Lut3D) {
  customLuts.set(id, lut);
}

export function unregisterCustomLut(id: string) {
  customLuts.delete(id);
}

export const NONE_ENTRY: LookEntry = {
  id: NONE_ID,
  name: 'Ohne',
  description: 'Keine LUT – nur Belichtung, Farbe und Effekte.',
  category: 'ohne',
};

export function builtinEntries(): LookEntry[] {
  return LOOKS.map((l) => ({ id: l.id, name: l.name, description: l.description, category: l.category }));
}

/** Die LUT zu einer Look-Id; null bei „Ohne“ oder unbekannter Id. buildLut läuft nur einmal je Look. */
export function lutFor(id: string): Lut3D | null {
  if (id === NONE_ID) return null;
  const custom = customLuts.get(id);
  if (custom) return custom;
  const cached = builtinLuts.get(id);
  if (cached) return cached;
  const look = LOOKS.find((l) => l.id === id);
  if (!look) return null;
  const lut = look.buildLut();
  builtinLuts.set(id, lut);
  return lut;
}

/** Look-Standardwerte; eigene LUTs und „Ohne“ starten bei DEFAULT_PARAMS. */
export function defaultsFor(id: string): LookParams {
  const look = LOOKS.find((l) => l.id === id);
  return { ...DEFAULT_PARAMS, ...look?.defaults };
}
