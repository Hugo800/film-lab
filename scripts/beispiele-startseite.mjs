// Startseite prüfen: node scripts/beispiele-startseite.mjs [393x852 1440x900 …]  (Port TEST_PORT, Vorgabe 5190)
// Je Fenstergröße Bildschirmfotos (erster Bildschirm, Abschnitte, ganze Seite) nach test-output/startseite/ und
// Prüfungen: kein waagerechter Überlauf, keine Engine vor dem Scrollen, Titelbild in der Fassung des Bildschirms,
// Knöpfe im ersten Bildschirm, Look-Rad und Rezept live gerechnet, Fassung der Fotos (hochkant/quer), „Jetzt
// hinzufügen“ öffnet die Anleitung (Handy mit iPhone-Kennung: Safari-Schritte); bei der ersten Größe zusätzlich
// Beispielfoto → Editor (lädt die große Fassung aus beispiele/gross/).
import { mkdirSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const OUT = 'test-output/startseite';
const OUT_RAD = 'test-output/look-rad';
const phone = (width, height, dpr) => ({ width, height, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
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

/** Zustand des Look-Rads: aktiver Index, Anzahl, stetige Lage, Kachel ganz im Bild, Überschrift im Bild, Scrollstand. */
const radZustand = (page) =>
  page.evaluate(() => {
    const rad = document.getElementById('look-rad');
    const opts = [...rad.querySelectorAll('[role=option]')];
    const main = document.querySelector('main');
    const m = main.getBoundingClientRect();
    const k = document.getElementById('rad-kachel').getBoundingClientRect();
    const id = rad.getAttribute('aria-activedescendant');
    return {
      i: opts.findIndex((o) => o.id === id),
      n: opts.length,
      name: document.getElementById(id)?.getAttribute('aria-label'),
      pos: Number(rad.dataset.pos),
      ganz: k.top >= m.top - 1 && k.bottom <= m.bottom + 1,
      titel: document.getElementById('rad-titel').getBoundingClientRect().top >= m.top - 1,
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
/** Rechteck der Look-Kachel im Fenster. */
const kachelRect = (page) =>
  page.evaluate(() => {
    const r = document.getElementById('rad-kachel').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
/** Hintergrund zeigt den aktiven Look (gerechnet, geladen). */
const radBildFertig = () => [...document.querySelectorAll('#alle-looks img.rad-hg')].some((i) => i.alt && i.complete && i.naturalWidth > 0 && i.src.startsWith('blob:'));
const scrollMainTo = (page, top) => page.evaluate((t) => (document.querySelector('main').scrollTop = t), top);

/**
 * Kachel so ins Bild wie beim Einrasten: mittig, samt Überschrift bzw. Bedienung, soweit sie hineinpassen (ein
 * Wisch-Schwung kann nachlaufen, deshalb zweimal). Gibt den Scrollstand zurück.
 */
const ausrichten = async (page) => {
  const mitte = () =>
    page.evaluate(() => {
      const main = document.querySelector('main');
      const kachel = document.getElementById('rad-kachel');
      const buehne = kachel.parentElement;
      const m = main.getBoundingClientRect();
      const el = [buehne.parentElement, buehne].find((x) => x.offsetHeight <= m.height - 16) ?? kachel;
      const r = el.getBoundingClientRect();
      main.scrollTop += Math.round(r.top - m.top - (m.height - r.height) / 2);
      return Math.round(main.scrollTop);
    });
  await mitte();
  await sleep(300);
  return mitte();
};

async function radPruefen(page, name, viewport, { shotRad, wait, cdpTouch }) {
  const touch = !!viewport.hasTouch;
  const H = viewport.height;
  const W = viewport.width;
  await page.evaluate(() => document.getElementById('alle-looks').scrollIntoView());
  ok(await wait(radBildFertig, 300_000), `${name}: Look-Rad: Hintergrund live gerechnet`);
  ok(await wait(() => [...document.querySelectorAll('#look-rad .schachtel-fenster img[src^="blob:"]')].filter((i) => i.complete && i.naturalWidth > 0).length >= 5, 300_000),
    `${name}: Look-Rad: Sichtfenster der Schachteln gerechnet`);
  await ausrichten(page);
  const s0 = await radZustand(page);
  ok(s0.ganz && s0.n === 20, `${name}: Look-Kachel ganz im Bild, Fujifilm mit ${s0.n} Schachteln (${s0.name})`);
  // Kachel statt Vollbild: festes Format, höhenbegrenzt, mit Kopf (ab dem Filmrand) im Bild; Breite wie die Bühne.
  const masse = await page.evaluate(() => {
    const kachel = document.getElementById('rad-kachel');
    const k = kachel.getBoundingClientRect();
    const kopf = document.getElementById('rad-titel').closest('.einblenden').getBoundingClientRect();
    return { w: Math.round(k.width), h: Math.round(k.height), mitKopf: Math.round(k.bottom - kopf.top), buehne: Math.round(kachel.parentElement.getBoundingClientRect().width) };
  });
  const format = masse.w / masse.h;
  const flach = H <= 520;
  const formatOk = flach ? Math.abs(format - 2) < 0.02 : W < 640 ? format >= 0.79 && format <= 0.9 && masse.w === W - 40 : Math.abs(format - 1.5) < 0.02 && masse.w === masse.buehne;
  ok(formatOk && masse.h <= H - 80 && (flach || masse.mitKopf <= H),
    `${name}: Kachel ${masse.w}×${masse.h} (${format.toFixed(2)}), nicht bildschirmfüllend${flach ? '' : `, mit Überschrift ${masse.mitKopf} px ≤ ${H}`}`);
  // Schachteln: Namen nicht abgeschnitten, nahe Schachteln deckend (blasser nur durch Abdunkeln, kein Glas), Name der
  // mittleren Schachtel mindestens 9 px.
  const karton = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('#look-rad .rad-box')].filter((b) => b.style.display !== 'none');
    const pos = Number(document.getElementById('look-rad').dataset.pos);
    return {
      zuLang: boxes.map((b) => b.querySelector('.schachtel-name')).filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent),
      durchsichtig: boxes.filter((b) => Math.abs(Number(b.dataset.i) - pos) <= 3 && getComputedStyle(b).opacity !== '1').length,
      namePx: parseFloat(getComputedStyle(document.querySelector('#look-rad [aria-selected=true] .schachtel-name')).fontSize),
    };
  });
  ok(karton.zuLang.length === 0 && karton.durchsichtig === 0 && karton.namePx >= 9, `${name}: Namen passen auf die Schachteln, nahe Schachteln deckend ${JSON.stringify(karton)}`);
  // Bogen in der Kachel: mittlere Schachtel ragt am weitesten nach links, Nachbarn weichen nach rechts zurück; alles in
  // der rechten Hälfte, bis ±2 rechts nicht aus der Kachel.
  const kr = await kachelRect(page);
  const boxes = await Promise.all([-2, -1, 0, 1, 2].map((d) => radBox(page, s0.i + d)));
  const xs = boxes.map((b) => b?.x ?? Infinity);
  const rechts = await page.evaluate((i0) => {
    const k = document.getElementById('rad-kachel').getBoundingClientRect();
    const opts = document.querySelectorAll('#look-rad [role=option]');
    return Math.max(...[-2, -1, 0, 1, 2].map((d) => opts[i0 + d].querySelector('.schachtel-karton').getBoundingClientRect().right - k.right));
  }, s0.i);
  ok(xs[2] < xs[1] && xs[2] < xs[3] && xs[1] < xs[0] && xs[3] < xs[4] && xs[2] > kr.x + kr.w / 2 && rechts <= 1,
    `${name}: Schachteln auf dem Bogen am rechten Kachelrand (x ${xs.map((v) => Math.round(v - kr.x)).join(', ')} von ${Math.round(kr.w)}, rechts ${Math.round(rechts)} px)`);
  // Name, Beschreibung und Knopf unten links in der Kachel, ohne Überlappung mit sichtbaren Schachteln.
  const text = await page.evaluate(() => {
    const k = document.getElementById('rad-kachel');
    const kr = k.getBoundingClientRect();
    const knopf = [...k.querySelectorAll('button')].find((b) => b.textContent.includes('Diesen Look ausprobieren'));
    const teile = [...knopf.parentElement.children].map((c) => c.getBoundingClientRect());
    const boxen = [...k.querySelectorAll('.rad-box')]
      .filter((b) => b.style.display !== 'none' && Number(getComputedStyle(b).opacity) > 0.3)
      .map((b) => b.querySelector('.schachtel-karton').getBoundingClientRect());
    let ueber = 0;
    for (const t of teile) for (const b of boxen) if (t.left < b.right && b.left < t.right && t.top < b.bottom && b.top < t.bottom) ueber++;
    const innen = teile.every((t) => t.left >= kr.left && t.top >= kr.top && t.bottom <= kr.bottom && t.right <= kr.right);
    return { ueber, innen, unten: Math.round(kr.bottom - knopf.getBoundingClientRect().bottom), links: Math.round(knopf.getBoundingClientRect().left - kr.left) };
  });
  ok(text.ueber === 0 && text.innen && text.unten <= 32 && text.links <= 32, `${name}: Text unten links in der Kachel, keine Überlappung mit Schachteln ${JSON.stringify(text)}`);
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
    // Mausrad über der Kachel: rastet erst ein, dreht dann; an den Enden frei; außerhalb normales Scrollen.
    const wheelAt = async (x, y, dy) => {
      await page.mouse.move(x, y);
      await page.mouse.wheel({ deltaY: dy });
      await sleep(450);
    };
    const ganz = () => {
      const k = document.getElementById('rad-kachel').getBoundingClientRect();
      const m = document.querySelector('main').getBoundingClientRect();
      return k.top >= m.top - 1 && k.bottom <= m.bottom + 1;
    };
    await wait(() => Number(document.getElementById('look-rad').dataset.pos) === 3, 10_000);
    const top = await ausrichten(page);
    // Kachel unten angeschnitten, Zeiger über ihrem sichtbaren Teil.
    await scrollMainTo(page, top - Math.round(H * 0.35));
    await sleep(300);
    let k = await kachelRect(page);
    await wheelAt(k.x + k.w * 0.3, (k.y + H) / 2, 100);
    await wait(ganz, 5000);
    await sleep(600);
    const w1 = await radZustand(page);
    ok(w1.ganz && w1.i === 3 && (H <= 520 || w1.titel), `${name}: Mausrad über der Kachel rastet zuerst ein (ganz im Bild ${w1.ganz}, Überschrift ${w1.titel}, Look ${w1.i})`);
    k = await kachelRect(page);
    const mitte = [k.x + k.w * 0.3, k.y + k.h * 0.5];
    await wheelAt(...mitte, 100);
    await wheelAt(...mitte, 100);
    const w2 = await radZustand(page);
    // Vor dem Trackpad-Test ruhen lassen: Hintergrund und Nachbarn sind gerechnet (SwiftShader blockiert sonst die Seite).
    await wait(radBildFertig, 300_000);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 }).catch(() => {});
    await sleep(4000);
    ok(w2.i === 5 && w2.scroll === w1.scroll, `${name}: Mausrad dreht das Rad (3 → ${w2.i}), Seite bleibt stehen`);
    // Trackpad: viele kleine Schritte, nicht zu empfindlich.
    for (let j = 0; j < 6; j++) {
      await page.mouse.wheel({ deltaY: 12 });
      await sleep(30);
    }
    await sleep(400);
    const w3 = await radZustand(page);
    ok(w3.i - w2.i === 1 && w3.scroll === w1.scroll, `${name}: Trackpad-Deltas (6 × 12 px) ergeben einen Schritt (${w2.i} → ${w3.i})`);
    await shotRad('3-mausrad');
    // Ende: am letzten Look gibt das Rad nach unten frei.
    const ruhe = w1.scroll;
    await page.focus('#look-rad');
    await page.keyboard.press('End');
    await sleep(600);
    await wheelAt(...mitte, 100);
    const w4 = await radZustand(page);
    ok(w4.i === w4.n - 1 && w4.scroll > ruhe, `${name}: am letzten Look scrollt das Mausrad die Seite weiter (${w4.scroll - ruhe} px)`);
    await wheelAt(...mitte, 100);
    ok((await radZustand(page)).scroll > w4.scroll, `${name}: weiter nach unten bleibt nicht hängen`);
    // Schneller Takt (120 ms, keine Pause): am Ende gibt das Rad nach spätestens ~0,5 s frei.
    await scrollMainTo(page, ruhe);
    await page.focus('#look-rad');
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowUp');
    await sleep(600);
    await page.mouse.move(...mitte);
    for (let j = 0; j < 14; j++) {
      await page.mouse.wheel({ deltaY: 100 });
      await sleep(120);
    }
    await sleep(400);
    const w4b = await radZustand(page);
    ok(w4b.i === w4b.n - 1 && w4b.scroll > ruhe, `${name}: Mausrad im schnellen Takt bleibt am Ende nicht hängen (${w4b.scroll - ruhe} px)`);
    // Anfang: am ersten Look gibt das Rad nach oben frei.
    await scrollMainTo(page, ruhe);
    await page.focus('#look-rad');
    await page.keyboard.press('Home');
    await sleep(600);
    await wheelAt(...mitte, -100);
    const w5 = await radZustand(page);
    ok(w5.i === 0 && w5.scroll < ruhe, `${name}: am ersten Look scrollt das Mausrad die Seite nach oben (${w5.scroll - ruhe} px)`);
    // Zeiger außerhalb der Kachel (über der Überschrift), Kachel angeschnitten: normales Scrollen, kein Einrasten.
    await scrollMainTo(page, top - Math.round(H * 0.35));
    await sleep(300);
    const titel = await page.evaluate(() => {
      const r = document.getElementById('rad-titel').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const before = await radZustand(page);
    await wheelAt(titel.x, titel.y, 100);
    const after = await radZustand(page);
    ok(after.scroll - before.scroll >= 90 && after.scroll - before.scroll <= 110 && after.i === before.i,
      `${name}: Mausrad außerhalb der Kachel scrollt normal (${after.scroll - before.scroll} px)`);
    // prefers-reduced-motion: sofort umschalten, ohne Bewegung.
    await scrollMainTo(page, ruhe);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.focus('#look-rad');
    await page.keyboard.press('ArrowDown');
    const rm = await radZustand(page);
    ok(rm.pos === rm.i && rm.i === 1, `${name}: reduzierte Bewegung schaltet sofort um (pos ${rm.pos})`);
    await page.emulateMediaFeatures([]);
  } else {
    // Wischen auf der Kachel neben dem Bogen scrollt die Seite.
    const top = await ausrichten(page);
    await sleep(300);
    const before = await radZustand(page);
    const k = await kachelRect(page);
    const x = k.x + k.w * 0.15;
    const y = k.y + k.h * 0.35;
    const ts = Date.now() / 1000;
    let done = await cdpTouch('touchStart', [{ x, y }], ts);
    for (let j = 1; j <= 6 && done; j++) done = await cdpTouch('touchMove', [{ x, y: y - j * 30 }], ts + j * 0.016);
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
    const k = document.getElementById('rad-kachel');
    const r = k.getBoundingClientRect();
    for (const [fx, fy] of [[0.25, 0.3], [0.2, 0.2], [0.35, 0.4]]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      const el = document.elementFromPoint(x, y);
      if (el && k.contains(el) && !el.closest('#look-rad, button')) return { x, y };
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
  // Die Frist kann ablaufen, während readPixels (SwiftShader) die Seite blockiert: danach noch einmal prüfen.
  const kodakDa = () => document.querySelectorAll('#look-rad [role=option]').length === 17 && document.getElementById('look-rad').getAttribute('aria-activedescendant')?.startsWith('rad-kodak');
  const kodak = (await wait(kodakDa, 10_000)) || (await page.evaluate(kodakDa));
  ok(kodak && (await wait(radBildFertig, 300_000)), `${name}: Marke Kodak mit eigenem Rad (17 Schachteln)`);
  await wait(() => [...document.querySelectorAll('#look-rad .schachtel-fenster img[src^="blob:"]')].filter((i) => i.complete && i.naturalWidth > 0).length >= 5, 300_000);
  await sleep(900);
  await ausrichten(page);
  await shotRad('5-kodak');
  // Marken-Schalter per Tastatur: Pfeil links von Kodak → Leica, Fokus wandert mit.
  await page.focus('#rad-marke-kodak');
  await page.keyboard.press('ArrowLeft');
  const leicaFokus = await page.evaluate(() => document.activeElement?.id === 'rad-marke-leica' && document.activeElement.getAttribute('aria-selected') === 'true');
  const leicaDa = () => document.querySelectorAll('#look-rad [role=option]').length === 18;
  ok(leicaFokus && ((await wait(leicaDa, 10_000)) || (await page.evaluate(leicaDa))) && (await wait(radBildFertig, 300_000)), `${name}: Marke Leica per Pfeiltaste (18 Schachteln)`);
  await wait(() => [...document.querySelectorAll('#look-rad .schachtel-fenster img[src^="blob:"]')].filter((i) => i.complete && i.naturalWidth > 0).length >= 5, 300_000);
  await sleep(900);
  await ausrichten(page);
  await shotRad('6-leica');

  // Fotowechsel: „Nachts“.
  await page.click('#alle-looks button[aria-label="Beispielfoto Nachts"]');
  const nacht = await wait(() => [...document.querySelectorAll('#alle-looks img.rad-hg')].some((i) => i.alt.includes('Nachts') && i.complete && i.naturalWidth > 0), 300_000);
  ok(nacht, `${name}: Foto „Nachts“ im Look-Rad gerechnet`);
  await wait(() => [...document.querySelectorAll('#look-rad .schachtel-fenster img[src^="blob:"]')].filter((i) => i.complete && i.naturalWidth > 0).length >= 5, 300_000);
  await sleep(900);
  await ausrichten(page);
  await shotRad('7-nachts');
  // Fotowechsel: „Sonnenuntergang“.
  await page.click('#alle-looks button[aria-label="Beispielfoto Sonnenuntergang"]');
  ok(await wait(() => [...document.querySelectorAll('#alle-looks img.rad-hg')].some((i) => i.alt.includes('Sonnenuntergang') && i.complete && i.naturalWidth > 0), 300_000),
    `${name}: Foto „Sonnenuntergang“ im Look-Rad gerechnet`);
  await wait(() => [...document.querySelectorAll('#look-rad .schachtel-fenster img[src^="blob:"]')].filter((i) => i.complete && i.naturalWidth > 0).length >= 5, 300_000);
  await sleep(900);
  await ausrichten(page);
  await shotRad('8-sonnenuntergang');
  await page.evaluate(() => [...document.querySelectorAll('#alle-looks [role=tab]')].find((b) => b.textContent.startsWith('Fujifilm'))?.click());
  await page.click('#alle-looks button[aria-label="Beispielfoto Klippen"]');
  await wait(radBildFertig, 300_000);
}

const server = await startDevServer();

async function run(name, viewport, editor, radEditor) {
  const t0 = Date.now();
  const { browser, page } = await launch({ viewport, log: false });
  if (viewport.hasTouch) await page.setUserAgent(IPHONE);
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  const antworten = [];
  page.on('response', (r) => antworten.push({ url: r.url(), status: r.status() }));
  // Hochkant-Fassung, solange die Rahmen hochkant sind (src/ui/start/hooks.ts: hochkant und schmaler als 640 px).
  const fassung = viewport.width < 640 && viewport.height > viewport.width ? 'hoch' : 'quer';
  const grossGeladen = (id) => antworten.some((a) => a.url.endsWith(`/beispiele/gross/${id}-${fassung}.jpg`) && a.status === 200);
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
    // Ausnahme: das vorab gerechnete Titelbild im Hero (quer oder hoch, statisch, ohne Engine).
    ok(!requests.some((u) => u.includes('/beispiele/') && !/\/beispiele\/titel(-hoch)?\.jpg$/.test(u)), `${name}: erster Bildschirm ohne Beispielbilder (außer Titelbild)`);
    const ov = await overflow();
    ok(ov.doc <= 0 && ov.main <= 0, `${name}: kein waagerechter Überlauf (Start) ${JSON.stringify(ov)}`);
    // Titelbild in der Fassung des Bildschirms (picture/source), und „Fotos wählen“ ohne Scrollen erreichbar.
    const hero = await page.evaluate(() => {
      const img = document.querySelector('main picture img');
      const knopf = [...document.querySelectorAll('main > section button')].find((b) => b.textContent.includes('Fotos wählen'));
      return { src: img.currentSrc.replace(/^.*\//, ''), geladen: img.complete && img.naturalWidth > 0, knopf: Math.round(knopf.getBoundingClientRect().bottom) };
    });
    ok(hero.geladen && hero.src === (fassung === 'hoch' ? 'titel-hoch.jpg' : 'titel.jpg'), `${name}: Titelbild ${hero.src}`);
    ok(hero.knopf <= viewport.height, `${name}: „Fotos wählen“ im ersten Bildschirm (unten bei ${hero.knopf} px)`);
    // Hero füllt den ersten Bildschirm, damit das Look-Rad (und mit ihm die Engine) erst beim Scrollen lädt.
    ok(await page.evaluate(() => document.querySelector('main > section').getBoundingClientRect().height >= innerHeight - 1), `${name}: Hero füllt den ersten Bildschirm`);

    // Look-Kachel (Filmschachteln auf dem Bogen): Bildschirmfotos nach test-output/look-rad/
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
    ok(await wait(() => [...document.querySelectorAll('#rezepte img')].some((i) => i.src.startsWith('blob:') && i.naturalWidth > 0)), `${name}: Rezept am Beispielfoto live gerechnet`);
    // Fassung nach Ausrichtung (Handy hochkant → hoch, sonst quer): Seitenfassung und Minis nur in dieser Fassung.
    const fotos = requests.filter((u) => /\/beispiele\/(mini\/)?[a-z]+-(quer|hoch)\.jpg$/.test(u) && !u.includes('/titel')).map((u) => u.replace(/^.*\/beispiele\//, ''));
    ok(['klippen', 'sonnenuntergang'].every((f) => fotos.includes(`${f}-${fassung}.jpg`)) && fotos.every((u) => u.endsWith(`-${fassung}.jpg`)), `${name}: ${fassung}-Fassung der Beispielfotos (${fotos.join(', ')})`);
    await sleep(900);
    await shot('9-rezept');

    // „Jetzt hinzufügen“: ohne Installationsdialog des Browsers (Headless Chrome) die Anleitung; am iPhone die Schritte
    // in Safari, die von selbst weiterlaufen.
    await scrollTo('#app');
    await page.evaluate(() => [...document.querySelectorAll('#app button')].find((b) => b.textContent.includes('Jetzt hinzufügen'))?.click());
    const dialog = () => page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      return d && { titel: d.querySelector('h2')?.textContent, schritt: [...d.querySelectorAll('ol button')].findIndex((b) => b.getAttribute('aria-current') === 'step') };
    });
    ok(await wait(() => !!document.querySelector('[role=dialog]'), 5000), `${name}: „Jetzt hinzufügen“ öffnet einen Dialog`);
    const d1 = await dialog();
    if (viewport.hasTouch) {
      await sleep(3200);
      const d2 = await dialog();
      ok(d1.titel === 'Zum Home-Bildschirm' && d1.schritt === 0 && d2.schritt === 1, `${name}: Anleitung für Safari läuft weiter (${JSON.stringify([d1, d2])})`);
    } else ok(d1.titel === 'Als App installieren', `${name}: Anleitung für den PC (${d1.titel})`);
    await sleep(600);
    await shot('9b-anleitung');
    await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes('Verstanden'))?.click());
    ok(await wait(() => !document.querySelector('[role=dialog]'), 5000), `${name}: „Verstanden“ schließt die Anleitung`);
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

    if (radEditor) {
      // Enter auf dem Rad öffnet den Editor mit Foto und aktivem Look.
      await page.evaluate(() => document.getElementById('alle-looks').scrollIntoView());
      await sleep(300);
      const look = await page.evaluate(() => document.getElementById(document.getElementById('look-rad').getAttribute('aria-activedescendant')).getAttribute('aria-label'));
      await page.focus('#look-rad');
      await page.keyboard.press('Enter');
      const inEditor = await wait(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
      ok(inEditor && (await wait((n) => document.body.innerText.includes(n), 10_000, look)), `${name}: Enter auf dem Rad → Editor mit „${look}“`);
      ok(grossGeladen('klippen'), `${name}: Editor lädt die große Fassung gross/klippen-${fassung}.jpg`);
      await sleep(1500);
      await shotRad('9-editor');
    }
    if (editor && !radEditor) {
      await page.evaluate(() => { document.querySelector('main').scrollTop = document.querySelector('main').scrollHeight; });
      await sleep(300);
      await page.evaluate(() => [...document.querySelectorAll('main button')].reverse().find((b) => b.textContent.includes('Mit Beispielfoto ausprobieren'))?.click());
      const inEditor = await wait(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
      ok(inEditor, `${name}: Beispielfoto → Editor`);
      ok(grossGeladen('klippen'), `${name}: Editor lädt die große Fassung gross/klippen-${fassung}.jpg`);
      // Der Look des Titelbilds (Velvia) kommt mit.
      ok(await wait(() => document.body.innerText.includes('Velvia'), 10_000), `${name}: Editor übernimmt den Look „Velvia“`);
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
