import { useContext, useEffect, useRef, useState, type PointerEvent } from 'react';
import { LOOKS } from '../../looks';
import type { LookCategory } from '../../types';
import { builtinEntries, CATEGORY_LABELS, type LookEntry } from '../lookRegistry';
import { useInView, useRendered, WerkstattContext } from './hooks';
import { FotoWahl, Kopf } from './teile';
import { BEISPIELE, beispielUrl, type BeispielId } from './werkstatt';

const MARKEN: LookCategory[] = ['fujifilm', 'leica', 'kodak'];
/** So viele Kacheln je Marke rechnet die Übersicht vorab (auch die noch nicht sichtbaren im Karussell). */
const VORAB = 4;

/**
 * Lange Bildkante für eine Kachel der Breite `w` (CSS-px): Die Kachel (4:5) schneidet das Querformat zu, also muss die
 * kurze Bildseite die Kachelhöhe in Gerätepixeln füllen. In 160er-Stufen, damit nicht jede Fenstergröße neu rechnet.
 */
function kachelEdge(w: number) {
  const long = w * 1.25 * (window.devicePixelRatio || 1) * 1.5;
  return Math.min(1200, Math.max(480, Math.ceil(long / 160) * 160));
}

/** Kurztext: der erste Satz(teil) der Beschreibung ohne Rezeptquelle; ist er lang, bis zum letzten Komma vor 70 Zeichen. */
function kurz(description: string) {
  const satz = description.replace(/\s*Rezept: .*$/, '').split(/[:–.]/)[0].trim();
  const komma = satz.lastIndexOf(',', 70);
  return satz.length > 70 && komma >= 25 ? satz.slice(0, komma) : satz;
}

const UNTERTITEL: Record<string, string> = {
  fujifilm: 'Die Filmsimulationen der X-Serie – von Provia bis Acros mit Farbfiltern.',
  leica: 'Die Leica Looks der Q- und M-Kameras, nachempfunden.',
  kodak: 'Kodak-Filme als Fuji-Rezepte von Fuji X Weekly und Co. – Basis-Simulation plus Kameraeinstellungen.',
};

function kachelName(e: LookEntry) {
  return e.category === 'leica' ? e.name.replace(/^Leica /, '') : e.name;
}

function Kachel({ entry, photo, edge, vorab }: { entry: LookEntry; photo: BeispielId; edge: number; vorab: boolean }) {
  const [ref, seen] = useInView<HTMLDivElement>('300px 0px');
  const { url, error } = useRendered(photo, entry.id, edge, 1, edge > 0 && (seen || vorab));
  const [peek, setPeek] = useState(false);
  const timer = useRef(0);
  const held = useRef(false);
  const pos = BEISPIELE.find((b) => b.id === photo)!.pos;
  const look = LOOKS.find((l) => l.id === entry.id);
  const base = look?.baseLookId ? LOOKS.find((l) => l.id === look.baseLookId)?.name.replace(/\/.*$/, '') : undefined;
  const text = kurz(entry.description);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Touch: Antippen zeigt kurz das Original, Gedrückthalten so lange wie gehalten. Maus: Überfahren (CSS).
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(timer.current);
    held.current = false;
    timer.current = window.setTimeout(() => {
      held.current = true;
      setPeek(true);
    }, 140);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(timer.current);
    setPeek(true);
    timer.current = window.setTimeout(() => setPeek(false), held.current ? 250 : 900);
  };
  const onCancel = () => {
    clearTimeout(timer.current);
    setPeek(false);
  };

  return (
    <div ref={ref} className="group w-[44%] flex-none snap-start sm:w-auto">
      <div
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onContextMenu={(e) => e.preventDefault()}
        className="no-callout relative aspect-[4/5] overflow-hidden rounded-xl bg-raised ring-1 ring-white/5 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-16px_rgb(0_0_0/0.9)] group-hover:ring-white/15 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
      >
        {url ? (
          <img src={url} alt={`${entry.name} am Beispielfoto`} draggable={false} className="ueberblenden absolute inset-0 size-full object-cover" style={{ objectPosition: pos }} />
        ) : error ? (
          <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-dim">Vorschau nicht verfügbar</span>
        ) : (
          <span className="platzhalter absolute inset-0" />
        )}
        {url && (
          <img
            src={beispielUrl(photo)}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-100 ${peek ? 'opacity-100' : 'opacity-0'}`}
            style={{ objectPosition: pos }}
          />
        )}
        {url && (
          <span
            className={`pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 ${
              peek ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Original
          </span>
        )}
        {entry.monochrome && (
          <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white/85 backdrop-blur-md">
            SW
          </span>
        )}
      </div>
      <p className="mt-2.5 truncate text-[15px] font-medium text-fg">{kachelName(entry)}</p>
      <p className="mt-0.5 line-clamp-4 text-[13px] leading-snug text-dim max-sm:hidden">{text}</p>
      {base && <p className="mt-1 truncate text-xs text-dim/70">Rezept auf {base}</p>}
    </div>
  );
}

