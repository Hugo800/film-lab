// Nachkritik PC 2: Tastenkürzel.
import { open, state, sleep, OUT } from './repro-pc-lib.mjs';
const { server, browser, page, shot } = await open();
const log = async (what) => console.log(what.padEnd(34), JSON.stringify(await state(page)));
await log('start');
await page.mouse.move(500, 400);
for (const k of ['ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowLeft']) { await page.keyboard.press(k); await sleep(250); await log('Taste ' + k); }
await page.keyboard.down('Space'); await sleep(400); await log('Space gehalten'); await page.keyboard.up('Space'); await sleep(200); await log('Space los');
await page.keyboard.press('KeyB'); await sleep(300); await log('B'); await page.keyboard.press('KeyB');
await page.keyboard.press('Slash'); await sleep(100);
await page.keyboard.down('Shift'); await page.keyboard.press('Slash'); await page.keyboard.up('Shift'); await sleep(400); await log('? (Shift+/)');
await shot('03-kuerzel-dialog');
await page.keyboard.press('Escape'); await sleep(300); await log('Esc');
// Leertaste auf fokussiertem Knopf (Tastaturnutzer): Look-Kachel per Tab-Fokus
await page.focus('button[data-look="Velvia/Vivid"]');
await log('Fokus Velvia-Kachel');
await page.keyboard.press('Space'); await sleep(400); await log('Space auf Kachel');
await page.focus('button[aria-label="Fotos hinzufügen"]');
let dialogs = 0; page.on('filechooser', async (c) => { dialogs++; await c.cancel(); });
await page.keyboard.press('Space'); await sleep(500); console.log('Space auf Fotos hinzufügen: Dateidialog', dialogs);
await page.keyboard.press('Enter'); await sleep(500); console.log('Enter auf Fotos hinzufügen: Dateidialog', dialogs);
await page.focus('#tab-anpassen'); await page.keyboard.press('Space'); await sleep(300); await log('Space auf Tab Anpassen');
await page.focus('button[aria-label="Exportieren"]'); await page.keyboard.press('Space'); await sleep(500); await log('Space auf Exportieren');
await page.keyboard.press('Escape'); await sleep(300); await log('Esc nach Export-Wahl');
await browser.close(); await server.close();
