import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ClipboardPaste, FileUp, PackageOpen, X } from 'lucide-react';
import { parseCube } from '../looks';
import type { LookCategory } from '../types';
import { fmtPercent } from './format';
import {
  builtinEntries,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  defaultsFor,
  NONE_ENTRY,
  NONE_ID,
  TRADEMARK_NOTE,
  type EntryCategory,
  type LookEntry,
} from './lookRegistry';
import { OfficialDialog } from './OfficialDialog';
import { RecipeDialog } from './RecipeDialog';
import { describeError } from './session';
import { Slider } from './Slider';
import { activePhoto, useStore } from './store';

/** Kurzer Kachelname; der volle steht im title und über dem Stärke-Regler. */
function tileName(e: Pick<LookEntry, 'name' | 'category'>): string {
  // „Monochrom + Ye“ usw. passen sonst nicht und wären abgeschnitten nicht zu unterscheiden.
  if (e.category === 'fujifilm') return e.name.replace(/\/.*$/, '').replace(/^Monochrom /, 'Mono ').replace(/^Eterna /, '');
  if (e.category === 'leica')
    return e.name
      .replace(/^Leica /, '')
      .replace('Monochrom High Contrast', 'Mono HC')
      .replace(/^Monochrom /, 'Mono ');
  // Das unterscheidende Ende muss in die Kachel: „K-chrome 64“ neben „K-chrome 25“, „VR 200“, „E100“.
  if (e.category === 'kodak')
    return e.name
      .replace(/^Kodak /, '')
      .replace(/^Kodachrome /, 'K-chrome ')
      .replace(/^(?:Kodacolor|Ektachrome) /, '');
  return e.name;
}

interface TileProps {
  name: string;
  /** Voller Name für title und Tests. */
  fullName?: string;
  /** undefined = wird noch gerendert, '' = fehlgeschlagen. */
  thumb: string | undefined;
  selected?: boolean;
  onClick: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  /** Kleines Abzeichen unten rechts, z. B. „Fuji-LUT“. */
  badge?: string;
}

