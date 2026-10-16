import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Columns2, MoveHorizontal } from 'lucide-react';
import { lutFor } from './lookRegistry';
import { getEngine, describeError, startEngine } from './session';
import { activePhoto, useStore } from './store';
import { IconButton, Message, Spinner, Button } from './controls';

// Mehr Pixel als das bringen weder Vorschau noch Auge, und die GPU-Zeit pro Regleränderung steigt.
const MAX_BUFFER_PIXELS = 4_000_000;

function fit(stageW: number, stageH: number, imgW: number, imgH: number, pad: number) {
  const aw = Math.max(0, stageW - pad * 2);
  const ah = Math.max(0, stageH - pad * 2);
  if (!imgW || !imgH || !aw || !ah) return { w: 0, h: 0 };
  const k = Math.min(aw / imgW, ah / imgH);
  return { w: Math.floor(imgW * k), h: Math.floor(imgH * k) };
}

export function Preview() {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [held, setHeld] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const source = useStore((s) => s.source);
  const photo = useStore(activePhoto);
  const compare = useStore((s) => s.compare);
  const split = useStore((s) => s.split);
  const engineReady = useStore((s) => s.engineReady);
  const engineError = useStore((s) => s.engineError);
  const lutEpoch = useStore((s) => s.lutEpoch);
  const patch = useStore((s) => s.patch);
  const removePhoto = useStore((s) => s.removePhoto);

  const ready = source.status === 'bereit' && source.photoId === photo?.id;
  const pad = stage.w >= 1024 ? 24 : 12;
  const size = fit(stage.w, stage.h, source.width, source.height, pad);

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
  useEffect(() => {
    if (!ready || !params || !size.w) return;
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
  }, [ready, params, held, compare, split, engineReady, source.version, size.w, size.h, lookId]);

  const hold = (on: boolean) => (e: PointerEvent<HTMLElement>) => {
    if (on) e.currentTarget.setPointerCapture(e.pointerId);
    setHeld(on);
  };

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

  const problem = engineError
    ? { title: 'Die Bildverarbeitung startet nicht', text: `${engineError}. Dein Browser braucht WebGL 2 – aktuelles Safari, Chrome, Edge oder Firefox.` }
    : source.status === 'fehler'
      ? { title: 'Das Foto lässt sich nicht öffnen', text: source.error ?? '' }
      : renderError
        ? { title: 'Die Vorschau hat einen Fehler', text: renderError }
        : null;

  return (
    <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={frameRef}
          className="no-callout relative touch-none overflow-hidden rounded-sm bg-raised"
          style={{ width: size.w, height: size.h, visibility: ready && !problem ? 'visible' : 'hidden', position: ready && !problem ? 'relative' : 'absolute' }}
          onPointerDown={hold(true)}
          onPointerUp={hold(false)}
          onPointerCancel={hold(false)}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Vorschau. Gedrückt halten zeigt das Original."
          role="img"
        >
          {ready && !problem && compare && (
            <>
              <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">Vorher</span>
              <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">Nachher</span>
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
          {ready && !problem && held && (
            <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              Original
            </span>
          )}
        </div>
      </div>

      {problem && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Message
            title={problem.title}
            action={
              photo &&
              !engineError && (
                <Button onClick={() => removePhoto(photo.id)}>Foto entfernen</Button>
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
          Foto wird geladen …
        </div>
      )}

      {ready && !problem && (
        <IconButton
          label={compare ? 'Vorher-Nachher-Teiler ausblenden' : 'Vorher-Nachher-Teiler einblenden'}
          aria-pressed={compare}
          onClick={() => patch({ compare: !compare })}
          className={`absolute bottom-2 right-2 bg-black/55 backdrop-blur-sm hover:bg-black/70 ${compare ? 'text-accent' : ''}`}
        >
          <Columns2 size={20} />
        </IconButton>
      )}
    </div>
  );
}
