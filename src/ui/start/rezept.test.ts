import { describe, expect, it } from 'vitest';
import { LOOKS } from '../../looks';
import { parseRecipe } from '../recipeText';
import { BEISPIEL_LOOK, BEISPIEL_REZEPT, REZEPT_GRUPPEN } from './rezept';

describe('Rezept-Beispiel der Startseite', () => {
  it('ergibt beim Einfügen genau die Einstellungen des Looks', () => {
    const look = LOOKS.find((l) => l.id === BEISPIEL_LOOK)!;
    const base = LOOKS.find((l) => l.id === look.baseLookId)!;
    const r = parseRecipe(BEISPIEL_REZEPT);
    expect(r.film).toBe(base.name.replace(/\/.*$/, ''));
    const { exposure, ...rest } = look.defaults;
    expect(r.params).toEqual(expect.objectContaining(rest));
    // Der Look rundet die Bereichsmitte auf zwei Stellen.
    expect(r.params.exposure).toBeCloseTo(exposure!, 2);
    expect(r.skipped.map((s) => s.line)).toEqual(['High ISO NR: -4']);
  });

  it('ordnet jede Zeile des Rezepts genau einer Gruppe zu', () => {
    const zeilen = BEISPIEL_REZEPT.split('\n').slice(1).map((r) => r.split(':')[0]);
    expect(REZEPT_GRUPPEN.flatMap((g) => g.zeilen).sort()).toEqual([...zeilen].sort());
  });
});
