import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowRight, RotateCcw, TriangleAlert } from 'lucide-react';
import { Spinner } from '../controls';
import type { LookCategory } from '../../types';
import { builtinEntries, CATEGORY_LABELS, type LookEntry } from '../lookRegistry';
import { beispielInEditor } from './beispielLaden';
import { bahnPunkt, geometrie, hub, SICHTBAR, type Geometrie } from './bahn';
import { schachtelFuer } from './filmschachteln';
import { useFoto, useInView, useRendered, WerkstattContext } from './hooks';
import { Schachtel } from './Schachtel';
import { BREITE, FotoWahl, Kopf, SPALTE } from './teile';
import { angaben, beispielUrl, GROSS, miniUrl, type BeispielId, type Foto } from './werkstatt';

const MARKEN: LookCategory[] = ['fujifilm', 'leica', 'kodak', 'ricoh'];
/** Mit diesem Look öffnet das Rad je Marke: mittendrin (Index ≥ 4), damit der Bogen nach oben und unten gefüllt ist. */
const START: Record<string, string> = { fujifilm: 'classic-chrome', leica: 'leica-chrome', kodak: 'kodak-gold-200', ricoh: 'ricoh-positive-film' };
/** Mausrad/Trackpad: so viele Pixel je Schritt, höchstens ein Schritt je SCHRITT_MS. */
const SCHWELLE = 70;
const SCHRITT_MS = 80;
/** Hintergrund erst rechnen, wenn das Rad so lange ruht (auch länger als die Schrittfolge von Hand beim Markenwechsel). */
const RUHE_MS = 200;
/** Mausrad am Ende bzw. nach dem Einrasten: Nachlauf höchstens so lange schlucken, dann freigeben. */
const SCHLUCKEN_MS = 500;

const reduziert = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Kurztext: der erste Satz(teil) der Beschreibung ohne Rezeptquelle. */
function kurz(description: string) {
  return description.replace(/\s*Rezept: .*$/, '').split(/[:–.]/)[0].trim();
}

/** Lange Bildkante für das Sichtfenster (≈ 0,64 × Schachtelhöhe) in Gerätepixeln, in 64er-Stufen. */
function fensterEdge(boxH: number) {
  const px = boxH * 0.64 * 1.5 * (window.devicePixelRatio || 1);
  return clamp(Math.ceil(px / 64) * 64, 128, 512);
}

function RadBox({
  entry,
  d,
  g,
  links,
  oben,
  hoehe,
  photo,
  edge,
  enabled,
  gesehen,
  aktiv,
  index,
  n,
  onPick,
}: {
  entry: LookEntry;
  d: number;
  g: Geometrie;
  links: number;
  oben: number;
  /** Höhe der Kachel: Schachteln ganz außerhalb werden nicht gerechnet. */
  hoehe: number;
  photo: Foto;
  edge: number;
  enabled: boolean;
  /** Abschnitt schon einmal in Sicht: erst dann die kleinen Fotos als Platzhalter laden. */
  gesehen: boolean;
  aktiv: boolean;
  index: number;
  n: number;
  onPick: () => void;
}) {
  const sichtbar = Math.abs(d) < SICHTBAR;
  const p = bahnPunkt(d, g);
  // Gerechnet wird nur, was man sieht: nicht ganz durchsichtig und wenigstens zum Teil in der Kachel.
  const halb = (p.scale * g.boxH) / 2;
  const { url } = useRendered(photo, entry.id, edge, 2, enabled && sichtbar && p.y + halb > 0 && p.y - halb < hoehe);
  const { pos } = angaben(photo);
  return (
    <div
      id={`rad-${entry.id}`}
      role="option"
      aria-selected={aktiv}
      aria-posinset={index + 1}
      aria-setsize={n}
      aria-label={entry.name}
      data-i={index}
      onClick={onPick}
      className="rad-box cursor-pointer"
      style={{
        width: g.boxW,
        height: g.boxH,
        borderRadius: g.boxW * 0.022,
        display: sichtbar ? undefined : 'none',
        opacity: p.opacity < 1 ? p.opacity : undefined,
        // Ganz ausgeblendet: nicht mehr antippbar.
        pointerEvents: p.opacity === 0 ? 'none' : undefined,
        zIndex: 100 - Math.round(Math.abs(d) * 10),
        transform: `translate3d(${(p.x - links - g.boxW / 2).toFixed(1)}px, ${(p.y - oben - g.boxH / 2).toFixed(1)}px, 0) rotate(${p.rot.toFixed(2)}deg) scale(${p.scale.toFixed(4)})`,
        ['--dunkel' as string]: p.dunkel.toFixed(3),
      }}
    >
      <Schachtel s={schachtelFuer(entry)} url={url} pos={pos} mini={gesehen ? miniUrl(photo) : undefined} />
    </div>
  );
}

