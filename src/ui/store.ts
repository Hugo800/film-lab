import { create } from 'zustand';
import { type LookParams, type Lut3D } from '../types';
import { builtinEntries, defaultsFor, NONE_ID, registerCustomLut, setOfficialLuts, setOfficialOn, unregisterCustomLut } from './lookRegistry';
import { clearOfficialLuts, deleteStoredLut, savePresets, saveStoredLut, saveUseOfficial, type UserPreset } from './storage';

export interface PhotoSettings {
  lookId: string;
  params: LookParams;
}

export interface Photo {
  id: string;
  /** Das File bleibt im Speicher, die Pixel nur für das aktive Foto. */
  file: File;
  name: string;
  settings: PhotoSettings;
  /** Object-URL des kleinen Filmstreifen-Bildes. */
  thumb: string | null;
}

export interface CustomLut {
  id: string;
  name: string;
  lut: Lut3D;
}

export type Tab = 'looks' | 'anpassen';

export interface SourceState {
  status: 'leer' | 'laden' | 'bereit' | 'fehler';
  photoId: string | null;
  width: number;
  height: number;
  /** Zählt bei jedem neuen Setzen der Quelle in der Engine hoch. */
  version: number;
  error?: string;
}

export interface Notice {
  id: number;
  text: string;
  kind: 'info' | 'fehler';
}

export type ExportScope = 'aktuell' | 'alle';

export interface ExportUi {
  phase: 'zu' | 'wahl' | 'laeuft' | 'fertig';
  scope: ExportScope;
  /** 0..1 über alle Fotos. */
  fraction: number;
  index: number;
  total: number;
  currentName: string;
  errors: string[];
  cancelled: boolean;
  /** Dateinamen und Größen der fertigen Ergebnisse. */
  done: { name: string; bytes: number }[];
}

export const EXPORT_IDLE: ExportUi = {
  phase: 'zu',
  scope: 'aktuell',
  fraction: 0,
  index: 0,
  total: 0,
  currentName: '',
  errors: [],
  cancelled: false,
  done: [],
};

let idCounter = 0;
/** crypto.randomUUID gibt es nur in sicheren Kontexten (nicht über http im WLAN). */
export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function initialSettings(): PhotoSettings {
  const first = builtinEntries()[0];
  const lookId = first ? first.id : NONE_ID;
  return { lookId, params: defaultsFor(lookId) };
}

/** Nimmt Dateien an, die Browser als Bild melden oder die nach RAW/HEIC aussehen. */
export function looksLikeImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|arw|dng|srf|sr2|cr2|cr3|nef|raf|orf|rw2)$/i.test(file.name);
}

interface State {
  photos: Photo[];
  activeId: string | null;
  tab: Tab;
  panelOpen: boolean;
  compare: boolean;
  split: number;
  engineReady: boolean;
  engineError: string | null;
  source: SourceState;
  customLuts: CustomLut[];
  presets: UserPreset[];
  /** Schlüssel der geladenen Fujifilm-Original-LUTs. */
  officialKeys: string[];
  useOfficial: boolean;
  /** Zählt hoch, wenn sich die LUTs hinter den Looks ändern (Originale an/aus/neu): Vorschau und Kacheln rechnen neu. */
  lutEpoch: number;
  /** Look-Kacheln: Schlüssel `${photoId}|${entryId}` → Object-URL ('' = fehlgeschlagen). */
  lookThumbs: Record<string, string>;
  notice: Notice | null;
  export: ExportUi;
  dragging: boolean;

  addFiles(files: File[]): void;
  selectPhoto(id: string): void;
  removePhoto(id: string): void;
  setPhotoThumb(id: string, url: string): void;
  setLook(lookId: string): void;
  applyPreset(preset: UserPreset): void;
  /** Rezept aus Text: Look (falls erkannt) und Parameter auf das aktive Foto. */
  applyRecipe(lookId: string | null, params: Partial<LookParams>): void;
  setParam<K extends keyof LookParams>(key: K, value: LookParams[K]): void;
  resetParam(key: keyof LookParams): void;
  resetAll(): void;
  rollLeak(): void;
  applyToAll(): void;
  addCustomLut(name: string, lut: Lut3D): CustomLut;
  removeCustomLut(id: string): void;
  setCustomLuts(list: CustomLut[]): void;
  addPreset(name: string): void;
  removePreset(id: string): void;
  setPresets(list: UserPreset[]): void;
  setOfficialLuts(luts: Map<string, Lut3D>, use: boolean): void;
  setUseOfficial(use: boolean): void;
  removeOfficialLuts(): void;
  setLookThumb(key: string, url: string): void;
  notify(text: string, kind?: Notice['kind']): void;
  dismissNotice(): void;
  patch(partial: Partial<State>): void;
}

