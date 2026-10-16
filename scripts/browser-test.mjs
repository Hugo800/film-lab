// Ende-zu-Ende-Test der gebauten App: npm run test:browser
// Baut nach test-output/e2e-build, liefert statisch aus (Port TEST_PORT, Vorgabe 5190) und bedient die
// Oberfläche in Headless Chrome als PC (1440×900) und Handy (393×852 @3x, Touch): 2 JPEGs + 1 ARW laden,
// Looks, Regler, Segmentwahl, Rezept einfügen, Export einzeln und als ZIP. Die Downloads werden geprüft (Maße, EXIF, kein ICC, XMP, dekodierbar).
// Der Server setzt die Header aus deploy/security-headers.conf; jeder CSP-Verstoß (Seite oder Worker) macht den Test rot.
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { build } from 'vite';
import { launch, PORT } from './lib/browser.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
// Mit eigenem TEST_PORT eigene Ordner, damit parallele Läufe sich nicht überschreiben.
const SUFFIX = process.env.TEST_PORT ? `-${process.env.TEST_PORT}` : '';
const BUILD = resolve(`test-output/e2e-build${SUFFIX}`);
const OUT = resolve(`test-output/e2e${SUFFIX}`);
const PHOTOS = ['testbilder/DSC04866.JPEG', 'testbilder/DSC01603.JPEG', 'testbilder/raw/DSC01542.ARW'].map((p) => resolve(p));
const RAW_SIZE = [6000, 4000]; // aktive Fläche der a6000 (siehe scripts/raw-test.mjs)
const BASE = `http://localhost:${PORT}`;
const t0 = Date.now();
const secs = (t = t0) => `${((Date.now() - t) / 1000).toFixed(0)} s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fails = 0;
const ok = (cond, msg) => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${msg}`);
  return cond;
};

// --- JPEG lesen (unabhängig von src/io) ---

/** APPn-Segmente bis SOS und die Bildmaße aus SOFn. */
function parseJpeg(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('kein JPEG');
  const segs = [];
  let size = null;
  for (let i = 2; i + 4 <= b.length && b[i] === 0xff; ) {
    const m = b[i + 1];
    if (m === 0xda) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    const payload = b.subarray(i + 4, i + 2 + len);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
      size = [(payload[3] << 8) | payload[4], (payload[1] << 8) | payload[2]];
    segs.push({ m, payload });
    i += 2 + len;
  }
  const id = (s, text) => Buffer.from(s.payload.subarray(0, text.length)).toString('latin1') === text;
  const exif = segs.find((s) => s.m === 0xe1 && id(s, 'Exif\0\0'));
  return {
    size,
    exif: exif && parseExif(exif.payload.subarray(6)),
    xmp: segs.some((s) => s.m === 0xe1 && id(s, 'http://ns.adobe.com/xap/1.0/\0')),
    icc: segs.some((s) => s.m === 0xe2 && id(s, 'ICC_PROFILE\0')),
  };
}

/** IFD0 und Exif-IFD: Zahlen (SHORT/LONG) und Texte. */
function parseExif(t) {
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const le = t[0] === 0x49;
  const ifd = (at) => {
    const out = {};
    for (let i = 0, n = v.getUint16(at, le); i < n; i++) {
      const p = at + 2 + i * 12;
      const tag = v.getUint16(p, le), type = v.getUint16(p + 2, le), count = v.getUint32(p + 4, le);
      if (type === 3) out[tag] = v.getUint16(p + 8, le);
      else if (type === 4) out[tag] = v.getUint32(p + 8, le);
      else if (type === 2) {
        const s = count <= 4 ? p + 8 : v.getUint32(p + 8, le);
        out[tag] = Buffer.from(t.subarray(s, s + count)).toString('latin1').replace(/\0+$/, '');
      }
    }
    return out;
  };
  const ifd0 = ifd(v.getUint32(4, le));
  return { ifd0, sub: ifd0[0x8769] ? ifd(ifd0[0x8769]) : {} };
}

