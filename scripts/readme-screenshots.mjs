// Bilder für die README: node scripts/readme-screenshots.mjs [start editor einstellungen lupe rezept …]  (Port TEST_PORT, Vorgabe 5190)
// Startet den Test-Dev-Server und schreibt JPEGs nach docs/screenshots/ (je höchstens 300 KB; die Qualität sinkt, bis es passt).
// Es werden ausschließlich die öffentlichen Beispielfotos aus public/beispiele/ geladen – nie testbilder/: im Editor die
// großen Fassungen (gross/), am Handy hochkant, am PC quer, wie die Startseite sie öffnet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, startDevServer } from './lib/browser.mjs';

const OUT = 'docs/screenshots';
const MAX_BYTES = 300 * 1024;
const FOTOS = ['klippen', 'sonnenuntergang', 'nachts', 'garten'];
const fotos = (fassung) => FOTOS.map((n) => resolve(`public/beispiele/gross/${n}-${fassung}.jpg`));
const phone = { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const pc = { width: 1440, height: 900, deviceScaleFactor: 1 };
// Rezept wie auf der Startseite (src/ui/start/rezept.ts).
const REZEPT = `Kodak Portra 400 v2
Film Simulation: Classic Chrome
Dynamic Range: DR400
Grain Effect: Strong, Small
Color Chrome Effect: Strong
Color Chrome FX Blue: Off
White Balance: 5200K, +1 Red & -6 Blue
Highlight: 0
Shadow: -2
Color: +2
Sharpness: -2
Clarity: -2
High ISO NR: -4
Exposure Compensation: +1/3 to +1`;

const SCHRITTE = ['start', 'editor', 'einstellungen', 'lupe', 'rezept'];
const wanted = process.argv.slice(2);
for (const w of wanted) if (!SCHRITTE.includes(w)) throw new Error(`Unbekannt: ${w} (bekannt: ${SCHRITTE.join(' ')})`);
const todo = wanted.length ? wanted : SCHRITTE;
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await startDevServer();

/** Bildschirmfoto als JPEG; die Qualität sinkt, bis die Datei höchstens MAX_BYTES hat. */
async function shot(page, name) {
  for (const quality of [90, 84, 78, 72, 66, 60, 54]) {
    const buf = await page.screenshot({ type: 'jpeg', quality });
    if (buf.length <= MAX_BYTES || quality === 54) {
      writeFileSync(`${OUT}/${name}.jpg`, buf);
      console.log(`${name}.jpg  ${(buf.length / 1024).toFixed(0)} KB (Q${quality})${buf.length > MAX_BYTES ? '  ZU GROSS' : ''}`);
      return;
    }
  }
}

async function session(viewport, fn) {
  const { browser, page } = await launch({ viewport, log: false });
  const wait = (f, ms = 180_000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 200 }, ...a).then(() => true, () => false);
  const click = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
  const clickText = (sel, t) => page.evaluate((s, x) => [...document.querySelectorAll(s)].find((b) => b.textContent.includes(x))?.click(), sel, t);
  /** Wartet, bis alle Kacheln der Gruppe ihr Vorschaubild haben (die Software-GL rechnet sie nacheinander). */
  const kacheln = async (cat) => {
    const fertig = await wait(
      (c) => {
        const t = [...document.querySelectorAll(`section[data-cat=${c}] button[data-look]`)];
        return t.length > 0 && t.every((b) => b.querySelector('img'));
      },
      300_000,
      cat,
    );
    if (!fertig) console.log(`Kacheln ${cat} nicht fertig`);
    await sleep(400);
  };
  const look = async (name, cat) => {
    await page.evaluate((n) => {
      const b = document.querySelector(`button[data-look="${n}"]`);
      b?.scrollIntoView({ block: 'center', inline: 'center' });
      b?.click();
    }, name);
    await sleep(1500);
    await kacheln(cat);
  };
  const foto = async (i, cat = 'fujifilm') => {
    await page.evaluate((n) => document.querySelectorAll('ul[aria-label="Geladene Fotos"] li > button:first-child')[n]?.click(), i);
    await sleep(1500);
    await kacheln(cat);
  };
  /** Fotos laden, Tipp-Meldung schließen, auf Vorschau und Kacheln warten. */
  const oeffnen = async () => {
    await page.goto(`${server.url}/`, { waitUntil: 'networkidle0' });
    await (await page.$('#datei-eingabe')).uploadFile(...fotos(viewport.width < viewport.height ? 'hoch' : 'quer'));
    await wait(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible');
    await wait((n) => document.querySelectorAll('section[data-cat=fujifilm] img').length >= 8 && document.querySelectorAll('ul[aria-label="Geladene Fotos"] li img').length >= n, 180_000, FOTOS.length);
    await click('[aria-label="Meldung schließen"]');
    await sleep(600);
  };
  const rezeptEintragen = async () => {
    await click('#tab-looks');
    await click('button[aria-label="Rezept einfügen"]');
    await page.waitForSelector('textarea[aria-label="Rezepttext"]');
    await page.$eval('textarea[aria-label="Rezepttext"]', (el, t) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, REZEPT);
    await sleep(600);
  };
  try {
    await fn({ page, wait, click, clickText, look, foto, oeffnen, rezeptEintragen });
  } finally {
    await browser.close();
  }
}

try {
  for (const [kind, viewport] of [['handy', phone], ['pc', pc]]) {
    await session(viewport, async (s) => {
      const { page } = s;
      if (todo.includes('start')) {
        await page.goto(`${server.url}/`, { waitUntil: 'networkidle0' });
        await sleep(1200);
        await shot(page, `start-${kind}`);
      }
      const brauchtEditor = ['editor', 'einstellungen', 'lupe', 'rezept'].some((t) => todo.includes(t));
      if (!brauchtEditor) return;
      await s.oeffnen();

      if (todo.includes('editor')) {
        await s.foto(FOTOS.indexOf(kind === 'handy' ? 'nachts' : 'klippen'));
        await s.click('#tab-looks');
        await s.look(kind === 'handy' ? 'Vision3 500T' : 'Kodachrome 64', 'kodak');
        await shot(page, `editor-${kind}`);
      }

      if (todo.includes('rezept')) {
        await s.foto(FOTOS.indexOf('garten'));
        await s.rezeptEintragen();
        await shot(page, `rezept-${kind}`);
        // Anwenden: danach zeigt „Anpassen“ die Werte des Rezepts.
        await s.clickText('[role=dialog] button', 'Anwenden');
        await sleep(2000);
      } else if (todo.includes('einstellungen')) {
        await s.foto(FOTOS.indexOf('garten'));
        await s.rezeptEintragen();
        await s.clickText('[role=dialog] button', 'Anwenden');
        await sleep(2000);
      }

      if (todo.includes('einstellungen')) {
        await s.click('#tab-anpassen');
        await s.click('[aria-label="Meldung schließen"]');
        await sleep(800);
        // Am Handy: bis zu den Bildeinstellungen scrollen (Dynamikbereich, Lichter, Schatten …).
        if (kind === 'handy') {
          await page.evaluate(() => {
            const h = [...document.querySelectorAll('[role=tabpanel] *')].find((e) => e.children.length === 0 && /^bildeinstellungen$/i.test(e.textContent.trim()));
            h?.scrollIntoView({ block: 'start' });
          });
          await sleep(500);
        }
        await shot(page, `einstellungen-${kind}`);
      }

      if (todo.includes('lupe') && kind === 'pc') {
        await s.foto(FOTOS.indexOf('klippen'));
        await s.click('#tab-looks');
        await s.look('Portra 400', 'kodak');
        await s.click('button[aria-label="100 %-Ansicht"]');
        const fertig = await s.wait(
          () => !!document.querySelector('[aria-label^="Ansicht 100 %"] canvas[style*="width"]') &&
            !document.querySelector('[aria-label="100 %, zurück zur Ganzansicht"] .animate-spin'),
        );
        if (!fertig) console.log('Lupe nicht fertig gerechnet');
        await sleep(800);
        await shot(page, 'lupe-pc');
      }
    });
  }
} finally {
  await server.close();
}
