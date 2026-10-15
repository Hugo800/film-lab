import { ChevronDown, ChevronUp, Palette, SlidersHorizontal } from 'lucide-react';
import { Adjust } from './Adjust';
import { LookPicker } from './LookPicker';
import { useStore, type Tab } from './store';

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'looks', label: 'Looks', icon: Palette },
  { id: 'anpassen', label: 'Anpassen', icon: SlidersHorizontal },
];

/** Unten einklappbar am Handy, Seitenleiste ab 1024 px. */
export function Panel() {
  const tab = useStore((s) => s.tab);
  const open = useStore((s) => s.panelOpen);
  const patch = useStore((s) => s.patch);

  return (
    <aside className="flex flex-none flex-col border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] lg:h-full lg:w-[380px] lg:border-l lg:border-t-0 lg:pb-0">
      <div role="tablist" aria-label="Bedienfeld" className="flex items-center gap-1 px-2 lg:border-b lg:border-line">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={selected}
              aria-controls="bedienfeld"
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
          className="ml-auto inline-flex size-11 items-center justify-center rounded-full text-dim hover:bg-raised hover:text-fg lg:hidden"
        >
          {open ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
        </button>
      </div>
      <div
        id="bedienfeld"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className={`min-h-0 overflow-y-auto overscroll-contain lg:block lg:max-h-none lg:flex-1 ${open ? 'max-h-[38dvh]' : 'hidden'}`}
      >
        {tab === 'looks' ? <LookPicker /> : <Adjust />}
      </div>
    </aside>
  );
}
