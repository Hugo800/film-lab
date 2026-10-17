// Startseite unter BASE_URL, Editor unter BASE_URL + „lab“. Kein Router: History-API und ein Abo für
// useSyncExternalStore. Die Fotos liegen im Store und bleiben beim Wechsel zwischen beiden Seiten erhalten.
import { useSyncExternalStore } from 'react';

const BASE = import.meta.env.BASE_URL;
const EDITOR = `${BASE}lab`;

/** Gehört der Pfad zum Editor? „/lab“ und „/lab/“. */
export function istEditorPfad(pfad: string, base = BASE): boolean {
  return pfad === `${base}lab` || pfad === `${base}lab/`;
}

const abos = new Set<() => void>();
const melden = () => abos.forEach((f) => f());

function abonnieren(f: () => void) {
  if (abos.size === 0) window.addEventListener('popstate', melden);
  abos.add(f);
  return () => {
    abos.delete(f);
    if (abos.size === 0) window.removeEventListener('popstate', melden);
  };
}

const imEditor = () => istEditorPfad(location.pathname);

export function useImEditor(): boolean {
  return useSyncExternalStore(abonnieren, imEditor);
}

export function zumEditor() {
  if (imEditor()) return;
  history.pushState(null, '', EDITOR);
  melden();
}

export function zurStartseite() {
  if (location.pathname === BASE) return;
  history.pushState(null, '', BASE);
  melden();
}

export const START_URL = BASE;
