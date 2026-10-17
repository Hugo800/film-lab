// Messpaare für die Ricoh-Effekte (GR IV) aus Vergleichsserien im Netz – nur lokal unter testbilder/referenz/ricoh/,
// nie committen (Rechte bei den Fotografen bzw. Ricoh). Je Serie dieselbe Szene in „Standard“ und im Effekt:
// - asobinet-gr4: alle Effekte, 375×500, aus einer RAW-Datei in der Kamera entwickelt (deckungsgleich).
// - grblog-gr4-official: Ricohs GR-Blog, 6 Effekte, 1120×747, einzelne Bilder um einige Pixel verschoben.
// - mawari-gr4: alle Effekte, 4096×2731, nacheinander aus der Hand aufgenommen (Versatz, leichte Drehung).
// Jedes Effektbild wird auf das Standard-Bild ausgerichtet (Ähnlichkeitstransformation, Korrelation der Helligkeit).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readImage, shrink } from './looks-lib.mjs';
import { R } from './looks-refs.mjs';

export const RICOH_DIR = `${R}/ricoh`;
const SERIES = [
  { dir: 'asobinet-gr4', edge: 500, name: (e) => `${String(ORDER.indexOf(e) + 1).padStart(2, '0')}-${e}.jpg` },
  { dir: 'grblog-gr4-official', edge: 1120, name: (e) => `${e}.jpg` },
  // Aus der Hand: Nach der Ausrichtung bleiben einige Pixel Versatz (Perspektive) – Kanten fallen per Maske heraus.
  { dir: 'mawari-gr4', edge: 1024, kanten: true, name: (e) => `${String(ORDER.indexOf(e) + 1).padStart(2, '0')}-${e}.jpg` },
];
// Reihenfolge wie im Kameramenü der GR IV (= Dateinummern der Serien).
const ORDER = ['standard', 'vivid', 'monotone', 'soft-monotone', 'hard-monotone', 'hi-contrast-bw', 'negative-film', 'positive-film',
  'cinema-yellow', 'cinema-green', 'cross-process', 'bleach-bypass', 'retro', 'hdr-tone'];

const REG_CACHE = 'test-output/ricoh-fit/registrierung.json';
const regCache = existsSync(REG_CACHE) ? JSON.parse(readFileSync(REG_CACHE, 'utf8')) : {};

const luma = (img) => {
  const L = new Float32Array(img.w * img.h);
  for (let i = 0; i < L.length; i++) L[i] = 0.3 * img.rgb[i * 3] + 0.6 * img.rgb[i * 3 + 1] + 0.1 * img.rgb[i * 3 + 2];
  return { w: img.w, h: img.h, L };
};

/** Bilinear, Koordinaten in Pixeln; NaN außerhalb. */
function bilinear(img, ch, x, y, c) {
  if (x < 0 || y < 0 || x > img.w - 1 || y > img.h - 1) return NaN;
  const x0 = Math.min(img.w - 2, x | 0), y0 = Math.min(img.h - 2, y | 0), fx = x - x0, fy = y - y0;
  const at = (i, j) => img[ch][((y0 + j) * img.w + x0 + i) * (ch === 'L' ? 1 : 3) + c];
  return (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy;
}

/** Ähnlichkeit (s, θ, tx, ty) um die Bildmitte: Standardpunkt → Effektpunkt (beide in Arbeitspixeln). */
const mapPt = (T, w, h, x, y) => {
  const cx = w / 2, cy = h / 2, c = Math.cos(T.th) * T.s, s = Math.sin(T.th) * T.s;
  return [cx + c * (x - cx) - s * (y - cy) + T.tx, cy + s * (x - cx) + c * (y - cy) + T.ty];
};

/** Korrelation der Helligkeit auf einem Gitter von Stichpunkten. */
function ncc(A, B, T, step) {
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  for (let y = step; y < A.h - step; y += step)
    for (let x = step; x < A.w - step; x += step) {
      const [u, v] = mapPt(T, A.w, A.h, x, y);
      const b = bilinear(B, 'L', u, v, 0);
      if (Number.isNaN(b)) continue;
      const a = A.L[y * A.w + x];
      sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++;
    }
  return n < 100 ? -1 : (sab / n - (sa / n) * (sb / n)) / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2) + 1e-12);
}

