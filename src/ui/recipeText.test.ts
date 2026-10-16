import { describe, expect, it } from 'vitest';
import { filmKey, findLook, findRecipeLook, numbersIn, parseRecipe, RECIPE_EXAMPLE, type RecipeLookRef } from './recipeText';

const LOOKS: RecipeLookRef[] = [
  'Provia', 'Velvia', 'Astia', 'Classic Chrome', 'Pro Neg. Hi', 'Pro Neg. Std', 'Classic Neg.', 'Nostalgic Neg.', 'Eterna', 'Eterna Bleach Bypass', 'Reala Ace', 'Acros', 'Acros + Ye', 'Monochrome', 'Sepia',
].map((name) => ({ id: name.toLowerCase().replace(/\W+/g, '-'), name, category: 'fujifilm' }));
LOOKS.push({ id: 'leica-chrome', name: 'Leica Chrome', category: 'leica' }, { id: 'portra-400', name: 'Portra 400', category: 'kodak' });

describe('numbersIn', () => {
  it('liest Brüche, gemischte Brüche und Bereiche', () => {
    expect(numbersIn('+1/3 to +1')).toEqual([1 / 3, 1]);
    expect(numbersIn('-2/3')).toEqual([-2 / 3]);
    expect(numbersIn('+1 1/3')).toEqual([1 + 1 / 3]);
    expect(numbersIn('0 to +2/3')).toEqual([0, 2 / 3]);
  });
  it('versteht Dezimalkomma, echtes Minus und Gedankenstrich als Minus oder Bereich', () => {
    expect(numbersIn('−1,5')).toEqual([-1.5]);
    expect(numbersIn('–1')).toEqual([-1]);
    expect(numbersIn('-1 – +1')).toEqual([-1, 1]);
  });
});

describe('findLook', () => {
  it('ordnet Schreibweisen zu', () => {
    expect(findLook('Classic Chrome', LOOKS)?.id).toBe('classic-chrome');
    expect(findLook('classic negative', LOOKS)?.id).toBe('classic-neg-');
    expect(findLook('PRO Neg. Std', LOOKS)?.id).toBe('pro-neg-std');
    expect(findLook('Pro Neg Hi', LOOKS)?.id).toBe('pro-neg-hi');
    expect(findLook('Eterna Cinema', LOOKS)?.id).toBe('eterna');
    expect(findLook('Bleach Bypass', LOOKS)?.id).toBe('eterna-bleach-bypass');
    expect(findLook('Portra 400', LOOKS)?.id).toBe('portra-400');
    expect(findLook('Provia/Standard', LOOKS)?.id).toBe('provia');
  });
  it('rät nicht', () => {
    expect(findLook('Kodachrome 64', LOOKS)).toBeUndefined();
    expect(findLook('', LOOKS)).toBeUndefined();
  });
  it('filmKey ist stabil', () => {
    expect(filmKey('Film Simulation: Nostalgic Negative')).toBe(filmKey('Nostalgic Neg.'));
  });
});

