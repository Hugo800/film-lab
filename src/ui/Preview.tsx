import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { AlertTriangle, MoveHorizontal } from 'lucide-react';
import { builtinEntries, lutFor, NONE_ENTRY, NONE_ID } from './lookRegistry';
import { getEngine, describeError, getSourceFor, startEngine } from './session';
import { activePhoto, useStore, type CustomLut } from './store';
import { Message, Spinner, Button } from './controls';
import { useGestures } from './gestures';

// Mehr Pixel als das bringen weder Vorschau noch Auge, und die GPU-Zeit pro Regleränderung steigt.
const MAX_BUFFER_PIXELS = 4_000_000;
// Lupe: sichtbare Fläche höchstens 4 MP, gerechnet wird mit 50 % Rand je Seite für das Verschieben.
// Die Engine lädt höchstens 4096 px samt Filterrand (4 px je Seite) hoch.
const ZOOM_VIEW_PIXELS = 4_000_000;
const ZOOM_MAX_EDGE = 4096 - 16;
const ZOOM_DEBOUNCE_MS = 150;
const LOOK_CHIP_MS = 1200;
const RAW_NAME = /\.(arw|dng|srf|sr2|cr2|cr3|nef|raf|orf|rw2)$/i;
// Wie die Tastenkürzel im Editor: hier gehört die Leertaste dem Bedienelement.
const OWN_KEYS = 'input, textarea, select, [contenteditable], [role=slider], [role=radio], [role=tab]';
// Z, B, Esc und \ braucht nur ein Textfeld selbst (Regler und Segmente nicht).
const TEXT = 'textarea, select, [contenteditable], input:not([type=range]):not([type=checkbox]):not([type=radio])';

type Rect = { x0: number; y0: number; x1: number; y1: number };

function fit(stageW: number, stageH: number, imgW: number, imgH: number, pad: number) {
  const aw = Math.max(0, stageW - pad * 2);
  const ah = Math.max(0, stageH - pad * 2);
  if (!imgW || !imgH || !aw || !ah) return { w: 0, h: 0 };
  const k = Math.min(aw / imgW, ah / imgH);
  return { w: Math.floor(imgW * k), h: Math.floor(imgH * k) };
}

/** Quellpixel je CSS-Pixel in der Lupe: 1 Quellpixel = 1 Gerätepixel, solange die Fläche unter 4 MP bleibt. */
function zoomScale(w: number, h: number) {
  return Math.min(window.devicePixelRatio || 1, Math.sqrt(ZOOM_VIEW_PIXELS / Math.max(1, w * h)));
}

/** Mittelpunkt so begrenzen, dass die Lupe im Bild bleibt (kleinere Bilder mittig). */
function clampAxis(v: number, img: number, view: number) {
  return img <= view ? img / 2 : Math.min(img - view / 2, Math.max(view / 2, v));
}

function lookName(id: string, custom: CustomLut[]): string {
  if (id === NONE_ID) return NONE_ENTRY.name;
  return builtinEntries().find((e) => e.id === id)?.name ?? custom.find((l) => l.id === id)?.name ?? '';
}

/** `viaTab`: Der Fokus kam per Tab, nicht per Klick (:focus-visible taugt nicht, Chrome setzt es bei jedem Tastendruck). */
function blockedKey(e: globalThis.KeyboardEvent, viaTab: boolean) {
  const t = e.target instanceof Element ? e.target : null;
  if (document.querySelector('[aria-modal=true]')) return true;
  if (e.key !== ' ') return !!t?.closest(TEXT);
  // Per Tab erreichte Knöpfe löst die Leertaste aus; nach einem Klick zeigt sie weiter das Original.
  return !!t?.closest(OWN_KEYS) || (viaTab && !!t?.closest('button, a[href], summary, [role=button]'));
}

