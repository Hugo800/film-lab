import { addPhotos } from '../intake';
import { useStore } from '../store';
import { beispielUrl, type BeispielId } from './werkstatt';

/** Lädt ein Beispielfoto als Datei in den Editor – derselbe Weg wie „Fotos wählen“ –, auf Wunsch gleich mit Look. */
export async function beispielInEditor(id: BeispielId, lookId?: string) {
  try {
    const res = await fetch(beispielUrl(id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const file = new File([await res.blob()], `beispiel-${id}.jpg`, { type: 'image/jpeg' });
    addPhotos([file]);
    if (lookId) useStore.getState().setLook(lookId);
  } catch {
    // Meist fehlt das Netz (die Fotos liegen sonst im Cache der App); die Rohmeldung („Failed to fetch“) hilft niemandem.
    useStore.getState().notify('Das Beispielfoto ließ sich nicht laden. Bitte prüfe die Internetverbindung.', 'fehler');
  }
}
