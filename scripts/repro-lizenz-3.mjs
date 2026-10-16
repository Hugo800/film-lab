import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { CHROME, PORT } from './lib/browser.mjs';
const BUILD = resolve('test-output/lizenz/build');
const { preview } = await import('vite');
const server = await preview({ configFile: false, root: process.cwd(), build: { outDir: BUILD }, preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
for (const f of process.argv.slice(2)) {
  const b64 = readFileSync(resolve('test-output/lizenz/bad', f)).toString('base64');
  const r = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes]);
    const out = {};
    for (const [n, fn] of [['bitmap+opts', () => createImageBitmap(blob, { imageOrientation: 'from-image', colorSpaceConversion: 'none', premultiplyAlpha: 'none' })], ['bitmap', () => createImageBitmap(blob)], ['img', async () => { const u = URL.createObjectURL(blob); const i = new Image(); i.src = u; await i.decode(); return createImageBitmap(i); }]]) {
      try { const b = await fn(); out[n] = `ok ${b.width}x${b.height}`; b.close(); } catch (e) { out[n] = `${e.name}: ${e.message}`; }
    }
    return out;
  }, b64);
  console.log(f, JSON.stringify(r));
}
await browser.close(); await new Promise((r) => server.httpServer.close(r));
