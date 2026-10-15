// Eigene Presets (localStorage) und eigene LUTs (IndexedDB). Alles darf scheitern:
// im privaten Modus oder bei gesperrtem Speicher läuft die App einfach ohne Merken weiter.
import type { LookParams, Lut3D } from '../types';

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

const PRESET_KEY = 'filmlab.presets.v1';
const DB_NAME = 'filmlab';
const STORE = 'luts';

export function loadPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as UserPreset[]).filter((p) => p && p.id && p.name && p.params) : [];
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
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
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
