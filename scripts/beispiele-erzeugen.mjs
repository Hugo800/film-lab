// Beispielfotos der Startseite: node scripts/beispiele-erzeugen.mjs  (Port TEST_PORT, Vorgabe 5190)
// Je Foto zwei Fassungen: quer (PC, Querformat) und hoch (Handy hochkant); Namen und Ausschnitte wie BEISPIELE in
// src/ui/start/werkstatt.ts. Alles läuft in Headless Chrome auf dem Test-Dev-Server:
// 1. Quelle öffnen: JPEG per createImageBitmap (Chrome rechnet Display P3 nach sRGB), Sony-RAW (ARW) mit der
//    RAW-Entwicklung der App (loadFile aus src/io, libraw-wasm), ohne Look. Danach wie in der Kamera: Verzeichnung und
//    Farbsäume nach den Korrekturdaten in der ARW entzerren (libraw tut das nicht), Belichtung und Weißabgleich an die
//    Kamera-Vorschau in der ARW angleichen (je Kanal eine Verstärkung in linearem Licht mit weicher Schulter, so dass
//    die Mittelwerte übereinstimmen; Messwerte im Protokoll), bei Bedarf den Horizont gerade drehen.
// 2. Daraus: Seitenfassung (lange Kante 2048, im Precache der App), Editor-Fassung gross/ (lange Kante 4000, nur
//    beim Öffnen im Editor geladen) und die Mini-Vorschau der Foto-Wahl (mini/, 168×132 = 56×44 bei @3).
// 3. Mit der Engine der App: Titelbild (Klippen quer, halb Original, halb Velvia) und Lupe (Klippen mit Portra 400,
//    echter 100-%-Ausschnitt aus der vollen RAW-Auflösung).
// Kodiert wird mit mozjpeg wie der Export der App (encodeJpeg); EXIF, GPS, XMP und ICC entfallen dabei. Am Ende wird
// geprüft, dass kein APPn-Segment außer JFIF bleibt. Dateien aus früheren Läufen, die nicht mehr entstehen, werden
// gelöscht. Nur diese Fotos dürfen öffentlich werden; andere Testbilder hier nie eintragen.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const OUT = 'public/beispiele';
// pos wie in BEISPIELE (src/ui/start/werkstatt.ts): Ausschnitt der Mini-Vorschau.
// drehen: Horizont gerade (Grad im Uhrzeigersinn), gemessen an der Kamera-Vorschau der ARW (−1,46° geneigt).
// editor: kleinere Editor-Fassung, wo 4000 px zu viel zeigen (Straße: ab ~2500 px Kennzeichen lesbar).
const PHOTOS = [
  { name: 'klippen-quer', src: 'testbilder/DSC04866.ARW', pos: [0.5, 0.5], drehen: 1.46 },
  { name: 'klippen-hoch', src: 'testbilder/DSC04824.ARW', pos: [0.5, 0.7] },
  { name: 'sonnenuntergang-quer', src: 'testbilder/IMG_0341.JPEG', pos: [0.5, 0.5] },
  { name: 'sonnenuntergang-hoch', src: 'testbilder/IMG_0366.JPEG', pos: [0.5, 0.4] },
  { name: 'nachts-quer', src: 'testbilder/IMG_0558.JPEG', pos: [0.3, 0.5] },
  { name: 'nachts-hoch', src: 'testbilder/IMG_0562.JPEG', pos: [0.5, 0.7] },
  { name: 'garten-quer', src: 'testbilder/DSC03982.JPEG', pos: [0.42, 0.5] },
  { name: 'garten-hoch', src: 'testbilder/IMG_0148.JPEG', pos: [0.5, 0.7], editor: 2048 },
];
/** Lange Kante: Seite wie GROSS in werkstatt.ts, Editor-Fassung; kleinere Quellen bleiben in voller Größe. */
const SEITE = 2048;
const EDITOR = 4000;
const MINI = [168, 132];
/** JPEG-Qualität (mozjpeg, 1–100). */
const QUALITAET = 88;
/** Obergrenzen je Datei: nur gegen Ausreißer, die Qualität bleibt fest. */
const GRENZE = { seite: 1100 * 1024, gross: 4 * 1024 * 1024, mini: 12 * 1024, titel: 1100 * 1024, lupe: 700 * 1024 };
/** Titelbild: Look rechts vom Teiler; Lupe: Look und Ausschnitt (x, y, w, h in Pixeln der RAW-Entwicklung, 6000×4000). */
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
       * Objektivkorrektur, die die Kamera für ihr JPEG anwendet, aus der ARW (SubIFD der Rohdaten, je 11 Stützstellen
       * über den Radius bis zur halben Diagonale): 0x7037 Verzeichnung, 0x7035 Farbsäume (erst Rot, dann Blau). Ohne sie
       * zeigt das 16-50 bei 16 mm stark tonnenförmige Verzeichnung. Die Vignettierung (0x7032) gleicht die
       * Kamera-Vorschau nicht aus (gemessen), sie bleibt deshalb.
       */
      objektiv(buf) {
        const v = new DataView(buf);
        const le = v.getUint8(0) === 0x49;
        const found = {};
        const seen = new Set();
        const walk = (off) => {
          if (!off || seen.has(off) || off + 2 > buf.byteLength) return;
          seen.add(off);
          const n = v.getUint16(off, le);
          for (let i = 0; i < n; i++) {
            const e = off + 2 + i * 12;
            const tag = v.getUint16(e, le);
            const count = v.getUint32(e + 4, le);
            if (tag === 0x14a) for (let k = 0; k < count; k++) walk(count === 1 ? v.getUint32(e + 8, le) : v.getUint32(v.getUint32(e + 8, le) + 4 * k, le));
            if (tag === 0x7035 || tag === 0x7037) {
              const at = v.getUint32(e + 8, le);
              found[tag] = Array.from({ length: count }, (_, k) => v.getInt16(at + 2 * k, le));
            }
          }
          walk(v.getUint32(off + 2 + n * 12, le));
        };
        walk(v.getUint32(4, le));
        const [verz, ca] = [found[0x7037], found[0x7035]];
        if (!verz || !ca) return null;
        const nc = verz[0];
        return { verzeichnung: verz.slice(1, nc + 1), caRot: ca.slice(1, nc + 1), caBlau: ca.slice(nc + 1, 2 * nc + 1) };
      },
      /**
       * Eine Bildpassage in einem Zug: Verzeichnung und Farbsäume (Neuabtastung, bilinear in linearem Licht), auf Wunsch
       * gerade gedreht; der Maßstab füllt wie in der Kamera das ganze Bild (größtes Bildfeld ohne leere Ränder). Je Kanal
       * Verstärkung `g` in linearem Licht, oberhalb von KNIE weich auf 1 auslaufend (keine Lichter beschnitten). Ohne
       * `geometrie` bleibt jedes Pixel an seiner Stelle (für die 100-%-Lupe ohne Neuabtastung).
       */
      korrigieren(src, W, Hh, { g, objektiv, drehen = 0, geometrie = true }) {
        const nc = objektiv.verzeichnung.length;
        // Faktor Ausgabe → Quelle je Kanal als Tabelle über den Radius 0 … RMAX (in halben Diagonalen, N Stufen),
        // jenseits der letzten Stützstelle konstant.
        const N = 6144;
        const RMAX = 1.5;
        const spline = (werte) => Float32Array.from({ length: N + 1 }, (_, i) => {
          const t = Math.min(1, (i / N) * RMAX) * (nc - 1);
          const k = Math.min(nc - 2, Math.floor(t));
          return werte[k] + (werte[k + 1] - werte[k]) * (t - k);
        });
        const d = objektiv.verzeichnung.map((x) => x / 16384 + 1);
        const fak = geometrie
          ? [spline(d.map((x, i) => x * (objektiv.caRot[i] / 2097152 + 1))), spline(d), spline(d.map((x, i) => x * (objektiv.caBlau[i] / 2097152 + 1)))]
          : [1, 1, 1].map(() => new Float32Array(N + 1).fill(1));
        const KNIE = 0.8;
        const M = 1 << 16;
        const LMAX = 4;
        const aus = Uint8Array.from({ length: M }, (_, i) => {
          const x = (i / M) * LMAX;
          return srgb(x <= KNIE ? x : KNIE + (1 - KNIE) * (1 - Math.exp(-(x - KNIE) / (1 - KNIE))));
        });
        const t = geometrie ? (drehen * Math.PI) / 180 : 0;
        const cos = Math.cos(t);
        const sin = Math.sin(t);
        const R = Math.hypot(W / 2, Hh / 2);
        const index = (cx, cy) => Math.min(N, Math.round((Math.hypot(cx, cy) / R / RMAX) * N));
        // Größter Maßstab z, bei dem jeder Randpunkt der Ausgabe (gedreht, entzerrt, je Kanal) noch in der Quelle liegt.
        const passt = (z) => {
          for (let k = 0; k <= 400; k++) {
            const u = k / 400 - 0.5;
            for (const [ox, oy] of [[u * W, -Hh / 2], [u * W, Hh / 2], [-W / 2, u * Hh], [W / 2, u * Hh]]) {
              const cx = z * (ox * cos + oy * sin);
              const cy = z * (-ox * sin + oy * cos);
              const ri = index(cx, cy);
              for (const f of fak) if (Math.abs(cx * f[ri]) > W / 2 || Math.abs(cy * f[ri]) > Hh / 2) return false;
            }
          }
          return true;
        };
        let z = 1;
        if (geometrie) {
          let [lo, hi] = [0.5, RMAX];
          for (let i = 0; i < 30; i++) [lo, hi] = passt((lo + hi) / 2) ? [(lo + hi) / 2, hi] : [lo, (lo + hi) / 2];
          z = lo;
        }
        const out = new Uint8ClampedArray(W * Hh * 4);
        for (let y = 0; y < Hh; y++) {
          for (let x = 0; x < W; x++) {
            const ox = x + 0.5 - W / 2;
            const oy = y + 0.5 - Hh / 2;
            const cx = z * (ox * cos + oy * sin);
            const cy = z * (-ox * sin + oy * cos);
            const ri = index(cx, cy);
            const o = (y * W + x) * 4;
            for (let k = 0; k < 3; k++) {
              const f = fak[k][ri];
              const sx = Math.min(W - 1, Math.max(0, W / 2 + cx * f - 0.5));
              const sy = Math.min(Hh - 1, Math.max(0, Hh / 2 + cy * f - 0.5));
              const x0 = Math.floor(sx);
              const y0 = Math.floor(sy);
              const x1 = Math.min(W - 1, x0 + 1);
              const y1 = Math.min(Hh - 1, y0 + 1);
              const fx = sx - x0;
              const fy = sy - y0;
              const a = (y0 * W + x0) * 4 + k;
              const b = (y0 * W + x1) * 4 + k;
              const c = (y1 * W + x0) * 4 + k;
              const e = (y1 * W + x1) * 4 + k;
              const l = (lin[src[a]] * (1 - fx) + lin[src[b]] * fx) * (1 - fy) + (lin[src[c]] * (1 - fx) + lin[src[e]] * fx) * fy;
              out[o + k] = aus[Math.min(M - 1, ((l * g[k]) / LMAX) * M) | 0];
            }
            out[o + 3] = 255;
          }
        }
        this.massstab = z;
        return new ImageData(out, W, Hh);
      },
    };
  });

  for (const p of PHOTOS) {
    const t0 = Date.now();
    const res = await page.evaluate(
      async (p, edges, miniSize, q) => {
        const H = window.H;
        let voll;
        let angleich = null;
        if (/\.arw$/i.test(p.src)) {
          // RAW wie im Editor (loadFile → libraw-wasm), dann wie die Kamera: Objektivkorrektur, Belichtung und
          // Weißabgleich angeglichen an ihre Vorschau.
          const { loadFile } = await import('/src/io/index.ts');
          const buf = await (await fetch(`/${p.src}`)).arrayBuffer();
          const vorschau = await H.vorschau(buf);
          const objektiv = H.objektiv(buf);
          if (!objektiv) throw new Error(`${p.src}: keine Objektivkorrektur in der ARW`);
          const src = await loadFile(new File([buf], p.src.split('/').pop()));
          const { data, width: W, height: Hh } = src.pixels;
          const leinwand = (img) => {
            const c = new OffscreenCanvas(img.width, img.height);
            c.getContext('2d').putImageData(img, 0, 0);
            return c;
          };
          const roh = leinwand(new ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), W, Hh));
          const ziel = await H.messen(vorschau);
          const vorher = await H.messen(roh);
          // Verstärkung je Kanal so, dass die linearen Mittel der Vorschau getroffen werden; gemessen an einer kleinen
          // Kopie mit derselben Korrektur (wegen der Schulter in einigen Runden).
          const klein = await H.verkleinern(roh, 600);
          const kd = H.pixel(klein);
          let g = [1, 1, 1];
          for (let r = 0; r < 5; r++) {
            const ist = await H.messen(leinwand(H.korrigieren(kd, klein.width, klein.height, { g, objektiv })));
            g = g.map((gk, k) => gk * (ziel.linear[k] / ist.linear[k]));
          }
          const nachher = await H.messen(leinwand(H.korrigieren(kd, klein.width, klein.height, { g, objektiv })));
          const fertig = leinwand(H.korrigieren(data, W, Hh, { g, objektiv, drehen: p.drehen }));
          const z = H.massstab;
          angleich = { g: g.map((x) => +x.toFixed(3)), ev: +Math.log2(g[1]).toFixed(2), vorher, nachher, ziel, roh: [W, Hh], z: +z.toFixed(4) };
          // Für die Lupe: die volle Entwicklung ohne Neuabtastung (Pixel an ihrer Stelle) als Quelle der Engine.
          if (p.name === 'klippen-quer') {
            const l = H.korrigieren(data, W, Hh, { g, objektiv, geometrie: false });
            window.__lupeQuelle = { ...src, pixels: { data: new Uint8Array(l.data.buffer), width: W, height: Hh } };
          }
          voll = fertig;
        } else {
          voll = await createImageBitmap(new Blob([await (await fetch(`/${p.src}`)).arrayBuffer()]));
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

  // Engine der App, ohne Werkstatt: Titel aus den unkomprimierten Pixeln der Seitenfassung, Lupe aus der vollen
  // RAW-Entwicklung (100 %: ein Quellpixel je Bildpixel, Korn in Originalgröße).
  const [titel, lupe] = await page.evaluate(
    async (titelLook, lupe, q) => {
      const H = window.H;
      const { createEngine } = await import('/src/engine/index.ts');
      const { defaultsFor, lutFor } = await import('/src/ui/lookRegistry.ts');
      const seite = window.__titelQuelle;
      const W = seite.width;
      const Hh = seite.height;
      const px = new OffscreenCanvas(W, Hh);
      px.getContext('2d').drawImage(seite, 0, 0);
      const d = px.getContext('2d').getImageData(0, 0, W, Hh).data;
      const quelle = { id: 'titel', fileName: 'klippen-quer.jpg', width: W, height: Hh, colorSpace: 'srgb', pixels: { data: new Uint8Array(d.buffer), width: W, height: Hh }, meta: {}, isRaw: false };
      const engine = createEngine(document.createElement('canvas'));
      engine.setSource(quelle);
      const look = await engine.renderThumbnail(lutFor(titelLook), defaultsFor(titelLook), Math.max(W, Hh));

      // Titel: links Original, rechts Look, dazwischen eine feine helle Linie mit weichem Schatten.
      const c = new OffscreenCanvas(W, Hh);
      const g = c.getContext('2d');
      g.drawImage(seite, 0, 0);
      const mid = Math.round(W / 2);
      g.drawImage(look, mid, 0, W - mid, Hh, mid, 0, W - mid, Hh);
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 12;
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.fillRect(mid - 1, 0, 2, Hh);

      const [x, y, lw, lh] = lupe.rect;
      const src = window.__lupeQuelle;
      const bmp = await engine.renderRegion(src, lutFor(lupe.look), defaultsFor(lupe.look), { x0: x, y0: y, x1: x + lw, y1: y + lh }, lw, lh);
      engine.dispose();
      return [await H.kodieren(c, q), await H.kodieren(bmp, 90)];
    },
    TITEL_LOOK,
    LUPE,
    QUALITAET,
  );
  save('titel.jpg', titel, GRENZE.titel);
  save('lupe.jpg', lupe, GRENZE.lupe);

  // Was nicht mehr entsteht (frühere Fotos), fällt weg.
  for (const dir of ['', 'mini/', 'gross/'])
    for (const f of readdirSync(`${OUT}/${dir}`, { withFileTypes: true }))
      if (f.isFile() && !geschrieben.has(dir + f.name)) {
        rmSync(`${OUT}/${dir}${f.name}`);
        console.log(`entfernt ${dir}${f.name}`);
      }
} finally {
  await browser.close();
  await server.close();
}
process.exit(fails ? 1 : 0);
