import type { KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Palette, SlidersHorizontal } from 'lucide-react';
import { Adjust } from './Adjust';
import { LookPicker } from './LookPicker';
import { useStore, type Tab } from './store';

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'looks', label: 'Looks', icon: Palette },
  { id: 'anpassen', label: 'Anpassen', icon: SlidersHorizontal },
];

/** Unten einklappbar am Handy, Seitenleiste bei `side`. */
export function Panel() {
  const tab = useStore((s) => s.tab);
  const open = useStore((s) => s.panelOpen);
  const failed = useStore((s) => s.source.status === 'fehler');
  const patch = useStore((s) => s.patch);

  // ←/→ wechselt den Tab (Tastaturmuster für Tabs).
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length].id;
    patch({ tab: next, panelOpen: true });
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <aside className="flex flex-none flex-col border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] side:h-full side:w-[clamp(300px,30vw,420px)] side:border-l side:border-t-0">
      <div role="tablist" aria-label="Bedienfeld" onKeyDown={onTabKey} className="flex items-center gap-1 px-2 side:border-b side:border-line">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={selected}
              aria-controls="bedienfeld"
              tabIndex={selected ? 0 : -1}
              onClick={() => patch({ tab: id, panelOpen: true })}
              className={`relative flex min-h-12 items-center gap-2 px-4 text-[15px] transition ${
                selected && open ? 'text-fg' : 'text-dim hover:text-fg'
              } ${selected && open ? "font-medium after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent" : ''}`}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
        <button
          type="button"
          aria-label={open ? 'Bedienfeld einklappen' : 'Bedienfeld ausklappen'}
          aria-expanded={open}
          onClick={() => patch({ panelOpen: !open })}
          className="ml-auto inline-flex size-11 items-center justify-center rounded-full text-dim hover:bg-raised hover:text-fg side:hidden"
        >
          {open ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
        </button>
      </div>
      <div
        id="bedienfeld"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        aria-disabled={failed || undefined}
        className={`min-h-0 overflow-y-auto overscroll-contain side:block side:h-auto side:flex-1 ${open ? 'h-[clamp(220px,32dvh,290px)]' : 'hidden'} ${
          failed ? 'pointer-events-none opacity-40' : ''
        }`}
      >
        {tab === 'looks' ? <LookPicker /> : <Adjust />}
      </div>
    </aside>
  );
}
