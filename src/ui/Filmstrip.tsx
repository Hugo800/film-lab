import { useEffect, useRef } from 'react';
import { CopyCheck, ImagePlus } from 'lucide-react';
import { useStore } from './store';

export function Filmstrip({ onAdd }: { onAdd: () => void }) {
  const photos = useStore((s) => s.photos);
  const activeId = useStore((s) => s.activeId);
  const select = useStore((s) => s.selectPhoto);
  const applyToAll = useStore((s) => s.applyToAll);
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeId]);

  return (
    <div className="flex items-center border-t border-line bg-panel/60">
      <ul className="hide-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-3 py-2" aria-label="Geladene Fotos">
        {photos.map((p, i) => {
          const active = p.id === activeId;
          return (
            <li key={p.id} ref={active ? activeRef : undefined} className="relative flex-none">
              <button
                type="button"
                onClick={() => select(p.id)}
                aria-label={`Foto ${i + 1} von ${photos.length}: ${p.name}`}
                aria-current={active}
                className={`block size-14 overflow-hidden rounded-lg bg-raised ring-2 transition ${active ? 'ring-accent' : 'ring-transparent opacity-80'}`}
              >
                {p.thumb ? (
                  <img src={p.thumb} alt="" draggable={false} className="size-full object-cover" />
                ) : (
                  <span className="platzhalter block size-full" />
                )}
              </button>
            </li>
          );
        })}
        <li className="flex-none">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Weitere Fotos hinzufügen"
            className="flex size-14 items-center justify-center rounded-lg border border-dashed border-line text-dim hover:border-dim hover:text-fg"
          >
            <ImagePlus size={20} />
          </button>
        </li>
      </ul>
      <button
        type="button"
        onClick={applyToAll}
        aria-label="Einstellungen dieses Fotos auf alle Fotos anwenden"
        className="mr-2 flex min-h-11 flex-none items-center gap-1.5 rounded-xl px-3 text-xs text-dim hover:bg-raised hover:text-fg"
      >
        <CopyCheck size={18} />
        <span className="leading-tight">
          Auf alle
          <br />
          anwenden
        </span>
      </button>
    </div>
  );
}
