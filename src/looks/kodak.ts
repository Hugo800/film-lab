// Kodak-Filme als Fujifilm-Rezepte: Basis-Simulation + Kamera-Einstellungen, wie sie die Rezeptautoren angeben
// (Werte aus docs/kamera-looks-referenz.md, Abschnitt 4). Die LUT ist die der Basis; der Film steckt in den defaults.
// Übertragung auf LookParams:
// - Weißabgleich: Daylight = 5500 K (das Foto gilt als bei Tageslicht neutral), Auto = 0; Fluorescent 1/3 sind
//   geschätzt (6000/4200 K, wie im Rezept-Parser der UI), Fujifilm nennt keine Werte.
// - DR-Auto wählt in der Kamera meist DR100 → 100; D-Range-Priority Auto (nur Portra 160) → DR200 (geschätzt).
// - Belichtung: Mitte des empfohlenen Bereichs. High ISO NR und ISO lassen sich nicht übertragen.
// Rezepte sind Annäherungen an die Filme (die Autoren sagen das selbst); Markennamen gehören ihren Inhabern.
import type { FilmLook, LookParams } from '../types';

interface KodakRecipe {
  id: string;
  name: string;
  /** Charakter des Films, 1 Satz. */
  character: string;
  /** Quelle des Rezepts. */
  source: string;
  base: string;
  /** Empfohlener Belichtungsbereich in EV [von, bis]. */
  exposure: [number, number];
  settings: Partial<LookParams>;
}

const DAYLIGHT = 5500;
const FLUORESCENT_1 = 6000;
const FLUORESCENT_3 = 4200;

