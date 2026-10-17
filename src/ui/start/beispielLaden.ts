import { addPhotos } from '../intake';
import { useStore } from '../store';
import { beispielUrl, grossUrl, type Foto } from './werkstatt';

/** Ladezustand der Editor-Fassung: `null` = nichts lädt, sonst der geladene Anteil 0…1 (`null`, solange unbekannt). */
export type BeispielLadezustand = { anteil: number | null } | null;

let zustand: BeispielLadezustand = null;
const hoerer = new Set<() => void>();
function setzen(z: BeispielLadezustand) {
  zustand = z;
  for (const h of hoerer) h();
}
/** Für useSyncExternalStore (Ladeanzeige der Startseite). */
export const beispielLadezustand = () => zustand;
export function beispielLadenAbo(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

/** Liest die Antwort und meldet den Anteil, sofern der Server die Größe nennt. */
async function lesen(res: Response): Promise<Blob> {
  const gesamt = Number(res.headers.get('content-length')) || 0;
  if (!res.body || gesamt <= 0) return res.blob();
  const teile: Uint8Array[] = [];
  let gelesen = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    teile.push(value);
    gelesen += value.length;
    setzen({ anteil: Math.min(1, gelesen / gesamt) });
  }
  return new Blob(teile as BlobPart[], { type: 'image/jpeg' });
}

/**
 * Editor-Fassung (bis 4000 px, echte Details für Lupe und Export). Offline und noch nicht im Cache: ohne Meldung die
 * Seitenfassung, die vorab im Cache der App liegt.
 */
async function bild(f: Foto): Promise<Blob> {
  try {
    const res = await fetch(grossUrl(f));
    if (res.ok) return await lesen(res);
  } catch {
    // weiter mit der Seitenfassung
  }
  setzen({ anteil: null });
  const res = await fetch(beispielUrl(f));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return lesen(res);
}

/** Lädt ein Beispielfoto als Datei in den Editor – derselbe Weg wie „Fotos wählen“ –, auf Wunsch gleich mit Look. */
export async function beispielInEditor(f: Foto, lookId?: string) {
  // Ein zweiter Klick während des Ladens startet nichts Neues.
  if (zustand) return;
  setzen({ anteil: null });
  try {
    const file = new File([await bild(f)], `beispiel-${f}.jpg`, { type: 'image/jpeg' });
    addPhotos([file]);
    if (lookId) useStore.getState().setLook(lookId);
  } catch {
    // Meist fehlt das Netz (die Fotos liegen sonst im Cache der App); die Rohmeldung („Failed to fetch“) hilft niemandem.
    useStore.getState().notify('Das Beispielfoto ließ sich nicht laden. Bitte prüfe die Internetverbindung.', 'fehler');
  } finally {
    setzen(null);
  }
}
