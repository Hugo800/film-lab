// Beispielfotos der Startseite: node scripts/beispiele-erzeugen.mjs [name …]  (Port TEST_PORT, Vorgabe 5190)
// Mit Namen (z. B. jet-quer jet-hoch) nur diese Fotos; Titelbilder, Lupe und Aufräumen brauchen alle Quellen.
// Je Foto zwei Fassungen: quer (PC, Querformat) und hoch (Handy hochkant); Namen und Ausschnitte wie BEISPIELE in
// src/ui/start/werkstatt.ts. Alles läuft in Headless Chrome auf dem Test-Dev-Server:
// 1. Quelle öffnen: JPEG per createImageBitmap (Chrome rechnet Display P3 nach sRGB), Sony-RAW (ARW) mit der
//    RAW-Entwicklung der App (decodeRaw aus src/io/raw, libraw-wasm), ohne Look. Danach wie in der Kamera: Verzeichnung
//    und Farbsäume mit der Objektivkorrektur der App entzerren (src/io/raw/objektiv.ts, wie beim ARW-Import im
//    Editor), in einem Zug mit dem Geradedrehen des Horizonts (eine Neuabtastung); Belichtung und Weißabgleich an die
//    Kamera-Vorschau in der ARW angleichen (je Kanal eine Verstärkung in linearem Licht mit weicher Schulter, so dass
//    die Mittelwerte übereinstimmen; Messwerte im Protokoll).
// 2. Daraus: Seitenfassung (lange Kante 2048, im Precache der App), Editor-Fassung gross/ (lange Kante 4000, nur
//    beim Öffnen im Editor geladen) und die Mini-Vorschau der Foto-Wahl (mini/, 168×132 = 56×44 bei @3).
// 3. Mit der Engine der App: Titelbilder (Klippen quer und hoch, halb Original, halb Velvia) und Lupe (Klippen mit
//    Portra 400, echter 100-%-Ausschnitt aus der vollen RAW-Auflösung).
// Kodiert wird mit mozjpeg wie der Export der App (encodeJpeg); EXIF, GPS, XMP und ICC entfallen dabei. Am Ende wird
// geprüft, dass kein APPn-Segment außer JFIF bleibt. Dateien aus früheren Läufen, die nicht mehr entstehen, werden
// gelöscht. Nur diese Fotos dürfen öffentlich werden; andere Testbilder hier nie eintragen.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const OUT = 'public/beispiele';
// pos wie in BEISPIELE (src/ui/start/werkstatt.ts): Ausschnitt der Mini-Vorschau.
// drehen: Horizont gerade (Grad im Uhrzeigersinn), gemessen an der Kamera-Vorschau der ARW (−1,46° geneigt).
// ausschnitt: [x0, y0, x1, y1] als Anteil des Bildes, vor dem Verkleinern.
// editor: kleinere Editor-Fassung, wo 4000 px zu viel zeigen (Straße: ab ~2500 px Kennzeichen lesbar).
const PHOTOS = [
  { name: 'klippen-quer', src: 'testbilder/DSC04866.ARW', pos: [0.5, 0.5], drehen: 1.46 },
  { name: 'klippen-hoch', src: 'testbilder/DSC04824.ARW', pos: [0.5, 0.7] },
  { name: 'sonnenuntergang-quer', src: 'testbilder/IMG_0341.JPEG', pos: [0.5, 0.5] },
  { name: 'sonnenuntergang-hoch', src: 'testbilder/IMG_0366.JPEG', pos: [0.5, 0.4] },
  { name: 'nachts-quer', src: 'testbilder/IMG_0558.JPEG', pos: [0.3, 0.5] },
  { name: 'nachts-hoch', src: 'testbilder/IMG_0562.JPEG', pos: [0.5, 0.7] },
  // F-16 auf der Intrepid (iPhone, IMG_0413/IMG_0412.HEIC, 48 MP, 4:3, Display P3). Chrome liest kein HEIC: vorher als
  // JPEG mit eingebettetem P3-Profil, lange Kante 4032 (npm heic-decode + PIL, siehe browser-bild-io-jpeg-wasm im Depot).
  // Quer 3:2 ohne den rechten Rand (dort stand ein erkennbarer Besucher), hoch 9:16 wie der eigene Zuschnitt (ohne die
  // Leute am rechten Rand). Editor-Fassung höchstens 2048 px: Besucher im Hintergrund auch in der Lupe nicht erkennbar.
  { name: 'jet-quer', src: 'testbilder/f16-quer.jpg', pos: [0.6, 0.6], ausschnitt: [0, 0.1, 0.89, 0.8911], editor: 2048 },
  { name: 'jet-hoch', src: 'testbilder/f16-hoch.jpg', pos: [0.5, 0.9], ausschnitt: [0.11, 0, 0.86, 1], editor: 2048 },
];
/** Nur diese Fotos (Namen auf der Kommandozeile), sonst alle. */
const NUR = process.argv.slice(2);
for (const n of NUR) if (!PHOTOS.some((p) => p.name === n)) throw new Error(`Unbekanntes Foto ${n}`);
/** Lange Kante: Seite wie GROSS in werkstatt.ts, Editor-Fassung; kleinere Quellen bleiben in voller Größe. */
const SEITE = 2048;
const EDITOR = 4000;
const MINI = [168, 132];
/** JPEG-Qualität (mozjpeg, 1–100). */
const QUALITAET = 88;
/** Obergrenzen je Datei: nur gegen Ausreißer, die Qualität bleibt fest. */
const GRENZE = { seite: 1100 * 1024, gross: 4 * 1024 * 1024, mini: 12 * 1024, titel: 1100 * 1024, lupe: 700 * 1024 };
/** Titelbilder: Look rechts vom Teiler; Lupe: Look und Ausschnitt (x, y, w, h in Pixeln der RAW-Entwicklung, 6000×4000). */
const TITEL_LOOK = 'velvia';
const LUPE = { look: 'kodak-portra-400', rect: [2200, 2910, 1024, 640] };

