// Regressionstest für Tastatur, Gesten, Rückgängig und Dialoge (Befunde der Korrektheitsprüfung vom 16.10.2026):
// node scripts/ui-tasten.mjs  (Test-Dev-Server auf TEST_PORT). Jeder Fall meldet OK oder FAIL, Exit-Code 1 bei Fehlern.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, startDevServer } from './lib/browser.mjs';

const server = await startDevServer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PHOTOS = ['testbilder/DSC04866.JPEG', 'testbilder/DSC03982.JPEG'].map((p) => resolve(p));
const DL = resolve('test-output/ui-tasten');
mkdirSync(DL, { recursive: true });

let fails = 0;
const ok = (cond, msg) => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
};

let page;
const waitFor = async (fn, ms = 60000, arg) => {
  const end = Date.now() + ms;
  for (;;) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    if (Date.now() >= end) return false;
    await sleep(150);
  }
};
const store = () =>
  page.evaluate(async () => {
    const { useStore } = await import('/src/ui/store.ts');
    const s = useStore.getState();
    return { n: s.photos.length, looks: s.photos.map((p) => p.settings.lookId), zoom: s.zoom, undo: !!s.undoState };
  });
const originalShown = () => page.evaluate(() => [...document.querySelectorAll('span')].some((s) => s.textContent === 'Original'));
const waitOriginal = (ms = 3000) => waitFor(() => [...document.querySelectorAll('span')].some((s) => s.textContent === 'Original'), ms);
const ctrl = async (key) => {
  await page.keyboard.down('Control');
  await page.keyboard.press(key);
  await page.keyboard.up('Control');
};

