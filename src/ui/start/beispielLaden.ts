import { addPhotos } from '../intake';
import { useStore } from '../store';
import { beispielUrl, grossUrl, type Foto } from './werkstatt';

/**
 * Editor-Fassung (bis 4000 px, echte Details für Lupe und Export). Offline und noch nicht im Cache: ohne Meldung die
 * Seitenfassung, die vorab im Cache der App liegt.
 */
async function bild(f: Foto): Promise<Blob> {
  try {
    const res = await fetch(grossUrl(f));
    if (res.ok) return await res.blob();
  } catch {
    // weiter mit der Seitenfassung
  }
  const res = await fetch(beispielUrl(f));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

/** Lädt ein Beispielfoto als Datei in den Editor – derselbe Weg wie „Fotos wählen“ –, auf Wunsch gleich mit Look. */
export async function beispielInEditor(f: Foto, lookId?: string) {
  try {
    const file = new File([await bild(f)], `beispiel-${f}.jpg`, { type: 'image/jpeg' });
    addPhotos([file]);
    if (lookId) useStore.getState().setLook(lookId);
  } catch {
    // Meist fehlt das Netz (die Fotos liegen sonst im Cache der App); die Rohmeldung („Failed to fetch“) hilft niemandem.
    useStore.getState().notify('Das Beispielfoto ließ sich nicht laden. Bitte prüfe die Internetverbindung.', 'fehler');
  }
}