/** Marker aller Segmente vor den Bilddaten (APP0 = JFIF, APP1 = EXIF/XMP, APP2 = ICC …) und die Maße aus SOFn. */
function lesen(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('kein JPEG');
  const list = [];
  let size = null;
  for (let i = 2; i + 4 <= b.length && b[i] === 0xff; i += 2 + ((b[i + 2] << 8) | b[i + 3])) {
    const m = b[i + 1];
    if (m === 0xda) break;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) size = [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
    list.push(m);
  }
  return { list, size };
}

let fails = 0;
const geschrieben = new Set();
/** Schreibt das JPEG und prüft Segmente (nur JFIF), Maße und Größe. */
function save(file, res, maxBytes) {
  const out = Buffer.from(res.data, 'base64');
  const { list, size } = lesen(out);
  const meta = list.filter((m) => m >= 0xe1 && m <= 0xef);
  const good = meta.length === 0 && size?.[0] === res.w && size?.[1] === res.h && out.length <= maxBytes;
  if (!good) fails++;
  writeFileSync(`${OUT}/${file}`, out);
  geschrieben.add(file);
  console.log(
    `${good ? 'OK    ' : 'FEHLER'} ${file} ${res.w}×${res.h}, ${(out.length / 1024).toFixed(0)} KB (≤ ${(maxBytes / 1024).toFixed(0)}), ` +
      `Segmente ${list.map((m) => m.toString(16)).join(' ')}${meta.length ? ' – Metadaten vorhanden!' : ''}`,
  );
}

