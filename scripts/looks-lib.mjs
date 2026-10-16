// Hilfen für looks-fit.mjs und looks-fuji-sheet.mjs (Node 22, lädt src/looks/*.ts per Type-Stripping):
// Bilder lesen/schreiben, LUT trilinear anwenden, CIELAB und ΔE2000.
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
import decode, { init } from '@jsquash/jpeg/decode.js';

let jpegReady = null;
async function readJpeg(path) {
  if (!jpegReady) {
    const wasm = await WebAssembly.compile(readFileSync(new URL('../node_modules/@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm', import.meta.url)));
    jpegReady = init(wasm);
  }
  await jpegReady;
  const buf = readFileSync(path);
  const img = await decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const rgb = new Uint8Array(img.width * img.height * 3);
  for (let i = 0; i < img.width * img.height; i++) {
    rgb[i * 3] = img.data[i * 4];
    rgb[i * 3 + 1] = img.data[i * 4 + 1];
    rgb[i * 3 + 2] = img.data[i * 4 + 2];
  }
  return { w: img.width, h: img.height, rgb };
}

function readPng(path) {
  const b = readFileSync(path);
  let p = 8, w = 0, h = 0, ctype = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8);
    const d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      ctype = d[9];
      if (d[8] !== 8 || d[12]) throw new Error(`${path}: nur 8 Bit ohne Interlacing`);
    } else if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0;
      const up = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? px[(y - 1) * stride + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++)
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = px[i * ch + (ch >= 3 ? c : 0)];
  return { w, h, rgb };
}

/** Liest JPEG oder PNG als { w, h, rgb: Uint8Array }. */
export const readImage = (path) => (/\.png$/i.test(path) ? readPng(path) : readJpeg(path));

/** Box-Verkleinerung auf höchstens maxEdge (ganzzahliger Faktor), Ergebnis Float32 0..1. */
export function shrink(img, maxEdge) {
  const k = Math.max(1, Math.ceil(Math.max(img.w, img.h) / maxEdge));
  const w = Math.floor(img.w / k), h = Math.floor(img.h / k), rgb = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += img.rgb[((y * k + j) * img.w + x * k + i) * 3 + c];
        rgb[(y * w + x) * 3 + c] = s / (k * k * 255);
      }
  return { w, h, rgb };
}

