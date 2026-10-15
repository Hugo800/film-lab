// Parametrisches Farbmodell: aus einer Look-Beschreibung wird eine 3D-LUT.
// Ablauf je Gitterpunkt: sRGB → linear → Weißabgleich/Mischmatrix (bzw. SW-Gewichtung)
// → Tonkurve je Kanal (log2 um Mittelgrau, Toe, Schulter) → Farbe in OKLCh
// (Sättigung, Farbtonbereiche, Split-Toning, weiche Gamut-Kompression) → sRGB → Fade.
import type { Lut3D } from '../types';

export type Vec3 = [number, number, number];

/** Wirkt auf einen Farbtonbereich in OKLCh (Grad, siehe HUE). */
export interface HueAdjust {
  hue: number;
  /** Halbe Breite in Grad; Gewicht fällt per Kosinus auf 0. */
  width: number;
  /** Farbtonverschiebung in Grad. */
  shift?: number;
  /** Faktor auf die Buntheit. */
  sat?: number;
  /** Helligkeitsänderung in OKLab-L (z. B. -0.03). */
  light?: number;
}

export interface LookSpec {
  /** Kanalfaktoren in linearem Licht (Grundfarbe des Films). */
  balance?: Vec3;
  /** 3×3-Matrix zeilenweise in linearem Licht (Übersprechen der Farbschichten). Zeilensummen ≈ 1. */
  matrix?: number[];
  /** Belichtungsversatz in Blenden vor der Kurve. */
  exposure?: number;
  /** Kontrast als Steigung in log2 um Mittelgrau. 1 = unverändert. */
  contrast?: number;
  /** Zusätzliche Steigung tief in den Schatten: > 0 dichte Schwärzen, < 0 offene Schatten. */
  toe?: number;
  /** Anteil des Bereichs unter Weiß, ab dem die Lichter weich abrollen (0..1). */
  shoulder?: number;
  /** Asymptote der Schulter in linearem Licht (abgerundetes Weiß). */
  white?: number;
  /** Angehobenes Schwarz in sRGB, je Kanal möglich. */
  fade?: number | Vec3;
  saturation?: number;
  /** Buntheitsfaktor in den Schatten (zusätzlich zu saturation). */
  shadowSat?: number;
  hues?: HueAdjust[];
  /** Split-Toning als OKLab-(a, b)-Versatz. */
  shadowTint?: [number, number];
  highlightTint?: [number, number];
  /** Schwarzweiß: Kanalgewichte in linearem Licht (werden normiert). */
  bw?: Vec3;
}

/** Ungefähre OKLCh-Farbtöne (Grad) für sRGB-Bezugsfarben. */
export const HUE = {
  red: 29,
  skin: 50,
  orange: 60,
  yellow: 108,
  foliage: 125,
  green: 142,
  cyan: 195,
  sky: 250,
  blue: 264,
  magenta: 328,
} as const;

const MID = 0.18;
const TOE_SOFT = 1.2; // Breite des Toe-Übergangs in Blenden

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

/**
 * Glatte 1D-Funktion als Tabelle (Stützstellen dichter bei 0), linear interpoliert über `lookup`.
 * Spart pow/log je Gitterpunkt; bewusst keine Closure, damit V8 den Aufruf inlinen kann.
 */
function tabulate(f: (x: number) => number, max: number, n = 2048): Float64Array {
  const t = new Float64Array(n + 2);
  for (let i = 0; i <= n; i++) t[i] = f((i / n) * (i / n) * max);
  t[n + 1] = t[n];
  return t;
}

/** x in 0..max (wie bei tabulate). */
function lookup(t: Float64Array, max: number, x: number): number {
  const u = Math.sqrt(x / max) * (t.length - 2);
  const i = u | 0;
  return t[i] + (t[i + 1] - t[i]) * (u - i);
}

const SRGB_T = tabulate(toSrgb, 1);

