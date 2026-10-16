// Repro für Korrektheitsfehler aus der Fehlersuche (16.10.2026). Nur lesend, Port per TEST_PORT.
// node scripts/repro-korrektheit.mjs  → je Fall „BUG“ (Fehler nachgestellt) oder „ok“.
import { resolve } from 'node:path';
import { launch, startDevServer } from './lib/browser.mjs';

const server = await startDevServer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PHOTOS = ['testbilder/DSC04866.JPEG', 'testbilder/DSC03982.JPEG'].map((p) => resolve(p));
const { browser, page } = await launch({ viewport: { width: 1280, height: 800 }, log: false });
const report = (bug, msg) => console.log(`${bug ? 'BUG ' : 'ok  '} ${msg}`);

const waitFor = async (fn, ms = 60000) => {
  const end = Date.now() + ms;
  for (;;) {
    if (await page.evaluate(fn)) return true;
    if (Date.now() >= end) return false;
    await sleep(150);
  }
};
const store = () => page.evaluate(async () => {
  const { useStore } = await import('/src/ui/store.ts');
  const s = useStore.getState();
  return { n: s.photos.length, active: s.activeId, looks: s.photos.map((p) => p.settings.lookId), zoom: s.zoom, undo: !!s.undoState };
});
const originalShown = () => page.evaluate(() => [...document.querySelectorAll('span')].some((s) => s.textContent === 'Original'));
const ready = () => waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');

async function load() {
  await page.goto(`${server.url}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.setItem('filmlab.tipp-original', '1'));
  await (await page.$('#datei-eingabe')).uploadFile(...PHOTOS);
  if (!(await ready())) throw new Error('Vorschau nicht bereit');
  // Kacheln fertig rechnen lassen, sonst blockiert SwiftShader die Zeitgeber.
  await waitFor(() => document.querySelectorAll('section[aria-label] img').length > 30, 120000);
  await sleep(500);
}

try {
  // 1 Gesten-Zähler bleibt hängen: Maus im Zoom außerhalb des Bildrahmens drücken, Esc, loslassen.
  await load();
  const frame = await (await page.$('[aria-label^="Vorschau"]')).boundingBox();
  const stage = await page.evaluate(() => {
    const r = document.querySelector('[aria-label^="Vorschau"]').parentElement.parentElement.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.down();
  const before = await waitFor(() => [...document.querySelectorAll('span')].some((s) => s.textContent === 'Original'), 3000);
  await page.mouse.up();
  await page.keyboard.press('z');
  await waitFor(async () => (await import('/src/ui/store.ts')).useStore.getState().zoom);
  // Punkt in der Bühne, aber außerhalb des Bildrahmens (Rand oben).
  const px = stage.x + stage.w / 2;
  const py = stage.y + Math.max(2, (frame.y - stage.y) / 2);
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.mouse.up();
  await sleep(300);
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.down();
  const after = await waitFor(() => [...document.querySelectorAll('span')].some((s) => s.textContent === 'Original'), 3000);
  await page.mouse.up();
  report(before && !after, `Halten zeigt „Original“: vorher ${before}, nach Esc bei gedrückter Maus im Zoom ${after} (Rand ${Math.round(frame.y - stage.y)} px)`);

  // 2 Leertaste auf einer fokussierten Kachel: löst sie nicht mehr aus.
  await load();
  const pick = async (key) => {
    const name = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button[data-look]')].find((x) => x.getAttribute('aria-pressed') === 'false');
      b.focus();
      return b.dataset.look;
    });
    await page.keyboard.press(key);
    await sleep(200);
    return { name, pressed: await page.evaluate((n) => document.querySelector(`button[data-look="${n}"]`).getAttribute('aria-pressed') === 'true', name) };
  };
  const space = await pick(' ');
  const enter = await pick('Enter');
  report(!space.pressed && enter.pressed, `Fokussierte Kachel: Leertaste wählt „${space.name}“ ${space.pressed}, Enter wählt „${enter.name}“ ${enter.pressed}`);

  // 3 Backslash per AltGr (deutsche Tastatur): AltGr zuerst loslassen → keyup meldet „ß“, „Original“ bleibt stehen.
  const cdp = await page.createCDPSession();
  await page.evaluate(() => document.activeElement?.blur());
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: '\\', code: 'Minus', modifiers: 2 | 1, text: '\\' });
  await sleep(150);
  const held = await originalShown();
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'AltGraph', code: 'AltRight' });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ß', code: 'Minus' });
  await sleep(300);
  const stuck = await originalShown();
  report(held && stuck, `AltGr+ß gehalten: „Original“ ${held}; nach Loslassen (AltGr zuerst) noch sichtbar: ${stuck}`);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));

  // 4 Rückgängig nach „Entfernen“ verwirft spätere Änderungen am anderen Foto.
  await load();
  const s0 = await store();
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Delete');
  await sleep(300);
  await page.keyboard.press('ArrowDown'); // Look des verbliebenen Fotos ändern
  await sleep(300);
  const s1 = await store();
  // Meldung schließen: Rückgängig wird nicht mehr angeboten, Strg+Z wirkt trotzdem.
  await page.evaluate(() => document.querySelector('[aria-label="Meldung schließen"]')?.click());
  await sleep(200);
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await sleep(300);
  const s2 = await store();
  report(s2.n === 2 && s2.looks[1] !== s1.looks[0],
    `Look Foto 2: vor ${s0.looks[1]}, nach ↓ ${s1.looks[0]}, nach Strg+Z (Meldung geschlossen) ${s2.looks[1]}; Fotos ${s2.n}`);
} finally {
  await browser.close();
  await server.close();
}
