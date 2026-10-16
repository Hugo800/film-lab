import { resolve } from 'node:path';
import { launch, startDevServer } from './lib/browser.mjs';
export const OUT = 'test-output/ux-nachkritik/pc';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const photo = (f) => resolve(`testbilder/${f}.JPEG`);
export async function open({ w = 1440, h = 900, names = ['DSC04866', 'DSC03427', 'DSC01603', 'DSC03982'], extra } = {}) {
  const server = await startDevServer();
  const { browser, page } = await launch({ viewport: { width: w, height: h }, log: false });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  await page.goto(server.url + '/', { waitUntil: 'networkidle0' });
  await (await page.$('#datei-eingabe')).uploadFile(...names.map(photo));
  await page.waitForFunction(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible', { timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll('section[aria-label] img').length > 8, { timeout: 120000 });
  await sleep(2500);
  return { server, browser, page, shot: (n, clip) => page.screenshot({ path: `${OUT}/${n}.png`, clip }) };
}
export const state = (page) => page.evaluate(() => ({
  photo: document.querySelector('ul[aria-label="Geladene Fotos"] button[aria-current=true]')?.getAttribute('aria-label')?.slice(0, 22),
  look: document.querySelector('button[aria-pressed=true][data-look]')?.dataset.look,
  label: document.querySelector('[aria-live=polite]')?.textContent,
  slider: !!document.querySelector('[role=slider][aria-label="Vorher-Nachher-Teiler"]'),
  dialog: document.querySelector('[role=dialog] h2')?.textContent ?? null,
  tab: document.querySelector('[role=tab][aria-selected=true]')?.id,
  focus: document.activeElement?.tagName + (document.activeElement?.getAttribute('aria-label') ? `[${document.activeElement.getAttribute('aria-label').slice(0, 25)}]` : document.activeElement?.id ? '#' + document.activeElement.id : ''),
  photos: document.querySelectorAll('ul[aria-label="Geladene Fotos"] > li').length - 1,
  zoom: !!document.querySelector('[aria-label^="100 %, zurück"]'),
  toast: document.querySelector('[role=status],[role=alert]')?.textContent ?? null,
}));
