import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Spinner } from '../controls';
import { beispielLadenAbo, beispielLadezustand } from './beispielLaden';
import { useFassung, useInView } from './hooks';
import { BEISPIELE, foto, miniUrl, type BeispielId } from './werkstatt';

// Breite der Bühnen von Vergleich und Look-Rad aus der Höhe (ab sm): Kopf (~10 rem), Abstände und die Bedienung über
// und unter dem Bild (~12 rem) bleiben neben einem Bild im Format 3:2 im Bild.
export const BREITE = 'mx-auto w-full max-w-5xl sm:w-[min(100%,max(28rem,calc((100svh-22rem)*1.5)))]';

/** Abschnittskopf: kleine Zeile in Akzentfarbe, große Überschrift, Einleitung; zentriert oder linksbündig. */
export function Kopf({
  id,
  eyebrow,
  title,
  align = 'center',
  children,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  align?: 'center' | 'left';
  children?: ReactNode;
}) {
  return (
    <Einblenden className={align === 'left' ? 'max-w-2xl' : 'mx-auto max-w-2xl text-center'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-[30px] leading-[1.1] font-medium tracking-[-0.025em] text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {children && <p className="mt-4 text-[15px] leading-relaxed text-pretty text-dim sm:text-base">{children}</p>}
    </Einblenden>
  );
}

/** Blendet den Inhalt beim ersten Erscheinen ein (ohne Bewegung bei prefers-reduced-motion, siehe index.css). */
export function Einblenden({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, seen] = useInView<HTMLDivElement>('0px 0px -8% 0px');
  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;
  return (
    <div ref={ref} className={`einblenden ${seen ? 'sichtbar' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Wahl des Beispielfotos als kleine Bildknöpfe. */
export function FotoWahl({ value, onChange, className = '' }: { value: BeispielId; onChange: (id: BeispielId) => void; className?: string }) {
  // Kleine Vorschauen (je rund 6 KB), erst kurz vor Sicht: loading="lazy" lädt in Chrome schon weit unterhalb des ersten Bildschirms.
  const [ref, near] = useInView<HTMLDivElement>('200px 0px');
  const fassung = useFassung();
  return (
    <div ref={ref} role="group" aria-label="Beispielfoto" className={`flex items-center gap-2 ${className}`}>
      {BEISPIELE.map((b) => {
        const on = b.id === value;
        const { label } = b[fassung];
        return (
          <button
            key={b.id}
            type="button"
            aria-pressed={on}
            aria-label={`Beispielfoto ${label}`}
            title={label}
            onClick={() => onChange(b.id)}
            // Fokus: weiß und weiter außen, damit er sich von der Auswahl (Ring in Akzentfarbe) abhebt; nicht gedämpft.
            className={`relative h-11 w-13 overflow-hidden rounded-lg bg-raised transition focus-visible:opacity-100 focus-visible:outline-white focus-visible:outline-offset-4 sm:w-14 ${
              on ? 'ring-2 ring-accent ring-offset-2 ring-offset-ink' : 'opacity-60 hover:opacity-100'
            }`}
          >
            {near && <img src={miniUrl(foto(b.id, fassung))} alt="" decoding="async" className="size-full object-cover" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Dezente Anzeige, solange die Editor-Fassung eines Beispielfotos lädt (bis ~2,5 MB), mit Anteil, wenn der Server die
 * Größe nennt. Erst nach kurzer Zeit, damit sie aus dem Cache nicht aufblitzt; Platz wie die Meldungen (Toast).
 */
export function BeispielLadeanzeige() {
  const z = useSyncExternalStore(beispielLadenAbo, beispielLadezustand);
  const laedt = z !== null;
  const [frei, setFrei] = useState(false);
  useEffect(() => {
    if (!laedt) return;
    const t = setTimeout(() => setFrei(true), 150);
    return () => {
      clearTimeout(t);
      setFrei(false);
    };
  }, [laedt]);
  if (!z || !frei) return null;
  const prozent = z.anteil === null ? null : Math.round(z.anteil * 100);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+56px)] z-[60] flex justify-center px-4 side:top-auto side:bottom-20">
      <div role="status" className="flex w-80 max-w-full flex-col gap-2.5 rounded-2xl border border-line bg-raised/95 px-4 py-3 text-sm shadow-xl backdrop-blur">
        <p className="flex items-center gap-2.5">
          <Spinner className="size-4" />
          <span className="flex-1 whitespace-nowrap">Beispielfoto wird geladen …</span>
          {prozent !== null && <span className="text-dim tabular-nums">{prozent} %</span>}
        </p>
        <div
          role="progressbar"
          aria-label="Beispielfoto laden"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={prozent ?? undefined}
          className="h-1 overflow-hidden rounded-full bg-line"
        >
          <div
            className={`h-full rounded-full bg-accent ${prozent === null ? 'w-1/4 animate-pulse' : 'transition-[width] duration-200'}`}
            style={prozent === null ? undefined : { width: `${prozent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
