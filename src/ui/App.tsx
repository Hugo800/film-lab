import { useEffect, useRef } from 'react';
import { Editor } from './Editor';
import { ExportDialog } from './ExportDialog';
import { addPhotos } from './intake';
import { registerCustomLut } from './lookRegistry';
import { StartView } from './StartView';
import { loadOfficialLuts, loadPresets, loadStoredLuts, loadUseOfficial } from './storage';
import { useStore } from './store';
import { Toast } from './Toast';

export default function App() {
  const hasPhotos = useStore((s) => s.photos.length > 0);
  const input = useRef<HTMLInputElement>(null);
  const pick = () => input.current?.click();

  // Gemerktes laden – ohne Speicher bleibt die App einfach leer.
  useEffect(() => {
    useStore.getState().setPresets(loadPresets());
    void loadStoredLuts().then((list) => {
      if (list.length === 0) return;
      for (const l of list) registerCustomLut(l.id, l.lut);
      useStore.getState().setCustomLuts(list);
    });
    void loadOfficialLuts().then((luts) => {
      if (luts.size > 0) useStore.getState().setOfficialLuts(luts, loadUseOfficial());
    });
  }, []);

  // Drag & Drop auf das ganze Fenster.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
    const set = (dragging: boolean) => useStore.getState().patch({ dragging });
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      set(true);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) set(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      set(false);
      addPhotos(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const dragging = useStore((s) => s.dragging);

  return (
    <>
      {hasPhotos ? <Editor onAdd={pick} /> : <StartView onPick={pick} />}
      <input
        ref={input}
        id="datei-eingabe"
        type="file"
        multiple
        accept="image/*,.arw,.ARW,.dng"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          addPhotos(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      {dragging && hasPhotos && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center border-4 border-dashed border-accent bg-black/70 text-lg">
          Zum Hinzufügen loslassen
        </div>
      )}
      <ExportDialog />
      <Toast />
    </>
  );
}