async function load(photos = PHOTOS) {
  await page.goto(`${server.url}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.setItem('filmlab.tipp-original', '1'));
  await (await page.$('#datei-eingabe')).uploadFile(...photos);
  if (!(await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible', 120000)))
    throw new Error('Vorschau nicht bereit');
  // Kacheln fertig rechnen lassen, sonst blockiert SwiftShader die Zeitgeber.
  await waitFor(() => document.querySelectorAll('section[aria-label] img').length > 30, 120000);
  await sleep(500);
}

async function pc() {
  const b = await launch({ viewport: { width: 1280, height: 800 }, log: false });
  page = b.page;
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
  try {
    // 1 Lupe endet bei gedrückter Maus außerhalb des Bildrahmens: Halten muss danach weiter gehen.
    await load();
    const frame = await (await page.$('[aria-label^="Vorschau"]')).boundingBox();
    const stage = await page.evaluate(() => {
      const r = document.querySelector('[aria-label^="Vorschau"]').parentElement.parentElement.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width };
    });
    const mid = [frame.x + frame.width / 2, frame.y + frame.height / 2];
    await page.keyboard.press('z');
    await waitFor(async () => (await import('/src/ui/store.ts')).useStore.getState().zoom);
    await page.mouse.move(stage.x + stage.w / 2, stage.y + Math.max(2, (frame.y - stage.y) / 2));
    await page.mouse.down();
    await page.keyboard.press('Escape');
    await sleep(200);
    await page.mouse.up();
    await sleep(300);
    await page.mouse.move(...mid);
    await page.mouse.down();
    const after = await waitOriginal();
    await page.mouse.up();
    ok(after, 'Halten zeigt „Original“ nach Esc bei gedrückter Maus im Zoom');

    // 2 Leertaste: löst einen per Tastatur fokussierten Knopf aus, nach Mausklick zeigt sie das Original.
    await page.evaluate(() => window.addEventListener('keydown', (e) => e.key === ' ' && setTimeout(() => (window.__spacePrevented = e.defaultPrevented))));
    await page.keyboard.press('Tab');
    const name = await page.evaluate(() => {
      const t = [...document.querySelectorAll('button[data-look]')].find((x) => x.getAttribute('aria-pressed') === 'false');
      t.focus();
      return t.dataset.look;
    });
    await page.keyboard.press(' ');
    await sleep(300);
    const picked = await page.evaluate((n) => document.querySelector(`button[data-look="${n}"]`).getAttribute('aria-pressed') === 'true', name);
    ok(picked && !(await page.evaluate(() => window.__spacePrevented)), `Leertaste auf fokussierter Kachel wählt „${name}“, ohne preventDefault`);
    const other = await page.$('button[data-look][aria-pressed=false]');
    await other.click();
    await sleep(300);
    await page.keyboard.down(' ');
    const held = await waitOriginal();
    await page.keyboard.up(' ');
    await sleep(300);
    ok(held && !(await originalShown()), 'Nach Mausklick auf eine Kachel zeigt gehaltene Leertaste das Original');

    // 3 \ per AltGr, AltGr zuerst losgelassen: keyup meldet „ß“.
    await page.evaluate(() => document.activeElement?.blur());
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: '\\', code: 'Minus', modifiers: 2 | 1, text: '\\' });
    const heldBs = await waitOriginal();
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'AltGraph', code: 'AltRight' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ß', code: 'Minus' });
    await sleep(300);
    ok(heldBs && !(await originalShown()), 'AltGr+ß: „Original“ endet beim Loslassen, auch wenn AltGr zuerst losgelassen wird');

    // 4 Strg+Z nach geschlossener Meldung verwirft keine spätere Änderung.
    await load();
    await page.keyboard.press('Delete');
    await sleep(300);
    await page.keyboard.press('ArrowDown');
    await sleep(300);
    const s1 = await store();
    await page.evaluate(() => document.querySelector('[aria-label="Meldung schließen"]')?.click());
    await sleep(200);
    await ctrl('z');
    await sleep(300);
    const s2 = await store();
    ok(s2.n === 1 && s2.looks[0] === s1.looks[0], `Strg+Z nach geschlossener Meldung: ${s2.n} Foto(s), Look ${s2.looks[0]} (erwartet 1, ${s1.looks[0]})`);

    // 5 Nach Mausklick auf einen Regler: Z, Esc und Strg+E wirken, die Pfeile bleiben beim Regler.
    await load();
    const slider = await (await page.$('#regler-strength')).boundingBox();
    await page.mouse.click(slider.x + slider.width * 0.6, slider.y + slider.height / 2);
    await sleep(200);
    const v0 = await page.$eval('#regler-strength', (e) => e.value);
    await page.keyboard.press('ArrowLeft');
    await sleep(200);
    const v1 = await page.$eval('#regler-strength', (e) => e.value);
    ok(v0 !== v1 && (await store()).n === 2, `Pfeil im fokussierten Regler verstellt ihn (${v0} → ${v1})`);
    await page.keyboard.press('z');
    const zoomed = await waitFor(async () => (await import('/src/ui/store.ts')).useStore.getState().zoom, 3000);
    await page.keyboard.press('Escape');
    const unzoomed = await waitFor(async () => !(await import('/src/ui/store.ts')).useStore.getState().zoom, 3000);
    ok(zoomed && unzoomed, `Regler fokussiert: Z → Lupe ${zoomed}, Esc → zurück ${unzoomed}`);
    await page.$eval('#regler-strength', (e) => e.focus());
    await ctrl('e');
    const exportOpen = await waitFor(() => !!document.querySelector('[aria-modal="true"]'), 3000);
    ok(exportOpen, 'Regler fokussiert: Strg+E öffnet den Export');
    await page.keyboard.press('Escape');
    await waitFor(() => !document.querySelector('[aria-modal="true"]'), 3000);

    // 6 Mausrad verschiebt die Lupe und hält am Bildrand.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('z');
    const canvasState = () =>
      page.evaluate(() => {
        const c = document.querySelector('[aria-label^="Ansicht 100 %"] canvas');
        return c && c.style.visibility !== 'hidden' ? c.style.transform + c.style.width : null;
      });
    await waitFor(() => {
      const c = document.querySelector('[aria-label^="Ansicht 100 %"] canvas');
      return !!c && c.style.visibility !== 'hidden';
    });
    const t0 = await canvasState();
    await page.mouse.move(...mid);
    await page.mouse.wheel({ deltaY: 300 });
    await sleep(800);
    const t1 = await canvasState();
    ok(t0 !== t1, `Mausrad verschiebt die Lupe (${t0} → ${t1})`);
    for (let i = 0; i < 40; i++) await page.mouse.wheel({ deltaY: 300 });
    await sleep(1500);
    const tEdge = await canvasState();
    await page.mouse.wheel({ deltaY: 300 });
    await sleep(1500);
    ok(tEdge === (await canvasState()), 'Mausrad hält am Bildrand');
    await page.keyboard.press('Escape');

    // 7 Tastenkürzel-Knopf öffnet den Dialog.
    await page.click('header [aria-label="Tastenkürzel"]');
    ok(await waitFor(() => document.querySelector('[role=dialog] h2')?.textContent === 'Tastenkürzel', 3000), 'Knopf „Tastenkürzel“ öffnet den Dialog');
    await page.keyboard.press('Escape');
    await sleep(200);

    // 8 Export bei offenem „Rückgängig“ (hier nach „Auf alle“): Der Toast verschwindet; nach dem Export ist Enter = Schließen.
    const hasUndo = () => page.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.textContent === 'Rückgängig'));
    await page.click('button[title="Look und alle Regler auf alle Fotos übertragen"]');
    const offered = await waitFor(() => [...document.querySelectorAll('button')].some((x) => x.textContent === 'Rückgängig'), 3000);
    await page.evaluate(() => document.activeElement?.blur());
    await ctrl('e');
    await waitFor(() => !!document.querySelector('[role=dialog] input[name=umfang]'), 5000);
    ok(offered && !(await hasUndo()), 'Beim Export ist „Rückgängig“ nicht mehr erreichbar');
    await page.evaluate(() => [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.includes('Dieses Foto'))?.click());
    await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Exportieren')?.click());
    const done = await waitFor(() => document.querySelector('[role=dialog] h2')?.textContent === 'Export fertig', 600000);
    await sleep(300);
    const focus = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 40));
    await page.keyboard.press('Enter');
    const closed = await waitFor(() => !document.querySelector('[role=dialog]'), 3000);
    ok(done && focus === 'Schließen' && closed, `Export fertig ${done}: Fokus auf „${focus}“, Enter schließt ${closed}`);

    // 9 Strg+Z in der Startansicht nach dem Entfernen des letzten Fotos.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Delete');
    await sleep(300);
    await page.keyboard.press('Delete');
    await sleep(300);
    const start = (await store()).n === 0;
    await ctrl('z');
    await sleep(300);
    ok(start && (await store()).n === 1, 'Strg+Z holt das letzte Foto aus der Startansicht zurück');
  } finally {
    await b.browser.close();
  }
}

/** Handy quer mit Bildschirmtastatur: Der Rezept-Dialog zeigt genug Inhalt. */
async function landscape(width, height) {
  const b = await launch({ viewport: { width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, log: false });
  page = b.page;
  try {
    await load([PHOTOS[0]]);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Rezept einfügen')?.click());
    await waitFor(() => !!document.querySelector('#rezept-text'), 10000);
    // Tastatur 180 px: iOS und Chrome verkleinern nur den visuellen Viewport.
    await page.evaluate(() => {
      Object.defineProperty(VisualViewport.prototype, 'height', { get: () => innerHeight - 180 });
      visualViewport.dispatchEvent(new Event('resize'));
      document.querySelector('#rezept-text').focus();
    });
    await sleep(500);
    const m = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      const apply = [...d.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Anwenden').getBoundingClientRect();
      return { body: Math.round(d.children[1].getBoundingClientRect().height), apply: apply.bottom <= innerHeight - 180 + 1 && apply.top >= 0 };
    });
    ok(m.body >= 80 && m.apply, `${width}×${height} quer, Tastatur offen: Inhalt ${m.body} px (≥ 80), „Anwenden“ sichtbar ${m.apply}`);
    await page.screenshot({ path: `${DL}/rezept-tastatur-${width}x${height}.png` });
  } finally {
    await b.browser.close();
  }
}

/** Handy hochkant: unterscheidbare Kachelnamen bei Kodak und Eterna. */
async function tileNames() {
  const b = await launch({ viewport: { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, log: false });
  page = b.page;
  try {
    await load([PHOTOS[0]]);
    const tiles = await page.$$eval('section[aria-label] button[data-look]', (bs) =>
      bs.map((x) => {
        const l = x.querySelector('span.truncate');
        return { full: x.dataset.look, shown: l.textContent, cut: l.scrollWidth > l.clientWidth };
      }),
    );
    const want = { 'Kodachrome 64': 'K-chrome 64', 'Kodachrome 25': 'K-chrome 25', 'Kodacolor VR 200': 'VR 200', 'Ektachrome E100': 'E100', 'Eterna Bleach Bypass': 'Bleach Bypass' };
    const bad = Object.entries(want).filter(([full, shown]) => {
      const t = tiles.find((x) => x.full === full);
      // „Bleach Byp…“ ist abgeschnitten, aber neben „Eterna“ eindeutig.
      return !t || t.shown !== shown || (t.cut && full !== 'Eterna Bleach Bypass');
    });
    ok(bad.length === 0, `Kachelnamen unterscheidbar: ${Object.values(want).join(', ')}${bad.length ? ` – falsch: ${bad.map((x) => x[0]).join(', ')}` : ''}`);
    console.log(`     noch abgeschnitten: ${tiles.filter((t) => t.cut).map((t) => t.shown).join(', ') || '–'}`);
  } finally {
    await b.browser.close();
  }
}

try {
  const only = process.argv[2];
  if (!only || only === 'pc') await pc();
  if (!only || only === 'quer') {
    await landscape(852, 393);
    await landscape(667, 375);
  }
  if (!only || only === 'namen') await tileNames();
} finally {
  await server.close();
}
console.log(fails ? `${fails} FAIL` : 'alles OK');
process.exit(fails ? 1 : 0);
