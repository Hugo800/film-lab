import { useContext, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowRight, ChevronsLeftRight, TriangleAlert } from 'lucide-react';
import { Spinner } from '../controls';
import { builtinEntries, CATEGORY_LABELS } from '../lookRegistry';
import { WerkstattContext, useInView, useRendered } from './hooks';
import { FotoWahl, Kopf } from './teile';
import { BEISPIELE, beispielUrl, GROSS, type BeispielId } from './werkstatt';

/** Kuratierte Auswahl für den Vergleich: id → kurzer Name auf dem Chip. */
const VERGLEICH_LOOKS: { id: string; label: string }[] = [
  { id: 'classic-chrome', label: 'Classic Chrome' },
  { id: 'velvia', label: 'Velvia' },
  { id: 'kodak-portra-400', label: 'Portra 400' },
  { id: 'kodak-cinestill-800t', label: 'CineStill 800T' },
  { id: 'kodak-kodachrome-64', label: 'Kodachrome 64' },
  { id: 'leica-chrome', label: 'Leica Chrome' },
  { id: 'acros', label: 'Acros' },
  { id: 'leica-mono-hc', label: 'Leica Monochrom' },
];

const CHIP_EDGE = 96;
// Breite der Bühne aus der Höhe (ab sm): Kopf (~10 rem), Abstände und zwei Chip-Reihen (~12 rem) bleiben im Bild.
const BREITE = 'mx-auto w-full max-w-5xl sm:w-[min(100%,max(28rem,calc((100svh-22rem)*1.5)))]';

