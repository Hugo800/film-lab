import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { BeispielId, Werkstatt } from './werkstatt';

export const WerkstattContext = createContext<Werkstatt | null>(null);

/** Wird `true`, sobald das Element (mit Vorlauf `margin`) in Sicht kommt, und bleibt es. */
export function useInView<T extends Element>(margin = '0px') {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    // Wurzel ist der scrollende <main>: sonst schneidet dessen Rand alles ab, und der Vorlauf (rootMargin) wirkt nicht.
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), {
      root: el.closest('main'),
      rootMargin: margin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen] as const;
}

export type Rendered = { url: string | null; error: boolean };

/** Beispielfoto mit Look, live gerechnet; `enabled` = erst anstoßen, wenn sichtbar. */
export function useRendered(photo: BeispielId, look: string, edge: number, prio: number, enabled: boolean): Rendered {
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
