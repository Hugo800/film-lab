import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { CHROME, PORT } from './lib/browser.mjs';
const BUILD = resolve('test-output/lizenz/build');
const { preview } = await import('vite');
const server = await preview({ configFile: false, root: process.cwd(), build: { outDir: BUILD }, preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage'], defaultViewport: { width: 1280, height: 800 } });
const page = await browser.newPage();
page.on('console', (m) => console.log('[c]', m.text().slice(0, 200)));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
await (await page.$('#datei-eingabe')).uploadFile(resolve('test-output/lizenz/bad', process.argv[2]));
await page.waitForFunction(() => [...document.querySelectorAll('header button')].some((b) => b.textContent.includes('Exportieren') && !b.disabled) || document.querySelector('[role=alert]'), { timeout: 200000, polling: 500 });
console.log(await page.evaluate(() => ({ gl: (() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); return g && g.getParameter(g.MAX_TEXTURE_SIZE); })(), text: document.body.innerText.replace(/\n+/g, ' | ').slice(0, 400), alert: document.querySelector('[role=alert]')?.textContent })));
await page.screenshot({ path: 'test-output/lizenz/' + process.argv[2] + '.png' });
if (process.argv[3] === 'export') {
  await page.click('header [aria-label="Exportieren"]'); await page.waitForSelector('[role=dialog]');
  await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Exportieren')?.click());
  const t0 = Date.now();
  while (Date.now() - t0 < 300000) { await new Promise((r) => setTimeout(r, 1000)); const t = await page.evaluate(() => document.querySelector('[role=dialog]')?.innerText ?? '').catch(() => 'tot'); if (!t || /Fehler|fehl/i.test(t)) { console.log('Export-Dialog:', t.slice(0, 300)); break; } }
  await page.screenshot({ path: 'test-output/lizenz/' + process.argv[2] + '-export.png' });
}
await browser.close(); await new Promise((r) => server.httpServer.close(r));
