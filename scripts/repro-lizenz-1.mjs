// Lizenz/Datenschutz-Prüfung: Produktions-Build mit CSP, alle Netzwerkanfragen (Seite, Worker, Service Worker)
// per Chrome-Netlog mitschneiden. Port per TEST_PORT.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { CHROME, PORT } from './lib/browser.mjs';

const OUT = resolve('test-output/lizenz');
const BUILD = resolve(OUT, 'build');
const NETLOG = resolve(OUT, 'netlog.json');
const DL = resolve(OUT, 'dl');
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });
if (!process.env.SKIP_BUILD) execFileSync('npx', ['vite', 'build', '--outDir', BUILD, '--emptyOutDir', '--logLevel', 'warn'], { stdio: 'inherit' });
const csp = readFileSync('deploy/security-headers.conf', 'utf8').match(/Content-Security-Policy "([^"]*)"/)?.[1];
const { preview } = await import('vite');
const server = await preview({ configFile: false, root: process.cwd(), build: { outDir: BUILD }, preview: { port: PORT, strictPort: true, headers: { 'Content-Security-Policy': csp, 'Referrer-Policy': 'no-referrer' } }, logLevel: 'warn' });
const URL_ = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 600000,
  args: ['--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage', `--log-net-log=${NETLOG}`, '--net-log-capture-mode=Everything'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const seen = [];
page.on('request', (r) => seen.push(r.url().slice(0, 120)));
page.on('console', (m) => { const t = m.text(); if (/Content Security|violates|Refused/i.test(t) || m.type() === 'error') console.log(`[console:${m.type()}]`, t.slice(0, 200)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
const ready = () => page.waitForFunction(() => [...document.querySelectorAll('header button')].some((b) => b.textContent.includes('Exportieren') && !b.disabled), { timeout: 180000 });
await page.goto(URL_, { waitUntil: 'networkidle0' });
console.log('Start-Text:', (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | '));
await (await page.$('#datei-eingabe')).uploadFile(resolve('testbilder/DSC03982.JPEG'));
await ready();
console.log('JPEG bereit');
// Look wechseln, Dialoge öffnen
await page.evaluate(() => { for (const l of ['Rezept einfügen']) [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === l || b.textContent.trim() === l)?.click(); });
await sleep(800);
await page.evaluate(() => { const t = document.querySelector('#rezept-text'); if (t) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'Film Simulation: Classic Chrome\nWhite Balance: 5500K, +2 Red & -4 Blue'); t.dispatchEvent(new Event('input', { bubbles: true })); } });
await sleep(500);
await page.keyboard.press('Escape'); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Fuji-LUTs|Fujifilm-LUTs/.test(b.textContent + b.getAttribute('aria-label')))?.click());
await sleep(800);
const link = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => ({ href: a.href, rel: a.rel, target: a.target })));
console.log('Links:', JSON.stringify(link));
await page.keyboard.press('Escape'); await sleep(500);
// Export
await page.click('header [aria-label="Exportieren"]');
await page.waitForSelector('[role=dialog]');
await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Exportieren')?.click());
const t0 = Date.now(); let f = null;
while (Date.now() - t0 < 240000 && !f) { await sleep(500); f = readdirSync(DL).find((x) => /\.jpe?g$/.test(x)); }
console.log('Export:', f);
// ARW
await page.reload({ waitUntil: 'networkidle0' });
await (await page.$('#datei-eingabe')).uploadFile(resolve('testbilder/raw/DSC01542.ARW'));
await ready();
console.log('ARW bereit');
// Dokument-Referrer / Speicher
const storage = await page.evaluate(async () => ({ ls: Object.keys(localStorage), cookies: document.cookie, dbs: (await indexedDB.databases?.())?.map((d) => d.name) }));
console.log('Speicher:', JSON.stringify(storage));
await sleep(1500);
await browser.close();
await new Promise((r) => server.httpServer.close(r));
const log = JSON.parse(readFileSync(NETLOG, 'utf8'));
const urls = new Set();
for (const e of log.events) { const u = e.params?.url; if (typeof u === 'string' && /^(https?|wss?|ftp):/.test(u)) urls.add(u.replace(/\?.*/, '')); const h = e.params?.host; if (typeof h === 'string') urls.add('HOST ' + h); }
const hosts = new Set([...urls].map((u) => (u.startsWith('HOST ') ? u : u.replace(/^(\w+:\/\/[^/]+).*/, '$1'))));
console.log('Hosts im Netlog:', [...hosts].sort().join('\n  '));
console.log('Anfragen der Seite (page.on request) außerhalb localhost:', seen.filter((u) => !u.startsWith(`http://localhost:${PORT}`) && !u.startsWith('blob:') && !u.startsWith('data:')));