export function Preview() {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [pointerHeld, setPointerHeld] = useState(false);
  const [keyHeld, setKeyHeld] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  // Lupe: Mittelpunkt in Quellpixeln (null = Bildmitte), laufendes Ziehen in CSS-Pixeln, gezeigter Ausschnitt.
  const [view, setView] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [shown, setShown] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [chip, setChip] = useState<string | null>(null);
  const [rawSecs, setRawSecs] = useState(0);

  const source = useStore((s) => s.source);
  const photo = useStore(activePhoto);
  const compare = useStore((s) => s.compare);
  const zoom = useStore((s) => s.zoom);
  const split = useStore((s) => s.split);
  const engineReady = useStore((s) => s.engineReady);
  const engineError = useStore((s) => s.engineError);
  const lutEpoch = useStore((s) => s.lutEpoch);
  const customLuts = useStore((s) => s.customLuts);
  const patch = useStore((s) => s.patch);
  const removePhoto = useStore((s) => s.removePhoto);
  const stepLook = useStore((s) => s.stepLook);

  const held = pointerHeld || keyHeld;
  const ready = source.status === 'bereit' && source.photoId === photo?.id;
  const pad = stage.w >= 1024 ? 24 : 12;
  const size = fit(stage.w, stage.h, source.width, source.height, pad);
  const imgW = source.width;
  const imgH = source.height;

  const problem = engineError
    ? { title: 'Die Bildverarbeitung startet nicht', text: `${engineError}. Dein Browser braucht WebGL 2 – aktuelles Safari, Chrome, Edge oder Firefox.` }
    : source.status === 'fehler'
      ? { title: 'Das Foto lässt sich nicht öffnen', text: source.error ?? '' }
      : renderError
        ? { title: 'Die Vorschau hat einen Fehler', text: renderError }
        : null;
  const usable = ready && !problem;
  const usableRef = useRef(usable);
  usableRef.current = usable;

  // Frischer Canvas pro Engine: ein zweiter getContext nach dispose() (StrictMode) wäre ein verlorener Kontext.
  useLayoutEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'block size-full';
    frameRef.current?.appendChild(canvas);
    canvasRef.current = canvas;
    const stop = startEngine(canvas);
    return () => {
      stop();
      canvas.remove();
      canvasRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_BUFFER_PIXELS / (size.w * size.h)));
    const w = Math.max(1, Math.round(size.w * dpr));
    const h = Math.max(1, Math.round(size.h * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }, [size.w, size.h]);

  const lookId = photo?.settings.lookId;
  const params = photo?.settings.params;
  const photoId = photo?.id;

  useEffect(() => {
    const engine = getEngine();
    if (!engine || !lookId) return;
    try {
      engine.setLut(lutFor(lookId));
      setRenderError(null);
    } catch (err) {
      setRenderError(`Look konnte nicht erzeugt werden: ${describeError(err)}`);
    }
  }, [lookId, engineReady, source.version, lutEpoch]);

  // Ein Frame pro Änderung: jede neue Abhängigkeit verwirft den noch nicht gezeichneten Frame davor.
  // Im Zoom ruht die Vorschau; beim Verlassen rechnet sie mit dem aktuellen Stand neu.
  useEffect(() => {
    if (!ready || !params || !size.w || zoom) return;
    const id = requestAnimationFrame(() => {
      const engine = getEngine();
      if (!engine) return;
      try {
        engine.render(params, { showOriginal: held, split: compare ? split : undefined });
      } catch (err) {
        setRenderError(`Vorschau fehlgeschlagen: ${describeError(err)}`);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [ready, params, held, compare, split, engineReady, source.version, size.w, size.h, lookId, zoom]);

  // --- 100-%-Lupe ---
  const k = zoomScale(stage.w, stage.h);
  const viewW = stage.w * k;
  const viewH = stage.h * k;
  const center = {
    x: clampAxis(view?.x ?? imgW / 2, imgW, viewW),
    y: clampAxis(view?.y ?? imgH / 2, imgH, viewH),
  };
  // Für den einmal registrierten wheel-Handler.
  const geo = useRef({ center, k, imgW, imgH, viewW, viewH });
  geo.current = { center, k, imgW, imgH, viewW, viewH };
  /** Verschieben per Rad: den nächsten Ausschnitt entprellt rechnen. */
  const wheelPan = useRef(false);
  const shownCenter = drag
    ? { x: clampAxis(center.x - drag.dx * k, imgW, viewW), y: clampAxis(center.y - drag.dy * k, imgH, viewH) }
    : center;

  useEffect(() => {
    if (zoom) return;
    setView(null);
    setDrag(null);
    setShown(null);
    setBusy(false);
  }, [zoom]);

  const lastZoomParams = useRef<unknown>(null);
  useEffect(() => {
    if (!zoom || !usable || !params || !lookId || !photoId || !viewW) return;
    const engine = getEngine();
    const src = getSourceFor(photoId);
    if (!engine || !src) return;
    const outW = Math.min(ZOOM_MAX_EDGE, imgW, Math.round(viewW * 2));
    const outH = Math.min(ZOOM_MAX_EDGE, imgH, Math.round(viewH * 2));
    const x0 = Math.min(imgW - outW, Math.max(0, Math.round(center.x - outW / 2)));
    const y0 = Math.min(imgH - outH, Math.max(0, Math.round(center.y - outH / 2)));
    const rect = { x0, y0, x1: x0 + outW, y1: y0 + outH };
    // Reglerziehen entprellen; Verschieben, Halten und der erste Ausschnitt rechnen sofort.
    const delay = (lastZoomParams.current && lastZoomParams.current !== params) || wheelPan.current ? ZOOM_DEBOUNCE_MS : 0;
    wheelPan.current = false;
    lastZoomParams.current = params;
    const ac = new AbortController();
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const bmp = await engine.renderRegion(src, lutFor(lookId), params, rect, outW, outH, { showOriginal: held, signal: ac.signal });
        const canvas = zoomCanvasRef.current;
        if (ac.signal.aborted || !canvas) {
          bmp.close();
          return;
        }
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext('2d')?.drawImage(bmp, 0, 0);
        bmp.close();
        setShown(rect);
        setBusy(false);
      } catch (err) {
        if (ac.signal.aborted) return;
        setBusy(false);
        useStore.getState().notify(`100 % nicht möglich: ${describeError(err)}`, 'fehler');
        patch({ zoom: false });
      }
    }, delay);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [zoom, usable, params, lookId, photoId, held, center.x, center.y, viewW, viewH, imgW, imgH, source.version, lutEpoch, engineReady, patch]);

  useEffect(() => {
    if (!zoom) lastZoomParams.current = null;
  }, [zoom]);

  /** Lupe an, mittig auf diesem Punkt (Client-Koordinaten) bzw. auf der Bildmitte. */
  const zoomIn = (clientX?: number, clientY?: number) => {
    const r = frameRef.current?.getBoundingClientRect();
    const { width, height } = useStore.getState().source;
    if (r && r.width && clientX !== undefined && clientY !== undefined) {
      setView({ x: ((clientX - r.left) / r.width) * width, y: ((clientY - r.top) / r.height) * height });
    } else setView(null);
    patch({ zoom: true });
  };
  const zoomInRef = useRef(zoomIn);
  zoomInRef.current = zoomIn;

  const gestures = useGestures(zoom, {
    hold: (on) => setPointerHeld(on),
    double: (x, y) => (zoom ? patch({ zoom: false }) : zoomIn(x, y)),
    swipe: (dir) => stepLook(dir),
    pan: (dx, dy, end) => {
      if (!end) return setDrag({ dx, dy });
      setDrag(null);
      if (dx || dy) setView({ x: clampAxis(center.x - dx * k, imgW, viewW), y: clampAxis(center.y - dy * k, imgH, viewH) });
    },
  });

  // Strg+Mausrad: nach oben Lupe am Zeiger, nach unten zurück. Ohne Strg verschiebt das Rad die Lupe
  // (mit Shift waagerecht). React meldet wheel nur passiv.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        if (!useStore.getState().zoom || !usableRef.current) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
        const sideways = e.shiftKey && !e.deltaX;
        const dx = (sideways ? e.deltaY : e.deltaX) * unit;
        const dy = (sideways ? 0 : e.deltaY) * unit;
        const g = geo.current;
        wheelPan.current = true;
        setView({ x: clampAxis(g.center.x + dx * g.k, g.imgW, g.viewW), y: clampAxis(g.center.y + dy * g.k, g.imgH, g.viewH) });
        return;
      }
      e.preventDefault();
      if (!usableRef.current) return;
      const on = useStore.getState().zoom;
      if (e.deltaY < 0 && !on) zoomInRef.current(e.clientX, e.clientY);
      else if (e.deltaY > 0 && on) useStore.getState().patch({ zoom: false });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Tasten: Leertaste/\ halten = Original, Z = Lupe, B = Vergleich, Esc verlässt die Lupe.
  // Die haltende Taste per e.code: Lässt man AltGr vor ß los, meldet keyup „ß“ statt „\“.
  const heldCode = useRef('');
  useEffect(() => {
    let viaTab = false;
    const pointer = () => (viaTab = false);
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Tab') viaTab = true;
      if (!usableRef.current || blockedKey(e, viaTab)) return;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      const s = useStore.getState();
      // Backslash kommt auf deutschen Tastaturen mit AltGr (= Strg+Alt).
      if (e.key === '\\' || (e.key === ' ' && plain)) {
        e.preventDefault();
        if (!e.repeat) {
          heldCode.current = e.code;
          setKeyHeld(true);
        }
      } else if (plain && !e.repeat && (e.key === 'z' || e.key === 'Z')) {
        if (s.zoom) s.patch({ zoom: false });
        else zoomInRef.current();
      } else if (plain && !e.repeat && (e.key === 'b' || e.key === 'B') && !s.zoom) {
        s.patch({ compare: !s.compare });
      } else if (e.key === 'Escape' && s.zoom) {
        e.preventDefault();
        s.patch({ zoom: false });
      }
    };
    const up = (e: globalThis.KeyboardEvent) => {
      if (e.key === ' ' || e.key === '\\' || (heldCode.current && e.code === heldCode.current)) {
        heldCode.current = '';
        setKeyHeld(false);
      }
    };
    const reset = () => {
      heldCode.current = '';
      setKeyHeld(false);
      setPointerHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    window.addEventListener('pointerdown', pointer, true);
    return () => {
      window.removeEventListener('pointerdown', pointer, true);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, []);

  // Look-Name kurz auf dem Bild, wenn der Look wechselt (nicht beim ersten Bild, nicht beim Fotowechsel).
  const prevLook = useRef<{ photoId?: string; lookId?: string } | null>(null);
  useEffect(() => {
    const prev = prevLook.current;
    prevLook.current = { photoId, lookId };
    if (!prev || prev.photoId !== photoId || !lookId) {
      setChip(null);
      return;
    }
    setChip(lookName(lookId, useStore.getState().customLuts));
    const t = setTimeout(() => setChip(null), LOOK_CHIP_MS);
    return () => clearTimeout(t);
  }, [photoId, lookId]);

  const rawLoading = !problem && source.status === 'laden' && RAW_NAME.test(photo?.name ?? '');
  useEffect(() => {
    if (!rawLoading) return;
    const t0 = Date.now();
    setRawSecs(0);
    const id = setInterval(() => setRawSecs(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(id);
  }, [rawLoading, photoId]);

  const dragSplit = (e: PointerEvent<HTMLElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const rect = frameRef.current!.getBoundingClientRect();
    patch({ split: Math.min(0.98, Math.max(0.02, (e.clientX - rect.left) / rect.width)) });
  };

  const onSplitKey = (e: KeyboardEvent<HTMLElement>) => {
    const d = e.key === 'ArrowLeft' ? -0.02 : e.key === 'ArrowRight' ? 0.02 : 0;
    if (d) {
      e.preventDefault();
      patch({ split: Math.min(0.98, Math.max(0.02, split + d)) });
    }
  };

  const showZoom = zoom && usable;
  const label = held ? 'Original' : chip;
  // Etiketten unten mittig auf dem Bild bzw. auf der Lupe.
  const labelBottom = showZoom ? 12 : Math.max(12, (stage.h - size.h) / 2 + 8);

  return (
    <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={frameRef}
          className="no-callout relative touch-none overflow-hidden rounded-sm bg-raised"
          style={{ width: size.w, height: size.h, visibility: usable ? 'visible' : 'hidden', position: usable ? 'relative' : 'absolute' }}
          {...gestures}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Vorschau. Gedrückt halten zeigt das Original."
          role="img"
        >
          {usable && compare && !zoom && (
            <>
              <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">Vorher</span>
              <span className="pointer-events-none absolute right-2 top-2 max-w-[60%] truncate rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">
                Nachher{lookId && lookId !== NONE_ID ? ` · ${lookName(lookId, customLuts)}` : ''}
              </span>
              <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split * 100}%` }}>
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label="Vorher-Nachher-Teiler"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(split * 100)}
                  aria-orientation="horizontal"
                  className="pointer-events-auto absolute inset-y-0 -left-[22px] flex w-11 cursor-ew-resize touch-none justify-center"
                  onPointerDown={(e) => {
                    e.stopPropagation(); // kein „Original halten“ beim Greifen des Teilers
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={dragSplit}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onKeyDown={onSplitKey}
                >
                  <div className="h-full w-0.5 bg-white/90 shadow-[0_0_4px_rgb(0_0_0/0.6)]" />
                  <div className="absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
                    <MoveHorizontal size={18} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showZoom && (
        <>
          <div
            className={`no-callout absolute inset-0 touch-none overflow-hidden ${drag ? 'cursor-grabbing' : 'cursor-grab'} ${shown ? 'bg-ink' : ''}`}
            {...gestures}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Ansicht 100 %. Ziehen verschiebt den Ausschnitt."
            role="img"
          >
            <canvas
              ref={zoomCanvasRef}
              className="absolute left-0 top-0 block origin-top-left"
              style={
                shown
                  ? {
                      width: (shown.x1 - shown.x0) / k,
                      height: (shown.y1 - shown.y0) / k,
                      transform: `translate(${(shown.x0 - (shownCenter.x - viewW / 2)) / k}px, ${(shown.y0 - (shownCenter.y - viewH / 2)) / k}px)`,
                    }
                  : { visibility: 'hidden' }
              }
            />
          </div>
          <button
            type="button"
            onClick={() => patch({ zoom: false })}
            title="Ganzansicht (Z, Esc, Doppelklick)"
            aria-label="100 %, zurück zur Ganzansicht"
            className="absolute left-2 top-2 flex h-8 items-center gap-2 rounded-full bg-black/60 px-3 text-sm font-medium text-white backdrop-blur-sm before:absolute before:-inset-1.5 before:content-[''] hover:bg-black/75"
          >
            100 %
            {busy && <Spinner className="size-3.5" />}
          </button>
        </>
      )}

      <div
        className="pointer-events-none absolute inset-x-0 flex justify-center px-4"
        style={{ bottom: labelBottom, visibility: usable ? 'visible' : 'hidden' }}
        aria-live="polite"
      >
        {label && (
          <span className="pointer-events-none max-w-full truncate rounded-full bg-black/60 px-3 py-1 text-xs text-white">{label}</span>
        )}
      </div>

      {problem && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <AlertTriangle size={28} className="text-danger" aria-hidden />
          <Message
            title={problem.title}
            action={
              photo &&
              !engineError && (
                <div className="mt-1 flex w-full flex-col gap-2">
                  <Button variant="primary" onClick={() => document.getElementById('datei-eingabe')?.click()}>
                    Anderes Foto wählen
                  </Button>
                  <Button onClick={() => removePhoto(photo.id)}>Foto entfernen</Button>
                </div>
              )
            }
          >
            {problem.text}
          </Message>
        </div>
      )}

      {!problem && source.status === 'laden' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/60 text-sm text-dim" role="status">
          <Spinner className="size-7" />
          {rawLoading ? (
            <>
              <span className="tabular-nums">RAW wird entwickelt …{rawSecs > 0 ? ` ${rawSecs} s` : ''}</span>
              <span className="text-xs text-dim/70">RAW-Dateien brauchen einige Sekunden.</span>
            </>
          ) : (
            'Foto wird geladen …'
          )}
        </div>
      )}
    </div>
  );
}