export function LookUebersicht({ photo, onPhoto }: { photo: BeispielId; onPhoto: (id: BeispielId) => void }) {
  const werkstatt = useContext(WerkstattContext);
  const [marke, setMarke] = useState<LookCategory>('fujifilm');
  const entries = builtinEntries();
  const shown = entries.filter((e) => e.category === marke);
  const total = entries.filter((e) => MARKEN.includes(e.category as LookCategory)).length;
  const [listRef, near] = useInView<HTMLDivElement>('300px 0px');
  const [edge, setEdge] = useState(0);

  // Kantenlänge aus der echten Kachelgröße (Karussell am Handy, Raster ab sm, Querformat).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const w = list.firstElementChild?.getBoundingClientRect().width ?? 0;
      if (w > 0) setEdge(kachelEdge(w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [listRef, marke]);

  // Die ersten Kacheln der anderen Marken vorab (Priorität 0): der Tabwechsel zeigt dann sofort Bilder.
  useEffect(() => {
    if (!near || !edge || !werkstatt) return;
    const jobs = entries
      .filter((e) => e.category !== marke && MARKEN.includes(e.category as LookCategory))
      .filter((e, i, all) => all.findIndex((x) => x.category === e.category) > i - VORAB)
      .map((e) => werkstatt.request(photo, e.id, edge, 0));
    for (const j of jobs) j.promise.catch(() => {});
    return () => jobs.forEach((j) => j.cancel());
    // entries ist bei jedem Aufruf ein neues Array, aber inhaltlich fest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, edge, werkstatt, marke, photo]);

  return (
    <section id="alle-looks" aria-labelledby="uebersicht-titel" className="px-5 py-16 sm:py-24">
      <Kopf id="uebersicht-titel" eyebrow={`${total} Looks`} title="Drei Marken. Ein Labor.">
        Jede Kachel ist live gerechnet. <span className="pointer-coarse:hidden">Fahr mit der Maus darüber, um kurz das Original zu sehen.</span>
        <span className="hidden pointer-coarse:inline">Tipp eine an, um kurz das Original zu sehen.</span>
      </Kopf>

      <div className="mx-auto mt-10 max-w-6xl sm:mt-14">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
          <div role="tablist" aria-label="Marke" className="flex w-full rounded-full border border-line bg-panel p-1 sm:w-auto">
            {MARKEN.map((m) => {
              const on = m === marke;
              const n = entries.filter((e) => e.category === m).length;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  id={`marke-${m}`}
                  aria-selected={on}
                  aria-controls="marke-looks"
                  onClick={() => setMarke(m)}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-medium transition sm:flex-none sm:px-5 ${
                    on ? 'bg-raised text-fg ring-1 ring-accent/50' : 'text-dim hover:bg-raised/50 hover:text-fg'
                  }`}
                >
                  {CATEGORY_LABELS[m]}
                  <span className={`text-xs tabular-nums ${on ? 'text-accent' : 'text-dim/70'}`}>{n}</span>
                </button>
              );
            })}
          </div>
          <FotoWahl value={photo} onChange={onPhoto} />
        </div>

        <p className="mt-6 text-center text-sm text-dim sm:text-left">{UNTERTITEL[marke]}</p>

        {/* Am Handy ein waagerechtes Karussell je Marke, ab sm das Raster. */}
        <div
          ref={listRef}
          id="marke-looks"
          role="tabpanel"
          aria-labelledby={`marke-${marke}`}
          key={marke}
          className="ueberblenden hide-scrollbar -mx-5 mt-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mt-6 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 xl:grid-cols-5"
        >
          {shown.map((e, i) => (
            <Kachel key={e.id} entry={e} photo={photo} edge={edge} vorab={near && i < VORAB} />
          ))}
        </div>
      </div>
    </section>
  );
}
