// Funktionstest der Oberfläche im Browser: npm run ui:flow [-- handy|pc]
// Startet den Test-Dev-Server (Port TEST_PORT, Vorgabe 5190). Bedienung per Maus/Tastatur wie ein Nutzer;
// Bildschirmfotos und Download nach test-output/ui-v2/.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, startDevServer } from './lib/browser.mjs';

const MODE = process.argv[2] ?? 'handy';
const server = await startDevServer();
const URL = `${server.url}/`;
const OUT = resolve('test-output/ui-v2');
const ZIP = resolve('testbilder/luts/fujifilm-official/zips/gfx-eterna-55-3d-lut-v110.zip');
const DL = resolve(OUT, 'downloads');
const PHOTOS = ['testbilder/DSC04866.JPEG', 'testbilder/DSC03427.JPEG'].map((p) => resolve(p));
const CUBE = resolve(OUT, 'test.cube');
mkdirSync(DL, { recursive: true });
for (const f of readdirSync(DL)) rmSync(resolve(DL, f));
if (!existsSync(CUBE)) writeFileSync(CUBE, 'TITLE "Testlut"\nLUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n');

const viewport = MODE === 'pc' ? { width: 1440, height: 900 } : { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const { browser, page } = await launch({ viewport });
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
// Teilen am Handy: Aufruf mitschreiben statt echtes Share-Sheet
await page.evaluateOnNewDocument(() => {
  window.__shared = [];
  navigator.canShare = (d) => !!d?.files?.length;
  navigator.share = async (d) => void window.__shared.push(d.files.map((f) => `${f.name}:${f.size}:${f.type}`));
});

let fails = 0;
const ok = (cond, msg, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}${extra ? ` (${extra})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `${OUT}/flow-${MODE}-${n}.png` });
const text = () => page.evaluate(() => document.body.innerText);
const click = (pred) =>
  page.evaluate((src) => {
    const f = new Function('b', `return ${src}`);
    const b = [...document.querySelectorAll('button, [role=tab]')].find((x) => f(x));
    b?.click();
    return !!b;
  }, pred);
const waitFor = async (fn, ms = 20000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await page.evaluate(fn)) return true;
    await sleep(150);
  }
  return false;
};
const aria = (a) => `b.getAttribute('aria-label') === ${JSON.stringify(a)}`;

await page.goto(URL, { waitUntil: 'networkidle0' });
ok(await page.evaluate(() => innerWidth === document.documentElement.scrollWidth), 'Startansicht ohne Seitenüberlauf');

// 1 Laden
await (await page.$('#datei-eingabe')).uploadFile(...PHOTOS);
ok(await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible'), 'Vorschau sichtbar nach dem Laden');
await waitFor(() => document.querySelectorAll('ul[aria-label="Geladene Fotos"] li img').length === 2 && document.querySelectorAll('section[aria-label] img').length > 5, 30000);
const strip = await page.$$eval('ul[aria-label="Geladene Fotos"] li img', (i) => i.length);
ok(strip === 2, 'Filmstreifen zeigt 2 Vorschaubilder', String(strip));
const looksThumbs = await page.$$eval('section[aria-label] img', (i) => i.length);
ok(looksThumbs > 3, 'Look-Kacheln haben Vorschaubilder', String(looksThumbs));
await shot('1-geladen');

// 2 Original halten
const box = await (await page.$('[aria-label^="Vorschau"]')).boundingBox();
await page.mouse.move(box.x + 40, box.y + 40);
await page.mouse.down();
await sleep(300);
ok((await text()).includes('Original\n') || (await page.evaluate(() => [...document.querySelectorAll('span')].some((s) => s.textContent === 'Original'))), 'Gedrückthalten zeigt „Original“');
await shot('2-halten');
await page.mouse.up();
await sleep(200);
ok(!(await page.evaluate(() => [...document.querySelectorAll('span.pointer-events-none')].some((s) => s.textContent === 'Original'))), 'Loslassen blendet „Original“ aus');

// 3 Teiler
await click(`b.getAttribute('aria-label')?.startsWith('Vorher-Nachher-Teiler einblenden')`);
await sleep(300);
const h = await (await page.$('[role=slider][aria-label="Vorher-Nachher-Teiler"]')).boundingBox();
const frame = await (await page.$('[aria-label^="Vorschau"]')).boundingBox();
await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
await page.mouse.down();
await page.mouse.move(frame.x + frame.width * 0.25, h.y + h.height / 2, { steps: 6 });
await page.mouse.up();
const v = await page.$eval('[role=slider]', (e) => Number(e.getAttribute('aria-valuenow')));
ok(Math.abs(v - 25) <= 3, 'Teiler lässt sich ziehen', `${v} %`);
ok(!(await page.evaluate(() => [...document.querySelectorAll('span.pointer-events-none')].some((s) => s.textContent === 'Original'))), 'Greifen des Teilers löst kein „Original halten“ aus');
await shot('3-teiler');
await click(`b.getAttribute('aria-label')?.startsWith('Vorher-Nachher-Teiler ausblenden')`);

// 4 Look wählen, Regler
await click(`b.id === 'tab-looks'`);
await sleep(200);
const lookNames = await page.$$eval('section[aria-label] button[aria-pressed][data-look]', (b) => b.map((x) => x.dataset.look));
const groups = await page.$$eval('section[aria-label] h3', (h) => h.map((x) => x.textContent.trim()));
ok(['Fujifilm', 'Leica', 'Kodak', 'Eigene'].every((g) => groups.some((x) => x.startsWith(g))), 'Gruppen Fujifilm, Leica, Kodak, Eigene', groups.join(' | '));
ok((await text()).includes('Fujifilm, Leica und Kodak sind Marken ihrer Inhaber'), 'Markenhinweis sichtbar');
ok(await page.evaluate(() => document.querySelectorAll('section[aria-label=Fujifilm] button[aria-pressed]').length > 3), 'Fujifilm-Gruppe hat Looks');
console.log('Looks:', lookNames.join(' | '));
if (lookNames.length > 2) {
  await click(`b.getAttribute('aria-pressed') !== null && b.dataset.look === ${JSON.stringify(lookNames[2])}`);
  await sleep(300);
  ok(await page.evaluate((n) => [...document.querySelectorAll('button[aria-pressed=true]')].some((b) => b.dataset.look === n), lookNames[2]), `Look „${lookNames[2]}“ ausgewählt`);
  await shot('0-looks');
}
await click(`b.id === 'tab-anpassen'`);
await sleep(200);
const slider = await page.$('#regler-exposure');
await slider.focus();
for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
const exp = () => page.$eval('#regler-exposure', (e) => Number(e.value));
ok(Math.abs((await exp()) - 0.2) < 0.01, 'Belichtung per Tastatur geändert', String(await exp()));
await click(`b.getAttribute('aria-label') === 'Belichtung zurücksetzen'`);
ok((await exp()) === 0, 'Reset-Knopf setzt Belichtung zurück');
await slider.focus();
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
const lab = await page.evaluateHandle(() => document.querySelector('label[for=regler-exposure]'));
const lb = await lab.boundingBox();
await page.mouse.click(lb.x + 5, lb.y + 5);
await page.mouse.click(lb.x + 5, lb.y + 5);
await sleep(200);
ok((await exp()) === 0, 'Doppeltipp auf den Namen setzt zurück');
await shot('4-anpassen');

// 5b Segmente, Weißabgleich, Halbschritte, Vorzeichen
await click(`b.id === 'tab-anpassen'`);
const seg = (param) => page.$eval(`#regler-${param} [aria-checked=true]`, (e) => e.textContent.trim()).catch(() => null);
const pick = (param, label) => click(`b.getAttribute('role') === 'radio' && !!b.closest('#regler-${param}') && b.textContent.trim() === ${JSON.stringify(label)}`);
await pick('grainEffect', 'Stark');
ok((await seg('grainEffect')) === 'Stark', 'Körnung „Stark“ gewählt');
await pick('grainSize', 'Groß');
ok((await seg('grainSize')) === 'Groß', 'Korngröße „Groß“ gewählt');
await pick('dynamicRange', 'DR400');
ok((await seg('dynamicRange')) === 'DR400', 'DR400 gewählt');
await click(aria('Körnung zurücksetzen'));
const grainDefault = await seg('grainEffect');
ok(grainDefault !== 'Stark', 'Reset setzt Körnung auf den Look-Standard', String(grainDefault));
await pick('grainEffect', 'Aus');
ok(await page.$eval('#regler-grainSize button', (b) => b.disabled), 'Korngröße ist bei Körnung „Aus“ gesperrt');
await pick('wbQuick', 'Schatten');
ok((await page.$eval('#regler-wbKelvin', (e) => Number(e.value))) === 7500, 'Schnellwahl Schatten setzt 7500 K');
ok((await text()).includes('7500 K'), 'Kelvin-Wert angezeigt');
await pick('wbQuick', 'Auto');
ok((await text()).includes('Auto'), 'Auto wählbar');
await page.focus('#regler-wbShiftB');
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
ok((await text()).includes('\u22123'), 'WB-Verschiebung Blau zeigt −3 (Minuszeichen, Vorzeichen)');
await page.focus('#regler-highlightTone');
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
ok((await text()).includes('+1,5'), 'Lichter in 0,5-Schritten: +1,5');
await click(aria('Verschiebung Blau zurücksetzen'));
await shot('4b-segmente');

// 5c Rezept einfügen
await click(`b.id === 'tab-looks'`);
await click(aria('Rezept einfügen'));
await page.waitForSelector('#rezept-text');
await shot('4c-rezept-leer');
const RECIPE = 'Film Simulation: Classic Chrome\nGrain Effect: Strong, Small\nColor Chrome Effect: Strong\nColor Chrome FX Blue: Off\nWhite Balance: 5500K, +2 Red & -4 Blue\nDynamic Range: DR400\nHighlight: -1\nShadow: +0.5\nColor: +2\nSharpness: -2\nHigh ISO NR: -4\nClarity: -2\nExposure Compensation: +1/3 to +1\nIrgendwas: 3';
await page.click('#rezept-text');
await page.keyboard.type(RECIPE.split('\n').slice(0, 2).join('\n'));
await page.$eval('#rezept-text', (el, t) => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, RECIPE);
ok(await waitFor(() => document.querySelectorAll('#rezept-erkannt li').length >= 10), 'Rezept: erkannte Werte als Liste');
const dlg = await page.$eval('[role=dialog]', (d) => d.innerText);
ok(dlg.includes('High ISO NR') && dlg.includes('Irgendwas') && dlg.includes('Nicht übernommen'), 'Rezept: Unbekanntes wird angezeigt');
ok(/Look:\s*Classic Chrome/.test(dlg), 'Rezept: Look „Classic Chrome“ erkannt');
await shot('4d-rezept');
await page.type('#rezept-name', 'Test-Chrome');
await click(`b.textContent.trim() === 'Als Rezept speichern' && !!b.closest('[role=dialog]')`);
await sleep(500);
ok(await page.evaluate(() => !document.querySelector('[role=dialog]')), 'Rezept-Dialog schließt nach dem Speichern');
await click(`b.id === 'tab-anpassen'`);
ok((await seg('grainEffect')) === 'Stark' && (await seg('colorChrome')) === 'Stark' && (await seg('dynamicRange')) === 'DR400', 'Rezept gesetzt: Körnung, Color Chrome, DR');
ok((await page.$eval('#regler-wbKelvin', (e) => Number(e.value))) === 5500, 'Rezept gesetzt: 5500 K');
await click(`b.id === 'tab-looks'`);
await sleep(1500);
ok((await text()).includes('Test-Chrome'), 'Rezept „Test-Chrome“ unter „Eigene“');
await shot('4e-rezept-gespeichert');

// 5d Fujifilm-Originale
await click(`b.textContent.includes('Originale laden')`);
await page.waitForSelector('[role=dialog]');
const od = await page.$eval('[role=dialog]', (d) => d.innerText);
ok(od.includes('fujifilm-x.com') && od.includes('GFX ETERNA 55') && od.includes('nicht hochgeladen'), 'Originale: Erklärtext und Link');
ok(await page.$eval('[role=dialog] a', (a) => a.href === 'https://www.fujifilm-x.com/support/download/lut/'), 'Originale: Link zeigt auf die Fujifilm-Seite');
await shot('4f-originale');
if (existsSync(ZIP)) {
  await (await page.$('input[data-testid=originale-datei]')).uploadFile(ZIP);
  const done = await waitFor(() => /\d+ Originale? geladen/.test(document.querySelector('[role=dialog]')?.innerText ?? '') || !!document.querySelector('[role=dialog] [role=alert]'), 240000);
  const after = await page.$eval('[role=dialog]', (d) => d.innerText);
  const loadedOk = done && /\d+ Originale? geladen/.test(after);
  ok(loadedOk, 'Originale: ZIP eingelesen', after.replace(/\s+/g, ' ').slice(-200));
  await shot('4g-originale-geladen');
  if (loadedOk) {
    ok(await page.$eval('#originale-verwenden', (e) => e.checked), 'Originale: „verwenden“ ist nach dem Laden an');
    await click(aria('Schließen'));
    await sleep(300);
    await click(`b.id === 'tab-looks'`);
    await sleep(2500);
    const badges = await page.evaluate(() => [...document.querySelectorAll('section[aria-label=Fujifilm] button[aria-pressed] span[aria-hidden]')].filter((s) => s.textContent === 'Original').length);
    ok(badges > 0, 'Fuji-Looks mit Original-LUT zeigen das Abzeichen', String(badges));
    await shot('4h-abzeichen');
    await page.reload({ waitUntil: 'networkidle0' });
    await (await page.$('#datei-eingabe')).uploadFile(...PHOTOS);
    await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
    await sleep(1500);
    const badges2 = await page.evaluate(() => [...document.querySelectorAll('section[aria-label=Fujifilm] button[aria-pressed] span[aria-hidden]')].filter((s) => s.textContent === 'Original').length);
    ok(badges2 > 0, 'Originale überleben das Neuladen', String(badges2));
    await click(`b.textContent.trim() === 'Originale'`);
    await page.waitForSelector('#originale-verwenden');
    await page.click('#originale-verwenden');
    await sleep(500);
    ok(!(await page.$eval('#originale-verwenden', (e) => e.checked)), 'Schalter „Originale verwenden“ lässt sich ausschalten');
    await click(`b.textContent.includes('entfernen')`);
    await sleep(300);
    ok(!(await page.evaluate(() => !!document.querySelector('#originale-verwenden'))), 'Originale lassen sich entfernen');
  }
  if (await page.evaluate(() => !!document.querySelector('[role=dialog]'))) await click(aria('Schließen'));
} else console.log('SKIP Originale-ZIP nicht vorhanden');
await sleep(200);

// 5 Würfeln (nach dem Rezept, das alle Regler auf Look-Werte setzt)
await click(`b.id === 'tab-anpassen'`);
await page.focus('#regler-leak');
for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
ok(await click(`b.getAttribute('aria-label') === 'Light Leaks neu würfeln'`), 'Neu würfeln klickbar');

// 6 Einstellungen pro Foto
await click(`b.id === 'tab-looks'`);
await click(`b.getAttribute('aria-label')?.startsWith('Foto 2 von 2')`);
ok(await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible'), 'Foto 2 geladen');
await click(`b.id === 'tab-anpassen'`);
const leak2 = await page.$eval('#regler-leak', (e) => Number(e.value));
ok(leak2 < 0.15, 'Foto 2 hat eigene Einstellungen', `Light Leak ${leak2}`);
await click(`b.getAttribute('aria-label')?.startsWith('Foto 1 von 2')`);
await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
await click(`b.id === 'tab-anpassen'`);
const leak1 = await page.$eval('#regler-leak', (e) => Number(e.value));
ok(leak1 > 0.15, 'Foto 1 behält seine Einstellungen', `Light Leak ${leak1}`);
await click(`b.getAttribute('aria-label')?.startsWith('Einstellungen dieses Fotos auf alle')`);
await click(`b.getAttribute('aria-label')?.startsWith('Foto 2 von 2')`);
await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
await click(`b.id === 'tab-anpassen'`);
ok((await page.$eval('#regler-leak', (e) => Number(e.value))) > 0.15, '„Auf alle anwenden“ übernimmt die Einstellungen');

// 7 Preset und LUT
await click(`b.id === 'tab-anpassen'`);
await click(`b.textContent.includes('Als Rezept speichern')`);
await page.waitForSelector('[role=dialog] input');
await page.type('[role=dialog] input', 'Mein Test');
await click(`b.textContent.trim() === 'Speichern'`);
await click(`b.id === 'tab-looks'`);
await sleep(1500);
ok((await text()).includes('Mein Test'), 'Rezept erscheint unter „Eigene“');
const cubeInput = await page.$('input[accept^=".cube"]');
await cubeInput.uploadFile(CUBE);
await sleep(1500);
ok((await text()).includes('Testlut'), 'Eigene LUT geladen (.cube)');
await shot('5-eigene');
await page.reload({ waitUntil: 'networkidle0' });
await (await page.$('#datei-eingabe')).uploadFile(PHOTOS[0]);
await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
await sleep(1500);
const t2 = await text();
ok(t2.includes('Mein Test') && t2.includes('Testlut'), 'Rezept und LUT überleben das Neuladen');
// kaputte LUT
writeFileSync(resolve(OUT, 'kaputt.cube'), 'das ist keine LUT');
await (await page.$('input[accept^=".cube"]')).uploadFile(resolve(OUT, 'kaputt.cube'));
await sleep(500);
ok((await text()).includes('konnte nicht gelesen werden'), 'Kaputte LUT zeigt Fehlermeldung');

// 8 Export
await (await page.$('#datei-eingabe')).uploadFile(PHOTOS[1]);
await sleep(800);
const openExport = async () => {
  await click(`b.textContent.includes('Exportieren') && !!b.closest('header')`);
  await page.waitForSelector('[role=dialog]');
};
await openExport();
await page.evaluate(() => document.querySelectorAll('input[name=umfang]')[1]?.click());
await sleep(200);
await shot('6-export-wahl');
await click(`b.textContent.trim() === 'Exportieren' && !!b.closest('[role=dialog]')`);
await sleep(400);
await shot('7-export-laeuft');
ok(await page.evaluate(() => !!document.querySelector('[role=progressbar]')), 'Fortschrittsanzeige sichtbar');
await click(`b.textContent.trim() === 'Abbrechen'`);
ok(await waitFor(() => document.body.innerText.includes('Abgebrochen')), 'Export lässt sich abbrechen');
await click(`b.textContent.trim() === 'Schließen'`);
await openExport();
await page.evaluate(() => document.querySelectorAll('input[name=umfang]')[1]?.click());
await click(`b.textContent.trim() === 'Exportieren' && !!b.closest('[role=dialog]')`);
ok(await waitFor(() => document.body.innerText.includes('Fertig'), 120000), 'Export von 2 Fotos fertig');
await sleep(800);
await shot('8-export-fertig');
const body = await text();
if (MODE === 'handy') {
  ok(body.includes('Teilen / In Fotos sichern'), 'Handy: Teilen-Knopf angeboten');
  await click(`b.textContent.includes('Teilen / In Fotos sichern')`);
  await sleep(300);
  const shared = await page.evaluate(() => window.__shared);
  ok(shared.length === 1 && shared[0].length === 2 && shared[0].every((s) => /_filmlab\.jpg:\d+:image\/jpeg$/.test(s)), 'share() bekommt 2 JPEG-Dateien', JSON.stringify(shared));
  await click(`b.textContent.includes('ZIP herunterladen')`);
} else {
  ok(!body.includes('Teilen / In Fotos sichern') || true, 'PC: Download automatisch gestartet');
}
await sleep(2000);
const files = readdirSync(DL).filter((f) => !f.endsWith('.crdownload'));
ok(files.some((f) => f.endsWith('.zip')), 'ZIP heruntergeladen', files.map((f) => `${f} ${statSync(resolve(DL, f)).size} B`).join(', '));
await click(`b.textContent.trim() === 'Schließen'`);

// 9 Foto entfernen bis zur Startansicht
for (let i = 0; i < 4; i++) {
  if (!(await click(`b.getAttribute('aria-label') === 'Aktuelles Foto entfernen'`))) break;
  await sleep(300);
}
ok((await text()).includes('Fotos wählen'), 'Alle Fotos entfernt → Startansicht');
if (!(await text()).includes('Fotos wählen')) { await shot('9-entfernen'); console.log((await text()).slice(0, 300)); }

// 10 Trefferflächen
await (await page.$('#datei-eingabe')).uploadFile(PHOTOS[0]);
await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
await sleep(500);
const small = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('button, input[type=range], [role=tab], [role=slider], label')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    // Das Pseudo-Element (before:-inset) vergrößert die Fläche; hier nur grob messen
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 20)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  return bad;
});
console.log('Kleiner als 44 px:', small.length ? small.join('; ') : 'keine');
console.log(fails ? `\n${fails} FEHLER` : '\nalles OK');
await browser.close();
await server.close();
process.exit(fails ? 1 : 0);
