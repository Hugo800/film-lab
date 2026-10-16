import { useEffect, useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { parseCube } from '../looks';
import { Editor } from './Editor';
import { ExportDialog } from './ExportDialog';
import { addPhotos } from './intake';
import { registerCustomLut } from './lookRegistry';
import { importOfficialLuts } from './officialLuts';
import { describeError } from './session';
import { StartView } from './StartView';
import { loadOfficialLuts, loadPresets, loadStoredLuts, loadUseOfficial, saveUseOfficial } from './storage';
import { useStore } from './store';
import { Toast } from './Toast';

/** Abgelegte Dateien: ZIP = Fujifilm-LUTs, .cube = eigene LUT, der Rest geht als Foto an addPhotos. */
async function dropFiles(files: File[]) {
  const { notify } = useStore.getState();
  const zips = files.filter((f) => /\.zip$/i.test(f.name));
  const cubes = files.filter((f) => /\.cube$/i.test(f.name));
  const rest = files.filter((f) => !zips.includes(f) && !cubes.includes(f));
  if (rest.length > 0) addPhotos(rest);
  if (zips.length > 0) {
    notify('Fujifilm-LUTs werden geladen …');
    try {
      const { luts, stored } = await importOfficialLuts(zips, () => {});
      useStore.getState().setOfficialLuts(luts, true);
      saveUseOfficial(true);
      notify(`${luts.size} Fujifilm-LUTs geladen` + (stored ? '' : ' – sie gelten nur bis zum Neuladen der Seite'));
    } catch (err) {
      notify(describeError(err), 'fehler');
    }
  }
  for (const file of cubes) {
    try {
      const title = file.name.replace(/\.cube$/i, '');
      const lut = parseCube(await file.text(), title);
      const entry = useStore.getState().addCustomLut(lut.title || title, lut);
      useStore.getState().setLook(entry.id);
      notify(`LUT „${entry.name}“ geladen`);
    } catch (err) {
      notify(`Die LUT „${file.name}“ konnte nicht gelesen werden: ${describeError(err)}`, 'fehler');
    }
  }
}

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
      void dropFiles(Array.from(e.dataTransfer?.files ?? []));
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
        <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 border-4 border-dashed border-accent bg-black/70 text-lg">
          <ImagePlus size={36} className="text-accent" aria-hidden />
          Zum Hinzufügen loslassen
        </div>
      )}
      <ExportDialog />
      <Toast />
    </>
  );
}
