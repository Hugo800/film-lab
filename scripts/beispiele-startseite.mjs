// Startseite prüfen: node scripts/beispiele-startseite.mjs [393x852 1440x900 …]  (Port TEST_PORT, Vorgabe 5190)
// Je Fenstergröße Bildschirmfotos (erster Bildschirm, Abschnitte, ganze Seite) nach test-output/startseite/ und
// Prüfungen: kein waagerechter Überlauf, keine Engine vor dem Scrollen, Vergleich/Kacheln live gerechnet,
// Teiler ziehen und per Tastatur, Look- und Fotowechsel; bei der ersten Größe zusätzlich Beispielfoto → Editor.
import { mkdirSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const OUT = 'test-output/startseite';
const phone = (width, height, dpr) => ({ width, height, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
const SIZES = {
  '393x852': phone(393, 852, 3),
  '375x667': phone(375, 667, 2),
  '852x393q': phone(852, 393, 3),
  '1440x900': { width: 1440, height: 900, deviceScaleFactor: 1 },
  '1920x1080': { width: 1920, height: 1080, deviceScaleFactor: 1 },
};
const args = process.argv.slice(2);
const wanted = args.length ? args.map((a) => Object.keys(SIZES).find((k) => k.startsWith(a)) ?? a) : Object.keys(SIZES);
for (const w of wanted) if (!SIZES[w]) throw new Error(`Unbekannte Größe ${w}`);
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${msg}`);
  return cond;
};

const server = await startDevServer();

async function run(name, viewport, editor) {
  const t0 = Date.now();
  const { browser, page } = await launch({ viewport, log: false });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  const shot = (n, opts = {}) => page.screenshot({ path: `${OUT}/${name}-${n}.png`, ...opts });
  const wait = (fn, ms = 120_000, ...a) => page.waitForFunction(fn, { timeout: ms, polling: 250 }, ...a).then(() => true, () => false);
  const scrollTo = (sel, block = 'start') => page.evaluate((s, b) => document.querySelector(s)?.scrollIntoView({ block: b }), sel, block);
  const overflow = () => page.evaluate(() => {
    const m = document.querySelector('main');
    return { doc: document.documentElement.scrollWidth - innerWidth, main: m ? m.scrollWidth - m.clientWidth : 0 };
  });
  try {
    await page.goto(`${server.url}/`, { waitUntil: 'networkidle0' });
    await shot('1-start');
    // Ausnahme: das vorab gerechnete Titelbild im Hero (statisch, ohne Engine).
    ok(!requests.some((u) => u.includes('/beispiele/') && !u.includes('/beispiele/titel.jpg')), `${name}: erster Bildschirm ohne Beispielbilder (außer Titelbild)`);
    const ov = await overflow();
    ok(ov.doc <= 0 && ov.main <= 0, `${name}: kein waagerechter Überlauf (Start) ${JSON.stringify(ov)}`);
    const heroFill = await page.evaluate(() => {
      const s = document.querySelector('main > section');
      return s.getBoundingClientRect().height >= innerHeight - 1;
    });
    ok(heroFill, `${name}: Hero füllt den ersten Bildschirm`);

    // Vergleich
    await page.evaluate(() => [...document.querySelectorAll('main > section button')].find((b) => b.textContent.includes('Looks ansehen'))?.click());
    const live = await wait(() => [...document.querySelectorAll('#looks img')].some((i) => i.src.startsWith('blob:') && i.complete && i.naturalWidth > 1000));
    ok(live, `${name}: Vergleich live gerechnet (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    await sleep(900);
    await scrollTo('#looks');
    await sleep(300);
    await shot('2-vergleich');

    // Teiler ziehen (Maus bzw. Touch) und per Tastatur
    await scrollTo('#looks .cursor-ew-resize', 'center');
    await sleep(300);
    const frame = await page.$('#looks [role=slider]');
    const box = await page.evaluate(() => {
      const r = document.querySelector('#looks .cursor-ew-resize, #looks .cursor-grabbing').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const val = () => page.$eval('#looks [role=slider]', (e) => Number(e.getAttribute('aria-valuenow')));
    if (viewport.hasTouch) {
      const y = box.y + box.h * 0.6;
      const cdp = await page.createCDPSession();
      const tp = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await tp('touchStart', box.x + box.w * 0.5);
      for (let i = 1; i <= 8; i++) await tp('touchMove', box.x + box.w * (0.5 - i * 0.04));
      await tp('touchEnd');
    } else {
      await page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.6);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.w * (0.5 - i * 0.04), box.y + box.h * 0.6);
      await page.mouse.up();
    }
    await sleep(200);
    const dragged = await val();
    ok(dragged >= 14 && dragged <= 22, `${name}: Teiler gezogen → ${dragged} %`);
    await frame.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    ok((await val()) === dragged + 10, `${name}: Teiler per Pfeiltaste → ${await val()} %`);
    await page.keyboard.press('End');
    ok((await val()) === 100, `${name}: Ende-Taste → 100 %`);
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    await shot('3-teiler');

    // Look wechseln
    const lookBtn = await page.evaluateHandle(() => [...document.querySelectorAll('#looks button[aria-pressed]')].find((b) => b.textContent.includes('Acros')));
    await lookBtn.click();
    const acros = await wait(() => document.querySelector('#looks .top-3.right-3')?.textContent === 'Acros' &&
      [...document.querySelectorAll('#looks img.ueberblenden')].filter((i) => i.src.startsWith('blob:') && i.naturalWidth > 1000).length >= 1);
    ok(acros, `${name}: Look „Acros“ gewählt`);
    await sleep(1200);
    await shot('4-look-acros');

    // Foto wechseln
    await page.click('#looks button[aria-label="Beispielfoto Nachts"]');
    const night = await wait(() => [...document.querySelectorAll('#looks img')].some((i) => i.src.includes('porsche')) &&
      [...document.querySelectorAll('#looks img.ueberblenden')].some((i) => i.src.startsWith('blob:') && i.naturalWidth > 1000 && i.naturalHeight > i.naturalWidth));
    ok(night, `${name}: Foto „Nachts“ gerechnet`);
    await sleep(1200);
    await scrollTo('#looks .cursor-ew-resize', 'center');
    await sleep(300);
    await shot('5-vergleich-nachts');
    await page.click('#looks button[aria-label="Beispielfoto Klippen"]');

    // Übersicht: Kacheln lazy beim Scrollen
    await scrollTo('#marke-looks');
    const tiles = await wait(() => document.querySelectorAll('#marke-looks img[src^="blob:"]').length >= 4, 300_000);
    ok(tiles, `${name}: Look-Kacheln gerechnet`);
    // durch die Seite scrollen, damit alles einblendet und rechnet
    for (let y = 0; ; y += 400) {
      const done = await page.evaluate((v) => {
        const m = document.querySelector('main');
        m.scrollTop = v;
        return m.scrollTop + m.clientHeight >= m.scrollHeight - 2;
      }, y);
      await sleep(120);
      if (done) break;
    }
    await wait(() => document.querySelectorAll('#marke-looks img[src^="blob:"]').length >= document.querySelectorAll('#marke-looks > div').length, 180_000);
    await scrollTo('#alle-looks');
    await sleep(800);
    await shot('6-uebersicht');
    await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.startsWith('Kodak'))?.click());
    await sleep(300);
    for (let y = 0; y < 6; y++) {
      await page.evaluate(() => document.querySelector('main').scrollBy(0, 300));
      await sleep(100);
    }
    await wait(() => document.querySelectorAll('#marke-looks img[src^="blob:"]').length >= document.querySelectorAll('#marke-looks > div').length, 180_000);
    await scrollTo('#marke-looks');
    await sleep(600);
    await shot('7-kodak');
    await scrollTo('#funktionen-titel');
    await sleep(900);
    await shot('8-funktionen');
    await scrollTo('#rezept-titel');
    await wait(() => [...document.querySelectorAll('section[aria-labelledby=rezept-titel] img')].some((i) => i.src.startsWith('blob:') && i.naturalWidth > 0));
    await sleep(900);
    await shot('9-rezept');
    await page.evaluate(() => { const m = document.querySelector('main'); m.scrollTop = m.scrollHeight; });
    await sleep(900);
    await shot('10-ende');
    const ov2 = await overflow();
    ok(ov2.doc <= 0 && ov2.main <= 0, `${name}: kein waagerechter Überlauf (ganze Seite) ${JSON.stringify(ov2)}`);

    // Ganze Seite: Scrollbereich aufklappen und das Fenster so hoch wie die Seite machen (1x, sonst zu groß).
    const full = await page.evaluate(() => {
      const h = innerHeight;
      for (const el of [document.documentElement, document.body, document.getElementById('root'), document.querySelector('main')]) {
        el.style.height = 'auto';
        el.style.overflow = 'visible';
      }
      document.querySelector('main > section').style.minHeight = `${h}px`;
      return document.documentElement.scrollHeight;
    });
    await page.setViewport({ ...viewport, height: full, deviceScaleFactor: 1 });
    await sleep(1500);
    await shot('0-ganz');
    await page.setViewport(viewport);
    await page.evaluate(() => {
      for (const el of [document.documentElement, document.body, document.getElementById('root'), document.querySelector('main')]) {
        el.style.height = '';
        el.style.overflow = '';
      }
      document.querySelector('main > section').style.minHeight = '';
    });
    await sleep(300);

    if (editor) {
      await page.evaluate(() => { document.querySelector('main').scrollTop = document.querySelector('main').scrollHeight; });
      await sleep(300);
      await page.evaluate(() => [...document.querySelectorAll('main button')].reverse().find((b) => b.textContent.includes('Mit Beispielfoto ausprobieren'))?.click());
      const inEditor = await wait(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
      ok(inEditor, `${name}: Beispielfoto → Editor`);
      // Der im Vergleich gewählte Look (Acros) kommt mit.
      ok(await wait(() => document.body.innerText.includes('Acros'), 10_000), `${name}: Editor übernimmt den Look „Acros“`);
      await sleep(1500);
      await shot('11-editor');
    }
    ok(errors.length === 0, `${name}: keine Konsolenfehler${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  } catch (err) {
    ok(false, `${name}: Ausnahme ${err.stack ?? err}`);
    await shot('fehler').catch(() => {});
  } finally {
    await browser.close();
  }
  console.log(`(${name}: ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

try {
  for (const [i, w] of wanted.entries()) await run(w, SIZES[w], i === 0);
} finally {
  await server.close();
}
console.log(fails ? `\n${fails} FEHLER` : '\nalles OK');
process.exit(fails ? 1 : 0);
