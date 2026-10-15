import { useMemo, useRef, type ReactNode } from 'react';
import { FileUp, X } from 'lucide-react';
import { parseCube } from '../looks';
import {
  builtinEntries,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  NONE_ENTRY,
  NONE_ID,
  type EntryCategory,
  type LookEntry,
} from './lookRegistry';
import { describeError } from './session';
import { activePhoto, useStore } from './store';

interface TileProps {
  name: string;
  /** undefined = wird noch gerendert, '' = fehlgeschlagen. */
  thumb: string | undefined;
  selected?: boolean;
  onClick: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}

function Tile({ name, thumb, selected, onClick, onRemove, removeLabel }: TileProps) {
  return (
    <div className="relative w-[84px] flex-none lg:w-auto">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className="block w-full rounded-xl text-left outline-offset-2"
      >
        <span
          className={`block aspect-square w-full overflow-hidden rounded-xl bg-raised ring-2 transition ${
            selected ? 'ring-accent' : 'ring-transparent'
          }`}
        >
          {thumb ? (
            <img src={thumb} alt="" draggable={false} className="size-full object-cover" />
          ) : thumb === undefined ? (
            <span className="platzhalter block size-full" />
          ) : (
            <span className="flex size-full items-center justify-center bg-gradient-to-br from-raised to-line text-lg text-dim">
              {name.slice(0, 1)}
            </span>
          )}
        </span>
        <span className={`mt-1 line-clamp-2 block text-xs leading-tight ${selected ? 'text-fg' : 'text-dim'}`}>{name}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white before:absolute before:-inset-2.5 before:content-['']"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex-none lg:mb-5" aria-label={label}>
      <h3 className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-wider text-dim">{label}</h3>
      <div className="flex gap-2 lg:grid lg:grid-cols-3">{children}</div>
    </section>
  );
}

export function LookPicker() {
  const fileInput = useRef<HTMLInputElement>(null);
  const photo = useStore(activePhoto);
  const thumbs = useStore((s) => s.lookThumbs);
  const customLuts = useStore((s) => s.customLuts);
  const presets = useStore((s) => s.presets);
  const setLook = useStore((s) => s.setLook);
  const applyPreset = useStore((s) => s.applyPreset);
  const notify = useStore((s) => s.notify);

  const entries = useMemo(() => builtinEntries(), []);
  const byCategory = useMemo(() => {
    const map = new Map<EntryCategory, LookEntry[]>();
    for (const e of entries) map.set(e.category, [...(map.get(e.category) ?? []), e]);
    return map;
  }, [entries]);

  if (!photo) return null;
  const photoId = photo.id;
  const current = photo.settings.lookId;
  const thumbOf = (id: string) => thumbs[`${photoId}|${id}`];
  const selectedEntry = entries.find((e) => e.id === current);
  const selectedCustom = customLuts.find((l) => l.id === current);
  const info =
    current === NONE_ID
      ? NONE_ENTRY.description
      : selectedEntry
        ? `${selectedEntry.name} – ${selectedEntry.description}`
        : selectedCustom
          ? `${selectedCustom.name} – eigene LUT`
          : '';

  async function loadCube(file: File | undefined) {
    if (!file) return;
    try {
      const title = file.name.replace(/\.cube$/i, '');
      const lut = parseCube(await file.text(), title);
      const entry = useStore.getState().addCustomLut(lut.title || title, lut);
      setLook(entry.id);
    } catch (err) {
      notify(`Die LUT „${file.name}“ konnte nicht gelesen werden: ${describeError(err)}`, 'fehler');
    }
  }

  const eigeneBuiltin = byCategory.get('eigene') ?? [];

  return (
    <div className="flex min-h-0 flex-col lg:h-full">
      <div className="hide-scrollbar flex gap-4 overflow-x-auto px-3 py-2 lg:block lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:px-4 lg:py-4">
        <Group label={CATEGORY_LABELS.ohne}>
          <Tile name={NONE_ENTRY.name} thumb={thumbOf(NONE_ID)} selected={current === NONE_ID} onClick={() => setLook(NONE_ID)} />
        </Group>
        {entries.length === 0 && (
          <p className="flex-none self-center text-sm text-dim lg:mb-5">Noch keine Looks verfügbar.</p>
        )}
        {CATEGORY_ORDER.filter((c) => c !== 'eigene').map((cat) => {
          const list = byCategory.get(cat);
          if (!list) return null;
          return (
            <Group key={cat} label={CATEGORY_LABELS[cat]}>
              {list.map((e) => (
                <Tile key={e.id} name={e.name} thumb={thumbOf(e.id)} selected={current === e.id} onClick={() => setLook(e.id)} />
              ))}
            </Group>
          );
        })}
        <Group label={CATEGORY_LABELS.eigene}>
          <div className="w-[84px] flex-none lg:w-auto">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label="LUT laden (.cube)"
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-dim hover:border-dim hover:text-fg"
            >
              <FileUp size={22} />
            </button>
            <span className="mt-1 block text-xs leading-tight text-dim" aria-hidden>
              LUT laden (.cube)
            </span>
          </div>
          {eigeneBuiltin.map((e) => (
            <Tile key={e.id} name={e.name} thumb={thumbOf(e.id)} selected={current === e.id} onClick={() => setLook(e.id)} />
          ))}
          {customLuts.map((l) => (
            <Tile
              key={l.id}
              name={l.name}
              thumb={thumbOf(l.id)}
              selected={current === l.id}
              onClick={() => setLook(l.id)}
              removeLabel={`LUT „${l.name}“ entfernen`}
              onRemove={() => window.confirm(`LUT „${l.name}“ entfernen? Presets darauf werden mit entfernt.`) && useStore.getState().removeCustomLut(l.id)}
            />
          ))}
          {presets.map((p) => (
            <Tile
              key={p.id}
              name={p.name}
              thumb={thumbOf(p.id)}
              onClick={() => applyPreset(p)}
              removeLabel={`Preset „${p.name}“ entfernen`}
              onRemove={() => window.confirm(`Preset „${p.name}“ entfernen?`) && useStore.getState().removePreset(p.id)}
            />
          ))}
        </Group>
      </div>
      {info && <p className="line-clamp-2 px-4 pb-2 text-xs leading-snug text-dim lg:line-clamp-none lg:border-t lg:border-line lg:py-3 lg:text-sm">{info}</p>}
      <input
        ref={fileInput}
        type="file"
        accept=".cube,.CUBE,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void loadCube(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