/** atan2 in Grad als Polynom (Fehler < 1e-4°); Math.atan2 kostet beim LUT-Bau spürbar Zeit. */
function atan2deg(y: number, x: number): number {
  const ax = Math.abs(x), ay = Math.abs(y);
  const mx = ax > ay ? ax : ay;
  if (mx === 0) return 0;
  const a = (ax > ay ? ay : ax) / mx;
  const q = a * a;
  let r = a * (0.99997726 + q * (-0.33262347 + q * (0.19354346 + q * (-0.11643287 + q * (0.05265332 - q * 0.0117212)))));
  if (ay > ax) r = Math.PI / 2 - r;
  if (x < 0) r = Math.PI - r;
  return (y < 0 ? -r : r) * (180 / Math.PI);
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

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Erzeugt die Funktion (lineares RGB) → sRGB für eine Look-Beschreibung. */
export function compileLook(spec: LookSpec): (r: number, g: number, b: number, out: Vec3) => void {
  const bal = spec.balance ?? [1, 1, 1];
  const M = spec.matrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const gain = Math.pow(2, spec.exposure ?? 0);
  const c = spec.contrast ?? 1;
  const toe = spec.toe ?? 0;
  const w = spec.white ?? 1;
  const knee = w * (1 - Math.max(0.02, spec.shoulder ?? 0.1));
  const fadeV = spec.fade ?? 0;
  const fade: Vec3 = typeof fadeV === 'number' ? [fadeV, fadeV, fadeV] : fadeV;
  const sat = spec.saturation ?? 1;
  const shSat = spec.shadowSat ?? 1;
  const hues = spec.hues ?? [];
  const shT = spec.shadowTint ?? [0, 0];
  const hiT = spec.highlightTint ?? [0, 0];
  const toned = shT[0] !== 0 || shT[1] !== 0 || hiT[0] !== 0 || hiT[1] !== 0;
  let bw: Vec3 | null = null;
  if (spec.bw) {
    const s = spec.bw[0] + spec.bw[1] + spec.bw[2];
    bw = [spec.bw[0] / s, spec.bw[1] / s, spec.bw[2] / s];
  }
  if (c + toe <= 0.1) throw new Error('Look: contrast + toe muss > 0.1 sein');

  // log2-Kontrast um Mittelgrau; der Softplus-Term gibt den tiefen Schatten die Steigung c + toe.
  const ln2 = Math.log(2);
  const tone = (lin: number): number => {
    if (lin <= 1e-9) return 0;
    const x = Math.log2((lin * gain) / MID);
    const z = -x / TOE_SOFT;
    const sp = z > 30 ? z : Math.log1p(Math.exp(z));
    const y = MID * Math.pow(2, c * x - toe * TOE_SOFT * (sp - ln2));
    if (y <= knee) return y;
    return knee + (w - knee) * (1 - Math.exp(-(y - knee) / (w - knee)));
  };

  const TONE_MAX = 1.5;
  const toneT = tabulate(tone, TONE_MAX);
  const toneL = (x: number) => (x < TONE_MAX ? lookup(toneT, TONE_MAX, x) : tone(x));
  const hn = hues.length;
  const hHue = hues.map((a) => a.hue);
  const hWidth = hues.map((a) => a.width);
  const hShift = hues.map((a) => a.shift ?? 0);
  const hSat = hues.map((a) => (a.sat ?? 1) - 1);
  const hLight = hues.map((a) => a.light ?? 0);
  const lab = [0, 0, 0];
  const lin = [0, 0, 0];

  return (r, g, b, out) => {
    if (bw) {
      const y = toneL(bw[0] * r + bw[1] * g + bw[2] * b);
      r = g = b = y;
    } else {
      r *= bal[0];
      g *= bal[1];
      b *= bal[2];
      const r2 = M[0] * r + M[1] * g + M[2] * b;
      const g2 = M[3] * r + M[4] * g + M[5] * b;
      const b2 = M[6] * r + M[7] * g + M[8] * b;
      r = toneL(Math.max(0, r2));
      g = toneL(Math.max(0, g2));
      b = toneL(Math.max(0, b2));
    }

    if (!bw || toned) {
      linToOklab(r, g, b, lab);
      let L = lab[0];
      const C = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
      const h = hn ? atan2deg(lab[2], lab[1]) : 0;
      // Bei fast unbunten Farben ist der Farbton bedeutungslos – Helligkeitsänderung dort ausblenden.
      const chromaW = smooth(0.005, 0.06, C);
      let k = sat * (1 + (shSat - 1) * (1 - smooth(0.15, 0.6, L)));
      let dh = 0;
      for (let j = 0; j < hn; j++) {
        let d = Math.abs(h - hHue[j]);
        if (d > 180) d = Math.abs(360 - d);
        if (d >= hWidth[j]) continue;
        const wt = 0.5 + 0.5 * Math.cos((Math.PI * d) / hWidth[j]);
        dh += hShift[j] * wt;
        k *= 1 + hSat[j] * wt;
        L += hLight[j] * wt * chromaW;
      }
      if (bw) k = 0;
      // Drehung um dh ohne erneutes cos/sin des Farbtons.
      let A = lab[1] * k;
      let B = lab[2] * k;
      if (dh !== 0) {
        const cs = Math.cos(dh * (Math.PI / 180));
        const sn = Math.sin(dh * (Math.PI / 180));
        const a0 = A;
        A = a0 * cs - B * sn;
        B = a0 * sn + B * cs;
      }
      if (toned) {
        // Schattengewicht: 0 bei Schwarz, Maximum bei L = 0.25, im Mittelgrau schon klein.
        const q = (L / 0.25) * Math.exp(1 - L / 0.25);
        const ws = L <= 0 ? 0 : q * q;
        const wh = smooth(0.55, 1, L) * (1 - smooth(0.97, 1.0, L));
        A += shT[0] * ws + hiT[0] * wh;
        B += shT[1] * ws + hiT[1] * wh;
      }
      L = Math.min(1, Math.max(0, L));
      // Weiche Gamut-Kompression bei gleichem L und Farbton statt hartem Abschneiden (sonst Knicke
      // in gesättigten Verläufen). Rand per Bisektion, zum Schluss linear zwischen den Überschreitungen.
      const KNEE = 0.8;
      const eHi = gamutExcess(L, A / KNEE, B / KNEE);
      if (eHi > 0) {
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
        const x = 1 / lo;
        const u = (x - KNEE) / (1 - KNEE);
        const f = lo > 0 ? ((KNEE + (1 - KNEE) * (u / (1 + u))) / x) * 0.995 : 0;
        A *= f;
        B *= f;
      }
      oklabToLin(L, A, B, lin);
      r = lin[0];
      g = lin[1];
      b = lin[2];
    }

    const vr = lookup(SRGB_T, 1, Math.min(1, Math.max(0, r)));
    const vg = lookup(SRGB_T, 1, Math.min(1, Math.max(0, g)));
    const vb = lookup(SRGB_T, 1, Math.min(1, Math.max(0, b)));
    const ir = 1 - vr, ig = 1 - vg, ib = 1 - vb;
    out[0] = vr + fade[0] * ir * ir * ir;
    out[1] = vg + fade[1] * ig * ig * ig;
    out[2] = vb + fade[2] * ib * ib * ib;
  };
}

/** Tastet eine Look-Beschreibung als 3D-LUT ab (Rot läuft am schnellsten). */
export function buildLut(spec: LookSpec, size = 33, title?: string): Lut3D {
  const fn = compileLook(spec);
  const data = new Float32Array(size * size * size * 3);
  const lin = Array.from({ length: size }, (_, i) => toLinear(i / (size - 1)));
  const out: Vec3 = [0, 0, 0];
  let i = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        fn(lin[r], lin[g], lin[b], out);
        data[i++] = Math.min(1, Math.max(0, out[0]));
        data[i++] = Math.min(1, Math.max(0, out[1]));
        data[i++] = Math.min(1, Math.max(0, out[2]));
      }
  return { size, data, title };
}
