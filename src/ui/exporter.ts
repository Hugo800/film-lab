// Export: Foto für Foto laden → Engine → freigeben. Die Ergebnisse bleiben als Blobs hier,
// der Zustand kennt nur Namen und Größen.
import { loadFile } from '../io';
import { EXPORT_IDLE, useStore, type ExportScope } from './store';
import { exportNames } from './names';
import { lutFor } from './lookRegistry';
import { closeSource, describeError, getEngine, getSourceFor } from './session';
import { buildZip } from './zip';

const QUALITY = 92;

interface Result {
  name: string;
  blob: Blob;
}

let results: Result[] = [];
// Vorab gepackt, damit „Herunterladen“ synchron aus dem Klick laufen kann (Safari verlangt die Geste).
let zipBlob: Blob | null = null;
let abort: AbortController | null = null;

const setExport = (partial: Partial<typeof EXPORT_IDLE>) =>
  useStore.setState((s) => ({ export: { ...s.export, ...partial } }));

export function openExport() {
  const { photos } = useStore.getState();
  if (photos.length === 0) return;
  results = [];
  zipBlob = null;
  useStore.setState({ export: { ...EXPORT_IDLE, phase: 'wahl', scope: photos.length > 1 ? 'alle' : 'aktuell' } });
  if (photos.length === 1) void startExport('aktuell');
}

export function closeExport() {
  if (useStore.getState().export.phase === 'laeuft') return;
  results = [];
  zipBlob = null;
  useStore.setState({ export: EXPORT_IDLE });
}

export function cancelExport() {
  abort?.abort();
}

export function setScope(scope: ExportScope) {
  setExport({ scope });
}

export async function startExport(scope: ExportScope) {
  const state = useStore.getState();
  const list = scope === 'alle' ? state.photos : state.photos.filter((p) => p.id === state.activeId);
  if (list.length === 0) return;
  const names = exportNames(list.map((p) => p.name));
  const engine = getEngine();
  results = [];
  zipBlob = null;
  abort = new AbortController();
  const { signal } = abort;
  const errors: string[] = [];
  const pageTitle = document.title;
  setExport({ phase: 'laeuft', scope, fraction: 0, index: 0, total: list.length, errors: [], cancelled: false, done: [] });

  for (let i = 0; i < list.length; i++) {
    if (signal.aborted) break;
    const photo = list[i];
    setExport({ index: i, currentName: photo.name, fraction: i / list.length });
    document.title = `Export ${i + 1}/${list.length} – Film Lab`;
    // Das aktive Foto liegt schon dekodiert vor; alle anderen werden nur für ihren Export geladen.
    let src = getSourceFor(photo.id);
    const own = !src;
    try {
      if (!engine) throw new Error('Die Bildverarbeitung ist nicht verfügbar.');
      src ??= await loadFile(photo.file);
      const blob = await engine.exportJpeg(src, lutFor(photo.settings.lookId), photo.settings.params, {
        quality: QUALITY,
        signal,
        onProgress: (f) => setExport({ fraction: (i + Math.min(1, Math.max(0, f))) / list.length }),
      });
      results.push({ name: names[i], blob });
    } catch (err) {
      if (signal.aborted) break;
      errors.push(`${photo.name}: ${describeError(err)}`);
    } finally {
      if (own) closeSource(src);
    }
  }

  abort = null;
  document.title = pageTitle;
  if (results.length > 1) {
    try {
      zipBlob = await buildZip(results);
    } catch (err) {
      errors.push(`ZIP: ${describeError(err)}`);
    }
  }
  setExport({
    phase: 'fertig',
    fraction: signal.aborted ? useStore.getState().export.fraction : 1,
    cancelled: signal.aborted,
    errors,
    done: results.map((r) => ({ name: r.name, bytes: r.blob.size })),
  });
  // Am PC reicht der Download; am Handy braucht share() eine frische Geste (Knopf im Dialog).
  if (!signal.aborted && results.length > 0 && !isTouchPrimary()) download();
}

export function isTouchPrimary(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function isIos(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function toFiles(): File[] {
  return results.map((r) => new File([r.blob], r.name, { type: 'image/jpeg' }));
}

export function canShareResults(): boolean {
  if (results.length === 0 || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: toFiles() });
  } catch {
    return false;
  }
}

/** Muss direkt aus dem Klick-Handler laufen: vor share() darf nichts Asynchrones passieren. */
export async function shareResults() {
  const notify = useStore.getState().notify;
  try {
    await navigator.share({ files: toFiles() });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    notify(`Teilen hat nicht geklappt (${describeError(err)}). Lade die Datei stattdessen herunter.`, 'fehler');
  }
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function download() {
  if (results.length === 1) saveBlob(results[0].blob, results[0].name);
  else if (zipBlob) saveBlob(zipBlob, 'filmlab_export.zip');
  else if (results.length > 1) results.forEach((r) => saveBlob(r.blob, r.name));
}
