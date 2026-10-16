// Bildschirmfotos der Oberfläche: npm run ui:shots (startet den Test-Dev-Server, Port TEST_PORT, Vorgabe 5190)
// Handy (393×852 @3x) und PC (1440×900); Ausgabe in test-output/ui-v2/.
import { mkdirSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const server = await startDevServer();
const URL = `${server.url}/`;
const OUT = 'test-output/ui-v2';
const PHOTOS = ['testbilder/DSC04866.JPEG', 'testbilder/DSC03427.JPEG'];
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, viewport) {
  const { browser, page } = await launch({ viewport });
  const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png` });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await shot('1-start');

  const input = await page.$('input[type=file]');
  await input.uploadFile(...PHOTOS);
  await page.waitForSelector('[aria-label="Vorschau. Gedrückt halten zeigt das Original."]', { timeout: 30000 });
  await sleep(6000);
  await shot('2-geladen');

  await page.evaluate(() => document.querySelector('#tab-anpassen')?.click());
  await sleep(500);
  await shot('3-anpassen');
  // Weiter unten im Bedienfeld: Körnung, Farbeffekte, Extras
  for (const [n, id] of [['3b-anpassen-koernung', 'regler-grainEffect'], ['3c-anpassen-extras', 'regler-leak']]) {
    await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'center' }), id);
    await sleep(300);
    await shot(n);
  }
  // Schwarzweiß-Look: Monochrom-Tönung statt Farbe
  await page.evaluate(() => document.querySelector('#tab-looks')?.click());
  await sleep(300);
  await page.evaluate(() => document.querySelector('button[data-look="Acros"]')?.click());
  await sleep(600);
  await page.evaluate(() => document.querySelector('#tab-anpassen')?.click());
  await sleep(500);
  await page.evaluate(() => document.getElementById('regler-monoWarmCool')?.scrollIntoView({ block: 'center' }));
  await sleep(300);
  await shot('3d-anpassen-sw');
  await page.evaluate(() => document.querySelector('#tab-looks')?.click());
  await sleep(300);
  await page.evaluate(() => document.querySelector('button[data-look="Ohne"]')?.click());
  await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Rezept einfügen')?.click());
  await sleep(400);
  await page.type('#rezept-text', 'Film Simulation: Classic Chrome\nGrain Effect: Strong, Small\nColor Chrome Effect: Strong\nWhite Balance: 5500K, +2 Red & -4 Blue\nDynamic Range: DR400\nHighlight: -1\nShadow: +0.5\nHigh ISO NR: -4\nExposure Compensation: +1/3 to +1');
  await sleep(500);
  await shot('3e-rezept');
  await page.keyboard.press('Escape');
  await sleep(300);

  await page.evaluate(() => document.querySelector('#tab-looks')?.click());
  await sleep(300);
  await page.evaluate(() => document.querySelector('button[data-look="Classic Chrome"]')?.click());
  await sleep(500);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Vorher-Nachher/.test(b.ariaLabel ?? ''))?.click());
  await sleep(800);
  await shot('4-vergleich');

  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Exportieren'))?.click());
  await sleep(1000);
  await shot('5-export');
  await browser.close();
}

await run('handy', { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await run('pc', { width: 1440, height: 900, deviceScaleFactor: 1 });
await server.close();
