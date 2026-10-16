// Nachkritik PC 1: Layouts bei fünf Fenstergrößen, Messwerte + Bildschirmfotos.
import { resolve } from 'node:path';
import { launch, startDevServer } from './lib/browser.mjs';
const OUT = 'test-output/ux-nachkritik/pc';
const files = ['DSC04866', 'DSC03427', 'DSC01603', 'DSC03982'].map((f) => resolve(`testbilder/${f}.JPEG`));
const server = await startDevServer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { browser, page } = await launch({ viewport: { width: 1440, height: 900 }, log: true });
await page.goto(server.url + '/', { waitUntil: 'networkidle0' });
await page.screenshot({ path: `${OUT}/01-start-1440.png` });
await (await page.$('#datei-eingabe')).uploadFile(...files);
await page.waitForFunction(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible', { timeout: 120000 });
await page.waitForFunction(() => document.querySelectorAll('section[aria-label] img').length > 8, { timeout: 120000 });
await sleep(4000);
for (const [w, h] of [[1440, 900], [1280, 720], [1023, 700], [900, 650], [1920, 1080]]) {
  await page.setViewport({ width: w, height: h });
  await sleep(1500);
  const m = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    const sec = [...document.querySelectorAll('section[data-cat]')].map((s) => s.dataset.cat);
    const list = document.querySelector('section[data-cat]')?.parentElement;
    return {
      frame: r('[aria-label^="Vorschau"]'),
      panel: r('aside'), list: list && [list.clientWidth, list.clientHeight, list.scrollHeight],
      filmstrip: r('ul[aria-label="Geladene Fotos"]'),
      hscroll: document.documentElement.scrollWidth > innerWidth,
      slider: r('#regler-strength'), sec,
      header: r('header'),
    };
  });
  console.log(w + 'x' + h, JSON.stringify(m));
  await page.screenshot({ path: `${OUT}/02-editor-${w}x${h}.png` });
}
await browser.close(); await server.close();
