import { describe, expect, it } from 'vitest';
import { channelGains, containRect, fitLongEdge, leakSpecs, planSourceTiles, targetSpan } from './plan';

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
  it('ist luminanzerhaltend und neutral bei 0', () => {
    expect(channelGains({ exposure: 0, temperature: 0, tint: 0 })).toEqual([1, 1, 1]);
    for (const [t, m] of [
      [1, 0],
      [-1, 0.5],
      [0.3, -1],
    ]) {
      const g = channelGains({ exposure: 0, temperature: t, tint: m });
      expect(0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2]).toBeCloseTo(1, 10);
    }
    const warm = channelGains({ exposure: 1, temperature: 1, tint: 0 });
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(0.2126 * warm[0] + 0.7152 * warm[1] + 0.0722 * warm[2]).toBeCloseTo(2, 10);
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
