import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Spinner } from '../controls';
import { beispielLadenAbo, beispielLadezustand } from './beispielLaden';
import { useFassung, useInView } from './hooks';
import { BEISPIELE, foto, miniUrl, type BeispielId } from './werkstatt';

// Breite der Bühne des Look-Rads aus der Höhe (ab sm): Kopf (~10 rem), Abstände und die Bedienung über
// und unter dem Bild (~12 rem) bleiben neben einem Bild im Format 3:2 im Bild.
export const BREITE = 'mx-auto w-full max-w-5xl sm:w-[min(100%,max(28rem,calc((100svh-22rem)*1.5)))]';

/** Breite aller Abschnitte der Startseite. */
export const SPALTE = 'mx-auto w-full max-w-6xl';

/** Kopfzeile eines Abschnitts wie der Rand eines Negativs: Nummer, Name, durchgehende Linie, rechts eine Angabe. */
export function Filmrand({ nr, name, rechts }: { nr: string; name: string; rechts?: ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
      <span className="text-accent">▸ {nr}</span>
      <span>{name}</span>
      <span aria-hidden className="h-px flex-1 bg-line" />
      {rechts && <span className="tabular-nums">{rechts}</span>}
    </p>
  );
}

/** Abschnittskopf: Filmrand über die ganze Breite, große Überschrift, Einleitung; linksbündig oder mittig (über einer Bühne). */
export function Kopf({
  id,
  nr,
  name,
  rechts,
  title,
  mittig = false,
  className = '',
  children,
}: {
  id: string;
  nr: string;
  name: string;
  rechts?: ReactNode;
  title: ReactNode;
  mittig?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Einblenden className={className}>
      <Filmrand nr={nr} name={name} rechts={rechts} />
      <div className={mittig ? 'mx-auto max-w-3xl text-center' : ''}>
        <h2 id={id} className="mt-5 text-[32px] leading-[1.05] font-medium tracking-[-0.03em] text-balance sm:mt-7 sm:text-5xl">
          {title}
        </h2>
        {children && <p className={`mt-4 text-[15px] leading-relaxed text-pretty text-dim sm:text-base ${mittig ? '' : 'max-w-2xl'}`}>{children}</p>}
      </div>
    </Einblenden>
  );
}

/**
 * Kleinbildfilm als Rahmen: Perforation und Randbeschriftung an den Längsseiten (index.css), quer oder am Handy
 * hochkant. Das Bild (children) füllt das Feld; Größe und Format setzt `bild`.
 */
export function Filmstreifen({
  bild,
  oben,
  unten,
  className = '',
  children,
}: {
  bild: string;
  oben: ReactNode;
  unten: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`filmstreifen ${className}`}>
      <span aria-hidden className="filmstreifen-rand oben">{oben}</span>
      <div className={`filmstreifen-bild ${bild}`}>{children}</div>
      <span aria-hidden className="filmstreifen-rand unten">{unten}</span>
    </div>
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
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--oben)+56px)] z-[60] flex justify-center px-4 side:top-auto side:bottom-20">
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
