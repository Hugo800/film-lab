// Messpaare für die Leica-Looks aus Leicas Beispielbildern (nur lokal unter testbilder/, nie committen).
// Core Looks: dieselbe Aufnahme in allen Looks (1920×1280, deckungsgleich).
// Essential Looks: je Bild das Look-Foto (x 238–1919, y 80–1199) und links als Inset dieselbe Aufnahme
// in „Standard“ (x 0–661, y 421–860); das Look-Foto wird auf Inset-Größe gemittelt. Beschriftungen und
// der vom Inset verdeckte Teil fallen per Maske heraus. Leica Standard gilt als „unser“ neutrales Foto.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readImage, shrink, writePng } from './looks-lib.mjs';
import { R } from './looks-refs.mjs';

export const LEICA_DIR = `${R}/leica-offiziell`;
const CORE = {
  standard: 'Leica-Looks-Core-Standard-1920x1280.jpg', natural: 'Leica-Looks-Core-Natural-1920x1280.jpg', vivid: 'Leica-Looks-Vivid-1920x1280.jpg',
  'mono-natural': 'Leica-Looks-Core-Monochrome-1920x1280.jpg', 'mono-hc': 'Leica-Looks-Core-Monochrome-HC-1920x1280.jpg',
};
const IW = 662, IH = 439;
// Gefundene Lage je Bild wird zwischengespeichert (die Suche dauert einige Sekunden pro Bild).
const REG_CACHE = 'test-output/leica-fit/registrierung.json';
const regCache = existsSync(REG_CACHE) ? JSON.parse(readFileSync(REG_CACHE, 'utf8')) : {};

/** Dateien der Essential-Look-Serie (Name wie im Dateinamen, z. B. „Classic“, „Teal“). */
export function essentialFiles(name) {
  if (!existsSync(LEICA_DIR)) return [];
  return readdirSync(LEICA_DIR).filter((f) => new RegExp(`^Leica-Looks[-_]${name}[-_]`, 'i').test(f)).sort().map((f) => `${LEICA_DIR}/${f}`);
}

/** Flächenmittel des Rechtecks [x0, x1) × [y0, y1) (Leinwandkoordinaten) auf w×h, Float 0..1. */
function resample(img, x0, y0, x1, y1, w, h) {
  const out = new Float32Array(w * h * 3), sx = (x1 - x0) / w, sy = (y1 - y0) / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ax = x0 + x * sx, bx = ax + sx, ay = y0 + y * sy, by = ay + sy;
      let s0 = 0, s1 = 0, s2 = 0, ws = 0;
      for (let j = Math.max(0, Math.floor(ay)); j < Math.min(img.h, Math.ceil(by)); j++) {
        const wy = Math.min(by, j + 1) - Math.max(ay, j);
        for (let i = Math.max(0, Math.floor(ax)); i < Math.min(img.w, Math.ceil(bx)); i++) {
          const wgt = wy * (Math.min(bx, i + 1) - Math.max(ax, i)), p = (j * img.w + i) * 3;
          s0 += img.rgb[p] * wgt;
          s1 += img.rgb[p + 1] * wgt;
          s2 += img.rgb[p + 2] * wgt;
          ws += wgt;
        }
      }
      if (ws > 0) out.set([s0 / ws / 255, s1 / ws / 255, s2 / ws / 255], (y * w + x) * 3);
    }
  return out;
}

/** Mittelwertfilter über ein Integralbild der Helligkeit (Leinwandauflösung). */
function boxGray(img) {
  const W = img.w + 1, I = new Float64Array(W * (img.h + 1));
  for (let y = 0; y < img.h; y++) {
    let row = 0;
    for (let x = 0; x < img.w; x++) {
      const p = (y * img.w + x) * 3;
      row += 0.3 * img.rgb[p] + 0.6 * img.rgb[p + 1] + 0.1 * img.rgb[p + 2];
      I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row;
    }
  }
  return (x0, y0, x1, y1) => {
    const a = Math.max(0, Math.round(x0)), b = Math.max(0, Math.round(y0));
    const c = Math.min(img.w, Math.max(a + 1, Math.round(x1))), d = Math.min(img.h, Math.max(b + 1, Math.round(y1)));
    return (I[d * W + c] - I[b * W + c] - I[d * W + a] + I[b * W + a]) / ((c - a) * (d - b));
  };
}

/**
 * Inset (Standard) und Look-Foto auf Inset-Größe, dazu die Maske gültiger Pixel. Die Lage des Insets im Look-Foto
 * schwankt je Bild um einige Pixel und Prozent; sie wird per Korrelation der Helligkeit gesucht (Maßstab + Versatz).
 */
