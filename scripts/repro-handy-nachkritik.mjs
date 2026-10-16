// UX-Nachkritik Handy (nur lesen): Abläufe per Touch, Bildschirmfotos + Maße nach test-output/ux-nachkritik/handy/
// TEST_PORT=5224 node scripts/repro-handy-nachkritik.mjs a|b|c|d
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, startDevServer } from './lib/browser.mjs';

const PART = process.argv[2] ?? 'a';
const OUT = resolve('test-output/ux-nachkritik/handy');
mkdirSync(OUT, { recursive: true });
const server = await startDevServer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const P = (n) => resolve('testbilder', n);
const report = {};
const note = (k, v) => {
  report[k] = v;
  console.log(k, JSON.stringify(v));
};

const RECIPE = `Kodak Portra 400
Film Simulation: Classic Negative
Dynamic Range: DR400
Highlight: -1
Shadow: +1
Color: +2
Sharpness: -1
Noise Reduction: -4
Grain Effect: Weak, Small
Color Chrome Effect: Strong
Color Chrome Effect Blue: Weak
White Balance: Daylight, +2 Red & -4 Blue
ISO: Auto, up to ISO 6400
Exposure Compensation: +1/3 to +2/3 (typically)`;

async function setup(viewport) {
  const { browser, page } = await launch({ viewport, log: false });
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`[console] ${m.text()}`));
  await page.evaluateOnNewDocument(() => {
    window.__shared = [];
    navigator.canShare = (d) => !!d?.files?.length;
    navigator.share = async (d) => void window.__shared.push(d.files.length);
  });
  await page.goto(`${server.url}/`, { waitUntil: 'networkidle0' });
  const cdp = await page.createCDPSession();
  const send = (m, p) => Promise.race([cdp.send(m, p), sleep(20000).then(() => { throw new Error(`CDP-Frist ${m}`); })]);
  const now = () => Date.now() / 1000;
  const T = {
    async tap(x, y) {
      const ts = now();
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }], timestamp: ts });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: ts + 0.05 });
    },
    async double(x, y) {
      const ts = now();
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }], timestamp: ts });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: ts + 0.05 });
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }], timestamp: ts + 0.15 });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: ts + 0.2 });
    },
    async swipe(x, y, dx, dy = 0, dur = 0.2, steps = 4) {
      const ts = now();
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }], timestamp: ts });
      for (let i = 1; i <= steps; i++)
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps, id: 1 }], timestamp: ts + (dur * i) / (steps + 1) });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: ts + dur });
    },
    async hold(x, y, ms) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await sleep(ms);
      const lab = await page.evaluate(() => document.querySelector('[aria-live=polite] span')?.textContent ?? null);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      return lab;
    },
  };
  return { browser, page, T, cdp };
}

const waitFor = async (page, fn, ms = 60000, arg) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await page.evaluate(fn, arg)) return Date.now() - t;
    await sleep(150);
  }
  return -1;
};
const ready = () => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible';
/** Warten, bis keine neuen Kachelbilder mehr kommen (Hauptthread ruht). */
async function quiet(page, maxMs = 90000) {
  let last = -1, same = 0;
  const t = Date.now();
  while (Date.now() - t < maxMs) {
    const n = await page.evaluate(() => document.querySelectorAll('button[data-look] img').length);
    same = n === last ? same + 1 : 0;
    last = n;
    if (same >= 6) return n;
    await sleep(400);
  }
  return last;
}
const S = (page, fn, arg) =>
  page.evaluate(
    async (src, a) => {
      const { useStore } = await import('/src/ui/store.ts');
      return new Function('s', 'a', `return (${src})(s, a)`)(useStore, a);
    },
    fn.toString(),
    arg,
  );
