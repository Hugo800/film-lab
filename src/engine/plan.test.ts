import { describe, expect, it } from 'vitest';
import { colorMatrix, containRect, drWhite, fitLongEdge, leakSpecs, planckXYZ, planSourceTiles, sharpKernelWeight, targetSpan } from './plan';

describe('Kachelplan', () => {
  it('Innenbereiche überdecken die Quelle genau einmal, Rand bleibt im Bild', () => {
    const tiles = planSourceTiles(6000, 4000, 2048, 3);
    let area = 0;
    for (const t of tiles) {
      area += (t.inner.x1 - t.inner.x0) * (t.inner.y1 - t.inner.y0);
      expect(t.upload.x0).toBe(Math.max(0, t.inner.x0 - 3));
      expect(t.upload.x1).toBeLessThanOrEqual(6000);
    }
    expect(tiles.length).toBe(6);
    expect(area).toBe(6000 * 4000);
  });

  it('Zielspannen zerlegen die Ausgabe lückenlos (auch bei krummen Faktoren)', () => {
    for (const [src, out, step] of [
      [6000, 2560, 1000],
      [5505, 1707, 777],
      [3670, 3670, 512],
      [1036, 1000, 300],
    ]) {
      let next = 0;
      for (let a = 0; a < src; a += step) {
        const [j0, j1] = targetSpan(a, Math.min(src, a + step), src, out);
        expect(j0).toBe(next);
        // Jeder Zielpixel liegt mit seiner Mitte im Kachelinneren.
        for (const j of [j0, j1 - 1]) if (j1 > j0) {
          const c = ((j + 0.5) * src) / out;
          expect(c).toBeGreaterThanOrEqual(a);
          expect(c).toBeLessThan(Math.min(src, a + step));
        }
        next = j1;
      }
      expect(next).toBe(out);
    }
  });
});

describe('Größen', () => {
  it('begrenzt die lange Kante und vergrößert nie', () => {
    expect(fitLongEdge(6000, 4000, 2560)).toEqual({ width: 2560, height: 1707 });
    expect(fitLongEdge(3670, 5505, 1024)).toEqual({ width: 683, height: 1024 });
    expect(fitLongEdge(1550, 1036, 4000)).toEqual({ width: 1550, height: 1036 });
  });

  it('passt mittig ein', () => {
    expect(containRect(6000, 4000, 1280, 800)).toEqual({ x0: 40, y0: 0, x1: 1240, y1: 800 });
  });
});

describe('Weißabgleich', () => {
  const P = { exposure: 0, wbKelvin: 0, wbShiftR: 0, wbShiftB: 0 };
  const white = (m: number[]) => [0, 1, 2].map((r) => m[r * 3] + m[r * 3 + 1] + m[r * 3 + 2]);
  const luma = (v: number[]) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];

  it('ist neutral bei „Auto“ und bei 5500 K', () => {
    expect(colorMatrix(P)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const m = colorMatrix({ ...P, wbKelvin: 5500 });
    m.forEach((v, i) => expect(v).toBeCloseTo(i % 4 === 0 ? 1 : 0, 5));
  });

  it('Planck-Näherung trifft bekannte Farborte', () => {
    // 6504 K Planck: x 0,3135, y 0,3236 (CIE); 2856 K (Normlicht A): x 0,4476, y 0,4074
    for (const [T, x, y] of [[6504, 0.3135, 0.3236], [2856, 0.4476, 0.4074]]) {
      const [X, Y, Z] = planckXYZ(T);
      expect(Math.abs(X / (X + Y + Z) - x)).toBeLessThan(0.001);
      expect(Math.abs(Y / (X + Y + Z) - y)).toBeLessThan(0.001);
    }
  });

  it('höhere Kelvin = wärmer, Luminanz von Weiß bleibt', () => {
    let last = 0;
    for (const K of [3000, 4500, 5500, 6500, 8000, 10000]) {
      const w = white(colorMatrix({ ...P, wbKelvin: K }));
      expect(luma(w)).toBeCloseTo(1, 10);
      const ratio = w[0] / w[2];
      expect(ratio).toBeGreaterThan(last);
      last = ratio;
    }
    const w = white(colorMatrix({ ...P, wbKelvin: 6500 }));
    expect(w[0]).toBeGreaterThan(1);
    expect(w[2]).toBeLessThan(1);
  });

  it('Verschiebung R/B und Belichtung', () => {
    const r = white(colorMatrix({ ...P, wbShiftR: 4 }));
    expect(r[0] / r[1]).toBeCloseTo(2 ** 0.24, 10);
    const b = white(colorMatrix({ ...P, wbShiftB: -3 }));
    expect(b[2] / b[1]).toBeCloseTo(2 ** -0.18, 10);
    const e = white(colorMatrix({ ...P, exposure: 1, wbShiftR: 2, wbKelvin: 7000 }));
    expect(luma(e)).toBeCloseTo(2, 10);
  });
});

describe('Dynamikbereich', () => {
  it('fängt nur bei Plusbelichtung zusätzliche Lichter auf, höchstens 1 bzw. 2 Blenden', () => {
    expect(drWhite({ exposure: 0, dynamicRange: 400 })).toBe(1);
    expect(drWhite({ exposure: -1, dynamicRange: 200 })).toBe(1);
    expect(drWhite({ exposure: 1.5, dynamicRange: 100 })).toBe(1);
    expect(drWhite({ exposure: 1.5, dynamicRange: 200 })).toBe(2);
    expect(drWhite({ exposure: 1.5, dynamicRange: 400 })).toBeCloseTo(2 ** 1.5, 10);
  });
});

describe('Schärfung', () => {
  it('Kern wird in der Vorschau schmaler und bleibt gültig', () => {
    expect(sharpKernelWeight(1)).toBeCloseTo(0.245, 10);
    expect(sharpKernelWeight(0.4)).toBeLessThan(sharpKernelWeight(1) / 4);
    expect(sharpKernelWeight(3)).toBe(sharpKernelWeight(1));
  });
});

describe('Light Leaks', () => {
  it('liefert deterministisch 1–3 warme Einfälle', () => {
    const counts = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const l = leakSpecs(seed);
      expect(leakSpecs(seed)).toEqual(l);
      counts.add(l.length);
      for (const s of l) {
        expect(s.color[0]).toBeGreaterThanOrEqual(s.color[1]);
        expect(s.color[1]).toBeGreaterThanOrEqual(s.color[2]);
        expect(s.edge).toBeGreaterThanOrEqual(0);
        expect(s.edge).toBeLessThanOrEqual(3);
      }
    }
    expect([...counts].sort()).toEqual([1, 2, 3]);
    expect(leakSpecs(1)).not.toEqual(leakSpecs(2));
  });
});
