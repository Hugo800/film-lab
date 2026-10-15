// Erzeugt die PNG-Symbole aus public/favicon.svg: node scripts/ui-icons.mjs
import { readFileSync } from 'node:fs';
import { launch } from './lib/browser.mjs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const { browser, page } = await launch({ viewport: { width: 512, height: 512 } });
for (const [name, size] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]]) {
  await page.setViewport({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:#0b0b0c"><img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}" width="${size}" height="${size}"></body>`);
  await page.screenshot({ path: `public/${name}.png` });
}
await browser.close();
