// Dauerhafter Speicher für Rezepte und LUTs: Sobald welche vorhanden sind, bittet die Seite einmal pro
// Sitzung um persistenten Speicher. Safari am iPhone räumt sonst Websitedaten nach einigen Tagen ab,
// außer die Seite liegt als App auf dem Home-Bildschirm (siehe pwa-installationshinweis im Depot).
import { useStore } from './store';

const HINT_KEY = 'filmlab.installhinweis';

export function isStandalone(): boolean {
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches);
}

/** iPhone/iPod, und das iPad, das sich seit iPadOS 13 als Mac meldet. */
function isIos(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Etwas später als die Meldung „Rezept gespeichert“, die der Auslöser selbst zeigt. */
const HINT_DELAY_MS = 5000;

function showInstallHint() {
  try {
    if (localStorage.getItem(HINT_KEY)) return;
    // Ein offenes „Rückgängig“ nicht verdrängen; der Merker gilt erst, wenn der Hinweis wirklich erschien.
    if (useStore.getState().notice?.action) {
      setTimeout(showInstallHint, HINT_DELAY_MS);
      return;
    }
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    return;
  }
  useStore.getState().notify('Tipp: Teilen → „Zum Home-Bildschirm“. Dann bleiben Rezepte und LUTs dauerhaft erhalten.');
}

export function initPersist() {
  let done = false;
  const check = () => {
    const s = useStore.getState();
    if (done || (!s.presets.length && !s.customLuts.length && !s.officialKeys.length)) return;
    done = true;
    unsubscribe();
    void navigator.storage?.persist?.().catch(() => {});
    if (isIos() && !isStandalone()) setTimeout(showInstallHint, HINT_DELAY_MS);
  };
  const unsubscribe = useStore.subscribe(check);
  check();
}
