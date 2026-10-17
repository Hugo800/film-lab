import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { foto, type BeispielId, type Fassung, type Foto, type Werkstatt } from './werkstatt';

export const WerkstattContext = createContext<Werkstatt | null>(null);

/**
 * Wird `true`, sobald das Element (mit Vorlauf `margin`) in Sicht kommt, und bleibt es; mit `bleibt = false` folgt
 * der Wert der aktuellen Sichtbarkeit (wieder `false`, wenn das Element außer Sicht ist).
 */
export function useInView<T extends Element>(margin = '0px', bleibt = true) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  const fertig = bleibt && seen;
  useEffect(() => {
    const el = ref.current;
    if (!el || fertig) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setSeen((s) => (bleibt && s) || entries.at(-1)!.isIntersecting), {
      rootMargin: margin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [fertig, margin, bleibt]);
  return [ref, seen] as const;
}

/**
 * Hochkante Fotos, solange die Bildrahmen hochkant sind: Handy hochkant (unter sm sind Vergleich und Look-Rad 4:5,
 * darüber 3:2 – ein Tablet hochkant bekäme sonst nur einen schmalen Streifen eines Hochkantfotos).
 */
const HOCH = '(orientation: portrait) and (width < 40rem)';

let hochMq: MediaQueryList | null = null;
const hoch = () => (hochMq ??= matchMedia(HOCH));
function fassungAbo(onChange: () => void) {
  hoch().addEventListener('change', onChange);
  return () => hoch().removeEventListener('change', onChange);
}
const fassungJetzt = (): Fassung => (hoch().matches ? 'hoch' : 'quer');

/** Fassung der Beispielfotos für diesen Bildschirm; wechselt live beim Drehen. */
export function useFassung(): Fassung {
  return useSyncExternalStore(fassungAbo, fassungJetzt, () => 'quer');
}

/** Beispielfoto `id` in der Fassung dieses Bildschirms. */
export function useFoto(id: BeispielId): Foto {
  return foto(id, useFassung());
}

export type Rendered = { url: string | null; error: boolean };

/** Beispielfoto mit Look, live gerechnet; `enabled` = erst anstoßen, wenn sichtbar. */
export function useRendered(photo: Foto, look: string, edge: number, prio: number, enabled: boolean): Rendered {
  const werkstatt = useContext(WerkstattContext);
  const key = `${photo}|${look}|${edge}`;
  const [state, setState] = useState<{ key: string; url: string | null; error: boolean }>({ key: '', url: null, error: false });
  useEffect(() => {
    if (!enabled || !werkstatt) return;
    const job = werkstatt.request(photo, look, edge, prio);
    let live = true;
    job.promise.then(
      (url) => live && setState({ key, url, error: false }),
      () => live && setState({ key, url: null, error: true }),
    );
    return () => {
      live = false;
      job.cancel();
    };
  }, [werkstatt, photo, look, edge, prio, enabled, key]);
  return state.key === key ? { url: state.url, error: state.error } : { url: null, error: false };
}