const RECIPES: KodakRecipe[] = [
  {
    id: 'kodak-portra-160', name: 'Portra 160', base: 'classic-chrome', exposure: [1 / 3, 1],
    character: 'Sehr weicher Kontrast, sanfte, leicht pastellige Farben und natürliche Haut mit feinstem Korn.',
    source: 'Fuji X Weekly (Kodak Portra 160 v2)',
    settings: { grainEffect: 1, grainSize: 'klein', colorChrome: 1, colorChromeBlue: 1, wbKelvin: DAYLIGHT, wbShiftR: 4, wbShiftB: -5, dynamicRange: 200, color: 0, sharpness: -1, clarity: -2 },
  },
  {
    id: 'kodak-portra-400', name: 'Portra 400', base: 'classic-chrome', exposure: [1 / 3, 1],
    character: 'Niedriger Kontrast, warme Pfirsich-Haut und satte, aber weiche Farben – hell und luftig.',
    source: 'Fuji X Weekly (Kodak Portra 400 v2)',
    settings: { grainEffect: 2, grainSize: 'klein', colorChrome: 2, colorChromeBlue: 0, wbKelvin: 5200, wbShiftR: 1, wbShiftB: -6, dynamicRange: 400, highlightTone: 0, shadowTone: -2, color: 2, sharpness: -2, clarity: -2 },
  },
  {
    id: 'kodak-portra-800', name: 'Portra 800', base: 'classic-chrome', exposure: [1 / 3, 4 / 3],
    character: 'Etwas mehr Korn und Kontrast als Portra 400, warmer Stich bei etwas weniger Sättigung.',
    source: 'Fuji X Weekly (Kodak Portra 800 v3)',
    settings: { grainEffect: 2, grainSize: 'gross', colorChrome: 2, colorChromeBlue: 0, wbKelvin: 6600, wbShiftR: -1, wbShiftB: -3, dynamicRange: 400, highlightTone: -2, shadowTone: -0.5, color: 3, sharpness: -2, clarity: -3 },
  },
  {
    id: 'kodak-ektar-100', name: 'Ektar 100', base: 'classic-chrome', exposure: [0, 2 / 3],
    character: 'Knackige Rot- und Orangetöne, tiefes Blau und hoher Kontrast bei feinstem Korn.',
    source: 'Fuji X Weekly (Kodak Ektar 100)',
    settings: { grainEffect: 0, colorChrome: 2, colorChromeBlue: 1, wbKelvin: 6050, wbShiftR: 3, wbShiftB: 0, dynamicRange: 100, highlightTone: 1, shadowTone: -2, color: 4, sharpness: 0, clarity: 3 },
  },
  {
    id: 'kodak-gold-200', name: 'Gold 200', base: 'classic-chrome', exposure: [2 / 3, 1],
    character: 'Warmer Gelb-Orange-Stich, goldene Grüntöne und mittlerer Kontrast wie im Familienalbum.',
    source: 'Fuji X Weekly (Kodak Gold 200)',
    settings: { grainEffect: 2, grainSize: 'klein', colorChrome: 1, colorChromeBlue: 0, wbKelvin: DAYLIGHT, wbShiftR: 4, wbShiftB: -5, dynamicRange: 400, highlightTone: -1.5, shadowTone: 0.5, color: 3, sharpness: -2, clarity: -2 },
  },
  {
    id: 'kodak-ultramax-400', name: 'UltraMax 400', base: 'classic-chrome', exposure: [1 / 3, 1],
    character: 'Neutraler als Gold, knackige Grundfarben, mehr Korn und Kontrast.',
    source: 'Fuji X Weekly (Kodak Ultramax 400)',
    settings: { grainEffect: 2, grainSize: 'gross', colorChrome: 1, colorChromeBlue: 0, wbKelvin: 0, wbShiftR: 1, wbShiftB: -5, dynamicRange: 100, highlightTone: 1, shadowTone: 1, color: 4, sharpness: 0, clarity: 3 },
  },
  {
    id: 'kodak-colorplus-200', name: 'ColorPlus 200', base: 'classic-chrome', exposure: [0, 1 / 3],
    character: 'Günstiger Alltagsfilm: warm, weich und verzeihend, Gelb und Rot betont, Blau gedämpft.',
    source: 'ShutterGroove (Kodak ColorPlus 200)',
    settings: { grainEffect: 1, grainSize: 'klein', colorChrome: 0, colorChromeBlue: 0, wbKelvin: DAYLIGHT, wbShiftR: 0, wbShiftB: -3, dynamicRange: 100, highlightTone: 0, shadowTone: 0, color: 2, sharpness: 0, clarity: 0 },
  },
  {
    id: 'kodak-kodacolor-vr-200', name: 'Kodacolor VR 200', base: 'classic-chrome', exposure: [0, 2 / 3],
    character: 'Weich, warm-gedämpft und pastellig wie leicht verblasste Abzüge der 1980er.',
    source: 'Fuji X Weekly (Kodacolor VR 200)',
    settings: { grainEffect: 1, grainSize: 'gross', colorChrome: 2, colorChromeBlue: 1, wbKelvin: 3000, wbShiftR: 8, wbShiftB: -8, dynamicRange: 200, highlightTone: 1.5, shadowTone: 2.5, color: -4, sharpness: 1, clarity: -2 },
  },
  {
    id: 'kodak-kodachrome-64', name: 'Kodachrome 64', base: 'classic-chrome', exposure: [0, 2 / 3],
    character: 'Diafilm mit tiefem, warmem Rot und Gelb, leicht cyanigem Blau, kräftigem Kontrast und dichten Schatten.',
    source: 'Fuji X Weekly (Kodachrome 64)',
    settings: { grainEffect: 1, grainSize: 'klein', colorChrome: 2, colorChromeBlue: 0, wbKelvin: DAYLIGHT, wbShiftR: 2, wbShiftB: -5, dynamicRange: 200, highlightTone: 0, shadowTone: 0.5, color: 2, sharpness: 1, clarity: 3 },
  },
  {
    id: 'kodak-kodachrome-25', name: 'Kodachrome 25', base: 'classic-chrome', exposure: [0, 2 / 3],
    character: 'Wie Kodachrome 64, nur noch feiner, schärfer und kontrastreicher.',
    source: 'Fuji X Weekly (Kodachrome 25)',
    settings: { grainEffect: 0, colorChrome: 2, colorChromeBlue: 1, wbKelvin: DAYLIGHT, wbShiftR: 2, wbShiftB: -4, dynamicRange: 400, highlightTone: 0.5, shadowTone: -0.5, color: 1, sharpness: 3, clarity: 3 },
  },
  {
    id: 'kodak-ektachrome-e100', name: 'Ektachrome E100', base: 'nostalgic-neg', exposure: [0, 1 / 3],
    character: 'Sauberer, eher kühler Diafilm mit genauen Farben, feinem Korn und mäßigem Kontrast.',
    source: 'Fuji X Weekly (Thommy’s Ektachrome)',
    settings: { grainEffect: 1, grainSize: 'klein', colorChrome: 1, colorChromeBlue: 0, wbKelvin: 5000, wbShiftR: -1, wbShiftB: 3, dynamicRange: 100, highlightTone: 1.5, shadowTone: 1.5, color: 1, sharpness: -1, clarity: -2 },
  },
  {
    id: 'kodak-vision3-250d', name: 'Vision3 250D', base: 'nostalgic-neg', exposure: [0, 2 / 3],
    character: 'Tageslicht-Kinonegativ mit gedämpften, natürlichen Farben und großem Belichtungsspielraum.',
    source: 'Fuji X Weekly (Kodak Vision3 250D v2)',
    settings: { grainEffect: 2, grainSize: 'klein', colorChrome: 2, colorChromeBlue: 0, wbKelvin: FLUORESCENT_1, wbShiftR: -5, wbShiftB: 0, dynamicRange: 200, highlightTone: 4, shadowTone: 3, color: -1, sharpness: -2, clarity: -2 },
  },
  {
    // Kein eigenes Rezept: Die Fuji-Community nimmt CineStill 800T (= Vision3 500T ohne Rückschicht) als Stellvertreter,
    // hier ohne die Halation, die erst durch die fehlende Rückschicht entsteht.
    id: 'kodak-vision3-500t', name: 'Vision3 500T', base: 'eterna', exposure: [-1 / 3, 2 / 3],
    character: 'Kunstlicht-Kinonegativ: kühl-türkis bei Tageslicht, feines Korn und weiter Spielraum, ohne Halation.',
    source: 'Fuji X Weekly (CineStill 800T v1)',
    settings: { grainEffect: 2, grainSize: 'gross', colorChrome: 2, colorChromeBlue: 1, wbKelvin: FLUORESCENT_3, wbShiftR: -6, wbShiftB: -4, dynamicRange: 400, highlightTone: 0, shadowTone: 2, color: 4, sharpness: -3, clarity: -5 },
  },
  {
    id: 'kodak-cinestill-800t', name: 'CineStill 800T', base: 'reala-ace', exposure: [-1 / 3, 1 / 3],
    character: 'Vision3 500T ohne Rückschicht: kühle Töne und rote Halation um helle Lichter (Halation als Extra).',
    source: 'Fuji X Weekly (CineStill 800T v2)',
    settings: { grainEffect: 2, grainSize: 'klein', colorChrome: 0, colorChromeBlue: 0, wbKelvin: 4500, wbShiftR: -1, wbShiftB: -3, dynamicRange: 200, highlightTone: 2, shadowTone: 0, color: 4, sharpness: -1, clarity: -3, halation: 0.6 },
  },
  {
    // Rezept nennt Acros mit beliebigem Filter (+Ye/+R/+G); gewählt ist der mildeste.
    id: 'kodak-tri-x-400', name: 'Tri-X 400', base: 'acros-ye', exposure: [1 / 3, 1],
    character: 'Klassisches Schwarzweiß mit sichtbarem Korn, kräftigem Kontrast, tiefen Schwärzen und reichen Mitten.',
    source: 'Fuji X Weekly (Kodak Tri-X 400, Anders Lindborg)',
    settings: { grainEffect: 2, grainSize: 'gross', colorChrome: 2, colorChromeBlue: 0, wbKelvin: DAYLIGHT, wbShiftR: 9, wbShiftB: -9, dynamicRange: 200, highlightTone: 0, shadowTone: 3, sharpness: 1, clarity: 4 },
  },
  {
    id: 'kodak-t-max-400', name: 'T-Max 400', base: 'monochrome', exposure: [1 / 3, 1],
    character: 'Feinkörniges, sauberes Schwarzweiß mit hoher Schärfe und weiter Tonskala – glatter als Tri-X.',
    source: 'Fuji X Weekly (Kodak T-Max 400)',
    settings: { grainEffect: 2, grainSize: 'klein', colorChrome: 2, colorChromeBlue: 0, wbKelvin: DAYLIGHT, wbShiftR: 9, wbShiftB: -9, dynamicRange: 200, highlightTone: 0, shadowTone: 3, sharpness: 2, clarity: 3, monoWarmCool: 2, monoMagentaGreen: 0 },
  },
  {
    id: 'kodak-t-max-100', name: 'T-Max 100', base: 'monochrome-g', exposure: [-2 / 3, 2 / 3],
    character: 'Sehr feines Korn, hohe Schärfe und weiche, lange Tonskala.',
    source: 'Fuji X Weekly (Kodak T-Max 100 Soft Tone, Dan Allen)',
    settings: { grainEffect: 1, grainSize: 'gross', colorChrome: 0, colorChromeBlue: 0, wbKelvin: DAYLIGHT, wbShiftR: -6, wbShiftB: -3, dynamicRange: 200, highlightTone: -0.5, shadowTone: 1.5, sharpness: -1, clarity: -1, monoWarmCool: 0, monoMagentaGreen: 0 },
  },
];

/** Baut die Kodak-Looks auf den gegebenen Basis-Looks auf (LUT = LUT der Basis). */
export function kodakLooks(bases: FilmLook[]): FilmLook[] {
  return RECIPES.map((r) => {
    const base = bases.find((b) => b.id === r.base);
    if (!base) throw new Error(`Basis-Look ${r.base} fehlt`);
    const exposure = Math.round(((r.exposure[0] + r.exposure[1]) / 2) * 100) / 100;
    return {
      id: r.id,
      name: r.name,
      description: `${r.character} Rezept: ${r.source}.`,
      category: 'kodak',
      ...(base.monochrome ? { monochrome: true } : {}),
      baseLookId: base.id,
      buildLut: () => base.buildLut(),
      defaults: { ...r.settings, exposure },
    };
  });
}
