// Browser-Test der RAW-Dekodierung: node scripts/raw-test.mjs [basisUrl] [raw-pfad unter basisUrl]
// Vorher läuft ein Server auf Port 5182 (Dev: `npx vite --port 5182 --strictPort`, Build: siehe scripts/raw-build-test.mjs).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { launch } from './lib/browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5182';
const rawPath = process.argv[3] ?? '/testbilder/raw/DSC01542.ARW';
const outDir = new URL('../test-output/raw/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

let failures = 0;
const check = (ok, what, detail = '') => {
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${what}${detail ? ` – ${detail}` : ''}`);
  if (!ok) failures++;
};
const savePng = (name, dataUrl) => writeFileSync(outDir + name, Buffer.from(dataUrl.split(',')[1], 'base64'));

// Unabhängiger EXIF-Leser (Little-Endian, wie geschrieben).
function parseExif(bytes) {
  const b = Uint8Array.from(bytes);
  if (String.fromCharCode(...b.subarray(0, 4)) !== 'Exif' || b[4] || b[5]) throw new Error('Kennung "Exif\\0\\0" fehlt');
  const t = b.subarray(6);
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength);
  if (t[0] !== 0x49 || t[1] !== 0x49 || v.getUint16(2, true) !== 42) throw new Error('kein Little-Endian-TIFF');
  const size = { 2: 1, 3: 2, 4: 4, 5: 8 };
  const readIfd = (at) => {
    const out = {};
    const n = v.getUint16(at, true);
    for (let i = 0; i < n; i++) {
      const p = at + 2 + i * 12;
      const tag = v.getUint16(p, true), type = v.getUint16(p + 2, true), count = v.getUint32(p + 4, true);
      const len = size[type] * count;
      const s = len <= 4 ? p + 8 : v.getUint32(p + 8, true);
      if (s + len > t.length) throw new Error(`Tag ${tag.toString(16)} liegt außerhalb`);
      out[tag] = type === 2 ? String.fromCharCode(...t.subarray(s, s + count - 1))
        : type === 3 ? v.getUint16(s, true) : type === 4 ? v.getUint32(s, true)
        : [v.getUint32(s, true), v.getUint32(s + 4, true)];
    }
    return out;
  };
  const ifd0 = readIfd(v.getUint32(4, true));
  return { ifd0, exif: readIfd(ifd0[0x8769]), length: b.length };
}

// Summe des Speichers (RSS, MB) aller Prozesse unter dem Browser, per ps.
function chromeRssMB(rootPid) {
  const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,rss='], { encoding: 'utf8' })
    .trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
  const kids = new Set([rootPid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const [pid, ppid] of rows) if (kids.has(ppid) && !kids.has(pid)) { kids.add(pid); changed = true; }
  }
  return rows.filter(([pid]) => kids.has(pid)).reduce((s, r) => s + r[2], 0) / 1024;
}

const { browser, page } = await launch();
const rootPid = browser.process().pid;
await page.goto(`${base}/scripts/harness/raw-decode.html`);
await page.waitForFunction('window.harnessReady', { timeout: 120_000 });
const workers = () => browser.targets().filter((t) => t.type() === 'worker' || t.type() === 'service_worker').length;

// 1. Dekodieren inkl. Speicherspitze (Zeiten schwanken stark, wenn der Rechner anderweitig ausgelastet ist)
console.log(`Last vor dem Test: ${loadavg()[0].toFixed(1)} bei ${cpus().length} Kernen`);
const idleMB = chromeRssMB(rootPid);
let peakMB = idleMB;
const sampler = setInterval(() => { peakMB = Math.max(peakMB, chromeRssMB(rootPid)); }, 100);
const r = await page.evaluate((u) => window.runDecode(u, 'DSC01542.ARW'), rawPath);
clearInterval(sampler);
await new Promise((res) => setTimeout(res, 500));
const afterMB = chromeRssMB(rootPid);

console.log(`Dekodierzeit ${r.ms} ms (Datei → RGBA, Worker + Umwandlung)`);
console.log(`Speicher Chrome gesamt (RSS): vorher ${idleMB.toFixed(0)} MB, Spitze ${peakMB.toFixed(0)} MB, danach ${afterMB.toFixed(0)} MB; JS-Heap ${r.heapMB} MB`);
console.log('Helligkeit: Mittel', r.stats.mean.toFixed(1), 'RGB', r.stats.rgbMean.map((x) => x.toFixed(1)).join('/'), 'geklemmt', r.stats.clippedPct, '%');
console.log('Histogramm (16 Klassen, %):', r.stats.hist.join(' '));
check(r.width === 6000 && r.height === 4000, 'Maße 6000×4000', `${r.width}×${r.height}`);
check(r.pxW === r.width && r.pxH === r.height && r.byteLength === r.width * r.height * 4, 'pixels passt zu width/height (RGBA8)');
check(r.colorSpace === 'srgb' && r.isRaw === true, "colorSpace 'srgb', isRaw true");
check(r.stats.mean > 60 && r.stats.mean < 130, 'plausible Helligkeit (60..130)', r.stats.mean.toFixed(1));
check(r.stats.clippedPct < 0.5, 'Lichter nicht abgeschnitten (<0.5 % geklemmt)', `${r.stats.clippedPct} %`);
const [mr, mg, mb] = r.stats.rgbMean;
check(mg > mr * 0.8 && mg < mr * 1.25 && mb < mg && mb > mg * 0.5, 'kein Magenta-/Grün-/Blaustich (Herbstszene: R≈G>B)', `${mr.toFixed(0)}/${mg.toFixed(0)}/${mb.toFixed(0)}`);
savePng('decode-preview.png', r.preview);

// 2. EXIF
try {
  const e = parseExif(r.exif);
  console.log('EXIF', e.length, 'Byte', JSON.stringify(e.ifd0), JSON.stringify(e.exif));
  check(e.length < 400, 'EXIF-Segment klein', `${e.length} Byte`);
  check(e.ifd0[0x010f] === 'Sony' && e.ifd0[0x0110] === 'ILCE-6000', 'Make/Model', `${e.ifd0[0x010f]} ${e.ifd0[0x0110]}`);
  check(e.ifd0[0x0112] === 1 && e.exif[0xa001] === 1, 'Orientation=1, ColorSpace=1');
  check(e.ifd0[0x0132] === '2017:10:14 12:47:29' && e.exif[0x9003] === '2017:10:14 12:47:29', 'Aufnahmezeit wie in der Datei', e.exif[0x9003]);
  check(e.exif[0x829a]?.[0] === 1 && e.exif[0x829a]?.[1] === 160, 'Belichtungszeit 1/160', JSON.stringify(e.exif[0x829a]));
  check(e.exif[0x829d]?.[0] / e.exif[0x829d]?.[1] === 5, 'Blende f/5', JSON.stringify(e.exif[0x829d]));
  check(e.exif[0x8827] === 100, 'ISO 100', String(e.exif[0x8827]));
  check(e.exif[0x920a]?.[0] / e.exif[0x920a]?.[1] === 39, 'Brennweite 39 mm', JSON.stringify(e.exif[0x920a]));
  check(e.exif[0xa434] === 'E 18-55mm F3.5-5.6 OSS', 'Objektiv', e.exif[0xa434]);
} catch (err) {
  check(false, 'EXIF parsebar', err.message);
}

// 3. Aufräumen und zweiter Lauf (Worker weg, kein Zustand übrig)
check(workers() === 0, 'nach dem Dekodieren läuft kein Worker mehr', `${workers()} Worker`);
const r2 = await page.evaluate((u) => window.runDecode(u, 'zweit.ARW', 400), rawPath);
console.log(`zweiter Lauf ${r2.ms} ms`);
check(r2.width === 6000 && r2.stats.mean === r.stats.mean, 'zweiter Lauf liefert dasselbe Bild', `Mittel ${r2.stats.mean.toFixed(2)}`);
check(workers() === 0, 'auch nach dem zweiten Lauf kein Worker', `${workers()} Worker`);

// 4. Ausrichtung: Orientation 6 (90° im Uhrzeigersinn) → Hochformat, Inhalt gedreht
const rot = await page.evaluate((u) => window.runDecode(u, 'rot.ARW', 1200, 6), rawPath);
check(rot.width === 4000 && rot.height === 6000, 'Orientation 6 → 4000×6000 aufrecht', `${rot.width}×${rot.height}`);
savePng('decode-orientation6.png', rot.preview);

// 5. Kaputte Datei
const bad = await page.evaluate(() => window.runBad());
check(bad.rejected && /RAW-Datei/.test(bad.message), 'kaputte Datei → verständlicher Fehler', bad.message);
check(workers() === 0, 'nach dem Fehler kein Worker', `${workers()} Worker`);

await browser.close();
console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen` : '\nalle Prüfungen bestanden');
process.exit(failures ? 1 : 0);
