// Offizielle Fujifilm-F-Log2-LUTs (vom Nutzer selbst geladen) → sRGB-LUTs „Provia-relativ“.
// Das Foto gilt als Ausgang der PROVIA-LUT: je Gitterpunkt wird der F-Log2-Code gesucht, den PROVIA
// dorthin abbildet (Newton), und dort die Ziel-LUT ausgewertet. Ausgang der LUTs: BT.709, Gamma 2,2.
// Nichts davon wird mitgeliefert; die Dateien bleiben beim Nutzer.
import { unzipSync } from 'fflate';
import type { Lut3D } from '../types';
import { parseCube } from './cube';

export interface OfficialFile {
  name: string;
  data: Uint8Array;
}

const OUT_SIZE = 33;
const GAMMA = 2.2;
const RANK: Record<string, number> = { FLOG2: 0, FLOG2C: 1, FLOG: 2 };
// Neutrale Umrechnungen ohne Simulation.
const SKIP = new Set(['WDR-709', 'FLOG2-709', 'FLOG2C-709', 'FLOG-709']);

/** Schlüssel aus einem Dateinamen, z. B. „…/FLog2_to_CLASSIC-Neg._33grid_V.1.00.cube“ → „CLASSIC-NEG“. */
export function officialKeyOf(fileName: string): { family: string; key: string; grid: number } | null {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const m = /^(F-?LOG2C|F-?LOG2|F-?LOG)_TO_(.+?)(?:_(\d+)GRID)?(?:_V[\d.]*)?\.CUBE$/i.exec(base);
  if (!m) return null;
  const key = m[2].toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { family: m[1].toUpperCase().replace('-', ''), key, grid: Number(m[3] ?? 0) };
}

// F-Log2 (Fujifilm Data Sheet) und BT.709 → F-Gamut (= BT.2020-Primärvalenzen), nur für Startwerte.
const flog2Enc = (x: number) => (x >= 0.000889 ? 0.245281 * Math.log10(5.555556 * x + 0.064829) + 0.384316 : 8.799461 * x + 0.092864);
const flog2Dec = (y: number) => (y >= 0.100686685370811 ? (Math.pow(10, (y - 0.384316) / 0.245281) - 0.064829) / 5.555556 : (y - 0.092864) / 8.799461);
const M709_TO_FGAMUT = [0.627404, 0.329283, 0.043313, 0.069097, 0.91954, 0.011362, 0.016391, 0.088013, 0.895595];

const srgbToLin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const linToSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/** Trilinear, Eingang 0..1. */
function sample(lut: Lut3D, r: number, g: number, b: number, out: Float64Array): void {
  const n = lut.size, d = lut.data, s = n - 1;
  const x = Math.min(s, Math.max(0, r * s)), y = Math.min(s, Math.max(0, g * s)), z = Math.min(s, Math.max(0, b * s));
  const x0 = Math.min(s - 1, x | 0), y0 = Math.min(s - 1, y | 0), z0 = Math.min(s - 1, z | 0);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  const i000 = (x0 + y0 * n + z0 * n * n) * 3, dx = 3, dy = n * 3, dz = n * n * 3;
  for (let c = 0; c < 3; c++) {
    const i = i000 + c;
    const c00 = d[i] + (d[i + dx] - d[i]) * fx;
    const c10 = d[i + dy] + (d[i + dy + dx] - d[i + dy]) * fx;
    const c01 = d[i + dz] + (d[i + dz + dx] - d[i + dz]) * fx;
    const c11 = d[i + dz + dy] + (d[i + dz + dy + dx] - d[i + dz + dy]) * fx;
    out[c] = (c00 + (c10 - c00) * fy) * (1 - fz) + (c01 + (c11 - c01) * fy) * fz;
  }
}