/** Erwartung aus der Quelldatei: aufrechte Maße und ob XMP vorhanden war. */
function expected(path) {
  if (/\.arw$/i.test(path)) return { size: RAW_SIZE, xmp: false };
  const j = parseJpeg(readFileSync(path));
  const o = j.exif?.ifd0[0x0112] ?? 1;
  return { size: o >= 5 ? [j.size[1], j.size[0]] : j.size, xmp: j.xmp };
}

// --- Build und statischer Server ---

console.log(`Baue App nach ${BUILD} …`);
await build({ logLevel: 'warn', build: { outDir: BUILD, emptyOutDir: true } });
// Dieselben Sicherheits-Header wie die Produktion: jede add_header-Zeile wird ein Header.
const HEADERS = Object.fromEntries(
  [...readFileSync('deploy/security-headers.conf', 'utf8').matchAll(/^\s*add_header\s+(\S+)\s+"([^"]*)"/gm)].map((m) => [m[1], m[2]]),
);
if (!HEADERS['Content-Security-Policy']) throw new Error('Keine CSP in deploy/security-headers.conf gefunden');
console.log(`Header aus deploy/security-headers.conf: ${Object.keys(HEADERS).join(', ')}`);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.zip': 'application/zip',
};
let DL = '';
const server = createServer((req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, BASE).pathname));
  if (path.endsWith('/')) path += 'index.html';
  // /__dl/… liefert die Downloads aus, damit die Seite sie zur Probe dekodieren kann.
  const file = path.startsWith('/__dl/') ? join(DL, path.slice(6)) : join(BUILD, path);
  if (!existsSync(file) || !statSync(file).isFile()) return res.writeHead(404, HEADERS).end();
  res.writeHead(200, { ...HEADERS, 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

// --- Ablauf je Gerät ---

async function run(mode, viewport) {
  const tRun = Date.now();
  console.log(`\n== ${mode} ${viewport.width}×${viewport.height}${viewport.deviceScaleFactor ? ` @${viewport.deviceScaleFactor}x` : ''}`);
  DL = join(OUT, mode);
  rmSync(DL, { recursive: true, force: true });
  mkdirSync(DL, { recursive: true });
  const touch = !!viewport.hasTouch;
  const { browser, page } = await launch({ viewport, log: false });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const requested = [];
  page.on('request', (r) => requested.push(r.url()));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
  // CSP-Verstöße: im Dokument per Ereignis, in Workern (LibRaw, Export) über deren Protokoll.
  const csp = [];
  const isCsp = (t) => /Content Security Policy/i.test(t);
  await page.exposeFunction('__cspVerstoss', (t) => csp.push(t));
  await page.evaluateOnNewDocument(() =>
    document.addEventListener('securitypolicyviolation', (e) => window.__cspVerstoss(`${e.violatedDirective}: ${e.blockedURI || e.sample}`)),
  );
  page.on('console', (m) => isCsp(m.text()) && csp.push(m.text()));
  page.on('workercreated', (w) => {
    w.client.on('Log.entryAdded', ({ entry }) => isCsp(entry.text) && csp.push(`Worker ${w.url().split('/').pop()}: ${entry.text}`));
    w.client.on('Runtime.exceptionThrown', ({ exceptionDetails: d }) => {
      const t = d.exception?.description ?? d.text;
      if (isCsp(t)) csp.push(`Worker ${w.url().split('/').pop()}: ${t}`);
    });
    w.client.send('Log.enable').catch(() => {});
  });
  /** Meldet die App einen CSP-Fehler (etwa beim RAW-Entwickeln im Worker), zählt er auch. */
  const appCsp = async () => {
    const t = await page.evaluate(() => document.body.innerText).catch(() => '');
    const m = t.split('\n').find((l) => isCsp(l) || /violates the following/i.test(l));
    if (m) csp.push(`App: ${m}`);
  };

  // Jede Prüfung läuft im Hauptthread der Seite. Unter SwiftShader blockiert ihn das Rechnen der Look-Kacheln
  // (readPixels) bis zu 10 s am Stück; dann zählt die erste Antwort nach Ablauf der Frist, nicht die Uhr allein.
  const waitFor = async (fn, ms, arg) => {
    const end = Date.now() + ms;
    for (;;) {
      if (await page.evaluate(fn, arg).catch(() => false)) return true;
      if (Date.now() >= end) return false;
      await sleep(200);
    }
  };
  /** Erster Knopf (oder Tab), für den `pred(b)` gilt; per Maus bzw. Finger bedient. */
  const press = async (pred, arg) => {
    const h = await page.evaluateHandle(
      (src, a) => [...document.querySelectorAll('button, [role=tab], input')].find((b) => new Function('b', 'a', `return ${src}`)(b, a)) ?? null,
      pred, arg,
    );
    const el = h.asElement();
    if (!el) throw new Error(`Bedienelement nicht gefunden: ${pred} ${arg ?? ''}`);
    await (touch ? el.tap() : el.click());
    await sleep(150);
  };
  const previewShot = async () => (await page.$('[aria-label^="Vorschau"]')).screenshot({ encoding: 'base64' });
  const loaded = () =>
    waitFor(() => document.querySelector('[aria-label^="Vorschau"]')?.style.visibility === 'visible' &&
      ![...document.querySelectorAll('[role=status]')].some((s) => s.textContent.includes('wird geladen')), 120_000);
  const text = () => page.evaluate(() => document.body.innerText);
  const dialogText = () => page.$eval('[role=dialog]', (d) => d.innerText).catch(() => '');
  const lookTiles = () => page.$$eval('section[aria-label] button[aria-pressed][data-look]', (b) => b.map((x) => x.dataset.look));
  const chooseLook = async (name) => {
    await press(`b.id === 'tab-looks'`);
    await press(`b.getAttribute('aria-pressed') !== null && b.dataset.look === a`, name);
    return waitFor((n) => [...document.querySelectorAll('button[aria-pressed=true]')].some((b) => b.dataset.look === n), 5000, name);
  };
  /** Segment („Stark“ bei Körnung …) wählen; liefert, ob es danach gewählt ist. */
  const segment = async (param, label) => {
    await press(`b.id === 'tab-anpassen'`);
    await press(`b.getAttribute('role') === 'radio' && !!b.closest('#regler-' + a[0]) && b.textContent.trim() === a[1]`, [param, label]);
    return page.$eval(`#regler-${param} [aria-checked=true]`, (e) => e.textContent.trim()).then((t) => t === label, () => false);
  };
  const sliderValue = (param) => page.$eval(`#regler-${param}`, (e) => Number(e.value));
  const radioValue = (param) => page.$eval(`#regler-${param} [aria-checked=true]`, (e) => e.textContent.trim()).catch(() => null);
  /** Rezepttext in den Dialog einfügen; mit `save` zusätzlich unter „Eigene“ speichern. */
  const pasteRecipe = async (text, save) => {
    await press(`b.id === 'tab-looks'`);
    await press(`b.getAttribute('aria-label') === 'Rezept einfügen'`);
    if (!(await waitFor(() => !!document.querySelector('#rezept-text'), 30_000))) throw new Error('Rezept-Dialog fehlt');
    await page.$eval('#rezept-text', (el, t) => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      set.call(el, t);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
    const recognized = await waitFor(() => !!document.querySelector('#rezept-erkannt li'), 5000);
    const shown = await dialogText();
    if (save) {
      await page.type('#rezept-name', save);
      await press(`b.textContent.trim() === 'Anwenden + speichern' && !!b.closest('[role=dialog]')`);
    } else await press(`b.textContent.trim() === 'Anwenden' && !!b.closest('[role=dialog]')`);
    await sleep(300);
    return { recognized, shown };
  };
  const nudge = async (param, steps) => {
    await press(`b.id === 'tab-anpassen'`);
    const before = await page.$eval(`#regler-${param}`, (e) => Number(e.value));
    await page.focus(`#regler-${param}`);
    for (let i = 0; i < steps; i++) await page.keyboard.press('ArrowRight');
    const after = await page.$eval(`#regler-${param}`, (e) => Number(e.value));
    return { before, after };
  };
  const selectPhoto = async (i) => {
    await press(`b.getAttribute('aria-label')?.startsWith(a)`, `Foto ${i} von ${PHOTOS.length}`);
    return loaded();
  };
  const waitDownload = async (name, ms) => {
    const file = join(DL, name);
    for (let t = Date.now(), last = -1; Date.now() - t < ms; await sleep(300)) {
      if (!existsSync(file) || readdirSync(DL).some((f) => f.endsWith('.crdownload'))) continue;
      const size = statSync(file).size;
      if (size > 0 && size === last) return readFileSync(file);
      last = size;
    }
    return null;
  };
  const exportRun = async (scope, name) => {
    const t = Date.now();
    await press(`b.textContent.includes('Exportieren') && !!b.closest('header')`);
    if (!(await waitFor(() => !!document.querySelector('[role=dialog] input[name=umfang]'), 30_000))) throw new Error('Export-Dialog fehlt');
    await press(`b.name === 'umfang' && b.closest('label').textContent.includes(a)`, scope === 'alle' ? 'Alle' : 'Dieses Foto');
    await press(`b.textContent.trim() === 'Exportieren' && !!b.closest('[role=dialog]')`);
    ok(await waitFor(() => !!document.querySelector('[role=progressbar]'), 10_000), `${scope}: Fortschrittsanzeige`);
    const done = await waitFor(() => /^Export (fertig|fehlgeschlagen|abgebrochen)/.test(document.querySelector('[role=dialog] h2')?.textContent ?? ''), 600_000);
    const text = await dialogText();
    if (!ok(done && text.startsWith('Export fertig') && !text.includes('konnte'), `${scope}: Export fertig (${secs(t)})`)) console.log(text);
    // Am PC startet der Download selbst, am Handy per Knopf (Teilen gibt es im Headless-Chrome nicht).
    if (touch) await press(`/herunterladen/i.test(b.textContent) && !!b.closest('[role=dialog]')`);
    const bytes = await waitDownload(name, 60_000);
    ok(!!bytes, `${scope}: Download ${name}${bytes ? ` (${(bytes.length / 1e6).toFixed(2)} MB)` : ' fehlt'}`);
    await press(`b.textContent.trim() === 'Schließen' && !!b.closest('[role=dialog]')`);
    return bytes;
  };
  const checkJpeg = async (name, bytes, source) => {
    const want = expected(source);
    let j;
    try {
      j = parseJpeg(bytes);
    } catch (e) {
      return ok(false, `${name}: ${e.message}`);
    }
    const e = j.exif;
    const dec = await page.evaluate(async (n) => {
      try {
        const bmp = await createImageBitmap(await (await fetch('/__dl/' + n)).blob());
        const c = new OffscreenCanvas(16, 16);
        c.getContext('2d').drawImage(bmp, 0, 0, 16, 16);
        const d = c.getContext('2d').getImageData(0, 0, 16, 16).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
        return { w: bmp.width, h: bmp.height, mean: sum / (d.length * 0.75) };
      } catch (err) {
        return { error: String(err) };
      }
    }, name);
    const problems = [];
    if (j.size?.[0] !== want.size[0] || j.size?.[1] !== want.size[1]) problems.push(`Maße ${j.size?.join('×')} statt ${want.size.join('×')}`);
    if (!e) problems.push('kein EXIF');
    else {
      if (e.ifd0[0x0112] !== 1) problems.push(`Orientation ${e.ifd0[0x0112]}`);
      if (!e.ifd0[0x010f] || !e.ifd0[0x0110]) problems.push('Make/Model fehlt');
      if (!e.sub[0x9003]) problems.push('DateTimeOriginal fehlt');
    }
    if (j.icc) problems.push('ICC-Profil vorhanden');
    if (want.xmp && !j.xmp) problems.push('XMP fehlt');
    if (dec.error || dec.w !== want.size[0] || dec.h !== want.size[1]) problems.push(`Dekodierung: ${dec.error ?? `${dec.w}×${dec.h}`}`);
    else if (!(dec.mean > 10 && dec.mean < 245)) problems.push(`Bild leer? Mittel ${dec.mean.toFixed(0)}`);
    return ok(problems.length === 0, `${name}: ${j.size?.join('×')}, ${e ? `${e.ifd0[0x010f]} ${e.ifd0[0x0110]}, ${e.sub[0x9003]}, Orientation ${e.ifd0[0x0112]}` : '–'}, ` +
      `ICC ${j.icc ? 'ja' : 'nein'}, XMP ${j.xmp ? 'ja' : 'nein'}${problems.length ? ' – ' + problems.join('; ') : ''}`);
  };

  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    ok(await page.evaluate(() => innerWidth === document.documentElement.scrollWidth), 'Startansicht ohne Seitenüberlauf');
    ok(!requested.some((u) => u.includes('libraw')), `RAW-Dekoder wird nicht vorab geladen (${requested.length} Anfragen beim Start)`);
    ok((await text()).includes('Fujifilm, Leica und Kodak sind Marken ihrer Inhaber'), 'Markenhinweis auf der Startseite');

    // Laden
    const tLoad = Date.now();
    await (await page.$('#datei-eingabe')).uploadFile(...PHOTOS);
    ok(await loaded(), `Foto 1 in der Vorschau (${secs(tLoad)})`);
    const strip = await waitFor((n) => document.querySelectorAll('ul[aria-label="Geladene Fotos"] button[aria-label^="Foto "][aria-current]').length === n, 10_000, PHOTOS.length);
    ok(strip, `Filmstreifen mit ${PHOTOS.length} Fotos`);
    const looks = await lookTiles();
    ok(looks.length > 5, `${looks.length} Looks zur Wahl`);
    const groups = await page.$$eval('section[aria-label] h3', (h) => h.map((x) => x.textContent.trim()));
    ok(['Fujifilm', 'Leica', 'Kodak', 'Eigene'].every((g) => groups.some((x) => x.startsWith(g))), `Gruppen: ${groups.join(' | ')}`);
    // Im Bedienfeld steht der Markenhinweis nur in der Seitenleiste (PC), am Handy nicht.
    if (!touch) ok((await text()).includes('Fujifilm, Leica und Kodak sind Marken ihrer Inhaber'), 'Markenhinweis in der Look-Liste');

    // Foto 1: Look + Regler, Vorschau ändert sich
    const before = await previewShot();
    ok(await chooseLook(looks[2]), `Foto 1: Look „${looks[2]}“`);
    const ex = await nudge('exposure', 4);
    ok(ex.after > ex.before, `Foto 1: Belichtung ${ex.before} → ${ex.after}`);
    const hl = await nudge('highlightTone', 3);
    ok(hl.after === hl.before + 1.5, `Foto 1: Lichter ${hl.before} → ${hl.after} (0,5er-Schritte)`);
    ok(await segment('grainEffect', 'Stark'), 'Foto 1: Körnung „Stark“ gewählt');
    ok(await segment('grainSize', 'Groß'), 'Foto 1: Korngröße „Groß“ gewählt');
    ok(await segment('dynamicRange', 'DR400'), 'Foto 1: DR400 gewählt');
    await sleep(500);
    ok(before !== (await previewShot()), 'Foto 1: Vorschau zeigt die Änderung');

    // Rezept einfügen: setzt Look und Einstellungen, lässt sich als eigenes Rezept speichern
    const r = await pasteRecipe(
      'Film Simulation: Classic Chrome\nGrain Effect: Weak, Small\nColor Chrome Effect: Strong\nColor Chrome FX Blue: Weak\nWhite Balance: 6500K, +2 Red & -4 Blue\nDynamic Range: DR200\nHighlight: -1.5\nColor: +2\nHigh ISO NR: -4\nExposure Compensation: +1/3 to +1',
      'Mein Rezept',
    );
    ok(r.recognized && r.shown.includes('Nicht übernommen') && r.shown.includes('High ISO NR'), 'Rezept: erkannte Werte und „Nicht übernommen“ werden gezeigt');
    await press(`b.id === 'tab-anpassen'`);
    ok((await sliderValue('wbKelvin')) === 6500 && (await sliderValue('wbShiftR')) === 2 && (await sliderValue('wbShiftB')) === -4, 'Rezept: Weißabgleich 6500 K, +2/−4');
    ok((await sliderValue('highlightTone')) === -1.5 && (await sliderValue('color')) === 2, 'Rezept: Lichter −1,5, Farbe +2');
    ok((await radioValue('grainEffect')) === 'Schwach' && (await radioValue('grainSize')) === 'Klein' && (await radioValue('colorChrome')) === 'Stark' && (await radioValue('dynamicRange')) === 'DR200', 'Rezept: Körnung, Color Chrome, DR');
    ok(Math.abs((await sliderValue('exposure')) - 0.65) < 0.06, 'Rezept: Belichtung aus Bereich gemittelt');
    ok((await text()).includes('−1,5') && (await text()).includes('+2'), 'Werte mit Vorzeichen und Komma angezeigt');
    await press(`b.id === 'tab-looks'`);
    ok((await lookTiles()).includes('Mein Rezept'), 'Gespeichertes Rezept erscheint unter „Eigene“');

    // Foto 2 und das RAW: eigene Looks
    ok(await selectPhoto(2), 'Foto 2 geladen');
    ok(await chooseLook(looks[5]), `Foto 2: Look „${looks[5]}“`);
    const vi = await nudge('vignette', 5);
    ok(vi.after > vi.before, `Foto 2: Vignette ${vi.before} → ${vi.after}`);
    const tRaw = Date.now();
    const rawOk = await selectPhoto(3);
    await appCsp();
    ok(rawOk, `ARW geladen (${secs(tRaw)})`);
    ok(await chooseLook(looks.at(-1)), `ARW: Look „${looks.at(-1)}“`);
    ok(await waitFor((n) => document.querySelectorAll('ul[aria-label="Geladene Fotos"] img').length === n, 30_000, PHOTOS.length), 'Filmstreifen hat alle Vorschaubilder (auch ARW)');
    await page.screenshot({ path: join(OUT, `${mode}-raw.png`) });

    // Export: einzeln (kleines Foto) und alle als ZIP
    ok(await selectPhoto(1), 'zurück zu Foto 1');
    const names = PHOTOS.map((p) => p.split('/').pop().replace(/\.[^.]+$/, '') + '_filmlab.jpg');
    const single = await exportRun('aktuell', names[0]);
    if (single) await checkJpeg(names[0], single, PHOTOS[0]);
    const zip = await exportRun('alle', 'filmlab_export.zip');
    if (zip) {
      const entries = unzipSync(new Uint8Array(zip));
      ok(names.every((n) => entries[n]), `ZIP enthält ${Object.keys(entries).join(', ')}`);
      for (const [i, n] of names.entries()) {
        if (!entries[n]) continue;
        writeFileSync(join(DL, n), entries[n]);
        await checkJpeg(n, Buffer.from(entries[n]), PHOTOS[i]);
      }
    }
    await page.screenshot({ path: join(OUT, `${mode}-ende.png`) });
  } catch (e) {
    ok(false, `Ablauf abgebrochen: ${e.message}`);
    await page.screenshot({ path: join(OUT, `${mode}-fehler.png`) }).catch(() => {});
  } finally {
    await appCsp();
    ok(csp.length === 0, `keine CSP-Verstöße${csp.length ? `: ${[...new Set(csp)].slice(0, 5).join(' | ')}` : ''}`);
    ok(errors.length === 0, `keine Konsolenfehler${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
    await browser.close();
    console.log(`(${mode}: ${secs(tRun)})`);
  }
}

try {
  await run('pc', { width: 1440, height: 900 });
  await run('handy', { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
} finally {
  server.close();
}
console.log(`\n${fails ? `${fails} FEHLER` : 'alles OK'} (gesamt ${secs()})`);
process.exit(fails ? 1 : 0);
