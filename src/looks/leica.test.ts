import { describe, expect, it } from 'vitest';
import type { Lut3D } from '../types';
import { LOOKS } from './index';

const LEICA = LOOKS.filter((l) => l.category === 'leica');
const look = (id: string) => LEICA.find((l) => l.id === id)!;

/** Trilinear wie in der Engine, Eingang 0..1. */
function sample(lut: Lut3D, r: number, g: number, b: number): [number, number, number] {
  const n = lut.size, s = n - 1, d = lut.data;
  const p = [r, g, b].map((v) => v * s), i0 = p.map((v) => Math.min(s - 1, Math.floor(v))), f = p.map((v, k) => v - i0[k]);
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++)
    for (let k = 0; k < 8; k++) {
      const o = [k & 1, (k >> 1) & 1, (k >> 2) & 1];
      const w = o.reduce((a, bit, j) => a * (bit ? f[j] : 1 - f[j]), 1);
      out[c] += w * d[(i0[0] + o[0] + (i0[1] + o[1]) * n + (i0[2] + o[2]) * n * n) * 3 + c];
    }
  return out;
}
const chroma = ([r, g, b]: number[]) => Math.max(r, g, b) - Math.min(r, g, b);

describe('Leica Looks', () => {
  it('enthält Core und Essential Looks mit Leica-Namen', () => {
    expect(LEICA.map((l) => l.name)).toEqual([
      'Leica Standard', 'Leica Vivid', 'Leica Natural', 'Leica Monochrom Natural', 'Leica Monochrom High Contrast',
      'Leica Classic', 'Leica Contemporary', 'Leica Eternal', 'Leica Chrome', 'Leica Silver', 'Leica Bleach', 'Leica Teal',
      'Leica Brass', 'Leica Pure', 'Leica Cine', 'Leica Selenium', 'Leica Sepia', 'Leica Blue',
    ]);
    for (const l of LEICA) {
      expect(l.defaults).toEqual({});
      expect(l.baseLookId ?? l.officialKey).toBeUndefined();
      expect(!!l.monochrome).toBe(/Monochrom|Selenium|Sepia|Blue/.test(l.name));
    }
  });

  it('Standard lässt das Foto unverändert, alle anderen verändern es', () => {
    const id = look('leica-standard').buildLut();
    const grid = (i: number) => {
      const j = Math.floor(i / 3);
      return [j % 33, Math.floor(j / 33) % 33, Math.floor(j / 1089)][i % 3] / 32;
    };
    expect(id.data.every((v, i) => Math.abs(v - grid(i)) < 0.003)).toBe(true);
    for (const l of LEICA.slice(1)) {
      const lut = l.buildLut();
      expect(lut.data.some((v, i) => Math.abs(v - id.data[i]) > 0.02), l.name).toBe(true);
    }
  });

  it('Vivid ist bunter als Standard, Natural blasser', () => {
    const skin = [0.85, 0.6, 0.45], sky = [0.35, 0.55, 0.85];
    for (const c of [skin, sky]) {
      const base = chroma(c);
      expect(chroma(sample(look('leica-vivid').buildLut(), c[0], c[1], c[2]))).toBeGreaterThan(base);
      expect(chroma(sample(look('leica-natural').buildLut(), c[0], c[1], c[2]))).toBeLessThan(base);
    }
  });

  it('Monochrom High Contrast hat tiefere Schatten und hellere Lichter als Natural', () => {
    const nat = look('leica-mono-natural').buildLut(), hc = look('leica-mono-hc').buildLut();
    expect(sample(hc, 0.2, 0.2, 0.2)[0]).toBeLessThan(sample(nat, 0.2, 0.2, 0.2)[0] - 0.01);
    expect(sample(hc, 0.75, 0.75, 0.75)[0]).toBeGreaterThan(sample(nat, 0.75, 0.75, 0.75)[0] + 0.01);
  });

  it('tönt Sepia warm, Blue blau und Selenium kühl-violett – auch in den Lichtern', () => {
    for (const v of [0.4, 0.8]) {
      const [sr, , sb] = sample(look('leica-sepia').buildLut(), v, v, v);
      expect(sr - sb).toBeGreaterThan(0.02);
      const [br, , bb] = sample(look('leica-blue').buildLut(), v, v, v);
      expect(bb - br).toBeGreaterThan(0.02);
    }
    const [r, g, b] = sample(look('leica-selenium').buildLut(), 0.4, 0.4, 0.4);
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(g);
  });
});