function LookChip({ photo, id, label, on, enabled, onPick }: { photo: BeispielId; id: string; label: string; on: boolean; enabled: boolean; onPick: () => void }) {
  const { url, error } = useRendered(photo, id, CHIP_EDGE, 1, enabled);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`flex min-h-11 min-w-0 flex-none snap-start items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-[15px] whitespace-nowrap transition sm:pr-3 sm:text-sm ${
        on ? 'border-accent bg-accent/12 text-fg' : 'border-line bg-panel text-dim hover:border-dim/60 hover:bg-raised hover:text-fg'
      }`}
    >
      <span className="relative size-8 flex-none overflow-hidden rounded-full bg-raised">
        {url ? <img src={url} alt="" className="ueberblenden size-full object-cover" /> : !error && <span className="platzhalter absolute inset-0" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export function Vergleich({
  photo,
  onPhoto,
  look,
  onLook,
  onTry,
}: {
  photo: BeispielId;
  onPhoto: (id: BeispielId) => void;
  look: string;
  onLook: (id: string) => void;
  onTry: () => void;
}) {
  const werkstatt = useContext(WerkstattContext);
  // Beobachtet wird der Rahmen, nicht der Abschnitt: dessen Oberkante grenzt direkt an den ersten Bildschirm.
  const [frameRef, near] = useInView<HTMLDivElement>('0px 0px 150px 0px');
  const [split, setSplit] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const down = useRef<{ x: number; moved: boolean; id: number } | null>(null);
  const { url, error } = useRendered(photo, look, GROSS, 3, near);
  const [layers, setLayers] = useState<{ photo: BeispielId; urls: string[] }>({ photo, urls: [] });
  const [failed, setFailed] = useState<BeispielId | null>(null);
  const entry = builtinEntries().find((e) => e.id === look);

  // Zwei Ebenen: das neue Bild blendet über dem alten ein. Ein anderes Foto ersetzt alles erst, wenn es gerechnet ist –
  // bis dahin bleibt das alte Foto samt Look stehen.
  useEffect(() => {
    if (!url) return;
    setLayers((l) => ({ photo, urls: l.photo === photo ? [...l.urls.filter((u) => u !== url).slice(-1), url] : [url] }));
  }, [url, photo]);
  const shown = layers.urls.length > 0 ? layers.photo : photo;
  const urls = layers.urls;
  const ready = urls.length > 0;
  const beispiel = BEISPIELE.find((b) => b.id === shown)!;
  const broken = failed === shown;

  // Liegt das gewählte Bild vor, weitere Looks dieses Fotos vorab rechnen: der Wechsel ist dann sofort da.
  // Am Handy nur die nächsten drei Chips, das spart Rechenzeit auf dem Hauptthread.
  useEffect(() => {
    if (!url || !werkstatt) return;
    const i = VERGLEICH_LOOKS.findIndex((l) => l.id === look);
    const rest = [...VERGLEICH_LOOKS.slice(i + 1), ...VERGLEICH_LOOKS.slice(0, Math.max(0, i))];
    const next = matchMedia('(pointer: coarse)').matches ? rest.slice(0, 3) : rest;
    const jobs = next.map((l) => werkstatt.request(photo, l.id, GROSS, 0));
    for (const j of jobs) j.promise.catch(() => {});
    return () => jobs.forEach((j) => j.cancel());
  }, [url, werkstatt, photo, look]);

  // Einmaliger Schwenk, sobald der erste Look da und der Rahmen gut im Bild ist: zeigt, dass sich der Teiler ziehen lässt.
  const [stageRef, inSight] = useInView<HTMLDivElement>('0px 0px -25% 0px');
  const [swing, setSwing] = useState(false);
  const swung = useRef(false);
  useEffect(() => {
    if (!ready || !inSight || touched || swung.current) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    swung.current = true;
    setSwing(true);
    const t = [
      window.setTimeout(() => setSplit(0.25), 200),
      window.setTimeout(() => setSplit(0.5), 800),
      window.setTimeout(() => setSwing(false), 1400),
    ];
    return () => {
      t.forEach(clearTimeout);
      setSwing(false);
    };
  }, [ready, inSight, touched]);

  const at = (clientX: number) => {
    const r = frameRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setSplit(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setTouched(true);
    down.current = { x: e.clientX, moved: false, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    // Maus: sofort greifen. Touch: erst bei waagerechter Bewegung (senkrecht scrollt die Seite, siehe touch-action).
    if (e.pointerType === 'mouse') {
      setDragging(true);
      at(e.clientX);
    }
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = down.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < 4 && e.pointerType !== 'mouse') return;
    d.moved = true;
    setDragging(true);
    at(e.clientX);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = down.current;
    if (!d || d.id !== e.pointerId) return;
    // Antippen ohne Ziehen: Teiler springt (mit Übergang) an die Stelle.
    if (!d.moved && e.type === 'pointerup' && e.pointerType !== 'mouse') at(e.clientX);
    down.current = null;
    setDragging(false);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.05;
    const next =
      e.key === 'ArrowLeft' || e.key === 'ArrowDown'
        ? split - step
        : e.key === 'ArrowRight' || e.key === 'ArrowUp'
          ? split + step
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? 1
              : null;
    if (next === null) return;
    e.preventDefault();
    setTouched(true);
    setSplit(Math.min(1, Math.max(0, next)));
  };

  const pct = `${(split * 100).toFixed(2)}%`;
  const ease = dragging
    ? ''
    : `transition-[clip-path,left] ${swing ? 'duration-[600ms] ease-in-out' : 'duration-300 ease-out'} motion-reduce:transition-none`;
  const busy = near && !url && !error && !broken;

  return (
    <section id="looks" aria-labelledby="vergleich-titel" className="px-5 py-16 sm:py-24">
      {/* Bühne: Kopf, Rahmen und Chips passen zusammen auf einen Bildschirm („Looks ansehen“ scrollt hierher). */}
      <div id="looks-buehne" className="scroll-mt-4">
        <Kopf id="vergleich-titel" eyebrow="Vorher · Nachher" title="Ein Foto. Viele Filme.">
          <span className="sm:hidden">Zieh den Teiler: links das Original, rechts der Look.</span>
          <span className="hidden sm:inline">
            Zieh den Teiler: links das Original, rechts der Look – live gerechnet von derselben Engine wie im Editor,
            direkt in deinem Browser.
          </span>
        </Kopf>

        <div ref={stageRef} className={`mt-6 sm:mt-10 ${BREITE}`}>
          <div
            ref={frameRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className={`no-callout relative aspect-[4/5] max-h-[calc(100svh-17rem)] w-full touch-pan-y overflow-hidden rounded-2xl bg-raised shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/5 sm:aspect-[3/2] sm:max-h-none ${
              dragging ? 'cursor-grabbing' : 'cursor-ew-resize'
            }`}
          >
            {near && !broken ? (
              <img
                key={shown}
                src={beispielUrl(shown)}
                alt={`Beispielfoto ${beispiel.label}, links Original, rechts mit ${entry?.name ?? 'Look'}`}
                decoding="async"
                fetchPriority="high"
                draggable={false}
                onError={() => setFailed(shown)}
                className="ueberblenden absolute inset-0 size-full object-cover"
                style={{ objectPosition: beispiel.pos }}
              />
            ) : (
              !broken && <span className="platzhalter absolute inset-0" />
            )}
            {/* Bis der erste Look gerechnet ist: rechte Hälfte schimmert statt das Original doppelt zu zeigen. */}
            {near && !ready && !error && !broken && (
              <span className={`platzhalter absolute inset-0 ${ease}`} style={{ clipPath: `inset(0 0 0 ${pct})` }} />
            )}
            {broken && (
              <span className="absolute inset-0 flex items-center justify-center p-8 text-center text-[15px] leading-relaxed text-dim">
                Die Beispielfotos brauchen einmal eine Internetverbindung. Deine eigenen Fotos gehen auch offline.
              </span>
            )}
            {urls.map((u) => (
              <img
                key={u}
                src={u}
                alt=""
                draggable={false}
                className={`ueberblenden absolute inset-0 size-full object-cover ${ease}`}
                style={{ objectPosition: beispiel.pos, clipPath: `inset(0 0 0 ${pct})` }}
              />
            ))}

            {!broken && (
              <>
                <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium tracking-wide text-white/90 backdrop-blur-md">
                  Original
                </span>
                <span
                  className={`pointer-events-none absolute top-3 right-3 max-w-[55%] truncate rounded-full bg-black/55 px-3 py-1 text-xs font-medium tracking-wide text-white backdrop-blur-md transition-opacity ${
                    ready ? '' : 'opacity-50'
                  }`}
                >
                  {entry?.name}
                </span>
              </>
            )}

            {/* Teiler mit Griff; erst sichtbar, wenn es rechts etwas zu vergleichen gibt. */}
            <div
              className={`pointer-events-none absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow-[0_0_12px_rgb(0_0_0/0.5)] ${ease} ${ready ? '' : 'opacity-0'}`}
              style={{ left: pct }}
            >
              <div
                role="slider"
                tabIndex={0}
                aria-label="Teiler zwischen Original und Look"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(split * 100)}
                aria-valuetext={`${Math.round(split * 100)} % Original`}
                onKeyDown={onKey}
                className={`pointer-events-auto absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-transform ${
                  dragging ? 'scale-110' : ''
                }`}
              >
                <ChevronsLeftRight size={20} strokeWidth={2.2} aria-hidden />
              </div>
            </div>

            {(busy || (error && !broken)) && (
              <span
                role="status"
                className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/65 px-3.5 py-1.5 text-xs whitespace-nowrap text-white/90 backdrop-blur-md"
              >
                {error ? <TriangleAlert size={14} className="text-accent" aria-hidden /> : <Spinner className="size-3.5 border-white/70" />}
                {error ? 'Live-Vorschau hier nicht verfügbar' : 'Wird gerechnet …'}
              </span>
            )}
          </div>

          <div className="hide-scrollbar -mx-5 mt-4 flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
            {VERGLEICH_LOOKS.map((l) => (
              <LookChip key={l.id} photo={photo} id={l.id} label={l.label} on={l.id === look} enabled={near} onPick={() => onLook(l.id)} />
            ))}
          </div>
        </div>
      </div>

      <div className={BREITE}>
        <div className="mt-8 flex flex-col gap-6 border-t border-line pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 sm:max-w-xl" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dim">{entry ? CATEGORY_LABELS[entry.category] : ''}</p>
            <p className="mt-1 text-lg font-semibold">{entry?.name}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-dim">{entry?.description}</p>
          </div>
          <div className="flex flex-none flex-col items-start gap-4 sm:items-end">
            <FotoWahl value={photo} onChange={onPhoto} />
            <button
              type="button"
              onClick={onTry}
              className="group inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-accent hover:brightness-110"
            >
              Dieses Foto bearbeiten
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
