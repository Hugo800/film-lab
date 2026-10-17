// Seiten nach Adresse: Startseite unter BASE_URL, schlichte Upload-Seite für die App auf dem Homescreen unter „app“,
// Editor unter „lab“. Andere Pfade landen auf der Startseite. Kein Router: History-API und ein Abo für
// useSyncExternalStore. Die Fotos liegen im Store und bleiben beim Wechsel zwischen den Seiten erhalten.
import { useSyncExternalStore } from 'react';
import { isStandalone } from './persist';

const BASE = import.meta.env.BASE_URL;

export type Seite = 'start' | 'app' | 'editor';

const PFAD: Record<Seite, string> = { start: BASE, app: `${BASE}app`, editor: `${BASE}lab` };

/** Seite zu einem Pfad; null = unbekannt. „/lab/“ und „/app/“ zählen mit. */
export function seiteVon(pfad: string, base = BASE): Seite | null {
  if (pfad === base || pfad === `${base}index.html`) return 'start';
  const rest = pfad.startsWith(base) ? pfad.slice(base.length).replace(/\/$/, '') : '';
  return rest === 'lab' ? 'editor' : rest === 'app' ? 'app' : null;
}

/** Unbekannte Pfade → Startseite, „/lab/“ → „/lab“ usw.: Adresse ersetzen, ohne neuen Verlaufseintrag. */
export function adresseBereinigen() {
  const s = seiteVon(location.pathname);
  if (s === null) history.replaceState(null, '', PFAD.start);
  else if (location.pathname !== PFAD[s]) history.replaceState(history.state, '', PFAD[s] + location.search + location.hash);
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

const aktuell = (): Seite => seiteVon(location.pathname) ?? 'start';

export function useSeite(): Seite {
  return useSyncExternalStore(abonnieren, aktuell);
}

function gehe(s: Seite) {
  if (aktuell() === s) return;
  history.pushState(null, '', PFAD[s]);
  melden();
}

export const zumEditor = () => gehe('editor');

/** Zuhause: in der App auf dem Homescreen die Upload-Seite, im Browser die Startseite. */
const heim = (): Seite => (isStandalone() ? 'app' : 'start');
export const heimUrl = () => PFAD[heim()];
export const nachHause = () => gehe(heim());