/** Sucht c in 0..1³ mit lut(c) ≈ y (gedämpftes Newton-Verfahren, Startwert in c). Ergebnis in c. */
function invertPoint(lut: Lut3D, y: Float64Array, c: Float64Array): void {
  const o = new Float64Array(3), o2 = new Float64Array(3), J = new Float64Array(9), cn = new Float64Array(3);
  const h = 1e-3;
  sample(lut, c[0], c[1], c[2], o);
  let res = Math.abs(y[0] - o[0]) + Math.abs(y[1] - o[1]) + Math.abs(y[2] - o[2]);
  for (let it = 0; it < 25 && res > 1e-5; it++) {
    for (let k = 0; k < 3; k++) {
      const save = c[k];
      // Differenz nach innen nehmen, damit der Rand 1 nicht stört
      const step = save + h > 1 ? -h : h;
      c[k] = save + step;
      sample(lut, c[0], c[1], c[2], o2);
      c[k] = save;
      for (let i = 0; i < 3; i++) J[i * 3 + k] = (o2[i] - o[i]) / step;
    }
    const det = J[0] * (J[4] * J[8] - J[5] * J[7]) - J[1] * (J[3] * J[8] - J[5] * J[6]) + J[2] * (J[3] * J[7] - J[4] * J[6]);
    if (Math.abs(det) < 1e-12) break;
    const r0 = y[0] - o[0], r1 = y[1] - o[1], r2 = y[2] - o[2];
    const d0 = ((J[4] * J[8] - J[5] * J[7]) * r0 - (J[1] * J[8] - J[2] * J[7]) * r1 + (J[1] * J[5] - J[2] * J[4]) * r2) / det;
    const d1 = (-(J[3] * J[8] - J[5] * J[6]) * r0 + (J[0] * J[8] - J[2] * J[6]) * r1 - (J[0] * J[5] - J[2] * J[3]) * r2) / det;
    const d2 = ((J[3] * J[7] - J[4] * J[6]) * r0 - (J[0] * J[7] - J[1] * J[6]) * r1 + (J[0] * J[4] - J[1] * J[3]) * r2) / det;
    let ok = false;
    for (let s = 1; s > 0.03; s /= 2) {
      cn[0] = Math.min(1, Math.max(0, c[0] + s * d0));
      cn[1] = Math.min(1, Math.max(0, c[1] + s * d1));
      cn[2] = Math.min(1, Math.max(0, c[2] + s * d2));
      sample(lut, cn[0], cn[1], cn[2], o2);
      const rn = Math.abs(y[0] - o2[0]) + Math.abs(y[1] - o2[1]) + Math.abs(y[2] - o2[2]);
      if (rn < res) {
        c.set(cn);
        o.set(o2);
        res = rn;
        ok = true;
        break;
      }
    }
    if (!ok) break;
  }
}

/** Umkehrung der Neutralachse einer LUT (Mittel der Kanäle) für Startwerte. */
function grayInverse(lut: Lut3D): (y: number) => number {
  const N = 1024, tab = new Float64Array(N + 1), o = new Float64Array(3);
  for (let i = 0; i <= N; i++) {
    sample(lut, i / N, i / N, i / N, o);
    tab[i] = Math.max((o[0] + o[1] + o[2]) / 3, i > 0 ? tab[i - 1] : 0);
  }
  return (y) => {
    let lo = 0, hi = N;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (tab[m] < y) lo = m;
      else hi = m;
    }
    const f = tab[hi] > tab[lo] ? (y - tab[lo]) / (tab[hi] - tab[lo]) : 0;
    return (lo + Math.min(1, Math.max(0, f))) / N;
  };
}

/**
 * Rechnet im aktuellen Thread (für den Worker und für Tests). Wirft einen verständlichen Fehler,
 * wenn PROVIA fehlt oder keine passende Datei dabei ist.
 */
