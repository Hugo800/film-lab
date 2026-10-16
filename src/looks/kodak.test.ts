import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, type LookParams } from '../types';
import { LOOKS } from './index';

const KODAK = LOOKS.filter((l) => l.category === 'kodak');
const byId = new Map(LOOKS.map((l) => [l.id, l]));
const SW = ['Tri-X 400', 'T-Max 400', 'T-Max 100'];

/** Wertebereiche laut Vertrag (src/types.ts). */
function checkRanges(p: LookParams): string[] {
  const bad: string[] = [];
  const range = (k: keyof LookParams, lo: number, hi: number, step = 0) => {
    const v = p[k] as number;
    if (!(v >= lo && v <= hi) || (step && Math.abs(v / step - Math.round(v / step)) > 1e-9)) bad.push(`${k}=${v}`);
  };
  range('strength', 0, 1);
  range('exposure', -2, 2);
  if (p.wbKelvin !== 0) range('wbKelvin', 2500, 10000, 10);
  range('wbShiftR', -9, 9, 1);
  range('wbShiftB', -9, 9, 1);
  if (![100, 200, 400].includes(p.dynamicRange)) bad.push(`dynamicRange=${p.dynamicRange}`);
  range('highlightTone', -2, 4, 0.5);
  range('shadowTone', -2, 4, 0.5);
  range('color', -4, 4, 1);
  range('sharpness', -4, 4, 1);
  range('clarity', -5, 5, 1);
  range('grainEffect', 0, 2, 1);
  if (!['klein', 'gross'].includes(p.grainSize)) bad.push(`grainSize=${p.grainSize}`);
  range('colorChrome', 0, 2, 1);
  range('colorChromeBlue', 0, 2, 1);
  range('monoWarmCool', -18, 18, 1);
  range('monoMagentaGreen', -18, 18, 1);
  range('halation', 0, 1);
  range('vignette', 0, 1);
  range('leak', 0, 1);
  return bad;
}

describe('Kodak-Rezepte', () => {
  it('enthält die belegten Filme mit eindeutigen Namen', () => {
    const names = KODAK.map((l) => l.name);
    for (const n of ['Portra 160', 'Portra 400', 'Portra 800', 'Ektar 100', 'Gold 200', 'UltraMax 400', 'ColorPlus 200', 'Kodachrome 64',
      'Ektachrome E100', 'Vision3 250D', 'Vision3 500T', 'CineStill 800T', 'Tri-X 400', 'T-Max 400', 'T-Max 100'])
      expect(names).toContain(n);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(KODAK.map((l) => [l.name, l] as const))('„%s“: Basis, Quelle und Einstellungen wie im Vertrag', (_n, look) => {
    const base = byId.get(look.baseLookId ?? '');
    expect(base?.category).toBe('fujifilm');
    expect(look.description).toMatch(/Rezept: .+\.$/);
    for (const k of Object.keys(look.defaults)) expect(k in DEFAULT_PARAMS).toBe(true);
    expect(checkRanges({ ...DEFAULT_PARAMS, ...look.defaults })).toEqual([]);
    // Rezept = Basis + Einstellungen: mindestens Weißabgleich und Dynamikbereich sind gesetzt.
    expect(look.defaults.wbKelvin).toBeDefined();
    expect(look.defaults.dynamicRange).toBeDefined();
    expect(look.officialKey).toBeUndefined();
  });

  it('setzt Schwarzweiß-Rezepte nur auf Schwarzweiß-Simulationen und Farbrezepte nur auf Farb-Simulationen', () => {
    for (const l of KODAK) {
      const sw = SW.includes(l.name);
      expect(!!byId.get(l.baseLookId!)!.monochrome, l.name).toBe(sw);
      expect(!!l.monochrome, l.name).toBe(sw);
      if (!sw) expect([l.defaults.monoWarmCool ?? 0, l.defaults.monoMagentaGreen ?? 0], l.name).toEqual([0, 0]);
      if (sw) expect(l.defaults.color, l.name).toBeUndefined();
    }
  });

  it('nutzt Extras nur, wo der Film sie braucht (Halation bei CineStill)', () => {
    for (const l of KODAK) {
      const p = { ...DEFAULT_PARAMS, ...l.defaults };
      expect([p.leak, p.vignette]).toEqual([0, 0]);
      expect(p.halation > 0, l.name).toBe(l.name === 'CineStill 800T');
    }
  });

  it('liefert die LUT der Basis', () => {
    for (const l of KODAK.slice(0, 3)) {
      const a = l.buildLut(), b = byId.get(l.baseLookId!)!.buildLut();
      expect(a.size).toBe(b.size);
      expect(a.data.every((v, i) => v === b.data[i])).toBe(true);
    }
  });
});