const rects = (page) =>
  page.evaluate(() => {
    const R = (e) => {
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const q = (s) => document.querySelector(s);
    const frame = q('[aria-label^="Vorschau"]');
    const panel = q('#bedienfeld');
    const list = q('#bedienfeld .hide-scrollbar');
    const l = list?.getBoundingClientRect();
    const sel = q('#bedienfeld button[aria-pressed="true"]');
    const sr = sel?.getBoundingClientRect();
    return {
      vw: innerWidth, vh: innerHeight, scrollW: document.documentElement.scrollWidth,
      header: R(q('header')), stage: R(frame?.parentElement?.parentElement), preview: R(frame), aside: R(q('aside')), panel: R(panel),
      panelScrolls: panel ? panel.scrollHeight - panel.clientHeight : null,
      strip: R(q('ul[aria-label="Geladene Fotos"]')), list: R(list),
      chip: q('button[aria-current="true"]')?.textContent ?? null,
      selected: sel?.getAttribute('data-look') ?? null,
      selectedVisible: !!(sr && l && sr.left >= l.left - 1 && sr.right <= l.right + 1 && sr.top >= l.top - 1 && sr.bottom <= l.bottom + 1),
      strength: R(q('#regler-strength')),
      tilesVisible: [...document.querySelectorAll('#bedienfeld button[data-look]')].filter((b) => { const x = b.getBoundingClientRect(); return l && x.right > l.left && x.left < l.right && x.width > 0; }).length,
    };
  });
const center = async (page, sel) => {
  const r = await page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hitOk: !!hit && (e === hit || e.contains(hit) || hit.contains(e)), hit: hit?.outerHTML.slice(0, 120) };
  }, sel);
  if (!r) throw new Error(`nicht gefunden: ${sel}`);
  if (!r.hitOk) console.log(`WARN verdeckt: ${sel} -> ${r.hit}`);
  return r;
};
const tapSel = async (T, page, sel) => {
  const c = await center(page, sel);
  await T.tap(c.x, c.y);
  return c.hitOk;
};

