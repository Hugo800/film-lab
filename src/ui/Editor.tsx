import { useEffect, useState } from 'react';
import { Aperture, ArrowRight, Columns2, Download, ImagePlus, Keyboard, ZoomIn, ZoomOut } from 'lucide-react';
import { Button, IconButton } from './controls';
import { openExport } from './exporter';
import { Filmstrip } from './Filmstrip';
import { Panel } from './Panel';
import { Preview } from './Preview';
import { heimUrl, nachHause, zumEditor } from './route';
import { openPhoto } from './session';
import { ShortcutsDialog } from './ShortcutsDialog';
import { activePhoto, useStore } from './store';
import { useThumbnails } from './thumbs';

const HINT_KEY = 'filmlab.tipp-original';
const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Strg+';

/** Tastenkürzel ruhen in Eingaben, Reglern, Segmenten, Tabs und offenen Dialogen; die mit Strg/⌘ nur in Textfeldern. */
const KEY_EXEMPT = 'input, textarea, select, [contenteditable], [role=slider], [role=radio], [role=tab]';
const TEXT_FIELDS = 'textarea, select, [contenteditable], input:not([type=range]):not([type=checkbox]):not([type=radio])';
const keysBlocked = (e: KeyboardEvent) =>
  (e.target instanceof Element && !!e.target.closest(e.ctrlKey || e.metaKey ? TEXT_FIELDS : KEY_EXEMPT)) ||
  !!document.querySelector('[aria-modal="true"]');

export function Editor({ onAdd }: { onAdd: () => void }) {
  const activeId = useStore((s) => s.activeId);
  const index = useStore((s) => s.photos.findIndex((p) => p.id === s.activeId));
  const count = useStore((s) => s.photos.length);
  const name = useStore((s) => activePhoto(s)?.name ?? '');
  const status = useStore((s) => s.source.status);
  const compare = useStore((s) => s.compare);
  const zoom = useStore((s) => s.zoom);
  const objektivkorrektur = useStore((s) => s.objektivkorrektur);
  const patch = useStore((s) => s.patch);
  const [help, setHelp] = useState(false);
  const ready = status === 'bereit';

  useThumbnails();

  useEffect(() => {
    // Auch beim Umlegen der Objektivkorrektur: ein RAW wird dann neu entwickelt.
    void openPhoto(activePhoto(useStore.getState()) ?? null);
  }, [activeId, objektivkorrektur]);

  // Beim Verlassen (letztes Foto entfernt) die Pixel des Fotos freigeben.
  useEffect(() => () => void openPhoto(null), []);

  useEffect(() => {
    if (status !== 'bereit') return;
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, '1');
    } catch {}
    useStore
      .getState()
      .notify(
        matchMedia('(pointer: fine)').matches
          ? 'Tipp: Leertaste oder Maustaste gedrückt halten zeigt das Original.'
          : 'Tipp: Bild gedrückt halten zeigt das Original.',
      );
  }, [status]);

  // Leertaste, \, Z, B und Esc behandelt die Bühne (Preview).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || keysBlocked(e)) return;
      const s = useStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'e') {
          e.preventDefault();
          if (s.source.status !== 'bereit') return;
          // Wie beim Klick: Nach dem Schließen kehrt der Fokus zu „Exportieren“ zurück.
          document.querySelector<HTMLElement>('header [aria-label="Exportieren"]')?.focus();
          openExport();
        }
        // Strg/⌘+Z behandelt der Toast, auch in der Startansicht.
        return;
      }
      const i = s.photos.findIndex((p) => p.id === s.activeId);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const next = s.photos[i + (e.key === 'ArrowRight' ? 1 : -1)];
        e.preventDefault();
        if (next) s.selectPhoto(next.id);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        s.stepLook(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (s.activeId) s.removePhoto(s.activeId);
      } else if (e.key === '?') {
        e.preventDefault();
        setHelp(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] side:flex-row">
      <div className="@container flex min-h-0 min-w-0 flex-1 flex-col pt-(--oben) side:pb-[env(safe-area-inset-bottom)]">
        <header className="flex items-center gap-2 px-3 py-1">
          <Logo />
          <p className="hidden min-w-0 flex-1 truncate text-center text-sm text-dim min-[1100px]:block">
            {name} · {index + 1} / {count}
          </p>
          <div className="ml-auto flex flex-none items-center gap-1">
            <IconButton
              label="Vorher/Nachher vergleichen"
              title="Vorher/Nachher vergleichen (B)"
              aria-pressed={compare}
              disabled={!ready || zoom}
              onClick={() => patch({ compare: !compare })}
              className={compare ? 'bg-raised text-accent' : ''}
            >
              <Columns2 size={20} />
            </IconButton>
            <IconButton
              label="100 %-Ansicht"
              title="100 % (Z, Doppelklick)"
              aria-pressed={zoom}
              disabled={!ready}
              onClick={() => patch({ zoom: !zoom })}
              className={zoom ? 'bg-raised text-accent' : ''}
            >
              {zoom ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
            </IconButton>
            <IconButton label="Tastenkürzel" title="Tastenkürzel (?)" onClick={() => setHelp(true)} className="pointer-coarse:hidden">
              <Keyboard size={20} />
            </IconButton>
            <IconButton label="Fotos hinzufügen" onClick={onAdd}>
              <ImagePlus size={22} />
            </IconButton>
            <Button
              variant="primary"
              onClick={openExport}
              disabled={!ready}
              aria-label="Exportieren"
              title={`Exportieren (${MOD}E)`}
              className="min-h-11 px-3.5 py-0 @min-[360px]:px-4"
            >
              <Download size={18} />
              <span className="hidden @min-[360px]:inline">Exportieren</span>
            </Button>
          </div>
        </header>
        <Preview />
        {count > 1 && <Filmstrip onAdd={onAdd} />}
      </div>
      <Panel />
      {help && <ShortcutsDialog onClose={() => setHelp(false)} />}
    </div>
  );
}

