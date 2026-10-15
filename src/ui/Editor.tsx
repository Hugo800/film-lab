import { useEffect } from 'react';
import { Aperture, Download, ImagePlus, Trash2 } from 'lucide-react';
import { Button, IconButton } from './controls';
import { openExport } from './exporter';
import { Filmstrip } from './Filmstrip';
import { Panel } from './Panel';
import { Preview } from './Preview';
import { openPhoto } from './session';
import { activePhoto, useStore } from './store';
import { useThumbnails } from './thumbs';

const HINT_KEY = 'filmlab.tipp-original';

export function Editor({ onAdd }: { onAdd: () => void }) {
  const activeId = useStore((s) => s.activeId);
  const count = useStore((s) => s.photos.length);
  const removePhoto = useStore((s) => s.removePhoto);
  const status = useStore((s) => s.source.status);

  useThumbnails();

  useEffect(() => {
    void openPhoto(activePhoto(useStore.getState()) ?? null);
  }, [activeId]);

  // Beim Verlassen (letztes Foto entfernt) die Pixel des Fotos freigeben.
  useEffect(() => () => void openPhoto(null), []);

  useEffect(() => {
    if (status !== 'bereit') return;
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, '1');
    } catch {}
    useStore.getState().notify('Tipp: Das Bild gedrückt halten zeigt das Original.');
  }, [status]);

  return (
    <div className="flex h-dvh flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between gap-2 px-3 py-1">
          <div className="flex items-center gap-2 pl-1 text-[15px] font-semibold tracking-tight">
            <Aperture size={20} className="text-accent" aria-hidden />
            Film Lab
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="Fotos hinzufügen" onClick={onAdd}>
              <ImagePlus size={22} />
            </IconButton>
            <IconButton label="Aktuelles Foto entfernen" onClick={() => activeId && removePhoto(activeId)}>
              <Trash2 size={20} />
            </IconButton>
            <Button variant="primary" onClick={openExport} disabled={status !== 'bereit'} className="min-h-11 py-0">
              <Download size={18} />
              Exportieren
            </Button>
          </div>
        </header>
        <Preview />
        {count > 1 && <Filmstrip onAdd={onAdd} />}
      </div>
      <Panel />
    </div>
  );
}
