// Film Lab als App installieren. Chromium (Android, Chrome und Edge am PC) meldet per beforeinstallprompt, dass es
// einen eigenen Dialog zeigen kann; Safari (iPhone, iPad, Mac) und Firefox nicht – dort zeigt die Startseite eine
// Anleitung. Das Teilen-Fenster per navigator.share enthält am iPhone kein „Zum Home-Bildschirm“, nur das von Safari.
// Hintergrund: pwa-installationshinweis im Depot.
import { useSyncExternalStore } from 'react';
import { isStandalone } from './persist';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Für die Anleitung: `ios-app` = In-App-Browser am iPhone (Instagram, Gmail …), der nichts installieren kann. */
export type Plattform = 'ios' | 'ios-app' | 'android' | 'desktop';

/**
 * iPadOS meldet sich als Mac, verrät sich aber durch Touch. In-App-Browser am iPhone tragen eine eigene Kennung
 * (Instagram, FBAN/FBAV) oder ihnen fehlt „Safari/“, das Safari, Chrome, Firefox und Edge für iOS mitschicken.
 */
export function plattform(ua: string, platform: string, touchPoints: number): Plattform {
  if (/iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1))
    return /Instagram|FBAN|FBAV/.test(ua) || !/Safari\//.test(ua) ? 'ios-app' : 'ios';
  return /Android/.test(ua) ? 'android' : 'desktop';
}

export const diesePlattform = () => plattform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

let ereignis: InstallEvent | null = null;
let installiert = false;
const hoerer = new Set<() => void>();
const melden = () => hoerer.forEach((h) => h());

/**
 * Vor dem ersten Rendern aufrufen, sonst ist das Ereignis verpasst. Ohne preventDefault: Chrome zeigt seine eigene
 * Leiste weiterhin (auch im Editor, wo es keinen Knopf gibt); prompt() geht trotzdem.
 */
export function installAbfangen() {
  window.addEventListener('beforeinstallprompt', (e) => {
    ereignis = e as InstallEvent;
    melden();
  });
  window.addEventListener('appinstalled', () => {
    ereignis = null;
    installiert = true;
    melden();
  });
}

/** `app` = läuft schon als App oder wurde eben installiert, `dialog` = Browser hat einen eigenen Dialog, sonst Anleitung. */
export type Installweg = 'app' | 'dialog' | 'anleitung';

const weg = (): Installweg => (installiert || isStandalone() ? 'app' : ereignis ? 'dialog' : 'anleitung');

function abo(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

export function useInstallweg(): Installweg {
  return useSyncExternalStore(abo, weg, () => 'anleitung');
}

/** Zeigt den Installationsdialog des Browsers (nur aus einem Klick heraus); null = keiner verfügbar. */
export async function installieren(): Promise<'accepted' | 'dismissed' | null> {
  const e = ereignis;
  if (!e) return null;
  // Ein Ereignis gilt nur einmal.
  ereignis = null;
  melden();
  await e.prompt();
  return (await e.userChoice).outcome;
}
