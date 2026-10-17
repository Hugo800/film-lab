// Eigene Rezepte (localStorage), eigene und Original-LUTs (IndexedDB). Alles darf scheitern:
// im privaten Modus oder bei gesperrtem Speicher läuft die App einfach ohne Merken weiter.
import { DEFAULT_PARAMS, type LookParams, type Lut3D } from '../types';

export interface UserPreset {
  id: string;
  name: string;
  /** Basis-Look (eingebaut oder eigene LUT). */
  lookId: string;
  params: LookParams;
}

export interface StoredLut {
  id: string;
  name: string;
  lut: Lut3D;
}

// v2: LookParams der Fuji-Parameter. Daten unter v1 haben ein anderes Format und werden ignoriert.
const PRESET_KEY = 'filmlab.presets.v2';
const USE_OFFICIAL_KEY = 'filmlab.originale.verwenden';
const OBJEKTIV_KEY = 'filmlab.objektivkorrektur';
const DB_NAME = 'filmlab';
const STORE = 'luts';
const OFFICIAL_STORE = 'official';

export function loadPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) 
      ? (list as UserPreset[])
          .filter((p) => p && p.id && p.name && p.lookId && p.params)
          // Stärke aufs Raster des Reglers (1 %-Schritte); ältere Rezepte konnten Zwischenwerte wie 0,85 haben.
          .map((p) => ({ ...p, params: { ...DEFAULT_PARAMS, ...p.params, strength: Math.round((p.params.strength ?? 1) * 50) / 50 } }))
      : [];
  } catch {
    return [];
  }
}

export function savePresets(list: UserPreset[]) {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(list));
  } catch {}
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(OFFICIAL_STORE)) db.createObjectStore(OFFICIAL_STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadStoredLuts(): Promise<StoredLut[]> {
  try {
    const all = await withStore('readonly', (s) => s.getAll() as IDBRequest<StoredLut[]>);
    return all.filter((l) => l?.lut?.data instanceof Float32Array);
  } catch {
    return [];
  }
}

export async function saveStoredLut(lut: StoredLut) {
  try {
    await withStore('readwrite', (s) => s.put(lut));
  } catch {}
}

export async function deleteStoredLut(id: string) {
  try {
    await withStore('readwrite', (s) => s.delete(id));
  } catch {}
}

// --- Fujifilm-Originale: vom Nutzer selbst geladen, bleiben nur in diesem Browser ---

interface StoredOfficial {
  key: string;
  lut: Lut3D;
}

export async function loadOfficialLuts(): Promise<Map<string, Lut3D>> {
  try {
    const all = await withStore('readonly', (s) => s.getAll() as IDBRequest<StoredOfficial[]>, OFFICIAL_STORE);
    return new Map(all.filter((o) => o?.key && o.lut?.data instanceof Float32Array).map((o) => [o.key, o.lut]));
  } catch {
    return new Map();
  }
}

/** Ersetzt den gespeicherten Satz. false = Speicher nicht verfügbar (die Originale gelten dann nur bis zum Neuladen). */
export async function saveOfficialLuts(luts: Map<string, Lut3D>): Promise<boolean> {
  try {
    await withStore('readwrite', (s) => s.clear(), OFFICIAL_STORE);
    for (const [key, lut] of luts) await withStore('readwrite', (s) => s.put({ key, lut } satisfies StoredOfficial), OFFICIAL_STORE);
    return true;
  } catch {
    return false;
  }
}

export async function clearOfficialLuts() {
  try {
    await withStore('readwrite', (s) => s.clear(), OFFICIAL_STORE);
  } catch {}
}

export function loadUseOfficial(): boolean {
  try {
    return localStorage.getItem(USE_OFFICIAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveUseOfficial(on: boolean) {
  try {
    localStorage.setItem(USE_OFFICIAL_KEY, on ? '1' : '0');
  } catch {}
}

/** Objektivkorrektur beim RAW-Import; ohne gespeicherte Wahl aus. */
export function loadObjektivkorrektur(): boolean {
  try {
    return localStorage.getItem(OBJEKTIV_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveObjektivkorrektur(on: boolean) {
  try {
    localStorage.setItem(OBJEKTIV_KEY, on ? '1' : '0');
  } catch {}
}
