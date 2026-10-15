import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './controls';

/** Unten ausfahrendes Blatt am Handy, zentrierter Dialog am PC. `onClose` fehlt = nicht schließbar. */
export function Dialog({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center"
      onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {onClose && (
            <IconButton label="Schließen" onClick={onClose} className="-mr-2">
              <X size={20} />
            </IconButton>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
