// Robustheit: kaputte/riesige Fotos in den Produktions-Build laden. Voraussetzung: node scripts/repro-lizenz-gen.mjs, Build in test-output/lizenz/build.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { CHROME, PORT } from './lib/browser.mjs';
const BUILD = resolve('test-output/lizenz/build');
const csp = readFileSync('deploy/security-headers.conf', 'utf8').match(/Content-Security-Policy "([^"]*)"/)?.[1];
const { preview } = await import('vite');
const server = await preview({ configFile: false, root: process.cwd(), build: { outDir: BUILD }, preview: { port: PORT, strictPort: true, headers: { 'Content-Security-Policy': csp } }, logLevel: 'warn' });
const URL_ = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage'], defaultViewport: { width: 393, height: 852, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
const only = process.argv.slice(2);
const files = readdirSync('test-output/lizenz/bad').filter((f) => /\.(jpg|arw|png|heic)$/.test(f) && (only.length === 0 || only.some((o) => f.includes(o))));
for (const f of files) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
  page.on('error', (e) => errs.push('CRASH ' + e.message));
  const t0 = Date.now();
  let res = '';
  try {
    await page.goto(URL_, { waitUntil: 'networkidle0' });
    await (await page.$('#datei-eingabe')).uploadFile(resolve('test-output/lizenz/bad', f));
    const r = await page.waitForFunction(() => {
      const ready = [...document.querySelectorAll('header button')].some((b) => b.textContent.includes('Exportieren') && !b.disabled);
      const alert = document.querySelector('[role=alert]')?.textContent;
      return ready ? 'bereit' : alert ? 'FEHLER: ' + alert : false;
    }, { timeout: 120000, polling: 500 });
    res = await r.jsonValue();
    await sleep(500);
    const alive = await Promise.race([page.evaluate(() => 1 + 1), sleep(5000).then(() => 'hängt')]);
    res += ` | lebt=${alive}`;
    if (res.includes('FEHLER') ) await page.screenshot({ path: `test-output/lizenz/fehler-${f}.png` });
  } catch (e) {
    res = 'AUSNAHME ' + e.message.slice(0, 100);
  }
  console.log(`${f.padEnd(28)} ${((Date.now() - t0) / 1000).toFixed(1)}s ${res} ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
  await page.close().catch(() => {});
}
await browser.close();
await new Promise((r) => server.httpServer.close(r));