function Tile({ name, fullName = name, thumb, selected, onClick, onRemove, removeLabel, badge }: TileProps) {
  return (
    <div className="relative w-20 flex-none side:w-auto">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={!!selected}
        aria-label={fullName}
        title={fullName}
        data-look={fullName}
        className="group block w-full rounded-xl text-left outline-offset-2 focus-visible:outline-fg"
      >
        <span
          className={`relative block aspect-square w-full overflow-hidden rounded-xl bg-raised ring-2 transition ${
            selected ? 'ring-accent' : 'ring-transparent group-hover:ring-line'
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
          {badge && (
            <span aria-hidden className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-black/65 px-1.5 py-px text-[10px] font-medium leading-4 text-white">
              {badge}
            </span>
          )}
        </span>
        <span className={`mt-1 block truncate text-xs leading-tight ${selected ? 'text-fg' : 'text-dim group-hover:text-fg'}`}>{name}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          title={removeLabel}
          onClick={onRemove}
          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white before:absolute before:-inset-2.5 before:content-['']"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function Group({ cat, hint, children }: { cat: LookCategory; hint?: string; children: ReactNode }) {
  return (
    <section className="flex-none side:mb-5" aria-label={CATEGORY_LABELS[cat]} data-cat={cat}>
      <h3 className="mb-1.5 hidden items-baseline px-0.5 text-[11px] font-medium uppercase tracking-wider text-dim side:flex">
        {CATEGORY_LABELS[cat]}
        {hint && <span className="ml-1.5 font-normal normal-case tracking-normal text-dim/70">· {hint}</span>}
      </h3>
      <div className="flex gap-2 side:grid side:grid-cols-[repeat(auto-fill,minmax(80px,1fr))] side:gap-x-2 side:gap-y-3">{children}</div>
    </section>
  );
}

function ActionTile({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <div className="w-20 flex-none side:w-auto">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="group block w-full rounded-xl text-left outline-offset-2 focus-visible:outline-fg"
      >
        <span className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-line text-dim group-hover:border-dim group-hover:text-fg">
          {icon}
        </span>
        <span className="mt-1 block truncate text-xs leading-tight text-dim group-hover:text-fg">{label}</span>
      </button>
    </div>
  );
}

/** Mitte des Elements in den sichtbaren Bereich der Liste holen, falls es nicht ganz zu sehen ist. */
function reveal(list: HTMLElement, el: Element) {
  const l = list.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.left >= l.left && r.right <= l.right && r.top >= l.top && r.bottom <= l.bottom) return;
  list.scrollBy({ left: r.left + r.width / 2 - (l.left + l.width / 2), top: r.top + r.height / 2 - (l.top + l.height / 2) });
}

export function LookPicker() {
  const fileInput = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Per Chip gewählte Gruppe: bleibt aktiv, bis der Nutzer selbst in der Liste scrollt. */
  const pinned = useRef<LookCategory | null>(null);
  const [dialog, setDialog] = useState<'rezept' | 'originale' | null>(null);
  const [activeCat, setActiveCat] = useState<LookCategory>('fujifilm');
  const [infoOpen, setInfoOpen] = useState(false);
  const photo = useStore(activePhoto);
  const thumbs = useStore((s) => s.lookThumbs);
  const customLuts = useStore((s) => s.customLuts);
  const presets = useStore((s) => s.presets);
  const officialKeys = useStore((s) => s.officialKeys);
  const useOfficial = useStore((s) => s.useOfficial);
  const setLook = useStore((s) => s.setLook);
  const setParam = useStore((s) => s.setParam);
  const resetParam = useStore((s) => s.resetParam);
  const applyPreset = useStore((s) => s.applyPreset);
  const notify = useStore((s) => s.notify);

  const entries = useMemo(() => builtinEntries(), []);
  const byCategory = useMemo(() => {
    const map = new Map<EntryCategory, LookEntry[]>();
    for (const e of entries) map.set(e.category, [...(map.get(e.category) ?? []), e]);
    return map;
  }, [entries]);

  const photoId = photo?.id;
  const current = photo?.settings.lookId;

  // Gewählte Kachel zeigen: nach Look- oder Fotowechsel und beim Einblenden des Tabs.
  useEffect(() => {
    const list = listRef.current;
    const tile = list?.querySelector('button[aria-pressed="true"]');
    pinned.current = null;
    if (list && tile) reveal(list, tile);
  }, [current, photoId]);

  // Der aktive Chip folgt der Scrollposition: die letzte Gruppe, deren Anfang den Listenanfang erreicht hat.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (pinned.current) return;
      const horizontal = getComputedStyle(list).display === 'flex';
      const l = list.getBoundingClientRect();
      const sections = Array.from(list.querySelectorAll<HTMLElement>('section[data-cat]'));
      const atEnd = horizontal
        ? list.scrollLeft + list.clientWidth >= list.scrollWidth - 2
        : list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
      let cat = sections[0]?.dataset.cat;
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if ((horizontal ? r.left - l.left : r.top - l.top) <= 40) cat = s.dataset.cat;
      }
      if (atEnd && sections.length > 0) cat = sections[sections.length - 1].dataset.cat;
      if (cat) setActiveCat(cat as LookCategory);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const release = () => {
      pinned.current = null;
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    for (const type of ['pointerdown', 'wheel', 'touchstart'] as const) list.addEventListener(type, release, { passive: true });
    update();
    return () => {
      list.removeEventListener('scroll', onScroll);
      for (const type of ['pointerdown', 'wheel', 'touchstart'] as const) list.removeEventListener(type, release);
      cancelAnimationFrame(frame);
    };
  }, [photoId]);

  if (!photo || current === undefined) return null;
  const thumbOf = (id: string) => thumbs[`${photo.id}|${id}`];
  const selectedEntry = entries.find((e) => e.id === current);
  const selectedCustom = customLuts.find((l) => l.id === current);
  const lookName = selectedEntry?.name ?? selectedCustom?.name ?? '';
  const info = current === NONE_ID ? NONE_ENTRY.description : (selectedEntry?.description ?? (selectedCustom ? 'Eigene LUT aus einer .cube-Datei.' : ''));
  const badge = (e: LookEntry) => (useOfficial && e.officialKey && officialKeys.includes(e.officialKey) ? 'Fuji-LUT' : undefined);

  const jumpTo = (cat: LookCategory) => {
    const list = listRef.current;
    const section = list?.querySelector(`section[data-cat="${cat}"]`);
    if (!list || !section) return;
    const l = list.getBoundingClientRect();
    const r = section.getBoundingClientRect();
    const pad = getComputedStyle(list);
    const horizontal = pad.display === 'flex';
    pinned.current = cat;
    setActiveCat(cat);
    // Eigene Gleitbewegung mit fester Dauer: 'smooth' braucht über 40 Kacheln hinweg länger als eine Sekunde.
    const x0 = list.scrollLeft;
    const y0 = list.scrollTop;
    const dx = horizontal ? r.left - l.left - parseFloat(pad.paddingLeft) : 0;
    const dy = horizontal ? 0 : r.top - l.top - parseFloat(pad.paddingTop);
    const t0 = performance.now();
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350;
    const step = (t: number) => {
      if (pinned.current !== cat) return; // Der Nutzer hat übernommen.
      const k = duration ? Math.min(1, (t - t0) / duration) : 1;
      const e = 1 - (1 - k) ** 3;
      list.scrollTo(x0 + dx * e, y0 + dy * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

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

  const lookTile = (e: LookEntry) => (
    <Tile key={e.id} name={tileName(e)} fullName={e.name} thumb={thumbOf(e.id)} selected={current === e.id} badge={badge(e)} onClick={() => setLook(e.id)} />
  );
  const eigeneBuiltin = byCategory.get('eigene') ?? [];

  return (
    <div className="@container flex min-h-0 flex-col side:h-full">
      <div className="flex flex-none items-center gap-0.5 px-1.5 side:border-b side:border-line side:px-2.5">
        {/* Chips 32 px hoch, per before: 44 px Trefferfläche, ohne die Zeile höher zu machen. */}
        {CATEGORY_ORDER.map((cat) => {
          const on = cat === activeCat;
          return (
            <button
              key={cat}
              type="button"
              aria-current={on || undefined}
              onClick={() => jumpTo(cat)}
              className={`relative min-h-8 px-2 text-[13px] transition before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] ${
                on ? "font-medium text-fg after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-accent" : 'text-dim hover:text-fg'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setDialog('rezept')}
          aria-label="Rezept einfügen"
          title="Rezept einfügen (Text von Fuji X Weekly)"
          className="relative ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-dim before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:bg-raised hover:text-fg"
        >
          <ClipboardPaste size={16} />
          <span className="hidden @min-[350px]:inline">Rezept</span>
        </button>
      </div>
      <div
        ref={listRef}
        className="hide-scrollbar flex gap-4 overflow-x-auto px-3 py-1 side:block side:min-h-0 side:flex-1 side:overflow-x-hidden side:overflow-y-auto side:px-4 side:py-3"
      >
        {entries.length === 0 && <p className="flex-none self-center text-sm text-dim side:mb-5">Noch keine Looks verfügbar.</p>}
        {CATEGORY_ORDER.filter((c) => c !== 'eigene').map((cat) => {
          const list = byCategory.get(cat);
          if (!list) return null;
          return (
            <Group key={cat} cat={cat} hint={cat === 'kodak' ? 'als Fuji-Rezepte' : undefined}>
              {cat === 'fujifilm' && (
                <Tile name={NONE_ENTRY.name} thumb={thumbOf(NONE_ID)} selected={current === NONE_ID} onClick={() => setLook(NONE_ID)} />
              )}
              {list.map(lookTile)}
              {cat === 'fujifilm' && <ActionTile label="Fuji-LUTs" icon={<PackageOpen size={22} />} onClick={() => setDialog('originale')} />}
            </Group>
          );
        })}
        <Group cat="eigene">
          <ActionTile label="Rezept einfügen" icon={<ClipboardPaste size={22} />} onClick={() => setDialog('rezept')} />
          <ActionTile label="LUT laden (.cube)" icon={<FileUp size={22} />} onClick={() => fileInput.current?.click()} />
          {eigeneBuiltin.map(lookTile)}
          {customLuts.map((l) => (
            <Tile
              key={l.id}
              name={l.name}
              thumb={thumbOf(l.id)}
              selected={current === l.id}
              onClick={() => setLook(l.id)}
              removeLabel={`LUT „${l.name}“ entfernen`}
              onRemove={() => window.confirm(`LUT „${l.name}“ entfernen? Rezepte darauf werden mit entfernt.`) && useStore.getState().removeCustomLut(l.id)}
            />
          ))}
          {presets.map((p) => (
            <Tile
              key={p.id}
              name={p.name}
              thumb={thumbOf(p.id)}
              onClick={() => applyPreset(p)}
              removeLabel={`Rezept „${p.name}“ entfernen`}
              onRemove={() => window.confirm(`Rezept „${p.name}“ entfernen?`) && useStore.getState().removePreset(p.id)}
            />
          ))}
        </Group>
        <p className="hidden pb-1 text-xs leading-snug text-dim side:block">{TRADEMARK_NOTE}</p>
      </div>
      <div className="flex flex-none flex-col px-4 pb-1.5 side:gap-1 side:border-t side:border-line side:py-3">
        {current !== NONE_ID && (
          <Slider
            id="regler-strength"
            label={lookName}
            hint="Stärke"
            value={photo.settings.params.strength}
            defaultValue={defaultsFor(current).strength}
            min={0}
            max={1}
            step={0.01}
            format={fmtPercent}
            onChange={(v) => setParam('strength', v)}
            onReset={() => resetParam('strength')}
          />
        )}
        {info && (
          <>
            <button
              type="button"
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen(!infoOpen)}
              className={`text-left text-xs leading-snug text-dim side:hidden ${infoOpen ? '' : 'line-clamp-1'}`}
            >
              {info}
            </button>
            <p className="hidden text-sm leading-snug text-dim side:block [@media(max-height:540px)]:line-clamp-1">{info}</p>
          </>
        )}
      </div>
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
      {dialog === 'rezept' && <RecipeDialog onClose={() => setDialog(null)} />}
      {dialog === 'originale' && <OfficialDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
