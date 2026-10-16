import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ClipboardPaste, ScrollText } from 'lucide-react';
import { Spinner } from '../controls';
import { useFoto, useInView, useRendered } from './hooks';
import { BEISPIEL_LOOK, BEISPIEL_REZEPT } from './rezept';
import { Einblenden, Kopf } from './teile';
import { angaben, beispielUrl, GROSS } from './werkstatt';

const FOTO = 'garten';
/** Am Handy so viele Rezeptzeilen sofort, der Rest aufklappbar. */
const KURZ = 6;

export function RezeptBeispiel() {
  const [ref, near] = useInView<HTMLElement>('300px 0px');
  const foto = useFoto(FOTO);
  // In voller Größe der Seitenfassung: ein Hochkantfoto (9:16) im 4:5-Rahmen am Handy braucht die ganze Breite.
  const { url, error } = useRendered(foto, BEISPIEL_LOOK, GROSS, 2, near);
  const [held, setHeld] = useState(false);
  const timer = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const { label, pos } = angaben(foto);
  const [title, ...rows] = BEISPIEL_REZEPT.split('\n');

  useEffect(() => () => clearTimeout(timer.current), []);

  // Gedrückt halten zeigt das Original. Touch erst nach kurzer Ruhe (wie die Kacheln): wer die Seite mit dem Finger
  // auf dem Bild anschiebt, soll kein Aufblitzen sehen.
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) setHeld(true);
      return;
    }
    clearTimeout(timer.current);
    start.current = { x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => setHeld(true), 140);
  };
  const onMove = (e: PointerEvent) => {
    const s = start.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) release();
  };
  const release = () => {
    clearTimeout(timer.current);
    start.current = null;
    setHeld(false);
  };

  const zeile = (row: string, i: number) => {
    const [k, v] = row.split(/:\s*/);
    const skipped = /^High ISO NR/.test(row);
    return (
      <div key={k} className={`contents ${i >= KURZ ? 'max-sm:hidden' : ''}`}>
        <dt className="text-dim">{k}</dt>
        <dd className={skipped ? 'flex items-center gap-2 text-dim/80' : 'text-fg'}>
          {skipped ? (
            <>
              <span className="line-through decoration-dim/60">{v}</span>
              <span className="rounded bg-raised px-1.5 font-sans text-[11px] leading-5 text-dim">entfällt</span>
            </>
          ) : (
            v
          )}
        </dd>
      </div>
    );
  };

  return (
    <section ref={ref} aria-labelledby="rezept-titel" className="px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Kopf id="rezept-titel" eyebrow="Rezepte" title="Vom Rezept zum Bild." align="left">
          Fuji-Rezepte sind Listen von Kameraeinstellungen. Film Lab liest sie wie eine Fujifilm – hier Kodak Portra 400 von Fuji X
          Weekly, angewendet auf ein Beispielfoto.
        </Kopf>

        <div className="mt-10 grid gap-6 sm:mt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-stretch lg:gap-10">
          <Einblenden>
            <figure className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <figcaption className="flex items-center gap-2.5 border-b border-line pb-4">
                <ScrollText size={18} className="text-accent" aria-hidden />
                <span className="font-semibold">{title}</span>
                <span className="ml-auto text-xs text-dim">Fuji X Weekly</span>
              </figcaption>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 font-mono text-[13px] leading-[1.9] sm:text-sm">{rows.map(zeile)}</dl>
              {/* Am Handy: erst die ersten Zeilen, der Rest auf Wunsch. */}
              <details className="group sm:hidden">
                <summary className="mt-1 flex min-h-11 cursor-pointer list-none items-center text-[13px] font-medium text-accent group-open:hidden [&::-webkit-details-marker]:hidden">
                  Alle {rows.length} Einstellungen zeigen
                </summary>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 font-mono text-[13px] leading-[1.9]">{rows.slice(KURZ).map((r) => zeile(r, 0))}</dl>
              </details>
              <p className="mt-4 flex gap-2.5 border-t border-line pt-4 text-[13px] leading-relaxed text-dim">
                <ClipboardPaste size={16} className="mt-0.5 flex-none text-accent" aria-hidden />
                Im Editor auf „Rezept“ tippen und den Text einfügen. Was keine Entsprechung hat (High ISO NR), wird angezeigt und
                ausgelassen.
              </p>
            </figure>
          </Einblenden>

          <Einblenden className="lg:h-full" delay={120}>
            <div
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={release}
              onPointerLeave={release}
              onPointerCancel={release}
              onContextMenu={(e) => e.preventDefault()}
              className="no-callout relative mx-auto aspect-[4/5] touch-pan-y overflow-hidden rounded-2xl bg-raised shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/5 sm:aspect-[3/2] sm:w-[min(100%,calc((100svh-5rem)*1.5))] lg:aspect-auto lg:h-full lg:w-full"
            >
              {url ? (
                <>
                  <img src={url} alt={`Beispielfoto ${label} mit dem Rezept Kodak Portra 400`} draggable={false} className="ueberblenden absolute inset-0 size-full object-cover" style={{ objectPosition: pos }} />
                  <img
                    src={beispielUrl(foto)}
                    alt=""
                    decoding="async"
                    draggable={false}
                    className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${held ? 'opacity-100' : 'opacity-0'}`}
                    style={{ objectPosition: pos }}
                  />
                </>
              ) : (
                <span className="platzhalter absolute inset-0" />
              )}
              <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                {held ? 'Original' : 'Portra 400'}
              </span>
              {url && (
                <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/55 px-3 py-1 text-xs text-white/85 backdrop-blur-md">
                  Gedrückt halten: Original
                </span>
              )}
              {!url && near && (
                <span role="status" className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/65 px-3.5 py-1.5 text-xs whitespace-nowrap text-white/90">
                  {error ? 'Live-Vorschau hier nicht verfügbar' : <><Spinner className="size-3.5 border-white/70" />Wird gerechnet …</>}
                </span>
              )}
            </div>
          </Einblenden>
        </div>
      </div>
    </section>
  );
}
