import type { CSSProperties, ReactNode } from 'react';
import { useInView } from './hooks';
import { BEISPIELE, miniUrl, type BeispielId } from './werkstatt';

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
  return (
    <div ref={ref} role="group" aria-label="Beispielfoto" className={`flex items-center gap-2 ${className}`}>
      {BEISPIELE.map((b) => {
        const on = b.id === value;
        return (
          <button
            key={b.id}
            type="button"
            aria-pressed={on}
            aria-label={`Beispielfoto ${b.label}`}
            title={b.label}
            onClick={() => onChange(b.id)}
            className={`relative h-11 w-14 overflow-hidden rounded-lg bg-raised transition ${
              on ? 'ring-2 ring-accent ring-offset-2 ring-offset-ink' : 'opacity-60 hover:opacity-100'
            }`}
          >
            {near && <img src={miniUrl(b.id)} alt="" decoding="async" className="size-full object-cover" />}
          </button>
        );
      })}
    </div>
  );
}