/** Grob: Versatz auf einem Viertel der Auflösung absuchen; fein: Koordinatenabstieg über alle vier Größen. */
function register(A, B) {
  const q = (img) => luma(shrinkF(img, 4));
  const a4 = q(A.src), b4 = q(B.src);
  let best = { s: 1, th: 0, tx: 0, ty: 0 }, bc = ncc(a4, b4, best, 2);
  const R4 = Math.round(Math.max(a4.w, a4.h) * 0.06);
  for (let ty = -R4; ty <= R4; ty++)
    for (let tx = -R4; tx <= R4; tx++) {
      const c = ncc(a4, b4, { s: 1, th: 0, tx, ty }, 3);
      if (c > bc) [bc, best] = [c, { s: 1, th: 0, tx, ty }];
    }
  let T = { ...best, tx: best.tx * 4, ty: best.ty * 4 }, c = ncc(A, B, T, 4);
  for (const k of [1, 0.25, 0.06]) {
    const steps = { tx: 2 * k, ty: 2 * k, th: 0.002 * k, s: 0.002 * k };
    for (let it = 0, moved = true; it < 40 && moved; it++) {
      moved = false;
      for (const p of ['tx', 'ty', 'th', 's'])
        for (const d of [-1, 1]) {
          const U = { ...T, [p]: T[p] + d * steps[p] }, cu = ncc(A, B, U, 4);
          if (cu > c) [c, T, moved] = [cu, U, true];
        }
    }
  }
  return { ...T, c };
}

/** Box-Verkleinerung um einen ganzzahligen Faktor (Float 0..1 bleibt Float). */
function shrinkF(img, k) {
  const w = Math.floor(img.w / k), h = Math.floor(img.h / k), rgb = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += img.rgb[((y * k + j) * img.w + x * k + i) * 3 + c];
        rgb[(y * w + x) * 3 + c] = s / (k * k);
      }
  return { w, h, rgb };
}

async function pairOf(series, effekt) {
  const fa = `${RICOH_DIR}/${series.dir}/${series.name('standard')}`, fb = `${RICOH_DIR}/${series.dir}/${series.name(effekt)}`;
  if (!existsSync(fa) || !existsSync(fb)) return null;
  const sa = shrink(await readImage(fa), series.edge), sb = shrink(await readImage(fb), series.edge);
  const A = { ...luma(sa), src: sa }, B = { ...luma(sb), src: sb, rgb: sb.rgb };
  const key = `${series.dir}/${effekt}`;
  const T = regCache[key] ?? register(A, B);
  if (!regCache[key]) {
    regCache[key] = T;
    mkdirSync('test-output/ricoh-fit', { recursive: true });
    writeFileSync(REG_CACHE, JSON.stringify(regCache, null, 1));
  }
  const n = sa.w * sa.h, look = new Float32Array(n * 3), mask = new Uint8Array(n);
  for (let y = 0; y < sa.h; y++)
    for (let x = 0; x < sa.w; x++) {
      const [u, v] = mapPt(T, sa.w, sa.h, x, y), i = y * sa.w + x;
      if (u < 2 || v < 2 || u > sb.w - 3 || v > sb.h - 3) continue;
      for (let c = 0; c < 3; c++) look[i * 3 + c] = bilinear(B, 'rgb', u, v, c);
      mask[i] = 1;
    }
  if (series.kanten) kantenAus(A, mask);
  return { w: sa.w, h: sa.h, std: sa.rgb, look, mask, fit: T, key };
}

/** Pixel mit Helligkeitssprung im Umkreis von 3 px (Standardbild) aus der Maske nehmen. */
function kantenAus(A, mask) {
  const r = 3, lim = 0.06;
  for (let y = 0; y < A.h; y++)
    for (let x = 0; x < A.w; x++) {
      let lo = 1, hi = 0;
      for (let j = Math.max(0, y - r); j <= Math.min(A.h - 1, y + r); j++)
        for (let i = Math.max(0, x - r); i <= Math.min(A.w - 1, x + r); i++) {
          const v = A.L[j * A.w + i];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      if (hi - lo > lim) mask[y * A.w + x] = 0;
    }
}

// Farbtafel der asobinet-Serie (14 Zeilen = Effekte in ORDER-Reihenfolge, 9 Felder je Zeile): deckt Grün, Gelb, Rot
// und Magenta ab, die in den Szenen fehlen. Felder: Marineblau (rechte Hälfte, links die Beschriftung), Cyan, Grün,
// Gelb, Rot, Magenta, Grau, Schwarz (linke Hälfte, rechts das Wasserzeichen); das neunte Feld bleibt weg.
const FELDER = [[0.55, 0.95], [0.2, 0.8], [0.2, 0.8], [0.2, 0.8], [0.2, 0.8], [0.2, 0.8], [0.2, 0.8], [0.1, 0.45]];

/** Mittlere Farbe (0..1) je Effekt und Feld: { effekt: [[r, g, b] × 8] }. */
export async function tafel() {
  const img = await readImage(`${RICOH_DIR}/asobinet-gr4/farbtafel-14-modi.jpg`);
  const zh = img.h / ORDER.length, fw = img.w / 9, out = {};
  ORDER.forEach((z, zi) => {
    out[z] = FELDER.map(([a, b], fi) => {
      const s = [0, 0, 0];
      let n = 0;
      for (let y = Math.round((zi + 0.3) * zh); y < (zi + 0.7) * zh; y++)
        for (let x = Math.round((fi + a) * fw); x < (fi + b) * fw; x++) {
          for (let c = 0; c < 3; c++) s[c] += img.rgb[(y * img.w + x) * 3 + c];
          n++;
        }
      return s.map((v) => v / n / 255);
    });
  });
  return out;
}

/** Tafel als Messpaar (8 Felder). Retro nicht: die Feldstreifen liegen im abgedunkelten Rand, Lage unbekannt. */
async function tafelPaar(effekt) {
  if (effekt === 'retro' || !existsSync(`${RICOH_DIR}/asobinet-gr4/farbtafel-14-modi.jpg`)) return null;
  const T = await tafel();
  if (!T[effekt]) return null;
  return { w: 8, h: 1, std: Float32Array.from(T.standard.flat()), look: Float32Array.from(T[effekt].flat()), mask: new Uint8Array(8).fill(1), key: 'asobinet-gr4/farbtafel' };
}

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);

