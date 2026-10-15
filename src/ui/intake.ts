import { queueFileThumb } from './thumbs';
import { useStore } from './store';

/** Fügt Fotos hinzu und stößt die Filmstreifenbilder an. */
export function addPhotos(files: File[]) {
  const before = new Set(useStore.getState().photos.map((p) => p.id));
  useStore.getState().addFiles(files);
  for (const p of useStore.getState().photos) if (!before.has(p.id)) queueFileThumb(p.id, p.file);
}
