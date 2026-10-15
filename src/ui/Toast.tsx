import { useEffect } from 'react';
import { useStore } from './store';

export function Toast() {
  const notice = useStore((s) => s.notice);
  const dismiss = useStore((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismiss, notice.kind === 'fehler' ? 8000 : 4500);
    return () => clearTimeout(t);
  }, [notice, dismiss]);

  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex justify-center px-4 lg:top-auto lg:right-[380px] lg:bottom-20">
      <button
        type="button"
        role={notice.kind === 'fehler' ? 'alert' : 'status'}
        onClick={dismiss}
        className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-3 text-left text-sm shadow-xl backdrop-blur ${
          notice.kind === 'fehler' ? 'border-danger/50 bg-[#2a1613]/95 text-fg' : 'border-line bg-raised/95 text-fg'
        }`}
      >
        {notice.text}
      </button>
    </div>
  );
}