// Retro dunkelt die Ränder ab (Firmware: eigener Schritt außerhalb der Farbabstimmung). Gemessen in beiden Serien
// gleich (Effekt/Standard in linearem Licht, Mitteltöne): r = Abstand zur Mitte / halbe Diagonale → Blendenstufen.
// Wird vor der Anpassung herausgerechnet; im Look übernimmt der Vignette-Regler.
const RETRO_VIGNETTE = [[0, 0], [0.15, 0], [0.4, -0.27], [0.6, -0.72], [0.78, -1.33], [0.92, -1.95], [1, -2.2]];
const RETRO_MAX_R = 0.75; // weiter außen zu wenig Signal

function ohneVignette(p) {
  const cx = p.w / 2, cy = p.h / 2, R = Math.hypot(cx, cy);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x, r = Math.hypot(x - cx, y - cy) / R;
      if (r > RETRO_MAX_R) {
        p.mask[i] = 0;
        continue;
      }
      const k = RETRO_VIGNETTE.findIndex(([a], j) => r >= a && r <= RETRO_VIGNETTE[j + 1][0]);
      const [[r0, e0], [r1, e1]] = [RETRO_VIGNETTE[k], RETRO_VIGNETTE[k + 1]];
      const g = 2 ** -(e0 + ((e1 - e0) * (r - r0)) / (r1 - r0));
      for (let c = 0; c < 3; c++) p.look[i * 3 + c] = Math.min(1, enc(lin(p.look[i * 3 + c]) * g));
    }
}

/** Mittleres log2(Effekt/Standard) in linearem Licht über neutrale Mitteltöne. */
function helligkeit(p) {
  let s = 0, n = 0;
  for (let i = 0; i < p.mask.length; i++) {
    if (!p.mask[i]) continue;
    const a = p.std.subarray(i * 3, i * 3 + 3), b = p.look.subarray(i * 3, i * 3 + 3);
    if (Math.max(...a) - Math.min(...a) > 0.06) continue;
    const la = 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
    const lb = 0.2126 * lin(b[0]) + 0.7152 * lin(b[1]) + 0.0722 * lin(b[2]);
    if (la < 0.04 || la > 0.4 || lb <= 0) continue;
    s += Math.log2(lb / la);
    n++;
  }
  return n > 200 ? s / n : null;
}

/**
 * Bildpaare eines Effekts („positive-film“ …) aus allen Serien, die ihn enthalten. Die Serie aus der Hand hat je
 * Aufnahme eine eigene Belichtung (Auto-ISO): ihr Effektbild wird in linearem Licht auf die Helligkeit gebracht,
 * die die deckungsgleichen Serien für diesen Effekt zeigen.
 */
export async function ricohPairs(effekt) {
  const out = [];
  for (const s of SERIES) {
    const p = await pairOf(s, effekt);
    if (!p) continue;
    if (effekt === 'retro') ohneVignette(p);
    p.kanten = !!s.kanten;
    out.push(p);
  }
  const t = await tafelPaar(effekt);
  if (t) out.push(t);
  const ref = out.filter((p) => !p.kanten && p !== t).map(helligkeit).filter((v) => v !== null);
  for (const p of out.filter((q) => q.kanten)) {
    const h = helligkeit(p);
    if (h === null || ref.length === 0) continue;
    const g = 2 ** (ref.reduce((a, b) => a + b, 0) / ref.length - h);
    p.belichtung = Math.log2(g);
    for (let i = 0; i < p.look.length; i++) p.look[i] = Math.min(1, enc(lin(p.look[i]) * g));
  }
  return out;
}
