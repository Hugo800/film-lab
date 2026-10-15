// Prüft, dass Headless Chrome + WebGL2 laufen: node scripts/smoke.mjs
import { launch } from './lib/browser.mjs';
const { browser, page } = await launch();
await page.setContent('<canvas></canvas>');
const r = await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  return gl ? { maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), max3d: gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) } : null;
});
console.log('WebGL2:', r);
await browser.close();
