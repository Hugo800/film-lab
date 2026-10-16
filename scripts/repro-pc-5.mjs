// Nachkritik PC 5: Drag & Drop (Start und Editor), ZIP, .cube, Fremddateien.
import { launch, startDevServer } from './lib/browser.mjs';
import { state, sleep, OUT } from './repro-pc-lib.mjs';
const server = await startDevServer();
const { browser, page } = await launch({ viewport: { width: 1440, height: 900 }, log: false });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(server.url + '/', { waitUntil: 'networkidle0' });
const fire = (type, specs) => page.evaluate(async (type, specs, base) => {
  const dt = new DataTransfer();
  for (const s of specs) {
    let body;
    if (s.url) body = await (await fetch(base + s.url)).blob(); else body = new Blob([s.text ?? 'x']);
    dt.items.add(new File([body], s.name, { type: s.type ?? body.type }));
  }
  window.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  return true;
}, type, specs, server.url);
const info = async (w) => console.log(w.padEnd(34), JSON.stringify(await state(page)));
// Start: drag hovering
await fire('dragenter', [{ name: 'DSC01603.JPEG', url: '/testbilder/DSC01603.JPEG' }]); await sleep(300);
await page.screenshot({ path: `${OUT}/05-drag-start.png` });
await fire('dragleave', [{ name: 'a.jpg', text: 'x' }]); await sleep(200);
// Drop 2 Fotos + 1 txt am Start
await fire('dragenter', [{ name: 'a.jpg', text: 'x' }]);
await fire('drop', [{ name: 'DSC01603.JPEG', url: '/testbilder/DSC01603.JPEG' }, { name: 'DSC03982.JPEG', url: '/testbilder/DSC03982.JPEG' }, { name: 'notizen.txt', text: 'hallo' }]);
await page.waitForFunction(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible', { timeout: 120000 });
await sleep(1500); await info('nach Drop 2 Fotos + txt');
await page.screenshot({ path: `${OUT}/05b-drop-foto-und-txt.png` });
// Overlay im Editor
await fire('dragenter', [{ name: 'a.jpg', text: 'x' }]); await sleep(300);
await page.screenshot({ path: `${OUT}/05c-drag-editor.png` });
await fire('dragleave', [{ name: 'a.jpg', text: 'x' }]); await sleep(200);
console.log('Overlay nach dragleave weg:', !(await page.evaluate(() => document.body.innerText.includes('Zum Hinzufügen loslassen'))));
// Drop einer Textdatei als .zip
await fire('drop', [{ name: 'kaputt.zip', text: 'kein zip' }]); await sleep(1500); await info('Drop kaputt.zip');
await page.screenshot({ path: `${OUT}/05d-drop-zip-kaputt.png`, clip: { x: 0, y: 600, width: 1020, height: 300 } });
// .cube: Identitäts-LUT
const cube = 'TITLE "Test"\nLUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n';
await fire('drop', [{ name: 'meine-lut.cube', text: cube }]); await sleep(1500); await info('Drop meine-lut.cube');
// Defektes .cube
await fire('drop', [{ name: 'defekt.cube', text: 'LUT_3D_SIZE 99\n1 2' }]); await sleep(1000); await info('Drop defekt.cube');
await page.screenshot({ path: `${OUT}/05e-drop-cube-defekt.png`, clip: { x: 0, y: 600, width: 1020, height: 300 } });
// echtes ZIP
try { await fire('drop', [{ name: 'GFX_ETERNA_55.zip', url: '/testbilder/luts/fujifilm-official/zips/' + (await (async () => 'x')()) }]); } catch (e) { console.log('zip fetch', e.message); }
await browser.close(); await server.close();