async function portrait(name, viewport) {
  const { browser, page, T } = await setup(viewport);
  const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png` });
  await shot('01-start');
  note(`${name}-start`, await page.evaluate(() => ({ scrollH: document.querySelector('main')?.scrollHeight, vh: innerHeight, scrollW: document.documentElement.scrollWidth })));
  await (await page.$('#datei-eingabe')).uploadFile(P('DSC04866.JPEG'));
  note(`${name}-ready-ms`, await waitFor(page, ready));
  await sleep(600);
  await shot('02-geladen-tipp');
  note(`${name}-toast-tipp`, await page.evaluate(() => {
    const t = document.querySelector('div[class*="z-[60]"] p');
    const b = t?.closest('[role=status],[role=alert]')?.getBoundingClientRect();
    const f = document.querySelector('[aria-label^="Vorschau"]').getBoundingClientRect();
    return { text: t?.textContent, toast: b && { y: Math.round(b.y), h: Math.round(b.height) }, previewTop: Math.round(f.y) };
  }));
  note(`${name}-tiles`, await quiet(page));
  await shot('03-looks');
  note(`${name}-looks`, await rects(page));

  // Chip „Kodak“ per Tipp
  const t0 = Date.now();
  await tapSel(T, page, '#bedienfeld button:nth-of-type(3)'); // Chips: Fujifilm, Leica, Kodak, Eigene
  await sleep(1000);
  note(`${name}-chip-kodak`, await page.evaluate(() => {
    const list = document.querySelector('#bedienfeld .hide-scrollbar');
    const first = list.querySelector('section[data-cat="kodak"] button');
    return { chip: document.querySelector('button[aria-current="true"]')?.textContent, firstLeft: Math.round(first.getBoundingClientRect().left - list.getBoundingClientRect().left), first: first.getAttribute('data-look') };
  }));
  await shot('04-chip-kodak');
  // Chip „Leica“
  await tapSel(T, page, '#bedienfeld button:nth-of-type(2)');
  await sleep(1000);
  note(`${name}-chip-leica`, await page.evaluate(() => document.querySelector('button[aria-current="true"]')?.textContent));
  await shot('05-chip-leica');
  // Kachel Classic Chrome per Tipp (erst Chip Fujifilm)
  await tapSel(T, page, '#bedienfeld button:nth-of-type(1)');
  await sleep(1000);
  await page.evaluate(() => document.querySelector('button[data-look="Classic Chrome"]')?.scrollIntoView({ inline: 'center' }));
  await sleep(300);
  await tapSel(T, page, 'button[data-look="Classic Chrome"]');
  await sleep(300);
  note(`${name}-cc-chip-auf-bild`, await page.evaluate(() => document.querySelector('[aria-live=polite] span')?.textContent ?? null));
  await shot('06-classic-chrome');
  await sleep(1500);
  note(`${name}-cc`, await rects(page));
  // Stärke per Touch-Zug nach links
  const sl = await page.evaluate(() => {
    const e = document.getElementById('regler-strength');
    const b = e.getBoundingClientRect();
    return { x: b.x, y: b.y + b.height / 2, w: b.width, v: e.value };
  });
  await T.swipe(sl.x + sl.w - 12, sl.y, -Math.round(sl.w * 0.4), 0, 0.4, 8);
  await sleep(600);
  note(`${name}-staerke`, { vorher: sl.v, nachher: await page.$eval('#regler-strength', (e) => e.value), out: await page.$eval('output[for="regler-strength"]', (e) => e.textContent) });
  await shot('07-staerke');
  // Beschreibung aufklappen
  const desc = await page.$('#bedienfeld button[aria-expanded]');
  if (desc) {
    const bb = await desc.boundingBox();
    await T.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await sleep(400);
    note(`${name}-beschreibung`, await page.evaluate(() => {
      const b = document.querySelector('#bedienfeld button[aria-expanded]');
      const p = document.querySelector('#bedienfeld');
      return { expanded: b.getAttribute('aria-expanded'), h: Math.round(b.getBoundingClientRect().height), bottom: Math.round(b.getBoundingClientRect().bottom), panelBottom: Math.round(p.getBoundingClientRect().bottom), panelScroll: p.scrollHeight - p.clientHeight };
    }));
    await shot('08-beschreibung-auf');
    await T.tap(bb.x + bb.width / 2, bb.y + 4);
    await sleep(300);
  }

  // Wischen auf dem Bild
  await quiet(page, 20000);
  const pv = await center(page, '[aria-label^="Vorschau"]');
  const lookBefore = await S(page, (s) => s.getState().photos[0].settings.lookId);
  await T.swipe(pv.x + 80, pv.y, -160);
  await sleep(250);
  const chipSwipe = await page.evaluate(() => document.querySelector('[aria-live=polite] span')?.textContent ?? null);
  await shot('09-wischen');
  await sleep(500);
  note(`${name}-wischen`, { vorher: lookBefore, nachher: await S(page, (s) => s.getState().photos[0].settings.lookId), chip: chipSwipe, ...(await rects(page)) });
  // Zurückwischen
  await T.swipe(pv.x - 80, pv.y, 160);
  await sleep(600);
  note(`${name}-wischen-zurueck`, await S(page, (s) => s.getState().photos[0].settings.lookId));
  // Halten / kurzer Tipp
  await quiet(page, 20000);
  note(`${name}-halten-400ms`, await T.hold(pv.x, pv.y, 400));
  await sleep(300);
  await T.tap(pv.x, pv.y);
  await sleep(100);
  note(`${name}-tipp-label`, await page.evaluate(() => document.querySelector('[aria-live=polite] span')?.textContent ?? null));
  await sleep(500);

  // Anpassen
  await tapSel(T, page, '#tab-anpassen');
  await sleep(700);
  await shot('10-anpassen');
  note(`${name}-anpassen`, await rects(page));
  await page.evaluate(() => document.getElementById('regler-grainEffect')?.scrollIntoView({ block: 'center' }));
  await sleep(300);
  const rad = async (group, label) =>
    page.evaluate((g, l) => {
      const b = [...document.querySelectorAll(`#${g} [role=radio]`)].find((x) => x.textContent.trim() === l);
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, group, label);
  for (const [g, l] of [['regler-grainEffect', 'Stark'], ['regler-grainSize', 'Groß']]) {
    const c = await rad(g, l);
    if (c) await T.tap(c.x, c.y);
    else console.log('WARN kein Segment', g, l);
    await sleep(300);
  }
  await sleep(1200);
  note(`${name}-korn`, await S(page, (s) => { const p = s.getState().photos[0].settings.params; return { grainEffect: p.grainEffect, grainSize: p.grainSize }; }));
  await shot('11-korn-stark');
  // Lupe per Doppeltipp
  await quiet(page, 20000);
  await T.double(pv.x + 30, pv.y - 20);
  const zw = await waitFor(page, () => !!document.querySelector('[aria-label^="Ansicht 100"] canvas') && document.querySelector('[aria-label^="Ansicht 100"] canvas').style.visibility !== 'hidden', 60000);
  note(`${name}-lupe-ms`, zw);
  await sleep(500);
  await shot('12-lupe');
  const lupeGeo = async () => page.evaluate(() => {
    const c = document.querySelector('[aria-label^="Ansicht 100"] canvas');
    return c && { w: c.width, h: c.height, cssW: Math.round(c.getBoundingClientRect().width), tr: c.style.transform };
  });
  note(`${name}-lupe-geo`, await lupeGeo());
  // Verschieben um 200 px nach links
  const zr = await center(page, '[aria-label^="Ansicht 100"]');
  await T.swipe(zr.x + 100, zr.y, -200, 0, 0.5, 8);
  await sleep(200);
  await waitFor(page, () => !document.querySelector('[aria-label^="100 %, zurück"] .animate-spin, [aria-label^="100 %, zurück"] svg'), 30000);
  await sleep(500);
  await shot('13-lupe-verschoben');
  note(`${name}-lupe-geo-verschoben`, await lupeGeo());
  // Halten in der Lupe zeigt nicht das Original (gewollt) – nur protokollieren
  // Tipp auf den Chip „100 %“ -> zurück
  await tapSel(T, page, '[aria-label^="100 %, zurück"]');
  await sleep(800);
  note(`${name}-lupe-aus`, await S(page, (s) => s.getState().zoom));

  // Zurück zu Looks: gewählte Kachel sichtbar?
  await tapSel(T, page, '#tab-looks');
  await sleep(800);
  note(`${name}-looks-zurueck`, await rects(page));
  await shot('14-looks-zurueck');

  // Mehrere Fotos
  await (await page.$('#datei-eingabe')).uploadFile(P('DSC03427.JPEG'), P('DSC01603.JPEG'), P('DSC03982.JPEG'));
  await sleep(1500);
  await shot('15-mehrere');
  await tapSel(T, page, 'button[aria-label^="Foto 2 von 4"]');
  await waitFor(page, ready);
  await quiet(page);
  await shot('16-hochformat');
  note(`${name}-hoch`, await rects(page));
  // Entfernen per × + Rückgängig
  const before = await S(page, (s) => { const st = s.getState(); return { ids: st.photos.map((p) => p.id), active: st.activeId, settings: JSON.stringify(st.photos.map((p) => p.settings)) }; });
  const xOk = await tapSel(T, page, 'button[aria-label="Foto entfernen"]');
  await sleep(500);
  await shot('17-entfernt-toast');
  note(`${name}-entfernt`, { xOk, n: await S(page, (s) => s.getState().photos.length), toast: await page.evaluate(() => document.querySelector('div[class*="z-[60]"]')?.textContent) });
  const undoOk = await tapSel(T, page, 'div[class*="z-[60]"] button:not([aria-label])');
  await sleep(1500);
  const after = await S(page, (s) => { const st = s.getState(); return { ids: st.photos.map((p) => p.id), active: st.activeId, settings: JSON.stringify(st.photos.map((p) => p.settings)) }; });
  note(`${name}-rueckgaengig`, { undoOk, same: JSON.stringify(before) === JSON.stringify(after), imgs: await page.evaluate(() => [...document.querySelectorAll('ul[aria-label="Geladene Fotos"] img')].map((i) => i.complete && i.naturalWidth > 0)) });
  await shot('18-rueckgaengig');
  // Auf alle + Rückgängig
  await tapSel(T, page, 'button[title^="Look und alle Regler"]');
  await sleep(500);
  await shot('19-auf-alle');
  note(`${name}-auf-alle`, await page.evaluate(() => document.querySelector('div[class*="z-[60]"]')?.textContent));
  await tapSel(T, page, 'div[class*="z-[60]"] button:not([aria-label])');
  await sleep(500);
  note(`${name}-auf-alle-undo`, JSON.stringify(before.settings) === JSON.stringify((await S(page, (s) => JSON.stringify(s.getState().photos.map((p) => p.settings))))));

  // Rezept
  await tapSel(T, page, 'button[aria-label="Rezept einfügen"]');
  await page.waitForSelector('#rezept-text');
  await sleep(500);
  await shot('20-rezept');
  await page.evaluate((txt) => {
    const t = document.getElementById('rezept-text');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(t, txt);
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }, RECIPE);
  await page.focus('#rezept-text');
  await sleep(400);
  await shot('21-rezept-text');
  // Tastatur: Chrome Android verkleinert den Layout-Viewport
  await page.setViewport({ ...viewport, height: viewport.height - (viewport.height > 700 ? 336 : 260) });
  await sleep(700);
  await shot('22-rezept-tastatur');
  note(`${name}-rezept-tastatur`, await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Anwenden');
    const r = b.getBoundingClientRect();
    const t = document.getElementById('rezept-text').getBoundingClientRect();
    return { vh: innerHeight, anwenden: { y: Math.round(r.y), bottom: Math.round(r.bottom) }, text: { y: Math.round(t.y), bottom: Math.round(t.bottom) }, sichtbar: r.bottom <= innerHeight && r.top >= 0 };
  }));
  await page.setViewport(viewport);
  await sleep(500);
  // Daneben tippen: bleibt offen (dirty)
  await T.tap(viewport.width / 2, 20);
  await sleep(400);
  note(`${name}-rezept-daneben-offen`, await page.evaluate(() => !!document.querySelector('[role=dialog]')));
  const anw = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Anwenden');
    b.scrollIntoView({ block: 'nearest' });
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await T.tap(anw.x, anw.y);
  await sleep(600);
  note(`${name}-rezept-angewendet`, { toast: await page.evaluate(() => document.querySelector('div[class*="z-[60]"]')?.textContent), look: await S(page, (s) => { const st = s.getState(); const p = st.photos.find((x) => x.id === st.activeId).settings; return { lookId: p.lookId, exposure: p.params.exposure, dr: p.params.dynamicRange }; }) });
  await shot('23-rezept-angewendet');
  await sleep(2500);
  // Export
  await tapSel(T, page, 'header [aria-label="Exportieren"]');
  await page.waitForSelector('[role=dialog]');
  await sleep(400);
  await shot('24-export-wahl');
  note(`${name}-export-scope`, await S(page, (s) => s.getState().export.scope));
  // Nur das aktuelle Foto (schneller)
  await page.evaluate(() => [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.includes('Dieses Foto'))?.click());
  await sleep(200);
  await tapSel(T, page, '[role=dialog] button[type=submit]');
  await sleep(1500);
  await shot('25-export-laeuft');
  note(`${name}-export-titel-laeuft`, await page.evaluate(() => document.title));
  const te = Date.now();
  await waitFor(page, () => /Export (fertig|fehlgeschlagen|abgebrochen)/.test(document.querySelector('[role=dialog] h2')?.textContent ?? ''), 300000);
  note(`${name}-export-ms`, Date.now() - te);
  await sleep(500);
  await shot('26-export-fertig');
  note(`${name}-export-fertig`, await page.evaluate(() => ({ title: document.title, h2: document.querySelector('[role=dialog] h2')?.textContent, buttons: [...document.querySelectorAll('[role=dialog] button')].map((b) => b.textContent.trim()) })));
  const sh = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.includes('Teilen'));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (sh) {
    await T.tap(sh.x, sh.y);
    await sleep(800);
    note(`${name}-geteilt`, await page.evaluate(() => window.__shared));
  }
  await browser.close();
}

