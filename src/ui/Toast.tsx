import { useEffect } from 'react';
import { X } from 'lucide-react';
import { UNDO_MS, useStore } from './store';

export function Toast() {
  const notice = useStore((s) => s.notice);
  const dismiss = useStore((s) => s.dismissNotice);
  const editor = useStore((s) => s.photos.length > 0);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismiss, notice.action ? UNDO_MS : notice.kind === 'fehler' ? 8000 : 4500);
    return () => clearTimeout(t);
  }, [notice, dismiss]);

  if (!notice) return null;
  // Am Handy unter der Kopfzeile, in der Seitenleisten-Ansicht unten über der Bühne.
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+56px)] z-[60] flex justify-center px-4 side:top-auto side:bottom-20 ${
        editor ? 'side:right-[clamp(300px,30vw,420px)]' : ''
      }`}
    >
      <div
        role={notice.kind === 'fehler' ? 'alert' : 'status'}
        className={`pointer-events-auto flex max-w-md items-center gap-1 rounded-2xl border py-1 pl-4 pr-1 text-sm shadow-xl backdrop-blur ${
          notice.kind === 'fehler' ? 'border-danger/50 bg-[#2a1613]/95 text-fg' : 'border-line bg-raised/95 text-fg'
        }`}
      >
        <p className="min-w-0 flex-1 py-2">{notice.text}</p>
        {notice.action && (
          <button
            type="button"
            onClick={() => {
              notice.action?.run();
              dismiss();
            }}
            className="min-h-11 flex-none rounded-xl px-3 font-semibold text-accent hover:bg-line"
          >
            {notice.action.label}
          </button>
        )}
        <button
          type="button"
          aria-label="Meldung schließen"
          onClick={dismiss}
          className="inline-flex size-11 flex-none items-center justify-center rounded-full text-dim hover:bg-line hover:text-fg"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
