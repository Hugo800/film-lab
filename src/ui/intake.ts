import { zumEditor } from './route';
import { queueFileThumb } from './thumbs';
import { useStore } from './store';

/** Fügt Fotos hinzu, stößt die Filmstreifenbilder an und wechselt in den Editor. */
export function addPhotos(files: File[]) {
  const before = new Set(useStore.getState().photos.map((p) => p.id));
  useStore.getState().addFiles(files);
  const added = useStore.getState().photos.filter((p) => !before.has(p.id));
  for (const p of added) queueFileThumb(p.id, p.file);
  if (added.length > 0) zumEditor();
}