export function convertOfficial(files: OfficialFile[], onProgress?: (f: number) => void): Map<string, Lut3D> {
  // Kandidaten sammeln (ZIP-Einträge erst entpacken, wenn sie gebraucht werden), dann je Familie
  // (F-Log2, F-Log2C, F-Log) und Schlüssel die kleinste Gittergröße nehmen.
  type Cand = { name: string; grid: number; data: () => Uint8Array };
  const fams = new Map<string, Map<string, Cand>>();
  const add = (name: string, data: () => Uint8Array) => {
    const k = officialKeyOf(name);
    if (!k || SKIP.has(k.key)) return;
    const fam = fams.get(k.family) ?? new Map<string, Cand>();
    const prev = fam.get(k.key);
    if (!prev || (k.grid || 99) < (prev.grid || 99)) fam.set(k.key, { name, grid: k.grid, data });
    fams.set(k.family, fam);
  };
  for (const f of files) {
    if (/\.zip$/i.test(f.name))
      unzipSync(f.data, {
        filter: (e) => {
          add(e.name, () => unzipSync(f.data, { filter: (x) => x.name === e.name })[e.name]);
          return false;
        },
      });
    else add(f.name, () => f.data);
  }
  const family = [...fams.keys()].filter((f) => fams.get(f)!.has('PROVIA')).sort((a, b) => (RANK[a] ?? 9) - (RANK[b] ?? 9))[0];
  if (!family) {
    if (fams.size === 0) throw new Error('Keine Fujifilm-LUT gefunden. Erwartet werden Dateien wie „FLog2_to_CLASSIC-CHROME_33grid_V.1.00.cube“ oder das ZIP von Fujifilm.');
    throw new Error('PROVIA fehlt: Für die Umrechnung wird „FLog2_to_PROVIA….cube“ aus demselben Paket gebraucht.');
  }
  const decoder = new TextDecoder();
  const sel = fams.get(family)!;
  const read = (e: Cand) => parseCube(decoder.decode(e.data()), e.name);
  const provia = read(sel.get('PROVIA')!);
  const targets = [...sel.entries()].map(([key, e]) => [key, read(e)] as const);

  // 1. Je sRGB-Gitterpunkt den F-Log2-Code suchen.
  const n = OUT_SIZE, s = n - 1;
  const codes = new Float64Array(n * n * n * 3);
  const inv = grayInverse(provia);
  const y = new Float64Array(3), c = new Float64Array(3), alt = new Float64Array(3), o = new Float64Array(3);
  const disp = Array.from({ length: n }, (_, i) => Math.pow(srgbToLin(i / s), 1 / GAMMA));
  const err = (cc: Float64Array) => {
    sample(provia, cc[0], cc[1], cc[2], o);
    return Math.abs(y[0] - o[0]) + Math.abs(y[1] - o[1]) + Math.abs(y[2] - o[2]);
  };
  let i = 0;
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++, i += 3) {
        y[0] = disp[r];
        y[1] = disp[g];
        y[2] = disp[b];
        // Zwei Startwerte, der kleinere Rest gewinnt (glatter als der Nachbarpunkt als Startwert):
        // Grau gleicher Helligkeit; Kanäle einzeln über die Neutralachse als Reflexion, BT.709 → F-Gamut.
        c.fill(inv((y[0] + y[1] + y[2]) / 3));
        const refl = [flog2Dec(inv(y[0])), flog2Dec(inv(y[1])), flog2Dec(inv(y[2]))];
        for (let k = 0; k < 3; k++)
          alt[k] = Math.min(1, flog2Enc(Math.max(1e-4, M709_TO_FGAMUT[k * 3] * refl[0] + M709_TO_FGAMUT[k * 3 + 1] * refl[1] + M709_TO_FGAMUT[k * 3 + 2] * refl[2])));
        invertPoint(provia, y, c);
        const best = err(c);
        invertPoint(provia, y, alt);
        if (err(alt) < best) c.set(alt);
        codes.set(c, i);
      }
    onProgress?.(((b + 1) / n) * 0.9);
  }

  // 2. Ziel-LUTs an diesen Codes auswerten, zurück nach sRGB.
  const result = new Map<string, Lut3D>();
  targets.forEach(([key, lut], t) => {
    const data = new Float32Array(n * n * n * 3);
    for (let j = 0; j < data.length; j += 3) {
      sample(lut, codes[j], codes[j + 1], codes[j + 2], o);
      for (let ch = 0; ch < 3; ch++) data[j + ch] = linToSrgb(Math.pow(Math.min(1, Math.max(0, o[ch])), GAMMA));
    }
    result.set(key, { size: n, data, title: `Fujifilm ${key} (offizielle LUT, Provia-relativ)` });
    onProgress?.(0.9 + (0.1 * (t + 1)) / targets.length);
  });
  return result;
}

/**
 * Wandelt vom Nutzer geladene Fujifilm-F-Log2-LUTs (.zip und/oder .cube) in sRGB-LUTs um.
 * Schlüssel = FilmLook.officialKey (z. B. „CLASSIC-CHROME“). Rechnet in einem Web Worker.
 */
export function buildOfficialLuts(files: OfficialFile[], onProgress?: (fraction: number) => void): Promise<Map<string, Lut3D>> {
  if (typeof Worker === 'undefined') return Promise.resolve().then(() => convertOfficial(files, onProgress));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./official.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ progress?: number; error?: string; result?: [string, Lut3D][] }>) => {
      const m = e.data;
      if (m.progress !== undefined) onProgress?.(m.progress);
      else {
        worker.terminate();
        if (m.error) reject(new Error(m.error));
        else resolve(new Map(m.result));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Umrechnung der Fujifilm-LUTs fehlgeschlagen'));
    };
    worker.postMessage(files);
  });
}
