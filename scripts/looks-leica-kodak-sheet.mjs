// Kontaktbögen aller Leica-Looks und Kodak-Rezepte über die echte Engine (Voreinstellungen inkl. Korn, Halation …):
//   TEST_PORT=5185 node scripts/looks-leica-kodak-sheet.mjs [leica|kodak|korn|halation …]
// Schreibt nach test-output/leica-kodak/: <gruppe>-<bild>.png je Nutzer-Testbild; korn-<bild>.png = 1:1-Ausschnitte
// eines 3000-px-Exports für die Rezepte mit Korn; halation-<bild>.png = Ausschnitt einer Nachtszene (Vision3 500T, CineStill).
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const OUT = 'test-output/leica-kodak';
mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const on = (s) => want.length === 0 || want.includes(s);
const images = readdirSync('testbilder').filter((f) => /\.jpe?g$/i.test(f));

const server = await startDevServer();
const { browser, page } = await launch();
try {
  await page.goto(`${server.url}/scripts/looks-leica-kodak.html`);
  await page.waitForFunction('window.ready === true', { timeout: 120_000 });
  const save = (file, url) => writeFileSync(`${OUT}/${file}`, Buffer.from(url.split(',')[1], 'base64'));
  for (const group of ['leica', 'kodak'].filter(on)) {
    const ids = await page.evaluate((g) => window.ids(g), group);
    for (const img of images) {
      const t0 = Date.now();
      save(`${group}-${img.replace(/\.\w+$/, '')}.png`, await page.evaluate((n, i) => window.sheet(n, i, 480, 6), img, ids));
      console.log(`${group} ${img}: ${ids.length} Looks, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }
  if (on('korn')) {
    const ids = ['kodak-portra-400', 'kodak-ultramax-400', 'kodak-tri-x-400', 'kodak-t-max-400', 'kodak-cinestill-800t'];
    const img = 'DSC03982.JPEG';
    save(`korn-${img.replace(/\.\w+$/, '')}.png`, await page.evaluate((n, i) => window.sheet(n, i, 3000, 3, [1300, 900, 400, 300]), img, ids));
    console.log('korn fertig');
  }
  if (on('halation')) {
    const img = 'DSC03427.JPEG';
    save(`halation-${img.replace(/\.\w+$/, '')}.png`, await page.evaluate((n, i) => window.sheet(n, i, 2000, 3, [150, 450, 640, 480]), img, ['kodak-vision3-500t', 'kodak-cinestill-800t']));
    console.log('halation fertig');
  }
} finally {
  await browser.close();
  await server.close();
}