export async function essentialPair(file) {
  const img = await readImage(file);
  const k = img.w / 1920; // Bleach liegt in 8000×5333 vor
  const std = resample(img, 0, 421 * k, 662 * k, 860 * k, IW, IH);
  // Pixel, die in Leinwandkoordinaten (cx, cy) unter Beschriftungen oder dem Inset liegen, zählen nicht.
  const hidden = (x, y, cx, cy) =>
    (y >= 290 && y < 400 && x >= 20 && x < 430) || (cx < 676 && cy > 405 && cy < 875) || (cx > 310 && cx < 1140 && cy > 930 && cy < 1160) ||
    cx < 240 || cx > 1918 || cy < 82 || cy > 1198 || x < 2 || y < 2 || x > IW - 3 || y > IH - 3; // Rand: weißer Inset-Rahmen
  const g = boxGray(img), gs = [];
  for (let y = 4; y < IH - 4; y += 3) for (let x = 4; x < IW - 4; x += 3) gs.push(x, y, 0.3 * std[(y * IW + x) * 3] + 0.6 * std[(y * IW + x) * 3 + 1] + 0.1 * std[(y * IW + x) * 3 + 2]);
  const corr = (ox, oy, sx, sy) => {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
    for (let i = 0; i < gs.length; i += 3) {
      const cx = ox + gs[i] * sx, cy = oy + gs[i + 1] * sy;
      if (hidden(gs[i], gs[i + 1], cx + sx / 2, cy + sy / 2)) continue;
      const a = gs[i + 2], b = g(cx * k, cy * k, (cx + sx) * k, (cy + sy) * k);
      sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++;
    }
    return (sab / n - (sa / n) * (sb / n)) / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2));
  };
  // grob → fein über Maßstab (Seitenverhältnis fest) und Versatz
  const key = file.split('/').pop();
  let best = regCache[key] ?? { c: corr(238, 80, 1682 / IW, 1120 / IH), ox: 238, oy: 80, sx: 1682 / IW, sy: 1120 / IH };
  for (const [ds, dd, n] of regCache[key] ? [] : [[0.02, 6, 6], [0.005, 2, 3], [0.0015, 0.5, 2]]) {
    const b0 = { ...best };
    for (let i = -n; i <= n; i++)
      for (let jx = -n; jx <= n; jx++)
        for (let jy = -n; jy <= n; jy++) {
          const s = b0.sx + i * ds, c = corr(b0.ox + jx * dd, b0.oy + jy * dd, s, s * (b0.sy / b0.sx));
          if (c > best.c) best = { c, ox: b0.ox + jx * dd, oy: b0.oy + jy * dd, sx: s, sy: s * (b0.sy / b0.sx) };
        }
  }
  if (!regCache[key]) {
    regCache[key] = best;
    mkdirSync('test-output/leica-fit', { recursive: true });
    writeFileSync(REG_CACHE, JSON.stringify(regCache, null, 1));
  }
  const look = resample(img, best.ox * k, best.oy * k, (best.ox + IW * best.sx) * k, (best.oy + IH * best.sy) * k, IW, IH);
  const mask = new Uint8Array(IW * IH);
  for (let y = 0; y < IH; y++)
    for (let x = 0; x < IW; x++) mask[y * IW + x] = hidden(x, y, best.ox + (x + 0.5) * best.sx, best.oy + (y + 0.5) * best.sy) ? 0 : 1;
  return { w: IW, h: IH, std, look, mask, fit: best };
}

async function corePair(id) {
  const A = shrink(await readImage(`${LEICA_DIR}/${CORE.standard}`), 640);
  const B = shrink(await readImage(`${LEICA_DIR}/${CORE[id]}`), 640);
  return { w: A.w, h: A.h, std: A.rgb, look: B.rgb, mask: new Uint8Array(A.w * A.h).fill(1) };
}

/** Bildpaare eines Leica-Looks: Core-ID („natural“, „mono-hc“ …) oder Essential-Name („Classic“ …). */
export async function leicaPairs(source) {
  if (CORE[source]) return existsSync(`${LEICA_DIR}/${CORE[source]}`) ? [await corePair(source)] : [];
  return Promise.all(essentialFiles(source).map(essentialPair));
}

/**
 * Stichproben wie pairSamples in looks-fit.mjs: Standard-Pixel nach Farbe gebündelt (25 Stufen je Kanal),
 * Ziel = mittlere Look-Farbe im Bündel; jedes Bild zählt gleich.
 */
export function pairsToSamples(pairs) {
  const acc = new Map();
  for (const P of pairs) {
    let n = 0;
    for (let i = 0; i < P.mask.length; i++) n += P.mask[i];
    const w = 1 / pairs.length / n;
    for (let i = 0; i < P.mask.length; i++) {
      if (!P.mask[i]) continue;
      const a = P.std.subarray(i * 3, i * 3 + 3), b = P.look.subarray(i * 3, i * 3 + 3);
      const key = ((a[0] * 24) | 0) + 25 * (((a[1] * 24) | 0) + 25 * ((a[2] * 24) | 0));
      const e = acc.get(key) ?? [0, 0, 0, 0, 0, 0, 0];
      for (let c = 0; c < 3; c++) {
        e[c] += a[c] * w;
        e[3 + c] += b[c] * w;
      }
      e[6] += w;
      acc.set(key, e);
    }
  }
  return [...acc.values()].map((e) => ({ x: [e[0] / e[6], e[1] / e[6], e[2] / e[6]], y: [e[3] / e[6], e[4] / e[6], e[5] / e[6]], w: e[6] }));
}

/** Kontrollbild eines Paars: [Standard | Look | Maske] nebeneinander. */
export function writePairPreview(path, P) {
  const W = P.w * 3, rgb = new Float32Array(W * P.h * 3);
  for (let y = 0; y < P.h; y++)
    for (let x = 0; x < P.w; x++) {
      const s = (y * P.w + x) * 3, row = y * W;
      for (let c = 0; c < 3; c++) {
        rgb[(row + x) * 3 + c] = P.std[s + c];
        rgb[(row + P.w + x) * 3 + c] = P.look[s + c];
        rgb[(row + 2 * P.w + x) * 3 + c] = P.mask[y * P.w + x] ? P.look[s + c] : c === 0 ? 1 : 0;
      }
    }
  writePng(path, W, P.h, rgb);
}