/**
 * Kachel mit allen Looks: Hintergrund = Beispielfoto mit dem aktiven Look, rechts ein gebogenes Rad aus
 * Filmschachteln; Markenschalter darüber, Fotowahl darunter. Drehen per Mausrad (nur mit dem Zeiger über der Kachel;
 * erst ganz ins Bild einrasten, an den Enden frei), Wischen auf dem Bogen, Antippen, Pfeiltasten.
 */
export function LookRad({ photo, onPhoto }: { photo: BeispielId; onPhoto: (id: BeispielId) => void }) {
  const werkstatt = useContext(WerkstattContext);
  // Das gewählte Foto in der Fassung dieses Bildschirms (beim Drehen wie ein Fotowechsel).
  const foto = useFoto(photo);
  const entries = useMemo(builtinEntries, []);
  const total = entries.filter((e) => MARKEN.includes(e.category as LookCategory)).length;
  const [marke, setMarke] = useState<LookCategory>('fujifilm');
  const liste = useMemo(() => entries.filter((e) => e.category === marke), [entries, marke]);
  const n = liste.length;
  const [ziele, setZiele] = useState<Record<string, number>>(() =>
    Object.fromEntries(MARKEN.map((m) => [m, Math.max(0, entries.filter((e) => e.category === m).findIndex((e) => e.id === START[m]))])),
  );
  const index = ziele[marke];
  const entry = liste[index];

  // `near`: jetzt in Sichtweite (nur dann wird gerechnet); `gesehen`: schon einmal, dann bleiben die Bilder stehen.
  // Unten erst, wenn der Abschnitt im Bild ist: Er beginnt direkt unter dem ersten Bildschirm, die Engine soll erst beim
  // Scrollen starten. Die Kachel liegt noch unter dem Kopf, rechnet also weiterhin vor, bevor man sie sieht.
  const [sectionRef, near] = useInView<HTMLElement>('200px 0px -40px 0px', false);
  const [gesehen, setGesehen] = useState(false);
  if (near && !gesehen) setGesehen(true);
  // Kachel; zum Einrasten außerdem die Bühne (Schalter, Kachel, Fotowahl) und der ganze Inhalt samt Überschrift.
  const kachelRef = useRef<HTMLDivElement>(null);
  const buehneRef = useRef<HTMLDivElement>(null);
  const inhaltRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const g = useMemo(() => (size.w ? geometrie(size.w, size.h) : null), [size]);
  const edge = g ? fensterEdge(g.boxH) : 0;

  // Stetige Lage des Rads (pos) und Ziel (target); die Animation läuft per rAF, beim Ziehen folgt pos dem Finger.
  const [pos, setPos] = useState(index);
  const posRef = useRef(index);
  const target = useRef(index);
  const raf = useRef(0);
  const zug = useRef<{ id: number; y0: number; p0: number; moved: boolean; spuren: { t: number; y: number }[] } | null>(null);
  const zugEnde = useRef(0);
  const [ruhe, setRuhe] = useState(true);
  const lage = useRef({ n, marke, g });
  lage.current = { n, marke, g };

  useLayoutEffect(() => {
    const el = kachelRef.current;
    if (!el) return;
    const measure = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const laufen = useCallback(() => {
    setRuhe(false);
    if (raf.current) return;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(64, Math.max(0, t - last));
      last = t;
      if (!zug.current) {
        const diff = target.current - posRef.current;
        posRef.current = Math.abs(diff) < 0.004 ? target.current : posRef.current + diff * (1 - Math.exp(-dt / 80));
      }
      setPos(posRef.current);
      if (zug.current || posRef.current !== target.current) raf.current = requestAnimationFrame(tick);
      else {
        raf.current = 0;
        setRuhe(true);
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /** Zum Look i drehen (begrenzt auf die Liste); ohne Bewegung bei prefers-reduced-motion. */
  const drehen = useCallback(
    (i: number) => {
      const { n: count, marke: m } = lage.current;
      const ziel = clamp(Math.round(i), 0, count - 1);
      target.current = ziel;
      setZiele((z) => (z[m] === ziel ? z : { ...z, [m]: ziel }));
      if (reduziert()) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
        posRef.current = ziel;
        setPos(ziel);
        setRuhe(!zug.current);
      } else laufen();
    },
    [laufen],
  );

  const markeWechseln = (m: LookCategory) => {
    if (m === marke) return;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    zug.current = null;
    lage.current = { ...lage.current, marke: m, n: entries.filter((e) => e.category === m).length };
    target.current = posRef.current = ziele[m];
    setPos(ziele[m]);
    setRuhe(true);
    setMarke(m);
  };

  // Mausrad: Nur mit dem Zeiger über der Kachel (das Ereignis kommt nur dann hier an). Ist sie nicht ganz im Bild, erst
  // einrasten, dann drehen; am ersten/letzten Look in der jeweiligen Richtung freigeben. Listener selbst, weil React
  // wheel passiv anmeldet.
  useEffect(() => {
    const kachel = kachelRef.current;
    const main = kachel?.closest('main');
    if (!kachel || !main) return;
    /** Scrollstand, bei dem die Kachel mittig ganz im Bild ist – samt Überschrift bzw. Bedienung, soweit sie hineinpassen. */
    const rastStelle = () => {
      const m = main.getBoundingClientRect();
      const el = [inhaltRef.current, buehneRef.current].find((x) => x && x.offsetHeight <= m.height - 16) ?? kachel;
      const r = el.getBoundingClientRect();
      return clamp(Math.round(main.scrollTop + r.top - m.top - (m.height - r.height) / 2), 0, main.scrollHeight - main.clientHeight);
    };
    let acc = 0;
    let letzterSchritt = -1e9;
    let letztes = -1e9;
    let letzterBetrag = 0;
    let rastet = 0; // Ende des Einrastens (Frist); 0 = rastet nicht
    let ziel = 0; // Scrollstand, auf den gerade eingerastet wird
    let ruhigBis = 0; // Nachlauf des Trackpads nach dem Einrasten schlucken (feste Frist, wird nicht verlängert)
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // Zoom-Geste
      // Zeit der Eingabe, nicht der Verarbeitung: rechnet die Seite gerade, kommen Ereignisse gebündelt an.
      const now = e.timeStamp;
      const pause = now - letztes;
      letztes = now;
      const dy = e.deltaY * (e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? kachel.clientHeight : 1);
      if (dy === 0 || Math.abs(e.deltaX) > Math.abs(dy)) return;
      // Neue Geste statt Nachlauf: nach einer Pause oder wenn die Ausschläge wieder größer werden (Schwung klingt ab).
      const neu = pause >= 200 || Math.abs(dy) > letzterBetrag * 1.3 + 2;
      letzterBetrag = Math.abs(dy);
      const dir = Math.sign(dy);
      if (rastet) {
        if (Math.abs(main.scrollTop - ziel) >= 2 && now < rastet) return void e.preventDefault();
        rastet = 0;
        ruhigBis = now + SCHLUCKEN_MS;
      }
      const m = main.getBoundingClientRect();
      const k = kachel.getBoundingClientRect();
      if (k.top < m.top - 1 || k.bottom > m.bottom + 1) {
        const z = rastStelle();
        const off = z - main.scrollTop;
        // Passt die Kachel nicht ganz ins Bild, dreht sie an der Raststelle trotzdem (sonst hinge das Rad fest).
        if (Math.abs(off) >= 2) {
          // Nur auf die Kachel zu einrasten; wer von ihr wegscrollt, scrollt normal.
          if (Math.sign(off) !== dir) return;
          e.preventDefault();
          acc = 0;
          ziel = z;
          rastet = now + 900;
          main.scrollTo({ top: z, behavior: reduziert() ? 'auto' : 'smooth' });
          return;
        }
      }
      const i = target.current;
      const ende = dir < 0 ? i <= 0 : i >= lage.current.n - 1;
      if (now < ruhigBis && !neu) return void e.preventDefault();
      ruhigBis = 0;
      if (ende) {
        // Freigeben – aber nicht, solange der Schwung der letzten Drehung noch nachläuft; die Frist läuft ab dem
        // letzten Schritt und wird nicht verlängert, so bleibt niemand am Ende hängen.
        if (now - letzterSchritt < SCHLUCKEN_MS && !neu) return void e.preventDefault();
        letzterSchritt = -1e9;
        acc = 0;
        return;
      }
      e.preventDefault();
      if (pause > 250 || Math.sign(acc) !== dir) acc = 0;
      acc = clamp(acc + dy, -SCHWELLE * 1.5, SCHWELLE * 1.5);
      if (Math.abs(acc) >= SCHWELLE && now - letzterSchritt >= SCHRITT_MS) {
        acc -= dir * SCHWELLE;
        letzterSchritt = now;
        drehen(i + dir);
      }
    };
    kachel.addEventListener('wheel', onWheel, { passive: false });
    return () => kachel.removeEventListener('wheel', onWheel);
  }, [drehen]);

  // Ziehen auf dem Bogen (Finger oder Maus): senkrecht = drehen, Schwung beim Loslassen. Antippen wählt per click.
  const schritt = g ? g.boxH * 0.94 + g.gap : 80;
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || zug.current) return;
    zug.current = { id: e.pointerId, y0: e.clientY, p0: posRef.current, moved: false, spuren: [{ t: e.timeStamp, y: e.clientY }] };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const z = zug.current;
    if (!z || z.id !== e.pointerId) return;
    const dy = e.clientY - z.y0;
    if (!z.moved) {
      if (Math.abs(dy) < 6) return;
      z.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      laufen();
    }
    // Über die Enden hinaus nur gedämpft (Gummiband).
    const roh = z.p0 - dy / schritt;
    const max = lage.current.n - 1;
    posRef.current = roh < 0 ? roh / 3 : roh > max ? max + (roh - max) / 3 : roh;
    // Name, Akzentring und Ansage folgen der Schachtel, die gerade in der Mitte liegt.
    const mitte = clamp(Math.round(posRef.current), 0, max);
    if (mitte !== target.current) {
      target.current = mitte;
      setZiele((zz) => ({ ...zz, [lage.current.marke]: mitte }));
    }
    z.spuren.push({ t: e.timeStamp, y: e.clientY });
    if (z.spuren.length > 6) z.spuren.shift();
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const z = zug.current;
    if (!z || z.id !== e.pointerId) return;
    zug.current = null;
    if (!z.moved) return;
    zugEnde.current = performance.now();
    // Schwung aus den letzten ~100 ms (Index je ms), weitergedacht über 250 ms.
    const a = z.spuren.find((s) => e.timeStamp - s.t < 100) ?? z.spuren.at(-1)!;
    const dt = e.timeStamp - a.t;
    const v = e.type === 'pointerup' && dt > 0 ? -(e.clientY - a.y) / schritt / dt : 0;
    drehen(posRef.current + clamp(v * 200, -6, 6));
  };
  const pick = (i: number) => {
    // Ein Klick direkt nach dem Ziehen ist kein Antippen.
    if (performance.now() - zugEnde.current < 250) return;
    drehen(i);
  };

  // Marken-Schalter (role=tablist): Pfeile links/rechts, Pos1/Ende wechseln und fokussieren (roving tabindex).
  const markenTaste = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = MARKEN.indexOf(marke);
    const k = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: MARKEN.length - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    const m = MARKEN[(k + MARKEN.length) % MARKEN.length];
    markeWechseln(m);
    document.getElementById(`rad-marke-${m}`)?.focus();
  };

  const tryIt = () => entry && void beispielInEditor(foto, entry.id);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = target.current;
    const next = { ArrowUp: i - 1, ArrowLeft: i - 1, ArrowDown: i + 1, ArrowRight: i + 1, PageUp: i - 4, PageDown: i + 4, Home: 0, End: n - 1 }[e.key];
    if (next !== undefined) {
      e.preventDefault();
      drehen(next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      tryIt();
    }
  };

  // Hintergrund: der aktive Look in Bildschirmgröße, erst wenn das Rad ruht (veraltete Aufträge fallen weg).
  // Zwei Ebenen: das neue Bild blendet über dem alten ein; ein anderes Foto ersetzt alles erst, wenn es gerechnet ist.
  const [layers, setLayers] = useState<{ photo: Foto; items: { key: string; url: string }[] }>({ photo: foto, items: [] });
  const [bgFehler, setBgFehler] = useState(false);
  // „Erneut versuchen“: zählt hoch, stößt Hintergrund und Sichtfenster neu an (die Werkstatt vergisst Fehlschläge).
  const [versuch, setVersuch] = useState(0);
  const lookId = entry?.id;
  const bgKey = `${foto}|${lookId}`;
  useEffect(() => {
    if (!near || !ruhe || !werkstatt || !lookId) return;
    let live = true;
    let job: ReturnType<typeof werkstatt.request> | null = null;
    const nachbarn: ReturnType<typeof werkstatt.request>[] = [];
    const t = window.setTimeout(() => {
      job = werkstatt.request(foto, lookId, GROSS, 3);
      job.promise.then(
        (url) => {
          if (!live) return;
          setBgFehler(false);
          setLayers((l) => {
            const item = { key: `${foto}|${lookId}`, url };
            const keep = l.photo === foto ? l.items.filter((x) => x.url !== url).slice(-1) : [];
            return { photo: foto, items: [...keep, item] };
          });
          // Danach die Nachbarn vorab (wartet, bis niemand scrollt): das nächste Drehen zeigt sofort das Bild.
          const i = liste.findIndex((x) => x.id === lookId);
          for (const nb of [liste[i + 1], liste[i - 1]]) if (nb) nachbarn.push(werkstatt.request(foto, nb.id, GROSS, 0));
          for (const j of nachbarn) j.promise.catch(() => {});
        },
        () => live && setBgFehler(true),
      );
    }, RUHE_MS);
    return () => {
      live = false;
      clearTimeout(t);
      job?.cancel();
      nachbarn.forEach((j) => j.cancel());
    };
  }, [near, ruhe, werkstatt, foto, lookId, liste, versuch]);

  const shown = layers.items.length > 0 ? layers.photo : foto;
  const beispiel = angaben(shown);
  const fertig = layers.items.at(-1)?.key === bgKey;
  const [originalKaputt, setOriginalKaputt] = useState(false);

  // Gedrückthalten auf dem Bild zeigt das Original (Finger und Maus); ein Wisch zum Scrollen bricht ab (pointercancel).
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef(0);
  const peekStart = useRef<{ x: number; y: number } | null>(null);
  const peekAn = (e: PointerEvent) => {
    if (e.button !== 0) return;
    clearTimeout(peekTimer.current);
    peekStart.current = { x: e.clientX, y: e.clientY };
    // Finger: erst nach einer Weile ohne Bewegung, damit der Beginn eines Wischs nicht kurz das Original zeigt.
    peekTimer.current = window.setTimeout(() => setPeek(true), e.pointerType === 'mouse' ? 0 : 280);
  };
  const peekBewegt = (e: PointerEvent) => {
    const s = peekStart.current;
    if (s && !peek && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 6) clearTimeout(peekTimer.current);
  };
  const peekAus = () => {
    clearTimeout(peekTimer.current);
    peekStart.current = null;
    setPeek(false);
  };
  useEffect(() => () => clearTimeout(peekTimer.current), []);

  // Nur die Spalte der sichtbaren Schachteln gehört dem Rad (touch-action: none); daneben, darüber und darunter
  // scrollt die Seite.
  const links = g ? Math.max(0, g.xMitte - g.boxW / 2 - 12) : 0;
  const reichweite = g ? hub(SICHTBAR - 0.7, g.boxH, g.gap) + g.boxH * 0.35 : 0;
  const oben = g ? Math.max(0, Math.round(g.cy - reichweite)) : 0;
  const unten = g ? Math.max(0, Math.round(size.h - g.cy - reichweite)) : 0;

  return (
    <section ref={sectionRef} id="alle-looks" aria-labelledby="rad-titel" className="px-5 py-16 sm:py-24">
      <div ref={inhaltRef}>
        <Kopf className={SPALTE} mittig id="rad-titel" nr="02" name="Look-Rad" rechts={`${total} Looks`} title="Das Look-Rad.">
          <span className="pointer-coarse:hidden">
            Live gerechnet, mit derselben Engine wie im Editor. Mausrad oder ↑ ↓ dreht das Rad, ein Klick holt eine Schachtel nach
            vorn. Bild gedrückt halten zeigt das Original.
          </span>
          <span className="hidden pointer-coarse:inline">Live gerechnet wie im Editor. Wischen dreht das Rad, Gedrückthalten zeigt das Original.</span>
        </Kopf>

        {/* Bühne: Marke über, Fotowahl unter der Kachel; am Handy quer (wenig Höhe) beide in einer Zeile darüber. */}
        <div
          ref={buehneRef}
          className={`mt-6 sm:mt-8 ${BREITE} [@media(max-height:520px)]:grid [@media(max-height:520px)]:w-[min(100%,calc((100svh-6rem)*2))] [@media(max-height:520px)]:grid-cols-[auto_auto] [@media(max-height:520px)]:items-center [@media(max-height:520px)]:justify-between`}
        >
          <div role="tablist" aria-label="Marke" className="mx-auto flex w-full rounded-full border border-line bg-panel p-1 sm:w-fit [@media(max-height:520px)]:mx-0">
            {MARKEN.map((m) => {
              const on = m === marke;
              const count = entries.filter((e) => e.category === m).length;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  id={`rad-marke-${m}`}
                  aria-selected={on}
                  aria-controls="look-rad"
                  tabIndex={on ? 0 : -1}
                  onClick={() => markeWechseln(m)}
                  onKeyDown={markenTaste}
                  className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-[14px] font-medium transition min-[420px]:px-3.5 sm:min-h-11 sm:flex-none sm:px-5 sm:text-[15px] ${
                    on ? 'bg-raised text-fg ring-1 ring-accent/60' : 'text-dim hover:bg-raised/60 hover:text-fg'
                  }`}
                >
                  {CATEGORY_LABELS[m]}
                  {/* Unter 390 px passen vier Marken nur ohne Anzahl in die Leiste. */}
                  <span className={`text-xs tabular-nums max-[389px]:hidden ${on ? 'text-accent' : 'text-dim/70'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Kachel: festes Format (Handy 4:5, quer 2:1, sonst 3:2), höhenbegrenzt, nie an die Fenstergröße gekoppelt. */}
          <div
            ref={kachelRef}
            id="rad-kachel"
            className="@container relative isolate mt-4 aspect-[4/5] max-h-[calc(100svh-17rem)] w-full overflow-hidden rounded-2xl bg-raised shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/5 select-none sm:aspect-[3/2] sm:max-h-none [@media(max-height:520px)]:col-span-2 [@media(max-height:520px)]:row-start-2 [@media(max-height:520px)]:mt-3 [@media(max-height:520px)]:aspect-[2/1]"
          >
            {/* Hintergrund */}
            <div
              className="no-callout absolute inset-0 touch-pan-y"
              onPointerDown={peekAn}
              onPointerMove={peekBewegt}
              onPointerUp={peekAus}
              onPointerCancel={peekAus}
              onPointerLeave={peekAus}
              onContextMenu={(e) => e.preventDefault()}
            >
              {gesehen && !originalKaputt ? (
                <img
                  key={shown}
                  src={beispielUrl(shown)}
                  alt=""
                  decoding="async"
                  draggable={false}
                  onError={() => setOriginalKaputt(true)}
                  className="absolute inset-0 size-full object-cover"
                  style={{ objectPosition: beispiel.pos }}
                />
              ) : (
                !originalKaputt && <span className="platzhalter absolute inset-0" />
              )}
              {layers.items.map((l) => (
                <img
                  key={l.url}
                  src={l.url}
                  alt={l.key === bgKey && entry ? `Beispielfoto ${beispiel.label} mit ${entry.name}` : ''}
                  draggable={false}
                  className="rad-hg ueberblenden absolute inset-0 size-full object-cover"
                  style={{ objectPosition: beispiel.pos }}
                />
              ))}
              {gesehen && !originalKaputt && (
                <img
                  src={beispielUrl(shown)}
                  alt=""
                  draggable={false}
                  className={`absolute inset-0 size-full object-cover transition-opacity duration-200 motion-reduce:transition-none ${peek ? 'opacity-100' : 'opacity-0'}`}
                  style={{ objectPosition: beispiel.pos }}
                />
              )}
            </div>

            {/* Lesbarkeit: Verlauf unten links (Text) und rechts hinter dem Bogen. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/90 via-black/65 via-40% to-transparent" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_0%_100%,rgb(0_0_0/0.6),transparent)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_75%_at_100%_50%,rgb(0_0_0/0.55),transparent)] max-sm:bg-[radial-gradient(ellipse_70%_60%_at_100%_45%,rgb(0_0_0/0.5),transparent)]"
            />

            {peek && (
              <span className="pointer-events-none absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3.5 py-1 text-sm font-medium text-white backdrop-blur-md">
                Original
              </span>
            )}

            {/* Unten links: der aktive Look, bis kurz vor die aktive Schachtel (sie ragt am weitesten nach links). */}
            {entry && (
              <div
                className="pointer-events-none absolute bottom-0 left-0 z-20 p-4 pr-0 sm:p-7 sm:pr-0 [@media(max-height:520px)]:p-4 [@media(max-height:520px)]:pr-0"
                style={{ width: g ? Math.min(g.xMitte - g.boxW / 2 - 12, 600) : undefined }}
              >
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75 [text-shadow:0_1px_12px_rgb(0_0_0/0.6)] sm:text-xs">
                  {CATEGORY_LABELS[marke]}
                  <span className="tabular-nums text-white/55">
                    {index + 1} / {n}
                  </span>
                  {near && !fertig && !bgFehler && <Spinner className="size-3 border-white/60" />}
                  {bgFehler && (
                    <button
                      type="button"
                      onClick={() => {
                        setBgFehler(false);
                        setVersuch((v) => v + 1);
                      }}
                      className="pointer-events-auto inline-flex min-h-8 items-center gap-1.5 rounded-full bg-black/55 px-3 text-xs font-medium tracking-normal normal-case text-white backdrop-blur-md transition hover:bg-black/70"
                    >
                      <TriangleAlert size={13} className="text-accent" aria-hidden />
                      Live-Vorschau nicht verfügbar
                      <span className="inline-flex items-center gap-1 text-accent">
                        <RotateCcw size={12} aria-hidden />
                        Erneut versuchen
                      </span>
                    </button>
                  )}
                </p>
                <p
                  key={entry.id}
                  className="ueberblenden mt-1.5 text-[length:clamp(24px,5.4cqw,54px)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance break-words text-white [text-shadow:0_1px_18px_rgb(0_0_0/0.45)]"
                >
                  {entry.name}
                </p>
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/75 [text-shadow:0_1px_18px_rgb(0_0_0/0.45)] sm:text-[15px] [@media(max-height:520px)]:line-clamp-1">
                  <span className="sm:hidden">{kurz(entry.description)}.</span>
                  <span className="max-sm:hidden">{entry.description.replace(/\s*Rezept: .*$/, '')}</span>
                </p>
                <button
                  type="button"
                  onClick={tryIt}
                  className="pointer-events-auto group mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold whitespace-nowrap text-ink shadow-[0_10px_30px_-10px_rgb(0_0_0/0.8)] transition hover:bg-accent sm:mt-5 sm:gap-2 sm:px-5 sm:text-[15px] [@media(max-height:520px)]:mt-3"
                >
                  Diesen Look ausprobieren
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              </div>
            )}

            {/* Rechts: das Rad. Wo der Bogen oben und unten aus der Kachel läuft, blenden die Schachteln weich aus statt hart
                abzubrechen; die Maske liegt auf der ganzen Kachel, sonst schnitte sie die Schatten links am Rad gerade ab. */}
            {g && (
              <div className="pointer-events-none absolute inset-0 z-10 [mask-image:linear-gradient(to_bottom,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]">
                <div
                  id="look-rad"
                  role="listbox"
                  tabIndex={0}
                  aria-label={`${CATEGORY_LABELS[marke]}-Looks`}
                  aria-activedescendant={entry ? `rad-${entry.id}` : undefined}
                  data-pos={pos.toFixed(3)}
                  onKeyDown={onKey}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  className="no-callout pointer-events-auto absolute right-0 touch-none outline-none"
                  style={{ left: links, top: oben, bottom: unten }}
                >
                  {liste.map((e, i) => (
                    <RadBox
                      key={`${marke}-${e.id}-${versuch}`}
                      entry={e}
                      d={i - pos}
                      g={g}
                      links={links}
                      oben={oben}
                      hoehe={size.h}
                      photo={foto}
                      edge={edge}
                      enabled={near}
                      gesehen={gesehen}
                      aktiv={i === index}
                      index={i}
                      n={n}
                      onPick={() => pick(i)}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="sr-only" aria-live="polite">
              {entry ? `${entry.name}, ${index + 1} von ${n}` : ''}
            </p>
          </div>

          <FotoWahl
            value={photo}
            onChange={onPhoto}
            className="mt-4 justify-center [@media(max-height:520px)]:col-start-2 [@media(max-height:520px)]:row-start-1 [@media(max-height:520px)]:mt-0"
          />
        </div>
      </div>
    </section>
  );
}
