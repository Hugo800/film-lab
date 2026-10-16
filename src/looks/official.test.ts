import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import type { Lut3D } from '../types';
import { parseCube } from './cube';
import { buildOfficialLuts, convertOfficial, officialKeyOf } from './official';

const enc = new TextEncoder();

/** Kleine F-Log2-artige Test-LUT: je Kanal dieselbe monotone Kurve f. */
function cubeText(f: (v: number) => number, n = 9): Uint8Array {
  const rows = [`LUT_3D_SIZE ${n}`];
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) rows.push([r, g, b].map((v) => f(v / (n - 1)).toFixed(6)).join(' '));
  return enc.encode(rows.join('\n'));
}

describe('officialKeyOf', () => {
  it('normalisiert Dateinamen robust', () => {
    expect(officialKeyOf('gfx/33Grid/F-Log2/FLog2_to_CLASSIC-CHROME_33grid_V.1.00.cube')).toEqual({ family: 'FLOG2', key: 'CLASSIC-CHROME', grid: 33 });
    expect(officialKeyOf('FLog2_to_CLASSIC-Neg._33grid_V.1.00.cube')?.key).toBe('CLASSIC-NEG');
    expect(officialKeyOf('flog2_to_pro-neg.std_65GRID_v1.10.CUBE')).toEqual({ family: 'FLOG2', key: 'PRO-NEG-STD', grid: 65 });
    expect(officialKeyOf('FLog2C_to_Velvia_33grid_V.1.00.cube')?.family).toBe('FLOG2C');
    expect(officialKeyOf('FLog2_to_ETERNA-BB.cube')?.key).toBe('ETERNA-BB');
    expect(officialKeyOf('readme.pdf')).toBeNull();
  });
});

describe('convertOfficial', () => {
  const curve = (v: number) => Math.pow(v, 0.8);

  it('meldet fehlendes PROVIA verständlich', () => {
    expect(() => convertOfficial([{ name: 'FLog2_to_ASTIA_33grid_V.1.00.cube', data: cubeText(curve) }])).toThrow(/PROVIA fehlt/);
    expect(() => convertOfficial([{ name: 'foto.cube', data: cubeText(curve) }])).toThrow(/Keine Fujifilm-LUT/);
  });

  it('bildet PROVIA auf sich selbst ab (≈ Identität) und liest ZIPs', () => {
    const zip = zipSync({ 'paket/33Grid/F-Log2/FLog2_to_PROVIA_33grid_V.1.00.cube': cubeText(curve) });
    const map = convertOfficial([{ name: 'paket.zip', data: zip }]);
    const lut = map.get('PROVIA')!;
    expect(lut.size).toBe(33);
    let worst = 0;
    const s = lut.size - 1;
    for (let b = 0; b <= s; b += 4)
      for (let g = 0; g <= s; g += 4)
        for (let r = 0; r <= s; r += 4) {
          const i = (r + g * 33 + b * 33 * 33) * 3;
          worst = Math.max(worst, Math.abs(lut.data[i] - r / s), Math.abs(lut.data[i + 1] - g / s), Math.abs(lut.data[i + 2] - b / s));
        }
    expect(worst).toBeLessThan(0.002);
  });

  it('läuft ohne Worker auch über buildOfficialLuts', async () => {
    const progress: number[] = [];
    const map = await buildOfficialLuts([{ name: 'FLog2_to_PROVIA.cube', data: cubeText(curve) }], (p) => progress.push(p));
    expect(map.has('PROVIA')).toBe(true);
    expect(progress.at(-1)).toBe(1);
  });
});

// --- Mit den lokal vorhandenen offiziellen Dateien (testbilder/ ist gitignoriert; fehlt sie, wird übersprungen) ---
const T = new URL('../../testbilder/', import.meta.url);
const CUBES = new URL('referenz/fujifilm-flog2-luts/', T);
const ZIP = new URL('luts/fujifilm-official/zips/gfx-eterna-55-3d-lut-v110.zip', T);
const DER = new URL('luts/abgeleitet-lokal/', T);
const haveLocal = existsSync(CUBES) && existsSync(DER);

