// Verbindet Engine und das eine aktive Foto. Nur dieses Foto liegt in voller Auflösung
// im Speicher; beim Wechsel wird das ImageBitmap des alten Fotos freigegeben.
import { createEngine } from '../engine';
import { loadFile } from '../io';
import type { Engine, SourceImage } from '../types';
import { useStore, type Photo } from './store';

let engine: Engine | null = null;
let source: SourceImage | null = null;
let sourcePhotoId: string | null = null;
let pendingId: string | null = null;
let token = 0;

export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function closeSource(src: SourceImage | null) {
  if (src && typeof ImageBitmap !== 'undefined' && src.pixels instanceof ImageBitmap) src.pixels.close();
}

export function getEngine(): Engine | null {
  return engine;
}

/** Die geladene Quelle, falls sie zu diesem Foto gehört (spart beim Export das erneute Dekodieren). */
export function getSourceFor(photoId: string): SourceImage | null {
  return sourcePhotoId === photoId ? source : null;
}

function feedEngine(): boolean {
  if (!engine || !source) return true;
  try {
    engine.setSource(source);
    return true;
  } catch (err) {
    useStore.getState().patch({
      source: { ...useStore.getState().source, status: 'fehler', error: `Vorschau nicht möglich: ${describeError(err)}` },
    });
    return false;
  }
}

/** Erzeugt die Engine in einem frischen Canvas. Fehler (z. B. kein WebGL2) landen im Zustand. */
export function startEngine(canvas: HTMLCanvasElement): () => void {
  let created: Engine | null = null;
  try {
    created = createEngine(canvas);
  } catch (err) {
    useStore.getState().patch({ engineReady: false, engineError: describeError(err) });
    return () => {};
  }
  engine = created;
  useStore.getState().patch({ engineReady: true, engineError: null });
  if (source && feedEngine()) {
    const s = useStore.getState().source;
    useStore.getState().patch({ source: { ...s, version: s.version + 1 } });
  }
  return () => {
    if (engine === created) engine = null;
    useStore.getState().patch({ engineReady: false });
    try {
      created?.dispose();
    } catch {}
  };
}

/** Lädt das Foto und reicht es an die Engine weiter. Veraltete Ladevorgänge werden verworfen. */
export async function openPhoto(photo: Photo | null) {
  const set = useStore.getState().patch;
  if (!photo) {
    token++;
    pendingId = null;
    closeSource(source);
    source = null;
    sourcePhotoId = null;
    set({ source: { status: 'leer', photoId: null, width: 0, height: 0, version: useStore.getState().source.version } });
    return;
  }
  if (photo.id === pendingId) return;
  if (photo.id === sourcePhotoId && source) {
    // Zurück zum bereits geladenen Foto (z. B. nach einem Ladefehler beim Nachbarn).
    token++;
    pendingId = null;
    const cur = useStore.getState().source;
    if (cur.status !== 'bereit' || cur.photoId !== photo.id) {
      set({ source: { status: 'bereit', photoId: photo.id, width: source.width, height: source.height, version: cur.version + 1 } });
    }
    return;
  }
  const mine = ++token;
  pendingId = photo.id;
  const prev = useStore.getState().source;
  set({ source: { ...prev, status: 'laden', photoId: photo.id, error: undefined } });
  let loaded: SourceImage;
  try {
    loaded = await loadFile(photo.file);
  } catch (err) {
    if (mine !== token) return;
    pendingId = null;
    set({
      source: { ...prev, status: 'fehler', photoId: photo.id, error: `„${photo.name}“ konnte nicht geladen werden: ${describeError(err)}` },
    });
    return;
  }
  if (mine !== token) {
    closeSource(loaded);
    return;
  }
  const old = source;
  source = loaded;
  sourcePhotoId = photo.id;
  pendingId = null;
  const ok = feedEngine();
  // Erst nach setSource schließen: die Engine hat dann das neue Bild und braucht das alte nicht mehr.
  closeSource(old);
  if (!ok) return;
  const cur = useStore.getState().source;
  set({
    source: { status: 'bereit', photoId: photo.id, width: loaded.width, height: loaded.height, version: cur.version + 1 },
  });
}
