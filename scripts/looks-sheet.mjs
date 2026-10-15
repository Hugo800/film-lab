// Kontaktbögen aller Looks ohne Engine: node scripts/looks-sheet.mjs [Kantenlänge]
// Startet Vite auf Port 5185, schreibt PNGs nach test-output/looks/.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { launch } from './lib/browser.mjs';

const PORT = 5185;
const EDGE = Number(process.argv[2] ?? 480);
const OUT = 'test-output/looks';
mkdirSync(OUT, { recursive: true });

const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'warn' });
await server.listen();
const { browser, page } = await launch();
try {
  await page.goto(`http://localhost:${PORT}/scripts/harness/looks-sheet.html`);
  await page.waitForFunction('window.ready === true', { timeout: 60_000 });
  console.table(await page.evaluate(() => window.lutStats()));
  const images = readdirSync('testbilder').filter((f) => /\.jpe?g$/i.test(f));
  for (const name of ['chart', ...images]) {
    const url = name === 'chart' ? 'chart' : `/testbilder/${name}`;
    const t0 = Date.now();
    const { png, times } = await page.evaluate((u, e) => window.makeSheet(u, e, 5), url, name === 'chart' ? 600 : EDGE);
    const file = `${OUT}/sheet-${name.replace(/\.\w+$/, '')}.png`;
    writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
    console.log(`${file} (${Date.now() - t0} ms), LUT-Bauzeiten ms:`, times.map((t) => t[1]).join(' '));
  }
} finally {
  await browser.close();
  await server.close();
}
