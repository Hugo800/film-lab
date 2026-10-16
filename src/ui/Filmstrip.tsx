import { useEffect, useRef } from 'react';
import { CopyCheck, ImagePlus, X } from 'lucide-react';
import { useStore } from './store';

export function Filmstrip({ onAdd }: { onAdd: () => void }) {
  const photos = useStore((s) => s.photos);
  const activeId = useStore((s) => s.activeId);
  const select = useStore((s) => s.selectPhoto);
  const removePhoto = useStore((s) => s.removePhoto);
  const applyToAll = useStore((s) => s.applyToAll);
  const activeRef = useRef<HTMLLIElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeId]);

  // Mausrad senkrecht blättert waagerecht. React registriert onWheel passiv, dort greift preventDefault nicht.
  useEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0 || e.ctrlKey || ul.scrollWidth <= ul.clientWidth) return;
      e.preventDefault();
      ul.scrollLeft += e.deltaY;
    };
    ul.addEventListener('wheel', onWheel, { passive: false });
    return () => ul.removeEventListener('wheel', onWheel);
  }, []);

  // Größere Bilder nur mit Platz in der Höhe: Handys quer (side über die Querklausel) behalten die kleinen.
  return (
    <div className="flex items-center border-t border-line bg-panel/60">
      <ul
        ref={listRef}
        className="hide-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-3 py-1 [mask-image:linear-gradient(90deg,transparent,#000_12px,#000_calc(100%-12px),transparent)] [@media(min-width:800px)_and_(min-height:541px)]:py-2"
        aria-label="Geladene Fotos"
      >
        {photos.map((p, i) => {
          const active = p.id === activeId;
          return (
            <li key={p.id} ref={active ? activeRef : undefined} className="relative flex-none">
              <button
                type="button"
                onClick={() => select(p.id)}
                aria-label={`Foto ${i + 1} von ${photos.length}: ${p.name}`}
                aria-current={active}
                title={p.name}
                className={`block size-11 overflow-hidden rounded-lg bg-raised ring-2 transition [@media(min-width:800px)_and_(min-height:541px)]:size-14 ${
                  active ? 'ring-accent' : 'ring-transparent opacity-80 hover:opacity-100'
                }`}
              >
                {p.thumb ? (
                  <img src={p.thumb} alt="" draggable={false} className="size-full object-cover" />
                ) : (
                  <span className="platzhalter block size-full" />
                )}
              </button>
              {active && (
                <button
                  type="button"
                  aria-label="Foto entfernen"
                  title="Foto entfernen (Entf)"
                  onClick={() => removePhoto(p.id)}
                  className="absolute right-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-black/65 text-white before:absolute before:-inset-2.5 before:content-[''] hover:bg-black/85"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          );
        })}
        <li className="flex-none">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Weitere Fotos hinzufügen"
            title="Weitere Fotos hinzufügen"
            className="flex size-11 items-center justify-center rounded-lg border border-dashed border-line text-dim hover:border-dim hover:text-fg [@media(min-width:800px)_and_(min-height:541px)]:size-14"
          >
            <ImagePlus size={20} />
          </button>
        </li>
      </ul>
      <button
        type="button"
        onClick={applyToAll}
        title="Look und alle Regler auf alle Fotos übertragen"
        className="mr-2 flex min-h-11 flex-none items-center gap-1.5 rounded-xl px-3 text-xs text-dim hover:bg-raised hover:text-fg"
      >
        <CopyCheck size={18} />
        Auf alle
      </button>
    </div>
  );
}
