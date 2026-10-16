// Beispielfotos der Startseite: node scripts/beispiele-erzeugen.mjs  (Port TEST_PORT, Vorgabe 5190)
// 1. Verkleinert die drei freigegebenen Testfotos in Headless Chrome auf lange Kante 1600 px und kodiert sie per
//    Canvas neu als JPEG, dazu Mini-Vorschauen für die Foto-Wahl (mini/*.jpg, 168×132 = 56×44 bei @3).
// 2. Rechnet mit der echten Engine (Werkstatt der Startseite, Test-Dev-Server) das Titelbild (Klippen, halb
//    Original, halb Velvia) und den Lupen-Ausschnitt (Klippen mit Portra 400 bei 100 %, mit Korn).
// Die Neukodierung lässt EXIF, GPS und XMP weg; das sRGB-Profil, das Chrome als APP2 anhängt, streichen wir (sRGB
// gilt ohne Profil ohnehin). Am Ende wird geprüft, dass kein APPn-Segment außer JFIF bleibt.
// Nur diese drei Fotos dürfen öffentlich werden; andere Testbilder hier nie eintragen.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const OUT = 'public/beispiele';
// pos wie BEISPIELE in src/ui/start/werkstatt.ts (Ausschnitt der Mini-Vorschau).
const PHOTOS = [
  { src: 'testbilder/DSC04866.JPEG', name: 'klippen', pos: [0.5, 0.5] },
  { src: 'testbilder/DSC03427.JPEG', name: 'porsche', pos: [0.5, 0.74] },
  { src: 'testbilder/DSC03982.JPEG', name: 'garten', pos: [0.42, 0.5] },
];
const EDGE = 1600;
const MAX_BYTES = 350 * 1024;
const MINI = [168, 132];
/** Titelbild: Look rechts vom Teiler; Lupe: Look und Ausschnitt (x, y, w, h in Pixeln des 1550er-Fotos). */
const TITEL_LOOK = 'velvia';
const LUPE = { look: 'kodak-portra-400', rect: [560, 560, 640, 400] };

/** Marker aller Segmente vor den Bilddaten (APP1 = EXIF/XMP, APP2 = ICC …). */
function markers(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('kein JPEG');
  const list = [];
  for (let i = 2; i + 4 <= b.length && b[i] === 0xff; i += 2 + ((b[i + 2] << 8) | b[i + 3])) {
    if (b[i + 1] === 0xda) break;
    list.push(b[i + 1]);
  }
  return list;
}

/** Ohne APP1..APP15 (EXIF, XMP, ICC …); JFIF (APP0) und Bilddaten bleiben. */
function stripMeta(b) {
  const parts = [b.subarray(0, 2)];
  let i = 2;
  for (; i + 4 <= b.length && b[i] === 0xff && b[i + 1] !== 0xda; ) {
    const end = i + 2 + ((b[i + 2] << 8) | b[i + 3]);
    if (!(b[i + 1] >= 0xe1 && b[i + 1] <= 0xef)) parts.push(b.subarray(i, end));
    i = end;
  }
  parts.push(b.subarray(i));
  return Buffer.concat(parts);
}

let fails = 0;
/** Schreibt das JPEG ohne Metadaten und prüft Segmente und Größe. */
function save(file, res, maxBytes) {
  const out = stripMeta(Buffer.from(res.data));
  const segs = markers(out);
  const meta = segs.filter((m) => m >= 0xe1 && m <= 0xef);
  const good = meta.length === 0 && out.length <= maxBytes;
  if (!good) fails++;
  writeFileSync(`${OUT}/${file}`, out);
  console.log(
    `${good ? 'OK    ' : 'FEHLER'} ${file} ${res.w}×${res.h}, Qualität ${res.q.toFixed(2)}, ${(out.length / 1024).toFixed(0)} KB, ` +
      `Segmente ${segs.map((m) => m.toString(16)).join(' ')}${meta.length ? ' – Metadaten vorhanden!' : ''}`,
  );
}

