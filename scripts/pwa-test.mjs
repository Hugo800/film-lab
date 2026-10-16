// PWA-Test: npm run test:pwa  (Port per TEST_PORT, Vorgabe 5190)
// Baut nach test-output/pwa-build (nicht dist), serviert per vite preview mit der CSP aus deploy/security-headers.conf
// und prüft: Precache, Offline-Start, JPEG und ARW offline bis „bereit“, Export, Installierbarkeit,
// Update ohne Neuladen des offenen Tabs.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, PORT } from './lib/browser.mjs';

const OUT = resolve('test-output/pwa-build');
const DL = resolve('test-output/pwa-downloads');
const JPEG = resolve('testbilder/DSC03982.JPEG');
const ARW = resolve('testbilder/raw/DSC01542.ARW');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}${extra ? ` (${extra})` : ''}`);
};

if (!process.env.SKIP_BUILD) execFileSync('npx', ['vite', 'build', '--outDir', OUT, '--emptyOutDir', '--logLevel', 'warn'], { stdio: 'inherit' });
mkdirSync(DL, { recursive: true });
const csp = readFileSync('deploy/security-headers.conf', 'utf8').match(/Content-Security-Policy "([^"]*)"/)?.[1];
ok(!!csp, 'CSP aus deploy/security-headers.conf gelesen');

const { preview } = await import('vite');
const server = await preview({
  configFile: false,
  root: process.cwd(),
  build: { outDir: OUT },
  preview: { port: PORT, strictPort: true, headers: { 'Content-Security-Policy': csp } },
  logLevel: 'warn',
});
const URL = `http://localhost:${PORT}/`;
const { browser, page } = await launch({ viewport: { width: 1280, height: 800 } });
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
const exportReady = (p) => p.waitForFunction(() => [...document.querySelectorAll('header button')].some((b) => b.textContent.includes('Exportieren') && !b.disabled), { timeout: 120000 });
const load = async (p, file) => {
  await (await p.$('#datei-eingabe')).uploadFile(file);
  await exportReady(p);
};

try {
  // 1 Registrieren, Precache
  await page.goto(URL, { waitUntil: 'networkidle0' });
  const precache = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const keys = await (await caches.open((await caches.keys()).find((k) => k.includes('precache')))).keys();
    return keys.map((r) => new globalThis.URL(r.url).pathname);
  });
  ok(precache.some((u) => /libraw-.*\.wasm$/.test(u)) && precache.some((u) => /mozjpeg_enc-.*\.wasm$/.test(u)), 'Precache enthält libraw- und mozjpeg-WASM', `${precache.length} Einträge`);
  for (const f of ['sw.js', 'manifest.webmanifest']) ok(existsSync(resolve(OUT, f)), `${f} im Build`);
  await page.reload({ waitUntil: 'networkidle0' });
  ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'Seite steht nach dem Neuladen unter dem Service Worker');

  // 2 Installierbarkeit
  const inst = await cdp.send('Page.getInstallabilityErrors');
  ok(inst.installabilityErrors.length === 0, 'Page.getInstallabilityErrors leer', JSON.stringify(inst.installabilityErrors));
  const manifest = await page.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
  ok(manifest.icons.some((i) => i.purpose === 'maskable') && manifest.display === 'standalone', 'Manifest: maskable-Symbol, standalone');

  // 3 Offline
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'networkidle0' });
  ok(await page.evaluate(() => !!document.querySelector('#datei-eingabe') && document.body.innerText.includes('Film Lab')), 'Offline: Startseite erscheint');
  await load(page, JPEG);
  ok(true, 'Offline: JPEG bis „bereit“');
  await page.click('header button:last-of-type');
  await page.waitForSelector('[role=dialog]');
  await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Exportieren')?.click());
  const t0 = Date.now();
  let file = null;
  while (Date.now() - t0 < 180000 && !file) {
    await sleep(500);
    file = readdirSync(DL).find((f) => f.endsWith('.jpg') || f.endsWith('.jpeg'));
  }
  ok(!!file, 'Offline: Export erzeugt eine Datei', file ?? '');
  await page.reload({ waitUntil: 'networkidle0' });
  await load(page, ARW);
  ok(true, 'Offline: ARW bis „bereit“');
  await page.screenshot({ path: 'test-output/pwa-offline-arw.png' });
  await page.setOfflineMode(false);

  // 4 Update ohne Neuladen: sw.js und index.html im Build ändern, Update anstoßen
  await page.evaluate(() => (window.__tab = 'alt'));
  const sw = readFileSync(resolve(OUT, 'sw.js'), 'utf8');
  const html = readFileSync(resolve(OUT, 'index.html'), 'utf8');
  writeFileSync(resolve(OUT, 'index.html'), html.replace('<title>Film Lab</title>', '<title>Film Lab NEU</title>'));
  writeFileSync(resolve(OUT, 'sw.js'), sw.replace(/(\{url:"index\.html",revision:")[^"]*/, '$1neu'));
  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update();
    for (let i = 0; i < 100 && !reg.waiting; i++) await new Promise((r) => setTimeout(r, 100));
    return { waiting: !!reg.waiting, installing: !!reg.installing };
  });
  ok(state.waiting, 'Neue Version wartet (installiert, nicht aktiv)');
  await sleep(1500);
  const after = await page.evaluate(() => ({ tab: window.__tab, title: document.title, ready: [...document.querySelectorAll('header button')].some((b) => b.textContent.includes('Exportieren') && !b.disabled) }));
  ok(after.tab === 'alt' && after.ready, 'Offener Tab lädt nicht neu, Foto bleibt', JSON.stringify(after));
  const page2 = await browser.newPage();
  await page.close();
  await sleep(2500);
  await page2.goto(URL, { waitUntil: 'networkidle0' });
  ok((await page2.title()) === 'Film Lab NEU', 'Nach Schließen und Neuöffnen: neue Version', await page2.title());
} catch (err) {
  fails++;
  console.log('FAIL Ausnahme:', err);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
  rmSync(DL, { recursive: true, force: true });
}
console.log(fails ? `\n${fails} Fehler` : '\nalles grün');
process.exit(fails ? 1 : 0);
