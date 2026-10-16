// Dauerhafter Speicher für Rezepte und LUTs: Sobald welche vorhanden sind, bittet die Seite einmal pro
// Sitzung um persistenten Speicher. Safari am iPhone räumt sonst Websitedaten nach einigen Tagen ab,
// außer die Seite liegt als App auf dem Home-Bildschirm (siehe pwa-installationshinweis im Depot).
import { useStore } from './store';

const HINT_KEY = 'filmlab.installhinweis';

function isStandalone(): boolean {
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches);
}

/** iPhone/iPod, und das iPad, das sich seit iPadOS 13 als Mac meldet. */
function isIos(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function showInstallHint() {
  try {
    if (localStorage.getItem(HINT_KEY)) return;
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
    if (isIos() && !isStandalone()) showInstallHint();
  };
  const unsubscribe = useStore.subscribe(check);
  check();
}