const emptySource: SourceState = { status: 'leer', photoId: null, width: 0, height: 0, version: 0 };

function updateActive(s: State, fn: (cur: PhotoSettings) => PhotoSettings): Partial<State> {
  return { photos: s.photos.map((p) => (p.id === s.activeId ? { ...p, settings: fn(p.settings) } : p)) };
}

let noticeCounter = 0;

export const useStore = create<State>()((set, get) => ({
  photos: [],
  activeId: null,
  tab: 'looks',
  panelOpen: true,
  compare: false,
  split: 0.5,
  engineReady: false,
  engineError: null,
  source: emptySource,
  customLuts: [],
  presets: [],
  officialKeys: [],
  useOfficial: false,
  lutEpoch: 0,
  lookThumbs: {},
  notice: null,
  export: EXPORT_IDLE,
  dragging: false,

  addFiles(files) {
    const accepted = files.filter(looksLikeImage);
    const skipped = files.length - accepted.length;
    if (skipped > 0) get().notify(`${skipped} ${skipped === 1 ? 'Datei ist kein Foto' : 'Dateien sind keine Fotos'} und wurde übersprungen.`, 'fehler');
    if (accepted.length === 0) return;
    const { photos, activeId } = get();
    const base = photos.find((p) => p.id === activeId)?.settings ?? initialSettings();
    const added: Photo[] = accepted.map((file) => ({
      id: newId('p'),
      file,
      name: file.name,
      settings: { lookId: base.lookId, params: { ...base.params } },
      thumb: null,
    }));
    set({ photos: [...photos, ...added], activeId: activeId ?? added[0].id });
  },

  selectPhoto: (id) => set({ activeId: id }),

  removePhoto(id) {
    const { photos, activeId, lookThumbs } = get();
    const idx = photos.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const gone = photos[idx];
    if (gone.thumb) URL.revokeObjectURL(gone.thumb);
    const kept: Record<string, string> = {};
    for (const [key, url] of Object.entries(lookThumbs)) {
      if (key.startsWith(`${id}|`)) {
        if (url) URL.revokeObjectURL(url);
      } else kept[key] = url;
    }
    const rest = photos.filter((p) => p.id !== id);
    const nextActive = activeId === id ? (rest[Math.min(idx, rest.length - 1)]?.id ?? null) : activeId;
    set({ photos: rest, activeId: nextActive, lookThumbs: kept });
  },

  setPhotoThumb(id, url) {
    const photo = get().photos.find((p) => p.id === id);
    if (!photo) {
      URL.revokeObjectURL(url);
      return;
    }
    set({ photos: get().photos.map((p) => (p.id === id ? { ...p, thumb: url } : p)) });
  },

  setLook(lookId) {
    set((s) =>
      updateActive(s, (cur) => ({
        lookId,
        // Der Würfelwurf der Light Leaks bleibt beim Looks-Wechsel erhalten.
        params: { ...defaultsFor(lookId), leakSeed: cur.params.leakSeed },
      })),
    );
  },

  applyPreset(preset) {
    set((s) => updateActive(s, () => ({ lookId: preset.lookId, params: { ...preset.params } })));
  },

  applyRecipe(lookId, params) {
    set((s) =>
      updateActive(s, (cur) => {
        const id = lookId ?? cur.lookId;
        // Was das Rezept nicht nennt, bleibt beim Standard des Looks.
        return { lookId: id, params: { ...defaultsFor(id), ...params, leakSeed: cur.params.leakSeed } };
      }),
    );
  },

  setParam(key, value) {
    set((s) => updateActive(s, (cur) => ({ ...cur, params: { ...cur.params, [key]: value } })));
  },

  resetParam(key) {
    set((s) =>
      updateActive(s, (cur) => ({ ...cur, params: { ...cur.params, [key]: defaultsFor(cur.lookId)[key] } })),
    );
  },

  resetAll() {
    set((s) => updateActive(s, (cur) => ({ ...cur, params: { ...defaultsFor(cur.lookId), leakSeed: cur.params.leakSeed } })));
  },

  rollLeak() {
    set((s) => updateActive(s, (cur) => ({ ...cur, params: { ...cur.params, leakSeed: 1 + Math.floor(Math.random() * 99999) } })));
  },

  applyToAll() {
    const { photos, activeId } = get();
    const cur = photos.find((p) => p.id === activeId)?.settings;
    if (!cur) return;
    set({ photos: photos.map((p) => ({ ...p, settings: { lookId: cur.lookId, params: { ...cur.params } } })) });
    get().notify(photos.length > 1 ? `Einstellungen auf alle ${photos.length} Fotos angewendet.` : 'Nur ein Foto geladen.');
  },

  addCustomLut(name, lut) {
    const entry: CustomLut = { id: newId('lut:'), name, lut };
    registerCustomLut(entry.id, lut);
    set((s) => ({ customLuts: [...s.customLuts, entry] }));
    void saveStoredLut({ id: entry.id, name, lut });
    return entry;
  },

  removeCustomLut(id) {
    unregisterCustomLut(id);
    void deleteStoredLut(id);
    const s = get();
    const thumbs: Record<string, string> = {};
    for (const [key, url] of Object.entries(s.lookThumbs)) {
      if (key.endsWith(`|${id}`)) {
        if (url) URL.revokeObjectURL(url);
      } else thumbs[key] = url;
    }
    const presets = s.presets.filter((p) => p.lookId !== id);
    if (presets.length !== s.presets.length) savePresets(presets);
    set({
      customLuts: s.customLuts.filter((l) => l.id !== id),
      presets,
      lookThumbs: thumbs,
      photos: s.photos.map((p) =>
        p.settings.lookId === id ? { ...p, settings: { lookId: NONE_ID, params: defaultsFor(NONE_ID) } } : p,
      ),
    });
  },

  setCustomLuts: (customLuts) => set({ customLuts }),

  addPreset(name) {
    const { photos, activeId, presets } = get();
    const cur = photos.find((p) => p.id === activeId)?.settings;
    if (!cur) return;
    const preset: UserPreset = { id: newId('preset:'), name, lookId: cur.lookId, params: { ...cur.params } };
    const next = [...presets, preset];
    savePresets(next);
    set({ presets: next, tab: 'looks' });
  },

  removePreset(id) {
    const s = get();
    const next = s.presets.filter((p) => p.id !== id);
    savePresets(next);
    const thumbs: Record<string, string> = {};
    for (const [key, url] of Object.entries(s.lookThumbs)) {
      if (key.endsWith(`|${id}`)) {
        if (url) URL.revokeObjectURL(url);
      } else thumbs[key] = url;
    }
    set({ presets: next, lookThumbs: thumbs });
  },

  setPresets: (presets) => set({ presets }),

  setOfficialLuts(luts, use) {
    setOfficialLuts(luts);
    const on = use && luts.size > 0;
    setOfficialOn(on);
    set({ officialKeys: [...luts.keys()], useOfficial: on });
    refreshThumbs();
  },

  setUseOfficial(use) {
    const on = use && get().officialKeys.length > 0;
    setOfficialOn(on);
    saveUseOfficial(on);
    set({ useOfficial: on });
    refreshThumbs();
  },

  removeOfficialLuts() {
    setOfficialLuts(new Map());
    setOfficialOn(false);
    saveUseOfficial(false);
    void clearOfficialLuts();
    set({ officialKeys: [], useOfficial: false });
    refreshThumbs();
  },

  setLookThumb(key, url) {
    const photoId = key.split('|')[0];
    if (!get().photos.some((p) => p.id === photoId)) {
      if (url) URL.revokeObjectURL(url);
      return;
    }
    set((s) => ({ lookThumbs: { ...s.lookThumbs, [key]: url } }));
  },

  notify(text, kind = 'info') {
    set({ notice: { id: ++noticeCounter, text, kind } });
  },

  dismissNotice: () => set({ notice: null }),

  patch: (partial) => set(partial),
}));

/** Kacheln verwerfen und neu rechnen lassen, wenn sich LUTs hinter den Looks ändern. */
function refreshThumbs() {
  const { lookThumbs, lutEpoch } = useStore.getState();
  for (const url of Object.values(lookThumbs)) if (url) URL.revokeObjectURL(url);
  useStore.setState({ lookThumbs: {}, lutEpoch: lutEpoch + 1 });
}

export function activePhoto(s: Pick<State, 'photos' | 'activeId'>): Photo | undefined {
  return s.photos.find((p) => p.id === s.activeId);
}
