// Startseite prüfen: node scripts/beispiele-startseite.mjs [393x852 1440x900 …]  (Port TEST_PORT, Vorgabe 5190)
// Je Fenstergröße Bildschirmfotos (erster Bildschirm, Abschnitte, ganze Seite) nach test-output/startseite/ und
// Prüfungen: kein waagerechter Überlauf, keine Engine vor dem Scrollen, Vergleich/Kacheln live gerechnet,
// Teiler ziehen und per Tastatur, Look- und Fotowechsel; bei der ersten Größe zusätzlich Beispielfoto → Editor.
import { mkdirSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const OUT = 'test-output/startseite';
const OUT_RAD = 'test-output/look-rad';
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
mkdirSync(OUT_RAD, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${msg}`);
  return cond;
};

/** Zustand des Look-Rads: aktiver Index, Anzahl, stetige Lage, Abstand Abschnitt ↔ Oberkante von <main>, Scrollstand. */
const radZustand = (page) =>
  page.evaluate(() => {
    const rad = document.getElementById('look-rad');
    const opts = [...rad.querySelectorAll('[role=option]')];
    const sec = document.getElementById('alle-looks');
    const main = document.querySelector('main');
    const id = rad.getAttribute('aria-activedescendant');
    return {
      i: opts.findIndex((o) => o.id === id),
      n: opts.length,
      name: document.getElementById(id)?.getAttribute('aria-label'),
      pos: Number(rad.dataset.pos),
      top: Math.round(sec.getBoundingClientRect().top - main.getBoundingClientRect().top),
      scroll: Math.round(main.scrollTop),
    };
  });
/** Rechteck (Mitte, Höhe) der Schachtel mit Index i. */
const radBox = (page, i) =>
  page.evaluate((k) => {
    const o = document.querySelectorAll('#look-rad [role=option]')[k];
    if (!o || o.style.display === 'none') return null;
    const r = o.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: o.offsetHeight };
  }, i);
/** Hintergrund zeigt den aktiven Look (gerechnet, geladen). */
const radBildFertig = () => [...document.querySelectorAll('#alle-looks img.rad-hg')].some((i) => i.alt && i.complete && i.naturalWidth > 0 && i.src.startsWith('blob:'));
const scrollMainTo = (page, top) => page.evaluate((t) => (document.querySelector('main').scrollTop = t), top);
const sectionTop = (page) => page.evaluate(() => document.getElementById('alle-looks').offsetTop);

/** Abschnitt bündig an den Bildschirm (ein Wisch-Schwung kann nachlaufen). */
const ausrichten = async (page) => {
  await page.evaluate(() => document.getElementById('alle-looks').scrollIntoView());
  await sleep(300);
  await page.evaluate(() => document.getElementById('alle-looks').scrollIntoView());
};

async function radPruefen(page, name, viewport, { shotRad, wait, cdpTouch }) {
  const touch = !!viewport.hasTouch;
  const H = viewport.height;
  const W = viewport.width;
  await page.evaluate(() => document.getElementById('alle-looks').scrollIntoView());
  ok(await wait(radBildFertig, 300_000), `${name}: Look-Rad: Hintergrund live gerechnet`);
  ok(await wait(() => [...document.querySelectorAll('#look-rad .schachtel-fenster img[src^="blob:"]')].filter((i) => i.complete && i.naturalWidth > 0).length >= 7, 300_000),
    `${name}: Look-Rad: Sichtfenster der Schachteln gerechnet`);
  const s0 = await radZustand(page);
  ok(s0.top === 0 && s0.n === 20, `${name}: Look-Rad bildschirmfüllend, Fujifilm mit ${s0.n} Schachteln (${s0.name})`);
  const fill = await page.evaluate(() => {
    const r = document.getElementById('alle-looks').getBoundingClientRect();
    return Math.round(r.height) === innerHeight && Math.round(r.width) === innerWidth;
  });
  ok(fill, `${name}: Look-Rad füllt den Bildschirm`);
  // Schachteln: Namen nicht abgeschnitten, nahe Schachteln deckend (blasser nur durch Abdunkeln, kein Glas).
  const karton = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('#look-rad .rad-box')].filter((b) => b.style.display !== 'none');
    const pos = Number(document.getElementById('look-rad').dataset.pos);
    return {
      zuLang: boxes.map((b) => b.querySelector('.schachtel-name')).filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent),
      durchsichtig: boxes.filter((b) => Math.abs(Number(b.dataset.i) - pos) <= 3 && getComputedStyle(b).opacity !== '1').length,
    };
  });
  ok(karton.zuLang.length === 0 && karton.durchsichtig === 0, `${name}: Namen passen auf die Schachteln, nahe Schachteln deckend ${JSON.stringify(karton)}`);
  // Bogen: mittlere Schachtel ragt am weitesten nach links, Nachbarn weichen nach rechts zurück; alles rechts der Mitte.
  const boxes = await Promise.all([-2, -1, 0, 1, 2].map((d) => radBox(page, s0.i + d)));
  const xs = boxes.map((b) => b?.x ?? Infinity);
  ok(xs[2] < xs[1] && xs[2] < xs[3] && xs[1] < xs[0] && xs[3] < xs[4] && xs[2] > W / 2, `${name}: Schachteln auf dem Bogen am rechten Rand (x ${xs.map(Math.round).join(', ')})`);
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 }).catch(() => {});
  await sleep(800);
  await shotRad('1-rad');

  // Zwischenzustand mitten in einer Drehung (Finger bzw. Maus hält das Rad zwischen zwei Looks), dann loslassen.
  const b0 = await radBox(page, s0.i);
  const schritt = b0.h * 1.1;
  const x = b0.x + 10;
  if (touch) {
    const ts = Date.now() / 1000;
    await cdpTouch('touchStart', [{ x, y: b0.y }], ts);
    for (let k = 1; k <= 8; k++) await cdpTouch('touchMove', [{ x, y: b0.y - (schritt * 2.5 * k) / 8 }], ts + k * 0.016);
    await sleep(300);
    await shotRad('2-drehung');
    const mid = await radZustand(page);
    ok(Math.abs(mid.pos - (s0.i + 2.5)) < 0.3, `${name}: Wischen auf dem Bogen dreht stetig mit (pos ${mid.pos})`);
    // Ruhig halten (kein Schwung), dann loslassen: rastet auf einen ganzen Index ein.
    await cdpTouch('touchMove', [{ x, y: b0.y - schritt * 2.4 }], ts + 0.4);
    await cdpTouch('touchMove', [{ x, y: b0.y - schritt * 2.4 }], ts + 0.55);
    await cdpTouch('touchEnd', [], ts + 0.56);
  } else {
    await page.mouse.move(x, b0.y);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(x, b0.y - (schritt * 2.5 * k) / 8);
    await sleep(300);
    await shotRad('2-drehung');
    const mid = await radZustand(page);
    ok(Math.abs(mid.pos - (s0.i + 2.5)) < 0.3, `${name}: Ziehen auf dem Bogen dreht stetig mit (pos ${mid.pos})`);
    await page.mouse.move(x, b0.y - schritt * 2.4);
    await sleep(200);
    await page.mouse.move(x, b0.y - schritt * 2.4);
    await page.mouse.up();
  }
  const settled = await wait((i) => {
    const r = document.getElementById('look-rad');
    return Number(r.dataset.pos) === i;
  }, 90_000, s0.i + 2);
  const s1 = await radZustand(page);
  ok(settled && s1.i === s0.i + 2, `${name}: Drehung rastet auf ganzen Look ein (${s0.i} → ${s1.i}, ${s1.name})`);

  // Antippen bzw. Klicken einer Schachtel holt sie in die Mitte.
  const nb = await radBox(page, s1.i + 1);
  if (touch) {
    await cdpTouch('touchStart', [{ x: nb.x, y: nb.y }]);
    await cdpTouch('touchEnd', []);
  } else await page.mouse.click(nb.x, nb.y);
  ok(await wait((i) => Number(document.getElementById('look-rad').dataset.pos) === i, 90_000, s1.i + 1), `${name}: Antippen holt die Schachtel in die Mitte`);

  // Tastatur: ↓, ↑, Pos1, Ende; Name per aria-live.
  await page.focus('#look-rad');
  await page.keyboard.press('ArrowDown');
  const k1 = await radZustand(page);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  const k2 = await radZustand(page);
  await page.keyboard.press('End');
  const k3 = await radZustand(page);
  await page.keyboard.press('Home');
  const k4 = await radZustand(page);
  const live = await page.evaluate(() => document.querySelector('#alle-looks [aria-live]')?.textContent);
  ok(k1.i === s1.i + 2 && k2.i === s1.i && k3.i === k3.n - 1 && k4.i === 0 && live?.startsWith(k4.name), `${name}: Tastatur ↓ ↑ Ende Pos1 (${k1.i}, ${k2.i}, ${k3.i}, ${k4.i}), angesagt „${live}“`);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');

  if (!touch) {
    // Mausrad über dem Abschnitt: rastet erst ein, dreht dann; an den Enden frei; außerhalb normales Scrollen.
    const top = await sectionTop(page);
    const wheelAt = async (y, dy) => {
      await page.mouse.move(W * 0.3, y);
      await page.mouse.wheel({ deltaY: dy });
      await sleep(450);
    };
    await wait(() => Number(document.getElementById('look-rad').dataset.pos) === 3, 10_000);
    await scrollMainTo(page, top - Math.round(H * 0.4));
    await sleep(300);
    await wheelAt(H * 0.7, 100);
    await wait(() => Math.abs(document.getElementById('alle-looks').getBoundingClientRect().top - document.querySelector('main').getBoundingClientRect().top) < 2, 5000);
    const w1 = await radZustand(page);
    ok(w1.top === 0 && w1.i === 3, `${name}: Mausrad über dem Abschnitt rastet zuerst ein (Abstand ${w1.top}, Look ${w1.i})`);
    await wheelAt(H * 0.5, 100);
    await wheelAt(H * 0.5, 100);
    const w2 = await radZustand(page);
    // Vor dem Trackpad-Test ruhen lassen: Hintergrund und Nachbarn sind gerechnet (SwiftShader blockiert sonst die Seite).
    await wait(radBildFertig, 300_000);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 }).catch(() => {});
    await sleep(4000);
    ok(w2.i === 5 && w2.top === 0, `${name}: Mausrad dreht das Rad (3 → ${w2.i}), Seite bleibt stehen`);
    // Trackpad: viele kleine Schritte, nicht zu empfindlich.
    for (let k = 0; k < 6; k++) {
      await page.mouse.wheel({ deltaY: 12 });
      await sleep(30);
    }
    await sleep(400);
    const w3 = await radZustand(page);
    ok(w3.i - w2.i === 1 && w3.top === 0, `${name}: Trackpad-Deltas (6 × 12 px) ergeben einen Schritt (${w2.i} → ${w3.i})`);
    await shotRad('3-mausrad');
    // Ende: am letzten Look gibt das Rad nach unten frei.
    await page.focus('#look-rad');
    await page.keyboard.press('End');
    await sleep(600);
    await wheelAt(H * 0.5, 100);
    const w4 = await radZustand(page);
    ok(w4.i === w4.n - 1 && w4.scroll > top, `${name}: am letzten Look scrollt das Mausrad die Seite weiter (${w4.scroll - top} px)`);
    await wheelAt(H * 0.5, 100);
    ok((await radZustand(page)).scroll > w4.scroll, `${name}: weiter nach unten bleibt nicht hängen`);
    // Schneller Takt (120 ms, keine Pause): am Ende gibt das Rad nach spätestens ~0,5 s frei.
    await scrollMainTo(page, top);
    await page.focus('#look-rad');
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowUp');
    await sleep(600);
    await page.mouse.move(W * 0.3, H * 0.5);
    for (let k = 0; k < 14; k++) {
      await page.mouse.wheel({ deltaY: 100 });
      await sleep(120);
    }
    await sleep(400);
    const w4b = await radZustand(page);
    ok(w4b.i === w4b.n - 1 && w4b.scroll > top, `${name}: Mausrad im schnellen Takt bleibt am Ende nicht hängen (${w4b.scroll - top} px)`);
    // Anfang: am ersten Look gibt das Rad nach oben frei.
    await scrollMainTo(page, top);
    await page.focus('#look-rad');
    await page.keyboard.press('Home');
    await sleep(600);
    await wheelAt(H * 0.5, -100);
    const w5 = await radZustand(page);
    ok(w5.i === 0 && w5.scroll < top, `${name}: am ersten Look scrollt das Mausrad die Seite nach oben (${w5.scroll - top} px)`);
    // Zeiger außerhalb (über dem Vergleich): normales Scrollen, das Rad bleibt.
    await scrollMainTo(page, top - Math.round(H * 0.8));
    await sleep(300);
    const before = await radZustand(page);
    await wheelAt(H * 0.1, 100);
    const after = await radZustand(page);
    ok(after.scroll - before.scroll >= 90 && after.i === before.i, `${name}: Mausrad außerhalb scrollt normal (${after.scroll - before.scroll} px)`);
    // prefers-reduced-motion: sofort umschalten, ohne Bewegung.
    await scrollMainTo(page, top);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.focus('#look-rad');
    await page.keyboard.press('ArrowDown');
    const rm = await radZustand(page);
    ok(rm.pos === rm.i && rm.i === 1, `${name}: reduzierte Bewegung schaltet sofort um (pos ${rm.pos})`);
    await page.emulateMediaFeatures([]);
  } else {
    // Wischen neben dem Bogen scrollt die Seite.
    const top = await sectionTop(page);
    await scrollMainTo(page, top);
    await sleep(300);
    const before = await radZustand(page);
    const ts = Date.now() / 1000;
    let done = await cdpTouch('touchStart', [{ x: W * 0.2, y: H * 0.45 }], ts);
    for (let k = 1; k <= 6 && done; k++) done = await cdpTouch('touchMove', [{ x: W * 0.2, y: H * 0.45 - k * 30 }], ts + k * 0.016);
    if (done) done = await cdpTouch('touchEnd', [], ts + 0.12);
    await sleep(1500);
    const after = await radZustand(page);
    ok(done && after.scroll > before.scroll && after.i === before.i, `${name}: Wischen neben dem Bogen scrollt die Seite (${after.scroll - before.scroll} px)`);
    await scrollMainTo(page, top);
    await sleep(300);
  }

  // Gedrückthalten auf dem Bild zeigt das Original.
  await ausrichten(page);
  await sleep(500);
  const pt = await page.evaluate(() => {
    const sec = document.getElementById('alle-looks');
    const r = sec.getBoundingClientRect();
    for (const [fx, fy] of [[0.25, 0.4], [0.2, 0.3], [0.35, 0.5]]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      const el = document.elementFromPoint(x, y);
      if (el && sec.contains(el) && !el.closest('#look-rad, button, [role=tablist]')) return { x, y };
    }
    return null;
  });
  const peek = () => page.evaluate(() => [...document.querySelectorAll('#alle-looks span')].some((s) => s.textContent === 'Original'));
  if (touch) await cdpTouch('touchStart', [{ x: pt.x, y: pt.y }]);
  else {
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
  }
  const shown = await wait(() => [...document.querySelectorAll('#alle-looks span')].some((s) => s.textContent === 'Original'), 10_000);
  await sleep(300);
  await shotRad('4-original');
  if (touch) await cdpTouch('touchEnd', []);
  else await page.mouse.up();
  await sleep(300);
  ok(shown && !(await peek()), `${name}: Gedrückthalten zeigt das Original, Loslassen den Look`);

  // Markenwechsel: Kodak, eigenes Rad.
  await page.evaluate(() => [...document.querySelectorAll('#alle-looks [role=tab]')].find((b) => b.textContent.startsWith('Kodak'))?.click());
  const kodak = await wait(() => document.querySelectorAll('#look-rad [role=option]').length === 17 && document.getElementById('look-rad').getAttribute('aria-activedescendant')?.startsWith('rad-kodak'), 10_000);
  ok(kodak && (await wait(radBildFertig, 300_000)), `${name}: Marke Kodak mit eigenem Rad (17 Schachteln)`);
  await wait(() => [...document.querySelectorAll('#look-rad .schachtel-fenster img[src^="blob:"]')].filter((i) => i.complete && i.naturalWidth > 0).length >= 6, 300_000);
  await sleep(900);
  await ausrichten(page);
  await shotRad('5-kodak');
  // Marken-Schalter per Tastatur: Pfeil links von Kodak → Leica, Fokus wandert mit.
  await page.focus('#rad-marke-kodak');
  await page.keyboard.press('ArrowLeft');
  const leicaFokus = await page.evaluate(() => document.activeElement?.id === 'rad-marke-leica' && document.activeElement.getAttribute('aria-selected') === 'true');
  ok(leicaFokus && (await wait(() => document.querySelectorAll('#look-rad [role=option]').length === 18, 10_000)) && (await wait(radBildFertig, 300_000)), `${name}: Marke Leica per Pfeiltaste (18 Schachteln)`);
  await wait(() => [...document.querySelectorAll('#look-rad .schachtel-fenster img[src^="blob:"]')].filter((i) => i.complete && i.naturalWidth > 0).length >= 6, 300_000);
  await sleep(900);
  await ausrichten(page);
  await shotRad('6-leica');

  // Fotowechsel: „Nachts“.
  await page.click('#alle-looks button[aria-label="Beispielfoto Nachts"]');
  const nacht = await wait(() => [...document.querySelectorAll('#alle-looks img.rad-hg')].some((i) => i.alt.includes('Nachts') && i.complete && i.naturalWidth > 0), 300_000);
  ok(nacht, `${name}: Foto „Nachts“ im Look-Rad gerechnet`);
  await wait(() => [...document.querySelectorAll('#look-rad .schachtel-fenster img[src^="blob:"]')].filter((i) => i.complete && i.naturalWidth > 0).length >= 6, 300_000);
  await sleep(900);
  await ausrichten(page);
  await shotRad('7-nachts');
  await page.evaluate(() => [...document.querySelectorAll('#alle-looks [role=tab]')].find((b) => b.textContent.startsWith('Fujifilm'))?.click());
  await page.click('#alle-looks button[aria-label="Beispielfoto Klippen"]');
  await wait(radBildFertig, 300_000);
}

const server = await startDevServer();

async function run(name, viewport, editor, radEditor) {
  const t0 = Date.now();
  const { browser, page } = await launch({ viewport, log: false });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  const shot = (n, opts = {}) => page.screenshot({ path: `${OUT}/${name}-${n}.png`, ...opts });
  const shotRad = (n) => page.screenshot({ path: `${OUT_RAD}/${name}-${n}.png` });
  let cdp = null;
  // Touch per CDP; jeder Befehl mit Frist (eine scrollende Wischgeste kann ihn sonst hängen lassen).
  const cdpTouch = async (type, pts, timestamp) => {
    cdp ??= await page.createCDPSession();
    const p = cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts, ...(timestamp ? { timestamp } : {}) });
    return Promise.race([p.then(() => true), sleep(20_000).then(() => false)]);
  };
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
    const night = await wait(() => [...document.querySelectorAll('#looks img')].some((i) => i.src.includes('skyline')) &&
      [...document.querySelectorAll('#looks img.ueberblenden')].some((i) => i.src.startsWith('blob:') && i.naturalWidth > 1000 && i.naturalWidth > 1.7 * i.naturalHeight));
    ok(night, `${name}: Foto „Nachts“ gerechnet`);
    await sleep(1200);
    await scrollTo('#looks .cursor-ew-resize', 'center');
    await sleep(300);
    await shot('5-vergleich-nachts');
    await page.click('#looks button[aria-label="Beispielfoto Klippen"]');

    // Look-Rad (Vollbild, Filmschachteln auf dem Bogen): Bildschirmfotos nach test-output/look-rad/
    await radPruefen(page, name, viewport, { shotRad, wait, cdpTouch });
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
      document.getElementById('alle-looks').style.height = `${h}px`;
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
      document.getElementById('alle-looks').style.height = '';
    });
    await sleep(300);

    if (radEditor) {
      // Enter auf dem Rad öffnet den Editor mit Foto und aktivem Look.
      await page.evaluate(() => document.getElementById('alle-looks').scrollIntoView());
      await sleep(300);
      const look = await page.evaluate(() => document.getElementById(document.getElementById('look-rad').getAttribute('aria-activedescendant')).getAttribute('aria-label'));
      await page.focus('#look-rad');
      await page.keyboard.press('Enter');
      const inEditor = await wait(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
      ok(inEditor && (await wait((n) => document.body.innerText.includes(n), 10_000, look)), `${name}: Enter auf dem Rad → Editor mit „${look}“`);
      await sleep(1500);
      await shotRad('9-editor');
    }
    if (editor && !radEditor) {
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
  for (const [i, w] of wanted.entries()) await run(w, SIZES[w], i === 0, w === '1440x900');
} finally {
  await server.close();
}
console.log(fails ? `\n${fails} FEHLER` : '\nalles OK');
process.exit(fails ? 1 : 0);
