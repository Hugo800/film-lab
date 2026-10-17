// PWA-Test: npm run test:pwa  (Port per TEST_PORT, Vorgabe 5190)
// Baut nach test-output/pwa-build (nicht dist), serviert per vite preview mit der CSP aus deploy/security-headers.conf
// und prüft: Precache (ohne die großen Beispielfotos), Offline-Start, JPEG und ARW offline bis „bereit“, Export,
// Beispielfoto im Editor (große Fassung, Laufzeit-Cache, offline Rückfall), Installierbarkeit, Update ohne Neuladen
// des offenen Tabs.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, PORT } from './lib/browser.mjs';

const OUT = resolve('test-output/pwa-build');
const DL = resolve('test-output/pwa-downloads');
const JPEG = resolve('testbilder/DSC03982.JPEG');
const ARW = resolve('testbilder/raw/DSC01542.ARW');
// Privates Testbild mit Objektivkorrektur (E PZ 16-50 bei 16 mm); fehlt es, entfällt die Prüfung.
const ARW_KORREKTUR = resolve('testbilder/DSC04866.ARW');
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
  ok(precache.some((u) => /objektivWorker-.*\.js$/.test(u)), 'Precache enthält den Worker der Objektivkorrektur');
  ok(['klippen-quer', 'klippen-hoch'].every((n) => precache.some((u) => u.endsWith(`/beispiele/${n}.jpg`))), 'Precache enthält die Beispielfotos (quer und hoch)');
  const grossImBuild = readdirSync(resolve(OUT, 'beispiele/gross'));
  ok(grossImBuild.length > 0 && !precache.some((u) => u.includes('/beispiele/gross/')), 'Editor-Fassungen (beispiele/gross) im Build, aber nicht im Precache', `${grossImBuild.length} Dateien`);
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
  // Nach dem Rechnen lädt der Export nicht selbst herunter: „Herunterladen“ in der Fertig-Ansicht antippen.
  let clicked = false;
  while (Date.now() - t0 < 180000 && !file) {
    await sleep(500);
    if (!clicked) clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Herunterladen');
      b?.click();
      return !!b;
    });
    file = readdirSync(DL).find((f) => f.endsWith('.jpg') || f.endsWith('.jpeg'));
  }
  ok(!!file, 'Offline: Export erzeugt eine Datei', file ?? '');
  await page.reload({ waitUntil: 'networkidle0' });
  await load(page, ARW);
  ok(true, 'Offline: ARW bis „bereit“');
  await page.screenshot({ path: 'test-output/pwa-offline-arw.png' });
  if (existsSync(ARW_KORREKTUR)) {
    const worker = [];
    const merken = (w) => worker.push(w.url());
    page.on('workercreated', merken);
    await page.reload({ waitUntil: 'networkidle0' });
    await load(page, ARW_KORREKTUR);
    page.off('workercreated', merken);
    const n = worker.filter((u) => u.includes('objektivWorker')).length;
    ok(n > 0, 'Offline: ARW mit Objektivkorrektur bis „bereit“', `${n} Worker der Objektivkorrektur`);
  } else console.log(`übersprungen: ARW mit Objektivkorrektur offline (${ARW_KORREKTUR} fehlt)`);

  // Beispielfoto im Editor: die große Fassung (beispiele/gross) kommt erst beim Öffnen, danach aus dem Laufzeit-Cache.
  // Offline und noch nicht im Cache: ohne Meldung die Seitenfassung aus dem Precache. setOfflineMode gilt nur für die
  // Seite; der Service Worker holt sonst weiter aus dem Netz – er bekommt eigene Netzbedingungen.
  const swCdp = await (await browser.waitForTarget((t) => t.type() === 'service_worker')).createCDPSession();
  await swCdp.send('Network.enable');
  const swOffline = (offline) => swCdp.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const beispiel = async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    const antworten = [];
    const fehl = [];
    const onRes = (r) => r.url().includes('/beispiele/') && antworten.push({ url: r.url(), status: r.status(), sw: r.fromServiceWorker() });
    const onFail = (r) => r.url().includes('/beispiele/') && fehl.push(r.url());
    page.on('response', onRes);
    page.on('requestfailed', onFail);
    await page.evaluate(() => [...document.querySelectorAll('main button')].find((b) => b.textContent.includes('Mit Beispielfoto ausprobieren'))?.click());
    await exportReady(page);
    await sleep(1000);
    page.off('response', onRes);
    page.off('requestfailed', onFail);
    const meldung = await page.evaluate(() => document.body.innerText.includes('ließ sich nicht laden'));
    const gross = antworten.find((a) => a.url.endsWith('/beispiele/gross/klippen-quer.jpg'));
    const seite = antworten.find((a) => a.url.endsWith('/beispiele/klippen-quer.jpg'));
    return { meldung, gross, seite, fehl: fehl.map((u) => u.replace(/^.*\/beispiele\//, '')) };
  };
  await swOffline(true);
  const b1 = await beispiel();
  ok(!b1.meldung && !b1.gross?.status && b1.seite?.status === 200, 'Offline, große Fassung nicht im Cache: Beispielfoto aus der Seitenfassung, ohne Meldung', JSON.stringify(b1));
  await page.setOfflineMode(false);
  await swOffline(false);
  const b2 = await beispiel();
  ok(b2.gross?.status === 200 && !b2.seite, 'Online: Editor lädt die große Fassung', JSON.stringify(b2));
  const imCache = await page.evaluate(async () => (await (await caches.open('beispiele-gross')).keys()).map((r) => new globalThis.URL(r.url).pathname));
  ok(imCache.some((u) => u.endsWith('/beispiele/gross/klippen-quer.jpg')), 'Große Fassung danach im Laufzeit-Cache', imCache.join(', '));
  await page.setOfflineMode(true);
  await swOffline(true);
  const b3 = await beispiel();
  ok(!b3.meldung && b3.gross?.status === 200 && b3.gross.sw && !b3.seite, 'Offline nach dem ersten Öffnen: große Fassung aus dem Cache', JSON.stringify(b3));
  await page.setOfflineMode(false);
  await swOffline(false);

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
