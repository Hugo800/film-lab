// Nachkritik PC 4: 100-%-Lupe.
import { open, state, sleep, OUT } from './repro-pc-lib.mjs';
const { server, browser, page, shot } = await open({ names: ['DSC03982', 'DSC03427'] });
const zinfo = () => page.evaluate(() => {
  const c = document.querySelector('[aria-label^="Ansicht 100"] canvas');
  const chip = document.querySelector('[aria-label^="100 %, zurück"]');
  const cb = c?.getBoundingClientRect();
  const st = document.querySelector('[aria-label^="Ansicht 100"]')?.getBoundingClientRect();
  return { canvas: c && [c.width, c.height, c.style.visibility || 'sichtbar'], rect: cb && [Math.round(cb.x), Math.round(cb.y), Math.round(cb.width), Math.round(cb.height)], stage: st && [Math.round(st.x), Math.round(st.y), Math.round(st.width), Math.round(st.height)], spinner: !!chip?.querySelector('.animate-spin'), chip: !!chip, cursor: c && getComputedStyle(c.parentElement).cursor, label: document.querySelector('[aria-live=polite]')?.textContent };
});
const waitIdle = async () => { const t = Date.now(); await sleep(150); while (await page.evaluate(() => !!document.querySelector('[aria-label^="100 %, zurück"] .animate-spin')) && Date.now() - t < 60000) await sleep(100); return Date.now() - t; };
const fr = await (await page.$('[aria-label^="Vorschau"]')).boundingBox();
console.log('Frame Einpassen', JSON.stringify(fr));
// Doppelklick auf Felsen
const px = fr.x + fr.width * 0.45, py = fr.y + fr.height * 0.5;
await page.mouse.click(px, py, { clickCount: 2, delay: 30 });
await sleep(100);
console.log('nach Doppelklick (sofort)', JSON.stringify(await zinfo()), JSON.stringify((await state(page)).zoom));
console.log('Rechenzeit ms', await waitIdle());
console.log('Lupe', JSON.stringify(await zinfo()));
await shot('04-lupe-doppelklick');
// Ziehen um 200 px nach links/oben
const d0 = await zinfo();
await page.mouse.move(700, 450); await page.mouse.down(); await page.mouse.move(600, 400, { steps: 5 }); await page.mouse.move(500, 350, { steps: 5 });
await sleep(200); console.log('beim Ziehen', JSON.stringify(await zinfo()));
await shot('04b-lupe-ziehen');
await page.mouse.up(); await sleep(100);
console.log('nach Loslassen sofort', JSON.stringify(await zinfo()));
console.log('Rechenzeit ms', await waitIdle());
console.log('nach Ziehen', JSON.stringify(await zinfo()));
await shot('04c-lupe-nach-ziehen');
// Mausrad ohne Strg
const before = await zinfo();
await page.mouse.move(700, 450); await page.mouse.wheel({ deltaY: 300 }); await sleep(600);
console.log('Mausrad ohne Strg verschiebt?', JSON.stringify((await zinfo()).rect) === JSON.stringify(before.rect) ? 'nein' : 'ja');
// Pfeil im Zoom
await page.keyboard.press('ArrowDown'); await sleep(500); console.log('ArrowDown im Zoom', JSON.stringify(await state(page)));
console.log('Rechenzeit ms', await waitIdle());
// Space gehalten im Zoom
await page.keyboard.down('Space'); await sleep(300); const o = await zinfo(); console.log('Space im Zoom: Label', o.label, 'spinner', o.spinner); await page.keyboard.up('Space'); await waitIdle();
// Esc
await page.keyboard.press('Escape'); await sleep(500); console.log('Esc', JSON.stringify((await state(page)).zoom));
// Z
await page.keyboard.press('KeyZ'); await sleep(300); console.log('Z an', (await state(page)).zoom); await waitIdle();
await page.keyboard.press('KeyZ'); await sleep(300); console.log('Z aus', (await state(page)).zoom);
// Strg+Rad
await page.mouse.move(fr.x + 100, fr.y + 100);
await page.keyboard.down('Control'); await page.mouse.wheel({ deltaY: -100 }); await page.keyboard.up('Control'); await sleep(300); console.log('Strg+Rad hoch', (await state(page)).zoom); await waitIdle();
await page.keyboard.down('Control'); await page.mouse.wheel({ deltaY: 100 }); await page.keyboard.up('Control'); await sleep(300); console.log('Strg+Rad runter', (await state(page)).zoom);
// Button
await page.click('button[aria-label="100 %-Ansicht"]'); await sleep(300); console.log('Lupenknopf', (await state(page)).zoom); await waitIdle();
await page.click('button[aria-label="Vorher/Nachher vergleichen"]', { }).catch((e) => console.log('Vergleich im Zoom nicht klickbar'));
console.log('Vergleich disabled im Zoom', await page.$eval('button[aria-label="Vorher/Nachher vergleichen"]', (b) => b.disabled));
// Fotowechsel im Zoom
await page.click('[aria-label^="Foto 2 von"]'); await sleep(800); console.log('Fotowechsel im Zoom -> zoom', (await state(page)).zoom);
await browser.close(); await server.close();
