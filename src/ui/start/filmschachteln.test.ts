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
  for (const [w, h] of [[393, 852], [375, 667], [852, 393], [1440, 900], [1920, 1080]]) {
    it(`${w}×${h}: Mitte ragt am weitesten nach links, nach oben und unten weicht der Bogen zum rechten Rand zurück`, () => {
      const g = geometrie(w, h);
      const p = (d: number) => bahnPunkt(d, g);
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
      // ±3 liegen ganz im Bild (am Desktop mit mindestens 6 % Rand oben und unten).
      const rand = w >= 640 && h >= 520 ? h * 0.06 : 0;
      expect(p(-3).y - (g.boxH * p(3).scale) / 2).toBeGreaterThanOrEqual(rand - (h < 520 ? g.boxH : 0));
      expect(p(3).y + (g.boxH * p(3).scale) / 2).toBeLessThanOrEqual(h - rand + (h < 520 ? g.boxH : 0));
      expect(p(3).x + (g.boxW * p(3).scale) / 2).toBeLessThanOrEqual(w);
      // Die Mitte liegt ganz im Bild, die Schachtel ragt rechts nicht hinaus.
      expect(p(0).x + g.boxW / 2).toBeLessThanOrEqual(w);
      expect(p(0).x - g.boxW / 2).toBeGreaterThan(w / 3);
      expect(p(5).opacity).toBe(0);
      // Kleines Handy: ±4 schon ganz ausgeblendet (sonst ragen sie oben an den Markenschalter), sonst halb.
      expect(p(4).opacity).toBe(w < 640 && h >= 520 && h < 720 ? 0 : 0.5);
    });
  }
});