describe('parseRecipe', () => {
  it('1: das Beispiel aus dem Eingabefeld (Zeilen)', () => {
    const r = parseRecipe(RECIPE_EXAMPLE);
    expect(r.film).toBe('Classic Chrome');
    expect(r.params).toEqual({
      dynamicRange: 400,
      highlightTone: -1,
      shadowTone: 0.5,
      color: 2,
      sharpness: -2,
      clarity: -2,
      grainEffect: 2,
      grainSize: 'klein',
      colorChrome: 2,
      colorChromeBlue: 0,
      wbKelvin: 5500,
      wbShiftR: 2,
      wbShiftB: -4,
      exposure: 0.67,
    });
    expect(r.skipped).toEqual([]);
  });

  it('2: alles in einer Zeile mit „ / “, Bruch „+1/3“ bleibt heil, High ISO NR wird gemeldet', () => {
    const r = parseRecipe(
      'Film Simulation: Classic Chrome / Grain Effect: Strong, Small / Color Chrome Effect: Strong / Color Chrome FX Blue: Off / White Balance: 5500K, +2 Red & -4 Blue / Dynamic Range: DR400 / Highlight: -1 / Shadow: +0.5 / Color: +2 / Sharpness: -2 / High ISO NR: -4 / Clarity: -2 / Exposure Compensation: +1/3 to +1',
    );
    expect(r.film).toBe('Classic Chrome');
    expect(r.params.exposure).toBe(0.67);
    expect(r.params.wbKelvin).toBe(5500);
    expect(r.params.wbShiftB).toBe(-4);
    expect(r.params.dynamicRange).toBe(400);
    expect(r.params.clarity).toBe(-2);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].line).toBe('High ISO NR: -4');
  });

  it('3: Auto-Weißabgleich mit Verschiebung, Titelzeile, Rauschminderung und ISO', () => {
    const r = parseRecipe(`Kodak Portra 400 Style
Film Simulation: Classic Negative
Dynamic Range: DR200
Highlight: -0.5
Shadow: -1
Color: +3
Noise Reduction: -4
Sharpening: +1
Clarity: +2
Grain Effect: Weak, Large
Color Chrome Effect: Weak
Color Chrome FX Blue: Weak
White Balance: Auto White Balance, +3 Red & -5 Blue
ISO: Auto, up to ISO 6400
Exposure Compensation: 0 to +2/3`);
    expect(r.title).toBe('Kodak Portra 400 Style');
    expect(r.film).toBe('Classic Negative');
    expect(r.params).toMatchObject({
      dynamicRange: 200, highlightTone: -0.5, shadowTone: -1, color: 3, sharpness: 1, clarity: 2,
      grainEffect: 1, grainSize: 'gross', colorChrome: 1, colorChromeBlue: 1, wbKelvin: 0, wbShiftR: 3, wbShiftB: -5, exposure: 0.33,
    });
    expect(r.skipped.map((s) => s.line)).toEqual(['Noise Reduction: -4', 'ISO: Auto, up to ISO 6400']);
  });

  it('4: Tageslicht, Schatten, Leuchtstoff und Kunstlicht als Namen', () => {
    const wb = (v: string) => parseRecipe(`White Balance: ${v}`).params;
    expect(wb('Daylight, +2 Red & -3 Blue')).toMatchObject({ wbKelvin: 5500, wbShiftR: 2, wbShiftB: -3 });
    expect(wb('Shade, 0 Red & 0 Blue')).toMatchObject({ wbKelvin: 7500, wbShiftR: 0, wbShiftB: 0 });
    expect(wb('Fluorescent 1, -1 Red & +4 Blue')).toMatchObject({ wbKelvin: 6000, wbShiftR: -1, wbShiftB: 4 });
    expect(wb('Fluorescent 2').wbKelvin).toBe(3500);
    expect(wb('Fluorescent 3').wbKelvin).toBe(4200);
    expect(wb('Incandescent, +1 Red & -2 Blue').wbKelvin).toBe(3200);
    expect(wb('Auto').wbKelvin).toBe(0);
    expect(wb('6500K, R: +4, B: -7')).toMatchObject({ wbKelvin: 6500, wbShiftR: 4, wbShiftB: -7 });
  });

  it('5: Halbschritte bei Lichtern und Schatten, auch mit Dezimalkomma und echtem Minus', () => {
    const r = parseRecipe('Highlight: -1.5\nShadow: +0.5\n');
    expect(r.params).toEqual({ highlightTone: -1.5, shadowTone: 0.5 });
    const g = parseRecipe('Highlight: −1,5\nShadow: +2,5');
    expect(g.params).toEqual({ highlightTone: -1.5, shadowTone: 2.5 });
    const c = parseRecipe('Highlight: +9\nShadow: -7');
    expect(c.params).toEqual({ highlightTone: 4, shadowTone: -2 });
  });

  it('6: Tone Curve „+1H & -1S“', () => {
    expect(parseRecipe('Tone Curve: +1H & -1S').params).toEqual({ highlightTone: 1, shadowTone: -1 });
    expect(parseRecipe('Tone Curve: nach Gefühl').skipped).toHaveLength(1);
  });

  it('7: Schwarzweiß mit Acros-Filter, Korn und Monochrom-Tönung', () => {
    const r = parseRecipe(`Film Simulation: Acros+Ye
Grain: Weak, Large
Monochromatic Color: WC +3 & MG -1
Highlight: +1
Shadow: +2`);
    expect(r.film).toBe('Acros');
    expect(r.filmFilter).toBe('Ye');
    expect(r.params).toEqual({ grainEffect: 1, grainSize: 'gross', monoWarmCool: 3, monoMagentaGreen: -1, highlightTone: 1, shadowTone: 2 });
    expect(findLook(r.film!, LOOKS)?.id).toBe('acros');
    expect(findRecipeLook(r, LOOKS)).toEqual({ look: LOOKS.find((l) => l.id === 'acros-ye'), filterIgnored: false });
    const red = parseRecipe('Film Simulation: Acros+R');
    expect(findRecipeLook(red, LOOKS)).toEqual({ look: LOOKS.find((l) => l.id === 'acros'), filterIgnored: true });
  });

  it('8: Korn aus; Größe nur bei vorhandenem Korn', () => {
    expect(parseRecipe('Grain Effect: Off').params).toEqual({ grainEffect: 0 });
    expect(parseRecipe('Grain Effect: Strong').params).toEqual({ grainEffect: 2 });
    expect(parseRecipe('Grain: Weak, Small').params).toEqual({ grainEffect: 1, grainSize: 'klein' });
  });

  it('9: Aufzählungszeichen, Markdown-Fett, britisches „Colour“, Groß-/Kleinschreibung', () => {
    const r = parseRecipe(`- **Film Simulation:** Velvia
* dynamic range: dr-200
• Colour: -2
1. SHARPNESS: +4`);
    expect(r.film).toBe('Velvia');
    expect(r.params).toEqual({ dynamicRange: 200, color: -2, sharpness: 4 });
  });

  it('10: Belichtungskorrektur: Bereiche mitteln, Brüche, Vorzeichen', () => {
    const e = (v: string) => parseRecipe(`Exposure Compensation: ${v}`).params.exposure;
    expect(e('-1/3 to +1/3')).toBe(0);
    expect(e('+2/3 to +1 1/3')).toBe(1);
    expect(e('-1 to 0')).toBe(-0.5);
    expect(e('+1')).toBe(1);
    expect(e('0')).toBe(0);
    expect(e('+5')).toBe(2);
    expect(e('-2/3')).toBe(-0.67);
  });

  it('11: Werte außerhalb des Bereichs werden begrenzt', () => {
    const r = parseRecipe('Color: +9\nSharpness: -9\nClarity: +9\nWhite Balance: 20000K, +20 Red & -20 Blue\nMonochromatic Color: WC +30 & MG -30');
    expect(r.params).toEqual({ color: 4, sharpness: -4, clarity: 5, wbKelvin: 10000, wbShiftR: 9, wbShiftB: -9, monoWarmCool: 18, monoMagentaGreen: -18 });
  });

  it('12: Unbekanntes wird gezeigt statt geraten', () => {
    const r = parseRecipe(`Film Simulation: Kodachrome 64
Dynamic Range: DR-Auto
Color Chrome Effect: vielleicht
White Balance: Unterwasser
Smooth Skin Effect: Strong
Lieblingsfarbe: Blau
einfach nur Text`);
    expect(r.film).toBe('Kodachrome 64');
    expect(r.params).toEqual({});
    expect(r.skipped.map((s) => s.line)).toEqual([
      'Dynamic Range: DR-Auto',
      'Color Chrome Effect: vielleicht',
      'White Balance: Unterwasser',
      'Smooth Skin Effect: Strong',
      'Lieblingsfarbe: Blau',
      'einfach nur Text',
    ]);
    expect(findLook(r.film!, LOOKS)).toBeUndefined();
  });

  it('13: leere und sinnlose Eingaben', () => {
    expect(parseRecipe('')).toEqual({ params: {}, applied: [], skipped: [] });
    expect(parseRecipe('   \n\n').applied).toEqual([]);
    expect(parseRecipe('Settings:\n').skipped).toEqual([]);
  });

  it('14: Anzeigewerte mit Vorzeichen und deutschem Komma', () => {
    const r = parseRecipe('Highlight: -1.5\nShadow: +0.5\nColor: 0\nWhite Balance: 5500K, +2 Red & -4 Blue\nExposure Compensation: +1/3');
    const show = Object.fromEntries(r.applied.map((a) => [a.label, a.value]));
    expect(show).toMatchObject({
      Lichter: '−1,5',
      Schatten: '+0,5',
      Farbe: '0',
      Weißabgleich: '5500 K',
      'WB-Verschiebung Rot': '+2',
      'WB-Verschiebung Blau': '−4',
      Belichtung: '+1/3 EV',
    });
  });

  it('15: späterer Eintrag derselben Einstellung gewinnt, Anzeige bleibt einzeilig', () => {
    const r = parseRecipe('Color: +1\nColor: +3');
    expect(r.params.color).toBe(3);
    expect(r.applied).toHaveLength(1);
  });

  it('16: Rezept mit Semikolon- und Pipe-Trennung', () => {
    const r = parseRecipe('Film Simulation: Provia; Color: +1 | Sharpness: 0');
    expect(r.film).toBe('Provia');
    expect(r.params).toEqual({ color: 1, sharpness: 0 });
  });
});

