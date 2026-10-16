import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './controls';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusables = (root: HTMLElement | null) =>
  Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);

/** Sichtbarer Bereich bei offener Bildschirmtastatur (iOS und Chrome verkleinern nur den visuellen Viewport), sonst null. */
function useKeyboardBox() {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox(vv.scale > 1.01 || window.innerHeight - vv.height < 80 ? null : { top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return box;
}

/**
 * Unten ausfahrendes Blatt am Handy, zentrierter Dialog am PC. `onClose` fehlt = nicht schließbar.
 * `footer` (die Knöpfe, Primärknopf zuerst) bleibt unten stehen, der Inhalt scrollt.
 * `dirty`: ein Klick daneben schließt dann nicht (Esc und × schon).
 */
export function Dialog({
  title,
  onClose,
  footer,
  wide,
  dirty,
  children,
}: {
  title: string;
  onClose?: () => void;
  footer?: ReactNode;
  wide?: boolean;
  dirty?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const downOnBackdrop = useRef(false);
  const keyboard = useKeyboardBox();

  const lastFocus = useRef<EventTarget | null>(null);

  // Fokus beim Schließen zurück zum Auslöser (zur Renderzeit gemerkt: ein autoFocus im Inhalt hat ihn sonst schon verdrängt).
  const [opener] = useState(() => document.activeElement);
  useEffect(
    () => () => {
      lastFocus.current = null;
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true });
    },
    [opener],
  );

  // Startfokus ins erste bedienbare Element. Ohne Abhängigkeiten: auch wenn der fokussierte Knopf durch eine neue Phase ersetzt wurde
  // (ein Tipp auf den Hintergrund nimmt den Fokus dagegen bewusst weg).
  useEffect(() => {
    const p = panel.current;
    if (!p || p.contains(document.activeElement) || (lastFocus.current instanceof Node && lastFocus.current.isConnected)) return;
    const first = p.querySelector<HTMLElement>('[data-autofocus]') ?? focusables(body.current)[0] ?? focusables(foot.current)[0] ?? p;
    first.focus({ preventScroll: true });
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose?.();
      if (e.key !== 'Tab') return;
      const list = focusables(panel.current);
      const active = document.activeElement;
      if (list.length === 0) {
        e.preventDefault();
        return panel.current?.focus();
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (!panel.current?.contains(active) || (e.shiftKey && (active === first || active === panel.current))) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center"
      style={keyboard ? { top: keyboard.top, height: keyboard.height, bottom: 'auto' } : undefined}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onPointerUp={(e) => {
        const closing = downOnBackdrop.current && e.target === e.currentTarget && !dirty;
        downOnBackdrop.current = false;
        if (closing) onClose?.();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onFocus={(e) => (lastFocus.current = e.target)}
        className={`flex w-full flex-col rounded-t-2xl border border-line bg-panel outline-none sm:rounded-2xl ${keyboard ? 'max-h-full' : 'max-h-[90%]'} ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`}
      >
        <div className={`flex flex-none items-center justify-between gap-2 px-5 ${keyboard ? 'pt-2' : 'pb-3 pt-5'}`}>
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {onClose && (
            <IconButton label="Schließen" onClick={onClose} className="-mr-2">
              <X size={20} />
            </IconButton>
          )}
        </div>
        <div ref={body} className={`min-h-0 flex-1 overflow-y-auto px-5 ${footer ? 'pb-3' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'}`}>
          {children}
        </div>
        {footer && (
          <div
            ref={foot}
            className={`flex flex-none flex-col gap-2 bg-panel px-5 sm:flex-row-reverse sm:justify-start sm:rounded-b-2xl [&>button]:w-full sm:[&>button]:w-auto ${keyboard ? 'py-1.5' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3'}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
