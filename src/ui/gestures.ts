// Zeigergesten der Bildfläche: Halten (Original), Doppeltipp, Wischen und im Zoom Verschieben.
// Ein Zustand für Finger, Stift und Maus; die Maus meldet ihren Doppelklick über dblclick.
import { useRef, type MouseEvent, type PointerEvent } from 'react';

const HOLD_MS = 150;
const SLOP_PX = 8;
const DOUBLE_MS = 300;
const DOUBLE_PX = 24;
const SWIPE_PX = 40;
const SWIPE_MS = 400;

export interface GestureHandlers {
  /** Nur im Einpass-Modus: „Original halten“ an/aus. */
  hold(on: boolean): void;
  /** Doppeltipp bzw. Doppelklick an diesem Punkt (Client-Koordinaten). */
  double(x: number, y: number): void;
  /** Nur im Einpass-Modus: 1 = nach links gewischt (nächster Look). */
  swipe(dir: 1 | -1): void;
  /** Nur im Zoom: Verschiebung seit dem Aufsetzen in CSS-Pixeln; `end` beim Loslassen. */
  pan(dx: number, dy: number, end: boolean): void;
}

interface Touch {
  id: number;
  x: number;
  y: number;
  t: number;
  moved: boolean;
  held: boolean;
}

export function useGestures(zoom: boolean, handlers: GestureHandlers) {
  const h = useRef(handlers);
  h.current = handlers;
  const g = useRef({
    count: 0,
    /** Mehr als ein Finger: bis alle oben sind, kein Halten, Tippen oder Wischen. */
    multi: false,
    touch: null as Touch | null,
    timer: 0,
    lastTap: null as { t: number; x: number; y: number } | null,
    mouse: false,
  });

  const release = (e: PointerEvent<HTMLElement>, cancel: boolean) => {
    const s = g.current;
    s.count = Math.max(0, s.count - 1);
    const t = s.touch;
    if (t && t.id === e.pointerId) {
      clearTimeout(s.timer);
      s.touch = null;
      if (t.held) h.current.hold(false);
      const dx = e.clientX - t.x;
      const dy = e.clientY - t.y;
      if (zoom) h.current.pan(dx, dy, true);
      if (!cancel && !s.multi && !t.held) {
        // Zeitstempel des Ereignisses statt Uhrzeit der Verarbeitung: rechnet die Seite gerade, kämen
        // beide Tipps eines Doppeltipps sonst verspätet und zu weit auseinander an.
        const now = e.timeStamp;
        if (!zoom && now - t.t < SWIPE_MS && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > 2 * Math.abs(dy)) {
          h.current.swipe(dx < 0 ? 1 : -1);
        } else if (!t.moved && !s.mouse) {
          const last = s.lastTap;
          if (last && t.t - last.t <= DOUBLE_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) <= DOUBLE_PX) {
            s.lastTap = null;
            h.current.double(e.clientX, e.clientY);
          } else s.lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
      }
    }
    if (s.count === 0) s.multi = false;
  };

  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const s = g.current;
      s.mouse = e.pointerType === 'mouse';
      e.currentTarget.setPointerCapture(e.pointerId);
      s.count++;
      if (s.count > 1 || s.multi) {
        s.multi = true;
        clearTimeout(s.timer);
        if (s.touch?.held) h.current.hold(false);
        if (s.touch && zoom) h.current.pan(0, 0, true);
        s.touch = null;
        return;
      }
      const t: Touch = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, moved: false, held: false };
      s.touch = t;
      if (!zoom) {
        s.timer = window.setTimeout(() => {
          if (s.touch !== t || t.moved) return;
          t.held = true;
          h.current.hold(true);
        }, HOLD_MS);
      }
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const t = g.current.touch;
      if (!t || t.id !== e.pointerId) return;
      const dx = e.clientX - t.x;
      const dy = e.clientY - t.y;
      if (!t.moved && Math.hypot(dx, dy) > SLOP_PX) {
        t.moved = true;
        clearTimeout(g.current.timer);
      }
      if (zoom) h.current.pan(dx, dy, false);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => release(e, false),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => release(e, true),
    onDoubleClick(e: MouseEvent<HTMLElement>) {
      // Finger lösen auf manchen Geräten zusätzlich dblclick aus; die zählen oben schon.
      if (g.current.mouse) h.current.double(e.clientX, e.clientY);
    },
  };
}
