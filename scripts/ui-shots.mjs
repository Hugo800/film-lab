// Bildschirmfotos der Oberfläche: npm run ui:shots (startet den Test-Dev-Server, Port TEST_PORT, Vorgabe 5190)
// Handy (393×852 @3x) und PC (1440×900); Ausgabe in test-output/ui/.
import { mkdirSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const server = await startDevServer();
const URL = `${server.url}/`;
const OUT = 'test-output/ui';
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

  await page.evaluate(() => document.querySelector('#tab-looks')?.click());
  await sleep(300);
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
