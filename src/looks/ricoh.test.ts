import { describe, expect, it } from 'vitest';
import { LOOKS } from './index';

const RICOH = LOOKS.filter((l) => l.category === 'ricoh');
const look = (id: string) => RICOH.find((l) => l.id === id)!;
/** LUT-Wert am Gitterpunkt (r, g, b) in 0..32. */
const at = (id: string, r: number, g: number, b: number) => {
  const lut = look(id).buildLut(), n = lut.size, i = (r + g * n + b * n * n) * 3;
  return [lut.data[i], lut.data[i + 1], lut.data[i + 2]];
};

describe('Ricoh-Effekte', () => {
  it('enthält die Effekte der GR IV in Menü-Reihenfolge (ohne HDR Tone)', () => {
    expect(RICOH.map((l) => l.name)).toEqual([
      'Ricoh Standard', 'Ricoh Vivid', 'Ricoh Positive Film', 'Ricoh Negative Film', 'Ricoh Retro', 'Ricoh Bleach Bypass',
      'Ricoh Cross Process', 'Ricoh Cinema Yellow', 'Ricoh Cinema Green', 'Ricoh Monotone', 'Ricoh Soft Monotone',
      'Ricoh Hard Monotone', 'Ricoh Hi-Contrast B&W',
    ]);
    for (const l of RICOH) {
      expect(l.baseLookId ?? l.officialKey).toBeUndefined();
      expect(!!l.monochrome).toBe(/Monotone|B&W/.test(l.name));
    }
  });

  it('Retro dunkelt die Ränder ab, Hi-Contrast B&W hat Korn, sonst keine Vorgaben', () => {
    expect(look('ricoh-retro').defaults).toEqual({ vignette: 1 });
    expect(look('ricoh-hi-contrast-bw').defaults).toEqual({ grainEffect: 2, grainSize: 'klein' });
    for (const l of RICOH.filter((x) => !['ricoh-retro', 'ricoh-hi-contrast-bw'].includes(x.id))) expect(l.defaults).toEqual({});
  });

  it('Standard lässt das Foto unverändert, alle anderen verändern es', () => {
    const id = look('ricoh-standard').buildLut();
    const grid = (i: number) => {
      const j = Math.floor(i / 3);
      return [j % 33, Math.floor(j / 33) % 33, Math.floor(j / 1089)][i % 3] / 32;
    };
    expect(id.data.every((v, i) => Math.abs(v - grid(i)) < 0.003)).toBe(true);
    for (const l of RICOH.slice(1)) {
      const lut = l.buildLut();
      expect(lut.data.some((v, i) => Math.abs(v - id.data[i]) > 0.02), l.name).toBe(true);
    }
  });

  it('typische Merkmale wie an der Kamera gemessen', () => {
    // Hard Monotone: Himmelblau wird viel dunkler als bei Monotone (wie mit Rotfilter).
    expect(at('ricoh-hard-monotone', 10, 18, 28)[0]).toBeLessThan(at('ricoh-monotone', 10, 18, 28)[0] - 0.1);
    // Negative Film: Rot kippt nach Orange (mehr Grün im Rot).
    const rot = at('ricoh-negative-film', 28, 4, 4), rotStd = at('ricoh-standard', 28, 4, 4);
    expect(rot[1] - rot[2]).toBeGreaterThan(rotStd[1] - rotStd[2] + 0.05);
    // Bleach Bypass: Mittelgrau deutlich heller.
    expect(at('ricoh-bleach-bypass', 16, 16, 16)[1]).toBeGreaterThan(0.6);
    // Cross Process: Schatten blau.
    const s = at('ricoh-cross-process', 4, 4, 4);
    expect(s[2]).toBeGreaterThan(s[0] + 0.1);
  });
});
