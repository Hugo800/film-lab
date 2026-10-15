// Browser-Test für src/io: npm run test:io
// Startet den Test-Dev-Server selbst (Port TEST_PORT, Vorgabe 5190). Den Produktionsbuild prüft npm run test:browser.
import { spawnSync } from 'node:child_process';
import { launch, startDevServer } from './lib/browser.mjs';

const images = ['DSC04866', 'DSC01603', 'DSC03427', 'DSC03982'].map((n) => `/testbilder/${n}.JPEG`);

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

const server = await startDevServer();
const page_url = `${server.url}/scripts/harness/io-test.html`;
let browser;
let failed = false;
try {
  const launched = await launch();
  browser = launched.browser;
  const page = launched.page;
  await page.goto(page_url);
  await page.waitForFunction(() => window.io !== undefined, { timeout: 120_000 });
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
  await server.close();
}
process.exit(failed ? 1 : 0);