describe('parseRecipe: Titel, Link und Aufnahmeeinstellungen', () => {
  it('17: „Film Simulation Recipe“ und „Recipe“ fallen aus dem Titel', () => {
    expect(parseRecipe('Kodak Portra 400 Film Simulation Recipe\nFilm Simulation: Classic Negative').title).toBe('Kodak Portra 400');
    expect(parseRecipe('Moody Classic Chrome Recipe\nColor: +1').title).toBe('Moody Classic Chrome');
    expect(parseRecipe('Film Simulation Recipe\nColor: +1').title).toBeUndefined();
    expect(parseRecipe('Sommerabend\nColor: +1').title).toBe('Sommerabend');
  });

  it('18: ein Link wird als Link gemeldet, nicht als unbekannte Zeile', () => {
    const r = parseRecipe('https://fujixweekly.com/2023/01/01/mein-rezept/');
    expect(r.link).toBe(true);
    expect(r.skipped).toEqual([]);
    expect(r.applied).toEqual([]);
    expect(parseRecipe('  HTTP://example.com\nColor: +1').params).toEqual({ color: 1 });
    expect(parseRecipe('Color: +1').link).toBeUndefined();
  });

  it('19: D Range Priority, Smooth Skin, Long Exposure NR, Color Space und Shadow/Highlight Priority sind Aufnahmeeinstellungen', () => {
    const r = parseRecipe(`D Range Priority: Off
Smooth Skin Effect: Strong
Long Exposure NR: On
Color Space: sRGB
Shadow/Highlight Priority: Off
Highlight: +1`);
    expect(r.params).toEqual({ highlightTone: 1 });
    expect(r.skipped).toHaveLength(5);
    expect(r.skipped.every((s) => s.reason.startsWith('Aufnahmeeinstellung'))).toBe(true);
  });

  it('20: DR-Auto meldet „DR100 bleibt“', () => {
    const r = parseRecipe('Dynamic Range: DR-Auto');
    expect(r.params).toEqual({});
    expect(r.skipped).toEqual([{ line: 'Dynamic Range: DR-Auto', reason: 'Auto gibt es hier nicht – DR100 bleibt' }]);
  });

  it('21: Tone Curve in fremdem Format wird ganz ausgelassen', () => {
    const r = parseRecipe('Tone Curve: +1H und Mitten anheben');
    expect(r.params).toEqual({});
    expect(r.skipped).toHaveLength(1);
    expect(parseRecipe('Tone Curve: +1.5H, -1S').params).toEqual({ highlightTone: 1.5, shadowTone: -1 });
    expect(parseRecipe('Tone Curve: -1S').params).toEqual({ shadowTone: -1 });
  });
});