function lab(r: number, g: number, b: number): [number, number, number] {
  const l = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const R = l(r), G = l(g), B = l(b);
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
  const fy = f(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
  const fz = f((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** ΔE2000 (ohne Zwischenwerte für Optimierung, siehe scripts/looks-lib.mjs). */
function dE00([l1, a1, b1]: number[], [l2, a2, b2]: number[]): number {
  const rad = Math.PI / 180;
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
  const hh = (b: number, a: number) => ((Math.atan2(b, a) / rad) + 360) % 360;
  const h1 = C1 ? hh(b1, a1p) : 0, h2 = C2 ? hh(b2, a2p) : 0;
  let dh = C1 * C2 ? h2 - h1 : 0;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh * rad) / 2);
  const Lm = (l1 + l2) / 2, Cmp = (C1 + C2) / 2;
  let hm = h1 + h2;
  if (C1 * C2) hm = Math.abs(h1 - h2) <= 180 ? hm / 2 : (hm + (hm < 360 ? 360 : -360)) / 2;
  const Tt = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const Rt = -Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad) * 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const x = (l2 - l1) / (1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2));
  const y = (C2 - C1) / (1 + 0.045 * Cmp), z = dH / (1 + 0.015 * Cmp * Tt);
  return Math.sqrt(x * x + y * y + z * z + Rt * y * z);
}

function meanDE(a: Lut3D, b: Lut3D): number {
  let s = 0;
  for (let i = 0; i < a.data.length; i += 3) s += dE00(lab(a.data[i], a.data[i + 1], a.data[i + 2]), lab(b.data[i], b.data[i + 1], b.data[i + 2]));
  return s / (a.data.length / 3);
}

describe.skipIf(!haveLocal)('offizielle Fujifilm-LUTs (lokal)', () => {
  const files = haveLocal
    ? readdirSync(CUBES).filter((f) => f.endsWith('.cube')).map((name) => ({ name, data: new Uint8Array(readFileSync(new URL(name, CUBES))) }))
    : [];
  const t0 = performance.now();
  const map = haveLocal ? convertOfficial(files) : new Map<string, Lut3D>();
  const ms = performance.now() - t0;

  it('liefert alle 10 Simulationen und ist schnell genug', () => {
    console.log(`buildOfficialLuts: ${files.length} Dateien in ${ms.toFixed(0)} ms`);
    expect([...map.keys()].sort()).toEqual(['ACROS', 'ASTIA', 'CLASSIC-CHROME', 'CLASSIC-NEG', 'ETERNA', 'ETERNA-BB', 'PRO-NEG-STD', 'PROVIA', 'REALA-ACE', 'VELVIA']);
    expect(ms).toBeLessThan(15_000);
  });

  it('stimmt mit den abgeleiteten Würfeln der Recherche überein', () => {
    const der = readdirSync(DER).filter((f) => /^provia-zu-.*_33\.cube$/.test(f));
    const rows: string[] = [];
    let worst = 0;
    for (const f of der) {
      const key = f.replace(/^provia-zu-|_srgb_33\.cube$/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/-$/, '');
      const ref = parseCube(readFileSync(new URL(f, DER), 'utf8'));
      const d = meanDE(map.get(key)!, ref);
      rows.push(`${key} ${d.toFixed(3)}`);
      worst = Math.max(worst, d);
    }
    console.log(`ΔE2000 (Mittel über 33³) gegen abgeleitet-lokal: ${rows.join(', ')}`);
    expect(worst).toBeLessThan(0.25);
  });

  it.skipIf(!existsSync(ZIP))('liest das Original-ZIP und kommt zum selben Ergebnis', () => {
    const t1 = performance.now();
    const fromZip = convertOfficial([{ name: 'gfx-eterna-55-3d-lut-v110.zip', data: new Uint8Array(readFileSync(ZIP)) }]);
    console.log(`ZIP (45 MB) in ${(performance.now() - t1).toFixed(0)} ms`);
    expect(meanDE(fromZip.get('CLASSIC-CHROME')!, map.get('CLASSIC-CHROME')!)).toBeLessThan(0.01);
  });
});
