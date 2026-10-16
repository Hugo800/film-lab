// Einheitliche Sicht auf eingebaute Looks, eigene LUTs, „Ohne“ und die vom Nutzer geladenen Fujifilm-Originale.
import { LOOKS } from '../looks';
import { DEFAULT_PARAMS, type FilmLook, type LookCategory, type LookParams, type Lut3D } from '../types';

export const NONE_ID = 'none';

export type EntryCategory = LookCategory | 'ohne';

export interface LookEntry {
  id: string;
  name: string;
  description: string;
  category: EntryCategory;
  monochrome: boolean;
  /** Schlüssel der Fujifilm-Original-LUT dieses Looks oder seiner Basis. */
  officialKey?: string;
}

export const CATEGORY_ORDER: LookCategory[] = ['fujifilm', 'leica', 'kodak', 'eigene'];

export const CATEGORY_LABELS: Record<EntryCategory, string> = {
  ohne: 'Original',
  fujifilm: 'Fujifilm',
  leica: 'Leica',
  kodak: 'Kodak',
  eigene: 'Eigene',
};

export const TRADEMARK_NOTE =
  'Nachempfundene Looks. Fujifilm, Leica und Kodak sind Marken ihrer Inhaber; Film Lab steht in keiner Verbindung zu ihnen.';

const builtinLuts = new Map<string, Lut3D>();
const customLuts = new Map<string, Lut3D>();
let officialLuts = new Map<string, Lut3D>();
let useOfficial = false;

export function registerCustomLut(id: string, lut: Lut3D) {
  customLuts.set(id, lut);
}

export function unregisterCustomLut(id: string) {
  customLuts.delete(id);
}

export function setOfficialLuts(luts: Map<string, Lut3D>) {
  officialLuts = luts;
}

export function setOfficialOn(on: boolean) {
  useOfficial = on;
}

export const NONE_ENTRY: LookEntry = {
  id: NONE_ID,
  name: 'Ohne',
  description: 'Keine LUT – nur Belichtung, Farbe und Effekte.',
  category: 'ohne',
  monochrome: false,
};

function lookById(id: string): FilmLook | undefined {
  return LOOKS.find((l) => l.id === id);
}

/** Schlüssel der Original-LUT: eigener, sonst der der Basis (Rezepte). */
function officialKeyOf(look: FilmLook | undefined, depth = 0): string | undefined {
  if (!look || depth > 4) return undefined;
  return look.officialKey ?? officialKeyOf(look.baseLookId ? lookById(look.baseLookId) : undefined, depth + 1);
}

function monochromeOf(look: FilmLook | undefined, depth = 0): boolean {
  if (!look || depth > 4) return false;
  return look.monochrome ?? monochromeOf(look.baseLookId ? lookById(look.baseLookId) : undefined, depth + 1) ?? false;
}

export function builtinEntries(): LookEntry[] {
  return LOOKS.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    category: l.category,
    monochrome: monochromeOf(l),
    officialKey: officialKeyOf(l),
  }));
}

/** SW-Look? (Rezepte zählen über ihre Basis; eigene LUTs und „Ohne“ nie.) */
export function isMonochrome(id: string): boolean {
  return monochromeOf(lookById(id));
}

/** Die Original-LUT zu dieser Look-Id, falls geladen und eingeschaltet. */
export function activeOfficialLut(id: string): Lut3D | null {
  if (!useOfficial) return null;
  const key = officialKeyOf(lookById(id));
  return (key && officialLuts.get(key)) || null;
}

/** Die LUT zu einer Look-Id; null bei „Ohne“ oder unbekannter Id. buildLut läuft nur einmal je Look. */
export function lutFor(id: string): Lut3D | null {
  if (id === NONE_ID) return null;
  const custom = customLuts.get(id);
  if (custom) return custom;
  const official = activeOfficialLut(id);
  if (official) return official;
  const cached = builtinLuts.get(id);
  if (cached) return cached;
  const look = lookById(id);
  if (!look) return null;
  const lut = look.buildLut();
  builtinLuts.set(id, lut);
  return lut;
}

/** Look-Standardwerte; eigene LUTs und „Ohne“ starten bei DEFAULT_PARAMS. */
export function defaultsFor(id: string): LookParams {
  return { ...DEFAULT_PARAMS, ...lookById(id)?.defaults };
}