/** PNG schreiben; rgb als Float 0..1 oder Uint8. */
export function writePng(path, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const f = rgb instanceof Uint8Array ? 1 : 255;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(rgb[y * w * 3 + x] * f)));
  const chunk = (t, d) => {
    const b = Buffer.alloc(12 + d.length);
    b.writeUInt32BE(d.length, 0);
    b.write(t, 4);
    d.copy(b, 8);
    b.writeUInt32BE(zlib.crc32(b.subarray(4, 8 + d.length)) >>> 0, 8 + d.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

/** Trilinear in einer Lut3D (Eingang 0..1). */
export function sampleLut(lut, r, g, b, out) {
  const n = lut.size, d = lut.data, s = n - 1;
  const x = Math.min(s, Math.max(0, r * s)), y = Math.min(s, Math.max(0, g * s)), z = Math.min(s, Math.max(0, b * s));
  const x0 = Math.min(s - 1, x | 0), y0 = Math.min(s - 1, y | 0), z0 = Math.min(s - 1, z | 0);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  for (let c = 0; c < 3; c++) {
    const at = (i, j, k) => d[(x0 + i + (y0 + j) * n + (z0 + k) * n * n) * 3 + c];
    const c00 = at(0, 0, 0) + (at(1, 0, 0) - at(0, 0, 0)) * fx;
    const c10 = at(0, 1, 0) + (at(1, 1, 0) - at(0, 1, 0)) * fx;
    const c01 = at(0, 0, 1) + (at(1, 0, 1) - at(0, 0, 1)) * fx;
    const c11 = at(0, 1, 1) + (at(1, 1, 1) - at(0, 1, 1)) * fx;
    out[c] = (c00 + (c10 - c00) * fy) * (1 - fz) + (c01 + (c11 - c01) * fy) * fz;
  }
  return out;
}

/** Bild (Float 0..1) durch eine Funktion (r, g, b, out) schicken. */
export function mapImage(img, fn) {
  const rgb = new Float32Array(img.rgb.length), o = [0, 0, 0];
  for (let i = 0; i < img.rgb.length; i += 3) {
    fn(img.rgb[i], img.rgb[i + 1], img.rgb[i + 2], o);
    rgb[i] = o[0];
    rgb[i + 1] = o[1];
    rgb[i + 2] = o[2];
  }
  return { w: img.w, h: img.h, rgb };
}

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fLab = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
/** sRGB 0..1 → CIELAB (D65). */
export function toLab(r, g, b, out = [0, 0, 0]) {
  const R = lin(Math.min(1, Math.max(0, r))), G = lin(Math.min(1, Math.max(0, g))), B = lin(Math.min(1, Math.max(0, b)));
  const fx = fLab((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
  const fy = fLab(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
  const fz = fLab((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
  out[0] = 116 * fy - 16;
  out[1] = 500 * (fx - fy);
  out[2] = 200 * (fy - fz);
  return out;
}

const RAD = Math.PI / 180;
/**
 * ΔE2000 zwischen Lab1 (Referenz) und Lab2. Mit `parts` (Länge 3) werden die gewichteten Anteile
 * ΔL'/SL, ΔC'/SC, ΔH'/SH abgelegt (ohne RT-Term) – glatte Residuen für die Optimierung.
 */
export function dE2000(l1, a1, b1, l2, a2, b2, parts) {
  const C1 = Math.sqrt(a1 * a1 + b1 * b1), C2 = Math.sqrt(a2 * a2 + b2 * b2), Cm = (C1 + C2) / 2;
  const Cm7 = Cm ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 6103515625)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1), C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const hh = (b, a) => {
    const t = Math.atan2(b, a) / RAD;
    return t < 0 ? t + 360 : t;
  };
  const h1 = C1p === 0 ? 0 : hh(b1, a1p), h2 = C2p === 0 ? 0 : hh(b2, a2p);
  const dL = l2 - l1, dC = C2p - C1p;
  let dh = h2 - h1;
  if (C1p * C2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * RAD) / 2);
  const Lm = (l1 + l2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1 + h2;
  if (C1p * C2p !== 0) hm = Math.abs(h1 - h2) <= 180 ? hm / 2 : (hm + (hm < 360 ? 360 : -360)) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * RAD) + 0.24 * Math.cos(2 * hm * RAD) + 0.32 * Math.cos((3 * hm + 6) * RAD) - 0.2 * Math.cos((4 * hm - 63) * RAD);
  const dTh = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Cmp7 = Cmp ** 7;
  const Rc = 2 * Math.sqrt(Cmp7 / (Cmp7 + 6103515625));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T;
  const Rt = -Math.sin(2 * dTh * RAD) * Rc;
  const x = dL / Sl, y = dC / Sc, z = dH / Sh;
  if (parts) {
    parts[0] = x;
    parts[1] = y;
    parts[2] = z;
  }
  return Math.sqrt(Math.max(0, x * x + y * y + z * z + Rt * y * z));
}

/** Mittleres ΔE2000 zwischen zwei gleich großen Bildern (Float 0..1). */
export function imageDE(A, B) {
  const p = [0, 0, 0], q = [0, 0, 0];
  let s = 0;
  const n = A.w * A.h;
  for (let i = 0; i < n * 3; i += 3) {
    toLab(A.rgb[i], A.rgb[i + 1], A.rgb[i + 2], p);
    toLab(B.rgb[i], B.rgb[i + 1], B.rgb[i + 2], q);
    s += dE2000(p[0], p[1], p[2], q[0], q[1], q[2]);
  }
  return s / n;
}