async function landscape(name, viewport) {
  const { browser, page, T } = await setup(viewport);
  const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png` });
  await shot('01-start');
  note(`${name}-start`, await page.evaluate(() => ({ scrollH: document.querySelector('main')?.scrollHeight, vh: innerHeight, scrollW: document.documentElement.scrollWidth })));
  await (await page.$('#datei-eingabe')).uploadFile(P('DSC04866.JPEG'), P('DSC03427.JPEG'));
  await waitFor(page, ready);
  await quiet(page);
  await shot('02-looks');
  note(`${name}-looks`, await rects(page));
  await tapSel(T, page, '#bedienfeld button:nth-of-type(3)');
  await sleep(1000);
  note(`${name}-chip-kodak`, await page.evaluate(() => {
    const list = document.querySelector('#bedienfeld .hide-scrollbar');
    const first = list.querySelector('section[data-cat="kodak"] button');
    return { chip: document.querySelector('button[aria-current="true"]')?.textContent, firstTop: Math.round(first.getBoundingClientRect().top - list.getBoundingClientRect().top) };
  }));
  await shot('03-chip-kodak');
  await tapSel(T, page, '#tab-anpassen');
  await sleep(600);
  await shot('04-anpassen');
  note(`${name}-anpassen`, await rects(page));
  // Lupe
  const pv = await center(page, '[aria-label^="Vorschau"]');
  await T.double(pv.x, pv.y);
  note(`${name}-lupe-ms`, await waitFor(page, () => document.querySelector('[aria-label^="Ansicht 100"] canvas')?.style.visibility === '', 60000));
  await sleep(500);
  await shot('05-lupe');
  await T.double(pv.x, pv.y);
  await sleep(600);
  note(`${name}-lupe-aus`, await S(page, (s) => s.getState().zoom));
  // Rezept quer mit Tastatur
  await tapSel(T, page, '#tab-looks');
  await sleep(500);
  await tapSel(T, page, 'button[aria-label="Rezept einfügen"]');
  await page.waitForSelector('#rezept-text');
  await page.evaluate((txt) => {
    const t = document.getElementById('rezept-text');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, txt);
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }, RECIPE);
  await page.focus('#rezept-text');
  await sleep(400);
  await shot('06-rezept');
  await page.setViewport({ ...viewport, height: viewport.height - 180 });
  await sleep(700);
  await shot('07-rezept-tastatur');
  note(`${name}-rezept-tastatur`, await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Anwenden');
    const r = b.getBoundingClientRect();
    const t = document.getElementById('rezept-text').getBoundingClientRect();
    const body = document.querySelector('[role=dialog] .overflow-y-auto').getBoundingClientRect();
    return { vh: innerHeight, anwenden: { y: Math.round(r.y), bottom: Math.round(r.bottom) }, text: { y: Math.round(t.y), bottom: Math.round(t.bottom) }, body: { y: Math.round(body.y), h: Math.round(body.height) }, sichtbar: r.bottom <= innerHeight && r.top >= 0 };
  }));
  await page.setViewport(viewport);
  await sleep(300);
  await page.keyboard.press('Escape');
  await sleep(300);
  await tapSel(T, page, 'header [aria-label="Exportieren"]');
  await page.waitForSelector('[role=dialog]');
  await sleep(400);
  await shot('08-export-wahl');
  note(`${name}-export-dialog`, await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]').getBoundingClientRect();
    const b = document.querySelector('[role=dialog] button[type=submit]').getBoundingClientRect();
    return { d: { y: Math.round(d.y), h: Math.round(d.height) }, submitBottom: Math.round(b.bottom), vh: innerHeight };
  }));
  await browser.close();
}

async function raw(name, viewport) {
  const { browser, page } = await setup(viewport);
  const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png` });
  await (await page.$('#datei-eingabe')).uploadFile(resolve('testbilder/raw/DSC01542.ARW'));
  await sleep(1500);
  await shot('01-raw-laedt');
  await sleep(3800);
  await shot('02-raw-5s');
  note(`${name}-raw-5s`, await page.evaluate(() => document.querySelector('div.absolute[role=status]')?.textContent));
  note(`${name}-raw-ms`, await waitFor(page, ready, 300000));
  await sleep(1500);
  await shot('03-raw-fertig');
  note(`${name}-raw-rects`, await rects(page));
  await browser.close();
}

const PH = { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const SE = { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
try {
  if (PART === 'a') await portrait('p393', PH);
  if (PART === 'b') await portrait('se375', SE);
  if (PART === 'c') {
    await landscape('q852', { width: 852, height: 393, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await landscape('q667', { width: 667, height: 375, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  }
  if (PART === 'd') await raw('raw393', PH);
} catch (e) {
  console.log('ABBRUCH', e.stack);
}
writeFileSync(`${OUT}/report-${PART}.json`, JSON.stringify(report, null, 2));
await server.close();
process.exit(0);
