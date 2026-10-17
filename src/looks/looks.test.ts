import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../types';
import { LOOKS } from './index';

const MENU = [
  'Provia/Standard', 'Velvia/Vivid', 'Astia/Soft', 'Classic Chrome', 'Reala Ace', 'Pro Neg. Hi', 'Pro Neg. Std', 'Classic Neg.',
  'Nostalgic Neg.', 'Eterna/Cinema', 'Eterna Bleach Bypass', 'Acros', 'Acros + Ye', 'Acros + R', 'Acros + G',
  'Monochrom', 'Monochrom + Ye', 'Monochrom + R', 'Monochrom + G', 'Sepia',
];

const FUJI = LOOKS.filter((l) => l.category === 'fujifilm');

describe('LOOKS', () => {
  it('enthält die Fujifilm-Simulationen in Menü-Reihenfolge mit eindeutigen IDs', () => {
    expect(FUJI.map((l) => l.name)).toEqual(MENU);
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    for (const l of FUJI) {
      expect(l.description.length).toBeGreaterThan(20);
      expect(!!l.monochrome).toBe(/Acros|Monochrom|Sepia/.test(l.name));
    }
  });

  it('ordnet die Gruppen Fujifilm, Leica, Kodak, Ricoh nacheinander an', () => {
    const order = LOOKS.map((l) => l.category).filter((c, i, a) => c !== a[i - 1]);
    expect(order).toEqual(['fujifilm', 'leica', 'kodak', 'ricoh']);
  });

  it('nennt die offiziellen LUT-Schlüssel genau für die Simulationen aus Fujifilms Paket', () => {
    const keys = LOOKS.filter((l) => l.officialKey).map((l) => l.officialKey);
    expect(keys.sort()).toEqual(['ACROS', 'ASTIA', 'CLASSIC-CHROME', 'CLASSIC-NEG', 'ETERNA', 'ETERNA-BB', 'PRO-NEG-STD', 'PROVIA', 'REALA-ACE', 'VELVIA']);
  });

  it('startet mit den Werkseinstellungen der Kamera (nur bekannte Felder, keine Extras)', () => {
    // Ausnahme: Was die Ricoh selbst im Effekt tut (Retro dunkelt die Ränder ab, Hi-Contrast B&W hat Korn).
    const kamera: Record<string, number[]> = { 'ricoh-retro': [0, 0, 1, 0], 'ricoh-hi-contrast-bw': [0, 0, 0, 2] };
    for (const l of LOOKS.filter((x) => x.category !== 'kodak')) {
      for (const k of Object.keys(l.defaults)) expect(k in DEFAULT_PARAMS).toBe(true);
      const p = { ...DEFAULT_PARAMS, ...l.defaults };
      expect([p.leak, p.halation, p.vignette, p.grainEffect], l.id).toEqual(kamera[l.id] ?? [0, 0, 0, 0]);
    }
  });

  it('Provia/Standard lässt das Foto unverändert', () => {
    const lut = LOOKS[0].buildLut(), n = lut.size;
    let worst = 0;
    for (let b = 0; b < n; b++)
      for (let g = 0; g < n; g++)
        for (let r = 0; r < n; r++) {
          const i = (r + g * n + b * n * n) * 3;
          worst = Math.max(worst, Math.abs(lut.data[i] - r / (n - 1)), Math.abs(lut.data[i + 1] - g / (n - 1)), Math.abs(lut.data[i + 2] - b / (n - 1)));
        }
    expect(worst).toBeLessThan(0.003);
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

// Kodak-Rezepte liefern die LUT ihrer Basis (eigene Prüfungen in kodak.test.ts).
describe.each(LOOKS.filter((l) => !l.baseLookId).map((l) => [l.name, l] as const))('LUT „%s“', (_name, look) => {
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

  if (look.monochrome && !['sepia', 'leica-sepia', 'leica-blue', 'leica-selenium'].includes(look.id))
    it('liefert R = G = B', () => {
      let differ = 0;
      for (let i = 0; i < lut.data.length; i += 3)
        if (lut.data[i + 1] !== lut.data[i] || lut.data[i + 2] !== lut.data[i]) differ++;
      expect(differ).toBe(0);
    });

  if (look.id === 'sepia')
    it('tönt gleichmäßig braun (R ≥ G ≥ B, Schwarz und Weiß neutral)', () => {
      let bad = 0;
      for (let i = 0; i < lut.data.length; i += 3) if (!(lut.data[i] >= lut.data[i + 1] && lut.data[i + 1] >= lut.data[i + 2])) bad++;
      expect(bad).toBe(0);
      expect(at(0, 0, 0, 0)).toBeLessThan(0.01);
      expect(at(n - 1, n - 1, n - 1, 2)).toBeGreaterThan(0.98);
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