/** „Film Lab“ oben links: führt zur Startseite (in der App auf dem Homescreen zu /app), die Fotos bleiben geladen. */
function Logo() {
  return (
    <a
      href={heimUrl()}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        nachHause();
      }}
      className="flex min-h-11 flex-none items-center gap-2 rounded-lg pl-1 pr-2 text-[15px] font-semibold tracking-tight"
    >
      <Aperture size={20} className="text-accent" aria-hidden />
      <span className="sr-only @min-[480px]:not-sr-only">Film Lab</span>
    </a>
  );
}

/** Nur Fotos wählen oder hierher ziehen: /app (Start der App auf dem Homescreen) und /lab ohne Fotos. */
export function Hochladen({ onAdd, titel }: { onAdd: () => void; titel: string }) {
  const fotos = useStore((s) => s.photos.length);
  return (
    <div className="@container flex h-dvh flex-col pt-(--oben) pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      <header className="flex items-center gap-2 px-3 py-1">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <ImagePlus size={32} className="text-accent" aria-hidden />
        <h1 className="text-xl font-semibold">{titel}</h1>
        <p className="max-w-sm text-sm leading-relaxed text-dim">JPEG, PNG, HEIC oder Sony-RAW (ARW) wählen oder hierher ziehen.</p>
        <Button variant="primary" onClick={onAdd} className="mt-2 min-h-14 px-8 text-lg">
          <ImagePlus size={22} />
          Fotos wählen
        </Button>
        {fotos > 0 && (
          <Button variant="ghost" onClick={zumEditor}>
            <ArrowRight size={18} />
            Weiter bearbeiten ({fotos} {fotos === 1 ? 'Foto' : 'Fotos'})
          </Button>
        )}
      </main>
    </div>
  );
}
