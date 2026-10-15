import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../types';
import { LOOKS } from './index';

const BRANDS = /kodak|fuji|ilford|cinestill|portra|ektar|velvia|provia|superia|eterna|acros|tri-?x|hp5/i;

describe('LOOKS', () => {
  it('hat 12–14 Looks mit eindeutigen IDs und Namen ohne Markennamen', () => {
    expect(LOOKS.length).toBeGreaterThanOrEqual(12);
    expect(LOOKS.length).toBeLessThanOrEqual(14);
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    for (const l of LOOKS) {
      expect(l.name).not.toMatch(BRANDS);
      expect(l.description.length).toBeGreaterThan(20);
    }
    for (const cat of ['farbe', 'diafilm', 'kino', 'schwarzweiss']) expect(LOOKS.some((l) => l.category === cat)).toBe(true);
  });

  it('hat Voreinstellungen im gültigen Bereich, Light Leaks aus', () => {
    for (const l of LOOKS) {
      const p = { ...DEFAULT_PARAMS, ...l.defaults };
      expect(p.leak).toBe(0);
      for (const k of ['grain', 'halation', 'vignette', 'strength'] as const) {
        expect(p[k]).toBeGreaterThanOrEqual(0);
        expect(p[k]).toBeLessThanOrEqual(1);
      }
      expect(p.grainSize).toBeGreaterThanOrEqual(0.5);
      expect(p.grainSize).toBeLessThanOrEqual(3);
    }
  });
});

// CPU-Zeit statt Wanduhr: parallel laufende Tests/Browser sollen die Messung nicht verfälschen.
const proc = (globalThis as { process?: { cpuUsage(prev?: object): { user: number; system: number } } }).process;
function cpuMs(fn: () => void): number {
  if (!proc) {
    const t = performance.now();
    fn();
    return performance.now() - t;
  }
  const start = proc.cpuUsage();
  fn();
  const d = proc.cpuUsage(start);
  return (d.user + d.system) / 1000;
}

// Einmal vorwärmen, damit die Zeitmessung nicht den JIT-Start misst.
LOOKS[0].buildLut();

describe.each(LOOKS.map((l) => [l.name, l] as const))('LUT „%s“', (_name, look) => {
  const lut = look.buildLut();
  const n = lut.size;
  const at = (r: number, g: number, b: number, c: number) => lut.data[(r + g * n + b * n * n) * 3 + c];

  it('hat 33³ Einträge im Bereich 0..1 ohne NaN', () => {
    expect(n).toBe(33);
    expect(lut.data.length).toBe(n ** 3 * 3);
    const bad = lut.data.filter((v) => !(v >= 0 && v <= 1));
    expect(bad.length).toBe(0);
  });

  it('ist auf der Grauachse in jedem Kanal monoton steigend', () => {
    for (let i = 1; i < n; i++)
      for (let c = 0; c < 3; c++) expect(at(i, i, i, c)).toBeGreaterThan(at(i - 1, i - 1, i - 1, c));
  });

  it('ist glatt: keine Sprünge zwischen Nachbarpunkten', () => {
    let worst = 0;
    for (let b = 0; b < n; b++)
      for (let g = 0; g < n; g++)
        for (let r = 1; r < n; r++)
          for (let c = 0; c < 3; c++) {
            worst = Math.max(worst, Math.abs(at(r, g, b, c) - at(r - 1, g, b, c)));
            worst = Math.max(worst, Math.abs(at(g, r, b, c) - at(g, r - 1, b, c)));
            worst = Math.max(worst, Math.abs(at(g, b, r, c) - at(g, b, r - 1, c)));
          }
    // Ein Gitterschritt ist 1/32; mehr als ~6-fache Steigung wäre ein sichtbarer Sprung.
    expect(worst).toBeLessThan(0.2);
  });

  if (look.category === 'schwarzweiss')
    it('liefert R = G = B', () => {
      let differ = 0;
      for (let i = 0; i < lut.data.length; i += 3)
        if (lut.data[i + 1] !== lut.data[i] || lut.data[i + 2] !== lut.data[i]) differ++;
      expect(differ).toBe(0);
    });

  it('ist deterministisch und schnell gebaut (< 50 ms CPU-Zeit)', () => {
    let best = Infinity;
    for (let k = 0; k < 5; k++) {
      let again = lut;
      best = Math.min(best, cpuMs(() => (again = look.buildLut())));
      expect(again.data.every((v, i) => v === lut.data[i])).toBe(true);
    }
    expect(best).toBeLessThan(50);
  });
});
