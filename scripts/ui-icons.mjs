// Erzeugt die PNG-Symbole aus public/favicon.svg: node scripts/ui-icons.mjs
// maskable-512.png: Vollfläche, Symbol höchstens 50 % (sichere Zone der maskierbaren Symbole).
import { readFileSync } from 'node:fs';
import { launch } from './lib/browser.mjs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const symbol = svg.match(/<g [\s\S]*<\/g>/)[0];
// Symbol (Lucide-Aperture, 24er-Raster, Durchmesser samt Strich ~21,8) auf 48 % der Fläche.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0b0b0c"/>${symbol.replace(/transform="[^"]*"/, 'transform="translate(256 256) scale(11.3) translate(-12 -12)"')}</svg>`;
const { browser, page } = await launch({ viewport: { width: 512, height: 512 } });
const render = async (markup, name, size) => {
  await page.setViewport({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:#0b0b0c"><img src="data:image/svg+xml;utf8,${encodeURIComponent(markup)}" width="${size}" height="${size}"></body>`);
  await page.screenshot({ path: `public/${name}.png` });
};
for (const [name, size] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]]) await render(svg, name, size);
await render(maskable, 'maskable-512', 512);
await browser.close();
