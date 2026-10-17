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
const OUT_EXPORT = resolve('test-output/export-v3');
const ZIP = resolve('testbilder/luts/fujifilm-official/zips/gfx-eterna-55-3d-lut-v110.zip');
const DL = resolve(OUT, 'downloads');
const PHOTOS = ['testbilder/DSC04866.JPEG', 'testbilder/DSC03427.JPEG'].map((p) => resolve(p));
const CUBE = resolve(OUT, 'test.cube');
mkdirSync(DL, { recursive: true });
mkdirSync(OUT_EXPORT, { recursive: true });
for (const f of readdirSync(DL)) rmSync(resolve(DL, f));
if (!existsSync(CUBE)) writeFileSync(CUBE, 'TITLE "Testlut"\nLUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n');

const viewport = MODE === 'pc' ? { width: 1440, height: 900 } : { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const { browser, page } = await launch({ viewport });
// Das Handy gibt sich als iPhone aus: iOS bekommt in der Fertig-Ansicht genau einen Knopf („In Fotos sichern“).
if (MODE !== 'pc') await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
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
// Wie in browser-test.mjs: Ist die Seite beim Rechnen blockiert, zählt die erste Antwort nach Ablauf der Frist.
const waitFor = async (fn, ms = 20000) => {
  const end = Date.now() + ms;
  for (;;) {
    if (await page.evaluate(fn)) return true;
    if (Date.now() >= end) return false;
    await sleep(150);
  }
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
const COMPARE = aria('Vorher/Nachher vergleichen');
await click(COMPARE);
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
await click(COMPARE);
ok(await waitFor(() => !document.querySelector('[role=slider][aria-label="Vorher-Nachher-Teiler"]'), 2000), 'Vergleich lässt sich wieder ausschalten');

// 4 Look wählen, Regler
await click(`b.id === 'tab-looks'`);
await sleep(200);
const lookNames = await page.$$eval('section[aria-label] button[aria-pressed][data-look]', (b) => b.map((x) => x.dataset.look));
const groups = await page.$$eval('section[aria-label] h3', (h) => h.map((x) => x.textContent.trim()));
ok(['Fujifilm', 'Leica', 'Kodak', 'Ricoh', 'Eigene'].every((g) => groups.some((x) => x.startsWith(g))), 'Gruppen Fujifilm, Leica, Kodak, Ricoh, Eigene', groups.join(' | '));
// Der Markenhinweis steht in der Look-Liste nur in der Seitenleiste (PC), am Handy auf der Startseite.
if (MODE === 'pc') ok((await text()).includes('Fujifilm, Leica, Kodak und Ricoh sind Marken ihrer Inhaber'), 'Markenhinweis in der Look-Liste');
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
// Der Browser rastet 0 bei Schritt 1/3 ab −2 als −2e−16 ein; gemeint ist 0.
const exp = () => page.$eval('#regler-exposure', (e) => Math.round(Number(e.value) * 1e9) / 1e9 || 0);
ok(Math.abs((await exp()) - 4 / 3) < 0.01, 'Belichtung per Tastatur in Dritteln geändert', String(await exp()));
ok((await text()).includes('+1 1/3 EV'), 'Belichtung zeigt „+1 1/3 EV“');
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
await click(aria('Gelb ↔ Blau zurücksetzen'));
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
await click(`b.textContent.trim() === 'Anwenden + speichern' && !!b.closest('[role=dialog]')`);
await sleep(500);
ok(await page.evaluate(() => !document.querySelector('[role=dialog]')), 'Rezept-Dialog schließt nach dem Speichern');
await click(`b.id === 'tab-anpassen'`);
ok((await seg('grainEffect')) === 'Stark' && (await seg('colorChrome')) === 'Stark' && (await seg('dynamicRange')) === 'DR400', 'Rezept gesetzt: Körnung, Color Chrome, DR');
ok((await page.$eval('#regler-wbKelvin', (e) => Number(e.value))) === 5500, 'Rezept gesetzt: 5500 K');
await click(`b.id === 'tab-looks'`);
await sleep(1500);
ok((await text()).includes('Test-Chrome'), 'Rezept „Test-Chrome“ unter „Eigene“');
await shot('4e-rezept-gespeichert');

// 5d Fujifilm-LUTs
await click(aria('Fuji-LUTs'));
await page.waitForSelector('[role=dialog]');
const od = await page.$eval('[role=dialog]', (d) => d.innerText);
ok(od.includes('fujifilm-x.com') && od.includes('GFX ETERNA 55') && od.includes('nicht hochgeladen'), 'Fujifilm-LUTs: Erklärtext und Link');
ok(await page.$eval('[role=dialog] a', (a) => a.href === 'https://www.fujifilm-x.com/support/download/lut/'), 'Fujifilm-LUTs: Link zeigt auf die Fujifilm-Seite');
await shot('4f-originale');
if (existsSync(ZIP)) {
  await (await page.$('input[data-testid=originale-datei]')).uploadFile(ZIP);
  const done = await waitFor(() => /\d+ Fujifilm-LUTs? geladen/.test(document.querySelector('[role=dialog]')?.innerText ?? '') || !!document.querySelector('[role=dialog] [role=alert]'), 240000);
  const after = await page.$eval('[role=dialog]', (d) => d.innerText);
  const loadedOk = done && /\d+ Fujifilm-LUTs? geladen/.test(after);
  ok(loadedOk, 'Fujifilm-LUTs: ZIP eingelesen', after.replace(/\s+/g, ' ').slice(-200));
  await shot('4g-originale-geladen');
  if (loadedOk) {
    ok(await page.$eval('#originale-verwenden', (e) => e.checked), 'Fujifilm-LUTs: „verwenden“ ist nach dem Laden an');
    await click(aria('Schließen'));
    await sleep(300);
    await click(`b.id === 'tab-looks'`);
    await sleep(2500);
    const badges = await page.evaluate(() => [...document.querySelectorAll('section[aria-label=Fujifilm] button[aria-pressed] span[aria-hidden]')].filter((s) => s.textContent === 'Fuji-LUT').length);
    ok(badges > 0, 'Fujifilm-Looks mit Fujifilm-LUT zeigen das Abzeichen „Fuji-LUT“', String(badges));
    await shot('4h-abzeichen');
    await page.reload({ waitUntil: 'networkidle0' });
    await (await page.$('#datei-eingabe')).uploadFile(...PHOTOS);
    await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
    await sleep(1500);
    const badges2 = await page.evaluate(() => [...document.querySelectorAll('section[aria-label=Fujifilm] button[aria-pressed] span[aria-hidden]')].filter((s) => s.textContent === 'Fuji-LUT').length);
    ok(badges2 > 0, 'Fujifilm-LUTs überleben das Neuladen', String(badges2));
    await click(aria('Fuji-LUTs'));
    await page.waitForSelector('#originale-verwenden');
    await page.click('#originale-verwenden');
    await sleep(500);
    ok(!(await page.$eval('#originale-verwenden', (e) => e.checked)), 'Schalter „Fujifilm-LUTs verwenden“ lässt sich ausschalten');
    await click(`b.textContent.includes('entfernen')`);
    await sleep(300);
    ok(!(await page.evaluate(() => !!document.querySelector('#originale-verwenden'))), 'Fujifilm-LUTs lassen sich entfernen');
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
const showPhoto2 = async () => {
  await click(`b.getAttribute('aria-label')?.startsWith('Foto 2 von 2')`);
  await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
  await click(`b.id === 'tab-anpassen'`);
  return page.$eval('#regler-leak', (e) => Number(e.value));
};
await click(`b.textContent.trim() === 'Auf alle'`);
ok(await click(`b.textContent.trim() === 'Rückgängig'`), '„Auf alle“: Toast bietet „Rückgängig“');
await sleep(300);
ok((await showPhoto2()) === leak2, '„Rückgängig“ stellt die Einstellungen von Foto 2 wieder her');
await click(`b.getAttribute('aria-label')?.startsWith('Foto 1 von 2')`);
await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
await click(`b.textContent.trim() === 'Auf alle'`);
ok((await showPhoto2()) > 0.15, '„Auf alle“ übernimmt die Einstellungen');

// 7 Preset und LUT
await click(`b.id === 'tab-anpassen'`);
await click(`b.textContent.trim() === 'Rezept speichern'`);
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
const openExport = async () => {
  await click(`b.textContent.includes('Exportieren') && !!b.closest('header')`);
  await page.waitForSelector('[role=dialog]');
};
// Mit nur einem Foto entfällt die Wahl „Dieses Foto / Alle“.
await openExport();
await sleep(300);
ok(await page.evaluate(() => !document.querySelector('input[name=umfang]') && !!document.querySelector('[role=dialog]')), 'Ein Foto: keine Umfang-Wahl');
ok(!!(await page.evaluate(() => /Volle Auflösung/.test(document.querySelector('[role=dialog]').innerText))), 'Ein Foto: Beschreibung steht da');
ok(await page.evaluate(() => document.activeElement?.textContent.trim() === 'Exportieren'), 'Ein Foto: Fokus auf „Exportieren“');
await shot('6-export-wahl-1');
await page.keyboard.press('Escape');
ok(await waitFor(() => !document.querySelector('[role=dialog]')), 'Esc schließt den Export-Dialog');
await (await page.$('#datei-eingabe')).uploadFile(PHOTOS[1]);
await sleep(800);
await openExport();
await page.evaluate(() => document.querySelectorAll('input[name=umfang]')[1]?.click());
await sleep(200);
await shot('6-export-wahl');
await click(`b.textContent.trim() === 'Exportieren' && !!b.closest('[role=dialog]')`);
await sleep(400);
await shot('7-export-laeuft');
ok(await page.evaluate(() => !!document.querySelector('[role=progressbar]')), 'Fortschrittsanzeige sichtbar');
await click(`b.textContent.trim() === 'Abbrechen'`);
ok(await waitFor(() => document.body.innerText.includes('Export abgebrochen')), 'Export lässt sich abbrechen');
await click(`b.textContent.trim() === 'Schließen'`);
await openExport();
await page.evaluate(() => document.querySelectorAll('input[name=umfang]')[1]?.click());
await click(`b.textContent.trim() === 'Exportieren' && !!b.closest('[role=dialog]')`);
ok(await waitFor(() => document.body.innerText.includes('Export fertig'), 120000), 'Export von 2 Fotos fertig');
await sleep(1500);
await shot('8-export-fertig');
await page.screenshot({ path: `${OUT_EXPORT}/fertig-${MODE}.png` });
ok(readdirSync(DL).length === 0, 'Nach dem Rechnen startet kein Download von selbst');
const actions = await page.$$eval('[role=dialog] button', (bs) => bs.map((b) => b.textContent.trim()).filter((t) => /herunterladen|teilen|sichern/i.test(t)));
ok(await page.evaluate(() => document.activeElement?.closest('[role=dialog]')?.querySelector('[data-autofocus]') === document.activeElement), 'Fokus auf dem Primärknopf');
if (MODE === 'handy') {
  ok(actions.length === 1 && actions[0] === 'In Fotos sichern', 'Handy (iOS): genau ein Knopf „In Fotos sichern“', actions.join(' | '));
  ok((await text()).includes('Im Teilen-Menü „Bild sichern“ wählen.'), 'Handy (iOS): Hinweis zum Teilen-Menü');
  await click(`b.textContent.includes('In Fotos sichern')`);
  await sleep(300);
  const shared = await page.evaluate(() => window.__shared);
  ok(shared.length === 1 && shared[0].length === 2 && shared[0].every((s) => /_filmlab\.jpg:\d+:image\/jpeg$/.test(s)), 'share() bekommt 2 JPEG-Dateien', JSON.stringify(shared));
  ok(readdirSync(DL).length === 0, 'Handy (iOS): „In Fotos sichern“ lädt nichts herunter');
} else {
  ok(actions.length === 1 && actions[0] === 'ZIP herunterladen', 'PC: genau ein Knopf „ZIP herunterladen“', actions.join(' | '));
  await click(`b.textContent.includes('ZIP herunterladen')`);
  await sleep(2000);
  const files = readdirSync(DL).filter((f) => !f.endsWith('.crdownload'));
  ok(files.some((f) => f.endsWith('.zip')), 'PC: ZIP nach Klick heruntergeladen', files.map((f) => `${f} ${statSync(resolve(DL, f)).size} B`).join(', '));
}
await click(`b.textContent.trim() === 'Schließen'`);

// 9 Foto entfernen (× am aktiven Bild, beim letzten die Taste Entf) bis zum leeren Editor (/lab), mit Rückgängig
const order = () => page.$$eval('ul[aria-label="Geladene Fotos"] button[aria-label^="Foto "][aria-current]', (b) => b.map((x) => `${x.getAttribute('aria-label')}|${x.getAttribute('aria-current')}`));
const before9 = await order();
await click(aria('Foto entfernen'));
await sleep(300);
ok((await order()).length === 0, 'Entfernen per × (danach ein Foto, kein Filmstreifen)');
await click(`b.textContent.trim() === 'Rückgängig'`);
ok(await waitFor(() => document.querySelectorAll('ul[aria-label="Geladene Fotos"] button[aria-label^="Foto "][aria-current]').length === 2, 3000), 'Rückgängig nach dem Entfernen');
ok(JSON.stringify(await order()) === JSON.stringify(before9), 'Rückgängig: gleiche Reihenfolge und aktives Foto', (await order()).join(', '));
for (let i = 0; i < 4 && !(await text()).includes('Noch keine Fotos'); i++) {
  if (!(await click(aria('Foto entfernen')))) {
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Delete');
  }
  await sleep(300);
}
ok((await text()).includes('Noch keine Fotos'), 'Alle Fotos entfernt → leerer Editor');
ok(await click(`b.textContent.trim() === 'Rückgängig'`), 'Leerer Editor bietet „Rückgängig“ für das letzte Foto');
ok(await waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible', 30000), 'Letztes Foto per Rückgängig zurück');
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press('Delete');
ok(await waitFor(() => document.body.innerText.includes('Noch keine Fotos'), 3000), 'Entf entfernt das letzte Foto');
if (!(await text()).includes('Noch keine Fotos')) { await shot('9-entfernen'); console.log((await text()).slice(0, 300)); }

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
