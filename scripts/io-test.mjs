// Browser-Test für src/io: node scripts/io-test.mjs [--build]
// Startet Vite selbst (Port 5184); mit --build wird nach test-output/io-build gebaut und statisch ausgeliefert.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 5184;
const build = process.argv.includes('--build');
const images = ['DSC04866', 'DSC01603', 'DSC03427', 'DSC03982'].map((n) => `/testbilder/${n}.JPEG`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.JPEG': 'image/jpeg' };
/** RSS (MB) des Chrome-Prozessbaums unter `pid`; andere Chrome-Instanzen (parallele Agents) zählen nicht. */
function treeRssMB(pid) {
  const rows = spawnSync('ps', ['-eo', 'pid=,ppid=,rss='], { encoding: 'utf8' }).stdout
    .trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
  const kids = new Set([pid]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [p, pp] of rows) if (kids.has(pp) && !kids.has(p)) kids.add(p), (grew = true);
  }
  return rows.filter(([p]) => kids.has(p)).reduce((n, r) => n + r[2], 0) / 1024;
}

/** Spitzenverbrauch über dem Ausgangswert, solange `work` läuft. */
async function withRssPeak(pid, work) {
  const before = treeRssMB(pid);
  let peak = before;
  const timer = setInterval(() => (peak = Math.max(peak, treeRssMB(pid))), 100);
  try {
    const result = await work();
    return { result, rssBeforeMB: Math.round(before), rssPeakMB: Math.round(peak), rssAddedMB: Math.round(peak - before) };
  } finally {
    clearInterval(timer);
  }
}

let server;
let vite;

async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url} nicht erreichbar`);
}

if (build) {
  const r = spawnSync('npx', ['vite', 'build', '--config', 'scripts/io-build.config.mjs'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('vite build fehlgeschlagen');
  const out = join(root, 'test-output/io-build');
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = path.startsWith('/testbilder/') ? join(root, path) : join(out, path);
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  }).listen(PORT);
} else {
  vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', detached: true });
}

const page_url = `http://localhost:${PORT}/scripts/harness/io-test.html`;
let browser;
let failed = false;
try {
  await waitFor(page_url);
  const launched = await launch();
  browser = launched.browser;
  const page = launched.page;
  // Der Dev-Server bündelt beim ersten Aufruf neu entdeckte Pakete vor und lädt die Seite dabei neu.
  for (let i = 0; i < 2; i++) {
    await page.goto(page_url);
    await page.waitForFunction(() => window.io !== undefined, { timeout: 120_000 });
    await new Promise((r) => setTimeout(r, 1500));
  }
  const show = (title, v) => console.log(`\n== ${title}\n${JSON.stringify(v, null, 1)}`);

  show('isRawFile', await page.evaluate(() => ['a.ARW', 'b.jpg', 'c.dng', 'd.JPEG', 'e.arw.jpg'].map((n) => [n, window.io.isRawFile(n)])));
  show('Orientierung (Weg + CPU-Notweg gegen Browser)', await page.evaluate(() => window.io.orientationCheck()));
  show('loadFile mit erzeugten Dateien', await page.evaluate(() => window.io.loadSynthetic()));
  for (const url of images) {
    const info = await page.evaluate((u) => window.io.load(u), url);
    show(`loadFile ${url}`, info);
    if (url.includes('04866')) show('Pixel gegen mozjpeg-Dekodierung', await page.evaluate((u) => window.io.compareDecode(u), url));
  }
  // 24 MP: kleines Bild und das große Querformat
  for (const [url, q] of [[images[0], 92], [images[3], 92], [images[3], 75]]) {
    const t0 = Date.now();
    show(`encodeJpeg ${url} q${q}`, await page.evaluate((u, qq) => window.io.encodeRoundtrip(u, qq), url, q));
    console.log(`(gesamt ${Date.now() - t0} ms)`);
  }
  // Speicher: frische Seite, nur kodieren (die Roundtrip-Tests oben halten mehrere 96-MB-Puffer).
  const fresh = await browser.newPage();
  await fresh.goto(page_url);
  await fresh.waitForFunction(() => window.io !== undefined);
  const pid = browser.process().pid;
  show('Speicher 24 MP (nur encodeJpeg, Prozessbaum des Test-Chrome)', await withRssPeak(pid, () => fresh.evaluate((u) => window.io.encodeOnly(u, 92), images[3])));
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await browser?.close();
  server?.close();
  if (vite?.pid) process.kill(-vite.pid);
}
process.exit(failed ? 1 : 0);