mkdirSync(`${OUT}/mini`, { recursive: true });
mkdirSync(`${OUT}/gross`, { recursive: true });
const server = await startDevServer();
const { browser, page } = await launch({ log: false });
page.on('pageerror', (e) => console.log(`[browser:pageerror] ${e.message}`));
try {
  await page.goto(`${server.url}/`, { waitUntil: 'networkidle0' });
  // Hilfen im Browser: Kodieren (mozjpeg der App, Ergebnis als Base64), Verkleinern, ARW-Vorschau, Messen.
  await page.evaluate(() => {
    const lin = new Float32Array(256).map((_, v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
    const srgb = (x) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)));
    const base64 = (u8) => {
      let s = '';
      for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode(...u8.subarray(k, k + 0x8000));
      return btoa(s);
    };
    const pixel = (bild) => {
      const c = bild instanceof OffscreenCanvas ? bild : new OffscreenCanvas(bild.width, bild.height);
      if (c !== bild) c.getContext('2d').drawImage(bild, 0, 0);
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    window.H = {
      pixel,
      async kodieren(bild, q) {
        const { encodeJpeg } = await import('/src/io/index.ts');
        const d = pixel(bild);
        const jpeg = await encodeJpeg(new Uint8Array(d.buffer, d.byteOffset, d.length), bild.width, bild.height, q);
        return { w: bild.width, h: bild.height, data: base64(jpeg) };
      },
      /** Lange Kante höchstens `edge`, hochwertig verkleinert. */
      verkleinern(bild, edge) {
        const k = Math.min(1, edge / Math.max(bild.width, bild.height));
        const w = Math.round(bild.width * k);
        const h = Math.round(bild.height * k);
        return k === 1 ? createImageBitmap(bild) : createImageBitmap(bild, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
      },
      /** Eingebettete Kamera-Vorschau einer ARW (IFD0, JPEGInterchangeFormat/-Length). */
      vorschau(buf) {
        const v = new DataView(buf);
        const le = v.getUint8(0) === 0x49;
        const ifd = v.getUint32(4, le);
        const tags = {};
        for (let i = 0, n = v.getUint16(ifd, le); i < n; i++) tags[v.getUint16(ifd + 2 + i * 12, le)] = v.getUint32(ifd + 10 + i * 12, le);
        return createImageBitmap(new Blob([buf.slice(tags[0x201], tags[0x201] + tags[0x202])], { type: 'image/jpeg' }));
      },
      /** Mittelwerte je Kanal, sRGB (0–255) und linear, auf lange Kante 600 verkleinert. */
      async messen(bild) {
        const d = pixel(await this.verkleinern(bild, 600));
        const m = [0, 0, 0];
        const ml = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) ((m[k] += d[i + k]), (ml[k] += lin[d[i + k]]));
        const n = d.length / 4;
        return { srgb: m.map((x) => +(x / n).toFixed(1)), linear: ml.map((x) => +(x / n).toFixed(4)) };
      },
      /**
       * Je Kanal Verstärkung `g` in linearem Licht, oberhalb von KNIE weich auf 1 auslaufend (keine Lichter beschnitten).
       * Wirkt auf die RGBA-Pixel `d` an Ort und Stelle (keine Neuabtastung).
       */
      verstaerken(d, g) {
        const KNIE = 0.8;
        const kurve = g.map((gk) =>
          Uint8Array.from({ length: 256 }, (_, v) => {
            const x = lin[v] * gk;
            return srgb(x <= KNIE ? x : KNIE + (1 - KNIE) * (1 - Math.exp(-(x - KNIE) / (1 - KNIE))));
          }),
        );
        for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = kurve[k][d[i + k]];
        return d;
      },
    };
  });

  for (const p of PHOTOS.filter((p) => NUR.length === 0 || NUR.includes(p.name))) {
    const t0 = Date.now();
    const res = await page.evaluate(
      async (p, edges, miniSize, q) => {
        const H = window.H;
        let voll;
        let angleich = null;
        if (/\.arw$/i.test(p.src)) {
          // RAW wie im Editor (decodeRaw → libraw-wasm), dann wie die Kamera: Objektivkorrektur der App (hier mit
          // Drehung in einem Zug, deshalb ohne die Korrektur entwickeln), Belichtung und Weißabgleich angeglichen an
          // ihre Vorschau.
          const { decodeRaw } = await import('/src/io/raw/index.ts');
          const { entzerren, leseObjektivkorrektur, objektivAbbildung } = await import('/src/io/raw/objektiv.ts');
          const buf = await (await fetch(`/${p.src}`)).arrayBuffer();
          const vorschau = await H.vorschau(buf);
          const objektiv = leseObjektivkorrektur(new Uint8Array(buf));
          if (!objektiv) throw new Error(`${p.src}: keine Objektivkorrektur in der ARW`);
          const src = await decodeRaw(new File([buf], p.src.split('/').pop()), { objektivkorrektur: false });
          const { data, width: W, height: Hh } = src.pixels;
          const leinwand = (d, w, h) => {
            const c = new OffscreenCanvas(w, h);
            c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.buffer, d.byteOffset, d.length), w, h), 0, 0);
            return c;
          };
          const ganz = (w, h) => ({ left: 0, top: 0, width: w, height: h });
          const roh = leinwand(data, W, Hh);
          const ziel = await H.messen(vorschau);
          const vorher = await H.messen(roh);
          // Verstärkung je Kanal so, dass die linearen Mittel der Vorschau getroffen werden; gemessen an einer kleinen
          // entzerrten Kopie (wegen der Schulter in einigen Runden).
          const klein = await H.verkleinern(roh, 600);
          const [kw, kh] = [klein.width, klein.height];
          const kd = entzerren({ data: H.pixel(klein), breite: kw, hoehe: kh, kanaele: 4 }, ganz(kw, kh), objektivAbbildung(objektiv, kw, kh));
          let g = [1, 1, 1];
          for (let r = 0; r < 5; r++) {
            const ist = await H.messen(leinwand(H.verstaerken(kd.slice(), g), kw, kh));
            g = g.map((gk, k) => gk * (ziel.linear[k] / ist.linear[k]));
          }
          const nachher = await H.messen(leinwand(H.verstaerken(kd.slice(), g), kw, kh));
          const abb = objektivAbbildung(objektiv, W, Hh, p.drehen);
          const fertig = leinwand(H.verstaerken(entzerren({ data, breite: W, hoehe: Hh, kanaele: 4 }, ganz(W, Hh), abb), g), W, Hh);
          angleich = { g: g.map((x) => +x.toFixed(3)), ev: +Math.log2(g[1]).toFixed(2), vorher, nachher, ziel, roh: [W, Hh], z: +abb.massstab.toFixed(4) };
          // Für die Lupe: die volle Entwicklung ohne Neuabtastung (Pixel an ihrer Stelle) als Quelle der Engine.
          if (p.name === 'klippen-quer') window.__lupeQuelle = { ...src, pixels: { data: H.verstaerken(data, g), width: W, height: Hh } };
          voll = fertig;
        } else {
          voll = await createImageBitmap(new Blob([await (await fetch(`/${p.src}`)).arrayBuffer()]));
        }
        if (p.ausschnitt) {
          const [x0, y0, x1, y1] = p.ausschnitt;
          const [w, h] = [Math.round((x1 - x0) * voll.width), Math.round((y1 - y0) * voll.height)];
          const c = new OffscreenCanvas(w, h);
          c.getContext('2d').drawImage(voll, Math.round(x0 * voll.width), Math.round(y0 * voll.height), w, h, 0, 0, w, h);
          voll = c;
        }
        const quelle = [voll.width, voll.height];
        const gross = await H.verkleinern(voll, p.editor ?? edges[1]);
        const seite = await H.verkleinern(voll, edges[0]);
        // Mini: wie object-cover mit object-position pos.
        const [mw, mh] = miniSize;
        const s = Math.max(mw / seite.width, mh / seite.height);
        const mini = new OffscreenCanvas(mw, mh);
        const gm = mini.getContext('2d');
        gm.imageSmoothingQuality = 'high';
        gm.drawImage(seite, (mw - seite.width * s) * p.pos[0], (mh - seite.height * s) * p.pos[1], seite.width * s, seite.height * s);
        if (p.name === 'klippen-quer') window.__titelQuelle = seite;
        if (p.name === 'klippen-hoch') window.__titelHochQuelle = seite;
        return { quelle, angleich, seite: await H.kodieren(seite, q), gross: await H.kodieren(gross, q), mini: await H.kodieren(mini, 80) };
      },
      p,
      [SEITE, EDITOR],
      MINI,
      QUALITAET,
    );
    console.log(`${p.name} ← ${p.src} (${res.quelle.join('×')}), ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (res.angleich) {
      const a = res.angleich;
      const f = (m) => `sRGB ${m.srgb.join('/')}, linear ${m.linear.join('/')}`;
      console.log(`  RAW ${a.roh.join('×')}, Bildfeld ×${a.z}, Verstärkung R/G/B ${a.g.join('/')} (Belichtung ${a.ev >= 0 ? '+' : ''}${a.ev} EV)`);
      console.log(`  Kamera-Vorschau: ${f(a.ziel)}\n  Entwicklung vorher: ${f(a.vorher)}\n  Entwicklung nachher: ${f(a.nachher)}`);
    }
    save(`${p.name}.jpg`, res.seite, GRENZE.seite);
    save(`gross/${p.name}.jpg`, res.gross, GRENZE.gross);
    save(`mini/${p.name}.jpg`, res.mini, GRENZE.mini);
  }

  if (NUR.length === 0) {
    // Engine der App, ohne Werkstatt: Titel aus den unkomprimierten Pixeln der Seitenfassung, Lupe aus der vollen
    // RAW-Entwicklung (100 %: ein Quellpixel je Bildpixel, Korn in Originalgröße).
    const [titel, titelHoch, lupe] = await page.evaluate(
      async (titelLook, lupe, q) => {
        const H = window.H;
        const { createEngine } = await import('/src/engine/index.ts');
        const { defaultsFor, lutFor } = await import('/src/ui/lookRegistry.ts');
        const engine = createEngine(document.createElement('canvas'));

        // Titel: links Original, rechts Look, dazwischen eine feine helle Linie mit weichem Schatten.
        async function titelBild(seite, fileName) {
          const W = seite.width;
          const Hh = seite.height;
          const px = new OffscreenCanvas(W, Hh);
          px.getContext('2d').drawImage(seite, 0, 0);
          const d = px.getContext('2d').getImageData(0, 0, W, Hh).data;
          const quelle = { id: fileName, fileName, width: W, height: Hh, colorSpace: 'srgb', pixels: { data: new Uint8Array(d.buffer), width: W, height: Hh }, meta: {}, isRaw: false };
          engine.setSource(quelle);
          const look = await engine.renderThumbnail(lutFor(titelLook), defaultsFor(titelLook), Math.max(W, Hh));
          const c = new OffscreenCanvas(W, Hh);
          const g = c.getContext('2d');
          g.drawImage(seite, 0, 0);
          const mid = Math.round(W / 2);
          g.drawImage(look, mid, 0, W - mid, Hh, mid, 0, W - mid, Hh);
          g.shadowColor = 'rgba(0,0,0,0.5)';
          g.shadowBlur = 12;
          g.fillStyle = 'rgba(255,255,255,0.92)';
          g.fillRect(mid - 1, 0, 2, Hh);
          return H.kodieren(c, q);
        }
        const quer = await titelBild(window.__titelQuelle, 'klippen-quer.jpg');
        const hoch = await titelBild(window.__titelHochQuelle, 'klippen-hoch.jpg');

        const [x, y, lw, lh] = lupe.rect;
        const src = window.__lupeQuelle;
        const bmp = await engine.renderRegion(src, lutFor(lupe.look), defaultsFor(lupe.look), { x0: x, y0: y, x1: x + lw, y1: y + lh }, lw, lh);
        engine.dispose();
        return [quer, hoch, await H.kodieren(bmp, 90)];
      },
      TITEL_LOOK,
      LUPE,
      QUALITAET,
    );
    save('titel.jpg', titel, GRENZE.titel);
    save('titel-hoch.jpg', titelHoch, GRENZE.titel);
    save('lupe.jpg', lupe, GRENZE.lupe);

    // Was nicht mehr entsteht (frühere Fotos), fällt weg.
    for (const dir of ['', 'mini/', 'gross/'])
      for (const f of readdirSync(`${OUT}/${dir}`, { withFileTypes: true }))
        if (f.isFile() && !geschrieben.has(dir + f.name)) {
          rmSync(`${OUT}/${dir}${f.name}`);
          console.log(`entfernt ${dir}${f.name}`);
        }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(fails ? 1 : 0);
