import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Spinner } from '../controls';
import { builtinEntries } from '../lookRegistry';
import { beispielInEditor } from './beispielLaden';
import { useFoto, useInView, useRendered } from './hooks';
import { BEISPIEL_LOOK, BEISPIEL_REZEPT, REZEPT_GRUPPEN } from './rezept';
import { Einblenden, Kopf, SPALTE } from './teile';
import { angaben, beispielUrl, GROSS } from './werkstatt';

const FOTO = 'sonnenuntergang';

const SCHRITTE = [
  { title: 'Grundlook', text: 'Jedes Rezept beginnt mit einer Filmsimulation der Kamera, hier Classic Chrome.' },
  { title: 'Feinschliff', text: 'Dynamikbereich, Weißabgleich, Farbe und Korn machen daraus Kodak Portra 400.' },
  { title: 'Einfügen', text: 'Rezepttext kopieren, im Editor auf „Rezept“ tippen und einfügen. Film Lab stellt alles ein.' },
];

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
  const werte = new Map(rows.map((r) => r.split(/:\s*/) as [string, string]));
  const kodak = builtinEntries().filter((e) => e.category === 'kodak').length;

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

  return (
    <section ref={ref} id="rezepte" aria-labelledby="rezept-titel" className="px-5 py-20 sm:py-28">
      <div className={SPALTE}>
        <Kopf id="rezept-titel" nr="04" name="Rezepte" rechts="Fuji X Weekly" title="Rezepte, einfach erklärt.">
          Ein Rezept ist eine Liste von Kameraeinstellungen, mit der Fotografen den Look eines Films nachbauen. Film Lab liest es
          wie eine Fujifilm.
        </Kopf>

        <ol className="mt-12 grid gap-6 sm:mt-14 sm:grid-cols-3 sm:gap-8">
          {SCHRITTE.map((s, i) => (
            <li key={s.title}>
              <Einblenden delay={i * 90} className="border-t border-line pt-5">
                <p className="font-mono text-[11px] tracking-[0.18em] text-accent">0{i + 1}</p>
                <h3 className="mt-2 text-[17px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-dim">{s.text}</p>
              </Einblenden>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-6 sm:mt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-stretch lg:gap-10">
          <Einblenden>
            <figure className="rounded-sm border border-line bg-panel">
              <figcaption className="flex items-baseline gap-3 border-b border-line px-5 py-4 sm:px-6">
                <span className="font-semibold">{title}</span>
                <span className="ml-auto font-mono text-[11px] tracking-[0.14em] text-dim uppercase">Rezept</span>
              </figcaption>
              <div className="px-5 pb-2 sm:px-6">
                {REZEPT_GRUPPEN.map((g) => (
                  <div key={g.name} className="border-b border-line/70 py-3 last:border-0">
                    <p className="flex justify-between gap-3 font-mono text-[10.5px] tracking-[0.16em] uppercase">
                      <span className="text-accent">{g.name}</span>
                      <span className="text-dim/80">{g.wirkung}</span>
                    </p>
                    <dl className="mt-1.5 grid grid-cols-[10.5rem_minmax(0,1fr)] gap-x-4 font-mono text-[13px] leading-[1.85] sm:grid-cols-[12.5rem_minmax(0,1fr)]">
                      {g.zeilen.map((k) => {
                        const v = werte.get(k);
                        const entfaellt = k === 'High ISO NR';
                        return (
                          <div key={k} className="contents">
                            <dt className="text-dim">{k}</dt>
                            <dd className={entfaellt ? 'flex items-center gap-2 text-dim/80' : 'text-fg'}>
                              {entfaellt ? (
                                <>
                                  <span className="line-through decoration-dim/60">{v}</span>
                                  <span className="rounded-sm bg-raised px-1.5 font-sans text-[11px] leading-5 text-dim">entfällt</span>
                                </>
                              ) : (
                                v
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                ))}
              </div>
              <p className="border-t border-line px-5 py-4 text-[13px] leading-relaxed text-dim sm:px-6">
                Was keine Entsprechung hat, etwa die Rauschminderung (High ISO NR), zeigt Film Lab an und lässt es aus.
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
              className="no-callout relative mx-auto aspect-[4/5] touch-pan-y overflow-hidden rounded-sm bg-raised select-none sm:aspect-[3/2] lg:aspect-auto lg:h-full lg:w-full"
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
              <span className="pointer-events-none absolute top-3 left-3 rounded-sm bg-black/55 px-2 py-1 font-mono text-[10px] tracking-[0.16em] text-white uppercase backdrop-blur-md">
                {held ? 'Original' : 'Portra 400'}
              </span>
              {url && (
                <span className="pointer-events-none absolute right-3 bottom-3 rounded-sm bg-black/55 px-2 py-1 text-xs text-white/85 backdrop-blur-md">
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

        <Einblenden className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-[15px] leading-relaxed text-dim">
            Die {kodak} Kodak-Looks im Look-Rad sind selbst solche Rezepte. Eigene Rezepte speichert Film Lab in deinem Browser.
          </p>
          <button
            type="button"
            onClick={() => void beispielInEditor(foto, BEISPIEL_LOOK)}
            className="group inline-flex min-h-11 flex-none items-center gap-2 self-start text-[15px] font-medium text-accent sm:self-auto"
          >
            Rezept im Editor ausprobieren
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </Einblenden>
      </div>
    </section>
  );
}