// Im Browser: Leinwand als JPEG, Qualität absteigend bis zur Größengrenze. Als Text, damit beide Seiten sie haben.
const ENCODE = `async (canvas, maxBytes, q0 = 0.82) => {
  let blob, q;
  for (q = q0; q >= 0.5; q -= 0.04) {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: q });
    if (blob.size <= maxBytes) break;
  }
  return { w: canvas.width, h: canvas.height, q, data: [...new Uint8Array(await blob.arrayBuffer())] };
}`;

mkdirSync(`${OUT}/mini`, { recursive: true });
const server = await startDevServer();
const { browser, page } = await launch({ log: false });
try {
  await page.goto('about:blank');
  for (const p of PHOTOS) {
    const input = readFileSync(p.src).toString('base64');
    const [big, mini] = await page.evaluate(
      async (b64, edge, maxBytes, pos, miniSize, encodeSrc) => {
        const encode = eval(encodeSrc);
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const probe = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
        const k = Math.min(1, edge / Math.max(probe.width, probe.height));
        const w = Math.round(probe.width * k);
        const h = Math.round(probe.height * k);
        probe.close();
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }), { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
        const canvas = new OffscreenCanvas(w, h);
        canvas.getContext('2d').drawImage(bmp, 0, 0);
        // Mini: wie object-cover mit object-position pos.
        const [mw, mh] = miniSize;
        const s = Math.max(mw / w, mh / h);
        const small = new OffscreenCanvas(mw, mh);
        const g = small.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(bmp, (mw - w * s) * pos[0], (mh - h * s) * pos[1], w * s, h * s);
        return [await encode(canvas, maxBytes), await encode(small, 8 * 1024, 0.8)];
      },
      input,
      EDGE,
      MAX_BYTES,
      p.pos,
      MINI,
      ENCODE,
    );
    save(`${p.name}.jpg`, big, MAX_BYTES);
    save(`mini/${p.name}.jpg`, mini, 8 * 1024);
  }

  // Engine: dieselbe Werkstatt wie auf der Startseite, also genau die Looks der App.
  await page.goto(`${server.url}/`, { waitUntil: 'networkidle0' });
  const [titel, lupe] = await page.evaluate(
    async (titelLook, lupe, encodeSrc) => {
      const encode = eval(encodeSrc);
      const { createWerkstatt, beispielUrl } = await import('/src/ui/start/werkstatt.ts');
      const w = createWerkstatt();
      const bitmap = async (url) => createImageBitmap(await (await fetch(url)).blob());
      const orig = await bitmap(beispielUrl('klippen'));
      const look = await bitmap(await w.request('klippen', titelLook, 1600, 1).promise);
      const portra = await bitmap(await w.request('klippen', lupe.look, 1600, 1).promise);
      w.dispose();

      // Titel: links Original, rechts Look, dazwischen eine feine helle Linie mit weichem Schatten.
      const W = orig.width;
      const H = orig.height;
      const c = new OffscreenCanvas(W, H);
      const g = c.getContext('2d');
      g.drawImage(orig, 0, 0);
      const mid = Math.round(W / 2);
      g.drawImage(look, mid, 0, W - mid, H, mid, 0, W - mid, H);
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 10;
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.fillRect(mid - 1, 0, 2, H);

      const [x, y, lw, lh] = lupe.rect;
      const l = new OffscreenCanvas(lw, lh);
      l.getContext('2d').drawImage(portra, x, y, lw, lh, 0, 0, lw, lh);
      return [await encode(c, 200 * 1024), await encode(l, 90 * 1024)];
    },
    TITEL_LOOK,
    LUPE,
    ENCODE,
  );
  save('titel.jpg', titel, 200 * 1024);
  save('lupe.jpg', lupe, 90 * 1024);
} finally {
  await browser.close();
  await server.close();
}
process.exit(fails ? 1 : 0);
