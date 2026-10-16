// Stärke-Regler: effectiveParams rechnet s in die Werte ein (0 = aus, 1 = Look wie definiert, 2 = doppelt).
import { describe, expect, it } from 'vitest';
import { LOOKS } from '../looks';
import { DEFAULT_PARAMS, type LookParams } from '../types';
import { drStrength, effectiveParams, GRAIN_AMP, type EffectiveParams } from './plan';

const look = (id: string) => LOOKS.find((l) => l.id === id)!;
/** Parameter wie in der App: Vorgaben des Looks, darauf eigene Änderungen, Stärke s. */
const P = (id: string, s: number, own: Partial<LookParams> = {}): LookParams => ({
  ...DEFAULT_PARAMS,
  ...look(id).defaults,
  ...own,
  strength: s,
  lookDefaults: look(id).defaults,
});
const NEUTRAL = effectiveParams(DEFAULT_PARAMS);
/** Alle Werte außer Stärke, Korngröße und Lecksamen (die skalieren nicht). */
const scaled = (e: EffectiveParams) => {
  const { strength: _s, grainSize: _g, leakSeed: _l, ...rest } = e;
  return rest;
};

describe('effectiveParams', () => {
  it('ohne Look-Vorgaben: Werte unverändert, Korn als Amplitude der Stufe', () => {
    for (const s of [0, 0.5, 1, 2]) {
      const p: LookParams = { ...DEFAULT_PARAMS, ...look('kodak-portra-400').defaults, strength: s };
      const { grainEffect, lookDefaults: _ld, ...rest } = p;
      expect(effectiveParams(p)).toEqual({ ...rest, grain: GRAIN_AMP[p.grainSize][grainEffect] });
    }
  });

  it('s = 1: für jeden Look identisch zur Rechnung ohne Look-Vorgaben (gleiche Zahlen, nicht nur ungefähr)', () => {
    for (const l of LOOKS) {
      const p = P(l.id, 1, { color: 1, clarity: -1 });
      const a = effectiveParams(p);
      const b = effectiveParams({ ...p, lookDefaults: undefined });
      for (const k of Object.keys(b) as (keyof EffectiveParams)[]) expect(Object.is(a[k], b[k]), `${l.name} ${k}`).toBe(true);
    }
  });

  it('s = 0 ohne eigene Änderungen: jeder Look ist neutral (Original, Korn aus)', () => {
    for (const l of LOOKS) {
      const e = effectiveParams(P(l.id, 0));
      // Tageslicht-Rezepte (5500 K) behalten 5500 K: gleichwertig zu „Auto“, nichts zu skalieren.
      expect([0, 5500], l.name).toContain(e.wbKelvin);
      expect(scaled({ ...e, wbKelvin: 0 }), l.name).toEqual(scaled(NEUTRAL));
      expect(e.grain).toBe(0);
      expect(e.dynamicRange).toBe(100);
    }
  });

  it('s = 2 verdoppelt die Abweichung des Looks von neutral (Portra 400)', () => {
    const d = look('kodak-portra-400').defaults;
    const e = effectiveParams(P('kodak-portra-400', 2));
    expect(e.color).toBe(2 * d.color!);
    expect(e.shadowTone).toBe(2 * d.shadowTone!);
    expect(e.wbShiftB).toBe(2 * d.wbShiftB!);
    expect(e.wbShiftR).toBe(2 * d.wbShiftR!);
    expect(e.clarity).toBe(2 * d.clarity!);
    expect(e.exposure).toBeCloseTo(2 * d.exposure!, 12);
    expect(e.colorChrome).toBe(4);
    expect(e.grain).toBeCloseTo(2 * GRAIN_AMP.klein[2], 12);
    expect(e.dynamicRange).toBe(1600); // DR400 = +2 Blenden → +4 Blenden
    // Weißabgleich in Mired: 5200 K liegt 10,5 Mired unter der Referenz → 21 Mired.
    expect(1e6 / e.wbKelvin - 1e6 / 5500).toBeCloseTo(2 * (1e6 / 5200 - 1e6 / 5500), 9);
  });

  it('eigene Änderungen wirken bei jeder Stärke voll', () => {
    const own = { color: 4, shadowTone: 0, wbShiftB: -2, exposure: -0.5, clarity: 1 } as const;
    for (const s of [0, 0.3, 1, 1.6, 2]) {
      const base = effectiveParams(P('kodak-portra-400', s));
      const mine = effectiveParams(P('kodak-portra-400', s, own));
      const d = look('kodak-portra-400').defaults;
      for (const k of Object.keys(own) as (keyof typeof own)[]) expect(mine[k] - base[k], `${k} bei s=${s}`).toBeCloseTo(own[k] - (d[k] as number), 12);
    }
    // Bei s = 0 bleibt nur die eigene Änderung: Farbe +2 statt Rezept +2 → +4.
    expect(effectiveParams(P('kodak-portra-400', 0, { color: 4 })).color).toBe(2);
  });

  it('Stufen werden stetig: Dynamikbereich in Blenden, Korn als Amplitude, Color Chrome linear', () => {
    const half = effectiveParams(P('kodak-portra-400', 0.5));
    expect(half.dynamicRange).toBe(200);
    expect(drStrength(half.dynamicRange)).toBe(0.5);
    expect(half.grain).toBeCloseTo(GRAIN_AMP.klein[2] / 2, 12);
    expect(half.colorChrome).toBe(1);
    const q = effectiveParams(P('kodak-portra-400', 0.25));
    expect(q.dynamicRange).toBeCloseTo(100 * Math.SQRT2, 9);
    // Die Korngröße bleibt die des Nutzers.
    const big = effectiveParams(P('kodak-portra-400', 0.5, { grainSize: 'gross' }));
    expect(big.grainSize).toBe('gross');
    expect(big.grain).toBeCloseTo(GRAIN_AMP.gross[2] / 2, 12);
  });

  it('Weißabgleich in Mired, „Auto“ ≙ 5500 K', () => {
    // Kodacolor VR 200: 3000 K. Halbe Stärke = Mitte in Mired.
    const e = effectiveParams(P('kodak-kodacolor-vr-200', 0.5));
    expect(e.wbKelvin).toBeCloseTo(1e6 / ((1e6 / 3000 + 1e6 / 5500) / 2), 6);
    // Rezept mit 5500 K (Tageslicht) = Auto: nichts zu skalieren, der Wert bleibt.
    expect(effectiveParams(P('kodak-portra-160', 0)).wbKelvin).toBe(5500);
    // Eigener Weißabgleich ist eine absolute Wahl: Er gilt bei jeder Stärke genau so („Auto“ = Foto bleibt).
    for (const s of [0, 0.5, 1, 2]) {
      expect(effectiveParams(P('kodak-kodacolor-vr-200', s, { wbKelvin: 0 })).wbKelvin, `Auto bei s=${s}`).toBe(0);
      expect(effectiveParams(P('kodak-kodacolor-vr-200', s, { wbKelvin: 4000 })).wbKelvin, `4000 K bei s=${s}`).toBe(4000);
    }
  });

  it('eigene Auswahl bei Stufen und Extras gilt absolut (aus bleibt aus, nichts kommt über 50 % zurück)', () => {
    const off = { grainEffect: 0, colorChrome: 0, colorChromeBlue: 0, dynamicRange: 100 } as const;
    for (const s of [0, 0.5, 1, 1.5, 2]) {
      const e = effectiveParams(P('kodak-portra-400', s, off));
      expect([e.grain, e.colorChrome, e.colorChromeBlue, e.dynamicRange], `Portra aus bei s=${s}`).toEqual([0, 0, 0, 100]);
      const weak = effectiveParams(P('kodak-portra-400', s, { grainEffect: 1, colorChrome: 1 }));
      expect([weak.grain, weak.colorChrome], `Schwach bei s=${s}`).toEqual([GRAIN_AMP.klein[1], 1]);
      const h = effectiveParams(P('kodak-cinestill-800t', s, { halation: 0 }));
      expect(h.halation, `Halation aus bei s=${s}`).toBe(0);
      expect(effectiveParams(P('kodak-cinestill-800t', s, { halation: 0.3 })).halation).toBe(0.3);
    }
  });

  it('begrenzt nur, wo die Rechnung sonst kippt', () => {
    const e = effectiveParams(P('kodak-vision3-250d', 2)); // Lichter +4, Schatten +3
    expect(e.highlightTone).toBe(4);
    expect(e.shadowTone).toBe(4);
    const v = effectiveParams(P('kodak-vision3-500t', 2)); // Klarheit −5, Schärfe −3, Farbe +4
    expect(v.clarity).toBe(-6);
    expect(v.sharpness).toBe(-4);
    expect(v.color).toBe(8); // über dem Kamerabereich erlaubt
    const k = effectiveParams(P('kodak-kodacolor-vr-200', 2)); // Farbe −4
    expect(k.color).toBe(-8);
    const h = effectiveParams(P('kodak-cinestill-800t', 2));
    expect(h.halation).toBeCloseTo(1.2, 12);
  });

  it('Fujifilm/Leica ohne Vorgaben: die Stärke betrifft nur die LUT', () => {
    for (const id of ['classic-chrome', 'velvia', 'acros', 'leica-chrome']) {
      const p = P(id, 0, { color: 2 });
      const { lookDefaults: _ld, ...rest } = p;
      expect(effectiveParams(p)).toEqual(effectiveParams(rest));
    }
  });
});

describe('drStrength', () => {
  it('DR100/200/400 wie bisher, dazwischen und darüber stetig, höchstens 2', () => {
    expect([100, 200, 400].map(drStrength)).toEqual([0, 0.5, 1]);
    expect(drStrength(800)).toBe(1.5);
    expect(drStrength(1600)).toBe(2);
    expect(drStrength(6400)).toBe(2);
    expect(drStrength(50)).toBe(0);
  });
});
