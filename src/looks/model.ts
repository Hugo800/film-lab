// Parametrisches Farbmodell „Provia → Simulation“: aus einer Look-Beschreibung wird eine 3D-LUT.
// Ablauf je Gitterpunkt (Eingang sRGB): Kanalmischung in linearem Licht → Tonkurve je Kanal (sRGB)
// → OKLCh: Buntheit (gesamt, nach Helligkeit, Kompression starker Farben), je Farbton Buntheit,
// Farbton und Helligkeit, weiche Gamut-Kompression → sRGB. SW: Kanalgewichte → Tonkurve → ggf. Tönung.
// Die Zahlen der Kamera-Looks stammen aus scripts/looks-fit.mjs.
import type { Lut3D } from '../types';

export type Vec3 = [number, number, number];

/** Eingangswerte (sRGB) der Stützstellen jeder Tonkurve – unten dichter für Schatten. */
export const CURVE_X = [0, 0.03, 0.07, 0.12, 0.2, 0.3, 0.42, 0.55, 0.7, 0.85, 1] as const;

export interface LookSpec {
  /** 3×3-Matrix zeilenweise in linearem Licht (Übersprechen der Farbschichten). Zeilensummen 1 halten Grau neutral. */
  matrix?: number[];
  /** Tonkurven R, G, B: Ausgangswerte (sRGB) an den Stellen CURVE_X, monoton steigend. Bei SW gilt nur die erste. */
  curves?: [number[], number[], number[]] | [number[]];
  /** Buntheitsfaktor gesamt. */
  saturation?: number;
  /** Kompression starker Farben: C' = C·saturation/(1 + chromaKnee·C), C in OKLab. */
  chromaKnee?: number;
  /** Zusätzlicher Buntheitsfaktor in den Schatten bzw. Lichtern. */
  shadowSat?: number;
  highlightSat?: number;
  /**
   * Je Farbton (OKLCh, n Werte gleichmäßig ab 0°, periodisch interpoliert):
   * Buntheitsfaktor, Farbtonverschiebung in Grad, Helligkeitsänderung in OKLab-L.
   */
  hueSat?: number[];
  hueShift?: number[];
  hueLight?: number[];
  /** Schwarzweiß: Kanalgewichte in linearem Licht (werden auf Summe 1 normiert, einzelne dürfen negativ sein). */
  bw?: Vec3;
  /** Tönung des SW-Bilds als OKLab-(a, b), zu Schwarz und Weiß hin ausgeblendet (z. B. Sepia). */
  tint?: [number, number];
  /** Tönung zum Weiß hin (OKLab a, b): statt auszublenden geht `tint` in den Lichtern in diesen Wert über (z. B. cremeweißes Papier). */
  tintWhite?: [number, number];
}

function toLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function toSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function linToOklab(r: number, g: number, b: number, out: number[]): void {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  out[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}

function oklabToLin(L: number, a: number, b: number, out: number[]): void {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  // x*x*x statt ** 3: Math.pow ist hier der größte Zeitfresser beim LUT-Bau.
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}

/** 1D-Funktion auf 0..1 als gleichmäßige Tabelle; Abfrage per `lookup` (Top-Level, damit V8 inlinen kann). */
const TAB_N = 2048;
function tabulate(f: (x: number) => number): Float64Array {
  const t = new Float64Array(TAB_N + 2);
  for (let i = 0; i <= TAB_N; i++) t[i] = f(i / TAB_N);
  t[TAB_N + 1] = t[TAB_N];
  return t;
}

/** x wird auf 0..1 begrenzt. */
function lookup(t: Float64Array, x: number): number {
  const u = (x <= 0 ? 0 : x >= 1 ? 1 : x) * TAB_N;
  const i = u | 0;
  return t[i] + (t[i + 1] - t[i]) * (u - i);
}

// Tabelle für linear → sRGB: quadratisch dichter bei 0 (steiler Anfang der sRGB-Kurve).
const SRGB_T = tabulate((u) => toSrgb(u * u));
const srgbOf = (lin: number) => lookup(SRGB_T, Math.sqrt(lin <= 0 ? 0 : lin));
const LIN_T = tabulate(toLinear);

/** Monotone kubische Interpolation (Fritsch–Carlson) durch (CURVE_X, ys). */
export function curveFn(ys: readonly number[]): (x: number) => number {
  const xs = CURVE_X;
  const n = xs.length;
  if (ys.length !== n) throw new Error(`Tonkurve braucht ${n} Werte`);
  const y = ys.slice();
  for (let i = 1; i < n; i++) if (y[i] < y[i - 1] + 1e-5) y[i] = y[i - 1] + 1e-5;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (xs[i + 1] - xs[i]));
  const m = new Array<number>(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      // gewichtetes harmonisches Mittel (Fritsch–Butland), hält die Kurve monoton
      const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]);
      const w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]);
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return (x) => {
    if (x <= 0) return y[0];
    if (x >= 1) return y[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** Periodische Catmull-Rom-Interpolation von n gleichmäßig über 360° verteilten Werten, an der Stelle deg. */
function huePoint(vals: number[] | undefined, neutral: number, deg: number): number {
  if (!vals || vals.length === 0) return neutral;
  const n = vals.length;
  const u = ((deg % 360) / 360) * n;
  const i = Math.floor(u);
  const f = u - i;
  const p0 = vals[(i - 1 + n) % n], p1 = vals[i % n], p2 = vals[(i + 1) % n], p3 = vals[(i + 2) % n];
  return p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
}

/** atan2 in Grad 0..360 als Polynom (Fehler < 1e-4°); Math.atan2 kostet beim LUT-Bau spürbar Zeit. */
function atan2deg(y: number, x: number): number {
  const ax = Math.abs(x), ay = Math.abs(y);
  const mx = ax > ay ? ax : ay;
  if (mx === 0) return 0;
  const a = (ax > ay ? ay : ax) / mx;
  const q = a * a;
  let r = a * (0.99997726 + q * (-0.33262347 + q * (0.19354346 + q * (-0.11643287 + q * (0.05265332 - q * 0.0117212)))));
  if (ay > ax) r = Math.PI / 2 - r;
  if (x < 0) r = Math.PI - r;
  const d = (y < 0 ? -r : r) * (180 / Math.PI);
  return d < 0 ? d + 360 : d;
}

const tmp = [0, 0, 0];
/** Größte Überschreitung von 0..1 über alle Kanäle (≤ 0: im Farbraum). */
function gamutExcess(L: number, a: number, b: number): number {
  oklabToLin(L, a, b, tmp);
  let e = -tmp[0];
  if (tmp[0] - 1 > e) e = tmp[0] - 1;
  if (-tmp[1] > e) e = -tmp[1];
  if (tmp[1] - 1 > e) e = tmp[1] - 1;
  if (-tmp[2] > e) e = -tmp[2];
  if (tmp[2] - 1 > e) e = tmp[2] - 1;
  return e;
}

const LMS_TO_LIN = new Float64Array([
  4.0767416621, -3.3077115913, 0.2309699292, -1.2684380046, 2.6097574011, -0.3413193965, -0.0041960863,
  -0.7034186147, 1.707614701,
]);
const poly = new Float64Array(12);
/** Wie gamutExcess, aber für die zuvor in `poly` abgelegten Kanalpolynome an der Stelle t. */
function rayExcess(t: number): number {
  let e = -Infinity;
  for (let ch = 0; ch < 12; ch += 4) {
    const v = poly[ch] + t * (poly[ch + 1] + t * (poly[ch + 2] + t * poly[ch + 3]));
    if (-v > e) e = -v;
    if (v - 1 > e) e = v - 1;
  }
  return e;
}

/** Faktor, der (A, B) bei festem L und Farbton weich in den sRGB-Farbraum holt (1 = nichts zu tun). */
function gamutScale(L: number, A: number, B: number): number {
  const KNEE = 0.8;
  const eHi = gamutExcess(L, A / KNEE, B / KNEE);
  if (eHi <= 0) return 1;
  // Entlang des Strahls t·(A, B) ist jeder lineare Kanal ein kubisches Polynom in t.
  const kl = 0.3963377774 * A + 0.2158037573 * B;
  const km = -0.1055613458 * A - 0.0638541728 * B;
  const ks = -0.0894841775 * A - 1.291485548 * B;
  const L2 = L * L, L3 = L2 * L;
  const a1 = 3 * L2 * kl, b1 = 3 * L2 * km, c1 = 3 * L2 * ks;
  const a2 = 3 * L * kl * kl, b2 = 3 * L * km * km, c2 = 3 * L * ks * ks;
  const a3 = kl * kl * kl, b3 = km * km * km, c3 = ks * ks * ks;
  for (let ch = 0; ch < 3; ch++) {
    const w0 = LMS_TO_LIN[ch * 3], w1 = LMS_TO_LIN[ch * 3 + 1], w2 = LMS_TO_LIN[ch * 3 + 2];
    poly[ch * 4] = (w0 + w1 + w2) * L3;
    poly[ch * 4 + 1] = w0 * a1 + w1 * b1 + w2 * c1;
    poly[ch * 4 + 2] = w0 * a2 + w1 * b2 + w2 * c2;
    poly[ch * 4 + 3] = w0 * a3 + w1 * b3 + w2 * c3;
  }
  let lo = 0;
  let hi = 1 / KNEE;
  let fLo = rayExcess(0);
  let fHi = eHi;
  if (fLo < 0) {
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      const fm = rayExcess(mid);
      if (fm <= 0) {
        lo = mid;
        fLo = fm;
      } else {
        hi = mid;
        fHi = fm;
      }
    }
    lo += ((hi - lo) * -fLo) / (fHi - fLo);
  }
  // x = C relativ zu Cmax; weich auf < 1 abbilden (C1-stetig am Knie). lo = 0: Weiß/Schwarz, keine Buntheit möglich.
  if (lo <= 0) return 0;
  const x = 1 / lo;
  const u = (x - KNEE) / (1 - KNEE);
  return ((KNEE + (1 - KNEE) * (u / (1 + u))) / x) * 0.995;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Erzeugt die Funktion sRGB → sRGB (je Kanal 0..1) für eine Look-Beschreibung. */
export function compileLook(spec: LookSpec): (r: number, g: number, b: number, out: number[]) => void {
  const M = spec.matrix;
  const fns = (spec.curves ?? [CURVE_X.slice()]).map((c) => curveFn(c));
  while (fns.length < 3) fns.push(fns[0]);
  // Tonkurven gleich mit der Umrechnung nach linear verrechnet: ohne Matrix ab sRGB, mit Matrix ab linear (√-Teilung).
  const tabs = fns.map((f) => (M ? tabulate((u) => toLinear(clamp01(f(toSrgb(u * u))))) : tabulate((v) => toLinear(clamp01(f(v))))));
  const [cR, cG, cB] = tabs;
  const sat = spec.saturation ?? 1;
  const knee = spec.chromaKnee ?? 0;
  const shSat = (spec.shadowSat ?? 1) - 1;
  const hiSat = (spec.highlightSat ?? 1) - 1;
  const hueOps = !!(spec.hueSat?.length || spec.hueShift?.length || spec.hueLight?.length);
  const colorOps = hueOps || sat !== 1 || knee !== 0 || shSat !== 0 || hiSat !== 0;
  // Je Grad: Buntheitsfaktor, cos/sin der Farbtonverschiebung, Helligkeitsänderung.
  const HT = new Float64Array(362 * 4);
  for (let d = 0; d <= 361; d++) {
    const sh = huePoint(spec.hueShift, 0, d) * (Math.PI / 180);
    HT.set([huePoint(spec.hueSat, 1, d), Math.cos(sh), Math.sin(sh), huePoint(spec.hueLight, 0, d)], d * 4);
  }
  const [tA, tB] = spec.tint ?? [0, 0];
  const tW = spec.tintWhite;
  let bw: Vec3 | null = null;
  if (spec.bw) {
    const s = spec.bw[0] + spec.bw[1] + spec.bw[2];
    bw = [spec.bw[0] / s, spec.bw[1] / s, spec.bw[2] / s];
  }
  const curveBw = tabulate((u) => clamp01(fns[0](toSrgb(u * u))));
  const lab = [0, 0, 0];
  const lin = [0, 0, 0];

  return (r, g, b, out) => {
    if (bw) {
      // Filtergewichte können negativ sein (Rotfilter: Blau wird schwarz).
      const yl = bw[0] * lookup(LIN_T, r) + bw[1] * lookup(LIN_T, g) + bw[2] * lookup(LIN_T, b);
      const y = lookup(curveBw, Math.sqrt(yl > 0 ? yl : 0));
      if (tA === 0 && tB === 0 && !tW) {
        out[0] = out[1] = out[2] = y;
        return;
      }
      // Tönung: in den Mitteltönen voll, zu Schwarz und Weiß hin ausgeblendet, im Farbraum gehalten.
      const ly = lookup(LIN_T, y);
      linToOklab(ly, ly, ly, lab);
      const L = lab[0];
      let ta = tA, tb = tB, w;
      if (tW) {
        const t = smooth(0.45, 1, L);
        ta += (tW[0] - tA) * t;
        tb += (tW[1] - tB) * t;
        w = smooth(0, 0.2, L);
      } else w = smooth(0, 0.2, L) * (1 - 0.18 * smooth(0.4, 0.85, L)) * (1 - smooth(0.85, 1, L));
      const f = gamutScale(L, ta * w, tb * w);
      oklabToLin(L, ta * w * f, tb * w * f, lin);
    } else {
      if (M) {
        const lr = lookup(LIN_T, r), lg = lookup(LIN_T, g), lb = lookup(LIN_T, b);
        const mr = M[0] * lr + M[1] * lg + M[2] * lb, mg = M[3] * lr + M[4] * lg + M[5] * lb, mb = M[6] * lr + M[7] * lg + M[8] * lb;
        lin[0] = lookup(cR, Math.sqrt(mr > 0 ? mr : 0));
        lin[1] = lookup(cG, Math.sqrt(mg > 0 ? mg : 0));
        lin[2] = lookup(cB, Math.sqrt(mb > 0 ? mb : 0));
      } else {
        lin[0] = lookup(cR, r);
        lin[1] = lookup(cG, g);
        lin[2] = lookup(cB, b);
      }
      if (colorOps) {
        linToOklab(lin[0], lin[1], lin[2], lab);
        let L = lab[0];
        const A0 = lab[1], B0 = lab[2];
        const C = Math.sqrt(A0 * A0 + B0 * B0);
        const kn = 1 + knee * C;
        let k = (sat / (kn > 0.3 ? kn : 0.3)) * (1 + shSat * (1 - smooth(0.2, 0.6, L)) + hiSat * smooth(0.6, 0.95, L));
        let A = A0, B = B0;
        if (hueOps) {
          const h = atan2deg(B0, A0);
          const i = h | 0, t = h - i, j = i * 4;
          k *= HT[j] + (HT[j + 4] - HT[j]) * t;
          const cs = HT[j + 1] + (HT[j + 5] - HT[j + 1]) * t, sn = HT[j + 2] + (HT[j + 6] - HT[j + 2]) * t;
          A = A0 * cs - B0 * sn;
          B = A0 * sn + B0 * cs;
          // Bei fast unbunten Farben ist der Farbton bedeutungslos – Helligkeitsänderung dort ausblenden.
          L += (HT[j + 3] + (HT[j + 7] - HT[j + 3]) * t) * smooth(0.005, 0.06, C);
        }
        A *= k;
        B *= k;
        L = L < 0 ? 0 : L > 1 ? 1 : L;
        const f = gamutScale(L, A, B);
        oklabToLin(L, A * f, B * f, lin);
      }
    }
    out[0] = srgbOf(lin[0] > 1 ? 1 : lin[0]);
    out[1] = srgbOf(lin[1] > 1 ? 1 : lin[1]);
    out[2] = srgbOf(lin[2] > 1 ? 1 : lin[2]);
  };
}

/** Tastet eine Look-Beschreibung als 3D-LUT ab (Rot läuft am schnellsten). */
export function buildLut(spec: LookSpec, size = 33, title?: string): Lut3D {
  const fn = compileLook(spec);
  const data = new Float32Array(size * size * size * 3);
  const out = [0, 0, 0];
  const s = size - 1;
  let i = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        fn(r / s, g / s, b / s, out);
        data[i++] = Math.min(1, Math.max(0, out[0]));
        data[i++] = Math.min(1, Math.max(0, out[1]));
        data[i++] = Math.min(1, Math.max(0, out[2]));
      }
  return { size, data, title };
}
