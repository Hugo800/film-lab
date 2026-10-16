// Nachkritik PC 3: Leertaste/Enter auf fokussierten Knöpfen.
import { open, state, sleep } from './repro-pc-lib.mjs';
const { server, browser, page } = await open({ names: ['DSC04866', 'DSC03427'] });
const log = async (what) => { const s = await state(page); console.log(what.padEnd(40), JSON.stringify({ look: s.look, photo: s.photo?.slice(0, 11), label: s.label, dialog: s.dialog, tab: s.tab, toast: s.toast })); };
await page.evaluate(() => { window.__clicks = 0; document.querySelector('#datei-eingabe').addEventListener('click', () => window.__clicks++); });
for (const key of ['Enter', 'Space']) {
  console.log('--', key);
  await page.focus('button[data-look="Velvia/Vivid"]'); await page.keyboard.press(key); await sleep(300); await log(key + ' auf Look-Kachel Velvia');
  await page.focus('[aria-label^="Foto 2 von"]'); await page.keyboard.press(key); await sleep(1200); await log(key + ' auf Filmstreifen-Bild 2');
  await page.focus('button[aria-label="Fotos hinzufügen"]'); await page.keyboard.press(key); await sleep(300); console.log(key + ' auf Fotos hinzufügen: Klicks auf Dateieingabe', await page.evaluate(() => window.__clicks));
  await page.focus('button[aria-label="Vorher/Nachher vergleichen"]'); await page.keyboard.press(key); await sleep(300); console.log(key + ' auf Vergleich: Teiler', (await state(page)).slider); await page.keyboard.press(key === 'Enter' ? 'Enter' : 'Space'); 
  await page.evaluate(() => document.querySelector('button[aria-label="Vorher/Nachher vergleichen"][aria-pressed=true]')?.click());
  await page.focus('button[aria-label="Exportieren"]'); await page.keyboard.press(key); await sleep(500); await log(key + ' auf Exportieren');
  if ((await state(page)).dialog) { await page.keyboard.press('Escape'); await sleep(300); }
  await page.focus('[aria-label="Foto entfernen"]'); await page.keyboard.press(key); await sleep(500); await log(key + ' auf Foto entfernen (×)');
  const r = await page.$('button ::-p-text(Rückgängig)');
  if (r) { await r.focus(); await page.keyboard.press(key); await sleep(600); await log(key + ' auf Toast Rückgängig'); }
  else console.log('kein Rückgängig-Knopf');
  // zurück zum Ausgangszustand
}
await browser.close(); await server.close();
