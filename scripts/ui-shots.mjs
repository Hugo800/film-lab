// Bildschirmfotos der Oberfläche: npm run ui:shots [-- 393x852 1440x900 …] (startet den Test-Dev-Server, Port TEST_PORT, Vorgabe 5190)
// Ohne Angabe alle Fenstergrößen der Endabnahme; je Größe Start, Looks, Anpassen, Lupe (100 %), Rezept, Export.
// Ausgabe in test-output/ui-v2/<Breite>x<Höhe>[q]-<Ansicht>.png (q = Handy quer).
import { mkdirSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const OUT = 'test-output/ui-v2';
const PHOTOS = ['testbilder/DSC04866.JPEG', 'testbilder/DSC03427.JPEG'];
const phone = (width, height, dpr) => ({ width, height, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
const pc = (width, height) => ({ width, height, deviceScaleFactor: 1 });
const SIZES = {
  '375x667': phone(375, 667, 2),
  '393x852': phone(393, 852, 3),
  '667x375q': phone(667, 375, 2),
  '852x393q': phone(852, 393, 3),
  '900x650': pc(900, 650),
  '1023x700': pc(1023, 700),
  '1280x720': pc(1280, 720),
  '1440x900': pc(1440, 900),
  '1920x1080': pc(1920, 1080),
};
const wanted = process.argv.slice(2).map((a) => Object.keys(SIZES).find((k) => k.startsWith(a)) ?? a);
for (const w of wanted) if (!SIZES[w]) throw new Error(`Unbekannte Größe ${w} (bekannt: ${Object.keys(SIZES).join(', ')})`);
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await startDevServer();

async function run(name, viewport) {
  const t0 = Date.now();
  const { browser, page } = await launch({ viewport, log: false });
  const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png` });
  const wait = (fn, ms = 60_000) => page.waitForFunction(fn, { timeout: ms, polling: 200 }).then(() => true, () => false);
  const click = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
  try {
    await page.goto(`${server.url}/`, { waitUntil: 'networkidle0' });
    await shot('1-start');

    await (await page.$('#datei-eingabe')).uploadFile(...PHOTOS);
    await wait(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible', 120_000);
    // Tipp-Toast schließen, Kacheln der ersten Gruppe abwarten
    await click('[aria-label="Meldung schließen"]');
    await wait(() => document.querySelectorAll('section[data-cat=fujifilm] img').length >= 8, 120_000);
    await sleep(500);
    await shot('2-looks');

    await click('#tab-anpassen');
    await sleep(500);
    await shot('3-anpassen');

    await click('button[aria-label="100 %-Ansicht"]');
    const zoomed = await wait(
      () => !!document.querySelector('[aria-label^="Ansicht 100 %"] canvas[style*="width"]') &&
        !document.querySelector('[aria-label="100 %, zurück zur Ganzansicht"] .animate-spin'),
      180_000,
    );
    await shot('4-lupe');
    if (!zoomed) console.log(`${name}: Lupe nicht fertig gerechnet`);
    await page.keyboard.press('Escape');
    await sleep(300);

    await click('#tab-looks');
    await click('button[aria-label="Rezept einfügen"]');
    await page.waitForSelector('#rezept-text');
    await page.$eval('#rezept-text', (el, t) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, 'Film Simulation: Classic Chrome\nGrain Effect: Strong, Small\nColor Chrome Effect: Strong\nWhite Balance: 5500K, +2 Red & -4 Blue\nDynamic Range: DR400\nHighlight: -1\nShadow: +0.5\nHigh ISO NR: -4\nExposure Compensation: +1/3 to +1');
    await sleep(500);
    await shot('5-rezept');
    await page.keyboard.press('Escape');
    // Ein Dialog mit Text schließt per Esc; zur Sicherheit über den Knopf.
    await click('[role=dialog] button[aria-label="Schließen"]');
    await sleep(300);

    await page.evaluate(() => [...document.querySelectorAll('header button')].find((b) => b.textContent.includes('Exportieren'))?.click());
    await sleep(800);
    await shot('6-export');
  } finally {
    await browser.close();
  }
  console.log(`${name}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

try {
  for (const name of wanted.length ? wanted : Object.keys(SIZES)) await run(name, SIZES[name]);
} finally {
  await server.close();
}
