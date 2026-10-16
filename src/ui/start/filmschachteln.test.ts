import { describe, expect, it } from 'vitest';
import { LOOKS } from '../../looks';
import { FILMSCHACHTELN, schachtelFuer } from './filmschachteln';
import { bahnPunkt, geometrie } from './bahn';

describe('Filmschachteln', () => {
  it('jeder eingebaute Look hat eine eigene Schachtel der passenden Familie', () => {
    const familie = { fujifilm: 'fuji', leica: 'leica', kodak: 'kodak' } as Record<string, string>;
    for (const look of LOOKS) {
      const s = FILMSCHACHTELN[look.id];
      expect(s, look.id).toBeDefined();
      expect(s.familie, look.id).toBe(familie[look.category]);
      expect(s.name.length, look.id).toBeGreaterThan(0);
    }
    expect(Object.keys(FILMSCHACHTELN).sort()).toEqual(LOOKS.map((l) => l.id).sort());
  });

  it('Leica-Schachteln tragen „Look“, Filme „135-36“; SW-Looks heißen Schwarzweiß', () => {
    for (const look of LOOKS) {
      const s = FILMSCHACHTELN[look.id];
      expect(s.kennung, look.id).toBe(look.category === 'leica' ? 'Look' : '135-36');
      const mono = look.monochrome ?? LOOKS.find((l) => l.id === look.baseLookId)?.monochrome ?? false;
      expect(s.typ === 'Schwarzweiß', look.id).toBe(mono);
    }
  });

  it('Filmschachteln haben unten rechts ISO oder Kürzel; Varianten derselben Schachtel unterscheiden sich darin', () => {
    const marke = new Map<string, string>();
    for (const look of LOOKS) {
      const s = FILMSCHACHTELN[look.id];
      if (s.familie === 'leica') continue;
      expect(s.iso ?? s.zeichen, look.id).toBeTruthy();
      const k = `${s.name}|${s.iso ?? ''}|${s.zeichen ?? ''}`;
      expect(marke.get(k), `${look.id} gleicht ${marke.get(k)}`).toBeUndefined();
      marke.set(k, look.id);
    }
  });

  it('unbekannte und eigene Looks bekommen eine neutrale Schachtel mit ihrem Namen', () => {
    const s = schachtelFuer({ id: 'eigene-123', name: 'Mein Rezept', monochrome: false });
    expect(s).toMatchObject({ familie: 'eigen', name: 'Mein Rezept', typ: 'Look' });
    expect(schachtelFuer({ id: 'x', name: 'SW', monochrome: true }).typ).toBe('Schwarzweiß');
  });
});

describe('Bahn des Look-Rads', () => {
  // Kachelgrößen: Handy hochkant (393 bzw. 375 breit), Handy quer, PC 1280×720, 1440×900 und 1920×1080.
  for (const [w, h] of [[353, 441], [335, 395], [594, 297], [552, 368], [822, 548], [1024, 683]]) {
    it(`Kachel ${w}×${h}: Mitte ragt am weitesten nach links, nach oben und unten weicht der Bogen zum rechten Rand zurück`, () => {
      const g = geometrie(w, h);
      const p = (d: number) => bahnPunkt(d, g);
      const halb = (d: number) => (g.boxH * p(d).scale) / 2;
      expect(p(0).y).toBeCloseTo(g.cy);
      for (let d = 0.5; d <= 4; d += 0.5) {
        expect(p(d).x).toBeGreaterThan(p(d - 0.5).x);
        expect(p(-d).x).toBeCloseTo(p(d).x);
        expect(p(d).y).toBeGreaterThan(p(d - 0.5).y);
        expect(p(-d).y - g.cy).toBeCloseTo(g.cy - p(d).y);
        expect(p(d).scale).toBeLessThan(p(d - 0.5).scale);
      }
      // Nachbarn überlappen sich nicht.
      for (let d = 0; d < 4; d++) {
        const a = p(d), b = p(d + 1);
        expect(b.y - a.y).toBeGreaterThan((g.boxH * (a.scale + b.scale)) / 2);
      }
      // Nahe Schachteln sind deckend (blasser nur durch Abdunkeln), erst am Rand blenden sie aus.
      for (let d = 0; d <= 3; d++) expect(p(d).opacity).toBe(1);
      expect(p(3).dunkel).toBeGreaterThan(p(1).dunkel);
      expect(p(4).opacity).toBe(0.5);
      expect(p(5).opacity).toBe(0);
      // Mitte und ±1 liegen ganz in der Kachel; in der breiten Kachel (3:2) auch ±2.
      const voll = w / h > 1.4 && w / h < 1.8 ? 2 : 1;
      expect(p(-voll).y - halb(voll)).toBeGreaterThanOrEqual(0);
      expect(p(voll).y + halb(voll)).toBeLessThanOrEqual(h);
      // Bis ±2 ragt rechts nichts aus der Kachel; die Mitte liegt in der rechten Hälfte, links bleibt Platz für den Text.
      for (let d = 0; d <= 2; d++) expect(p(d).x + (g.boxW * p(d).scale) / 2).toBeLessThanOrEqual(w);
      expect(p(0).x - g.boxW / 2).toBeGreaterThan(w / 2);
      // Nie kleiner als 118 px breit: Der Name der mittleren Schachtel (längstes Wort mit 7,6 cqw) bleibt ≥ 9 px.
      expect(g.boxW).toBeGreaterThanOrEqual(118);
    });
  }

  it('richtet sich nach der Kachel, nicht nach dem Fenster: größere Kachel, größere Schachteln (bis 120 px hoch)', () => {
    expect(geometrie(1024, 683).boxH).toBeGreaterThan(geometrie(822, 548).boxH);
    expect(geometrie(822, 548).boxH).toBeGreaterThan(geometrie(552, 368).boxH);
    expect(geometrie(1600, 1067).boxH).toBe(120);
  });
});
