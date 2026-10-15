import type { FilmLook, LookCategory, LookParams } from '../types';
import { buildLut, HUE, type LookSpec } from './model';

interface LookDef {
  id: string;
  name: string;
  description: string;
  category: LookCategory;
  spec: LookSpec;
  defaults: Partial<LookParams>;
}

export const LOOK_SPECS: LookDef[] = [
  {
    id: 'warm-portrait',
    name: 'Warmes Porträt',
    description: 'Angelehnt an Kodak Portra 400: warm, weiche Kontraste, natürliche Haut und cremige Lichter.',
    category: 'farbe',
    spec: {
      balance: [1.03, 1, 0.95],
      exposure: 0.12,
      contrast: 0.95,
      toe: -0.08,
      shoulder: 0.4,
      fade: 0.015,
      saturation: 0.92,
      hues: [
        { hue: HUE.skin, width: 40, shift: 3, sat: 1.06 },
        { hue: HUE.foliage, width: 45, sat: 0.85, shift: -4 },
        { hue: HUE.blue, width: 50, sat: 0.85, shift: -6 },
      ],
      shadowTint: [-0.003, -0.004],
      highlightTint: [0.003, 0.01],
    },
    defaults: { grain: 0.25, grainSize: 1, halation: 0.15, vignette: 0.15 },
  },
  {
    id: 'vivid-landscape',
    name: 'Satte Landschaft',
    description: 'Angelehnt an Kodak Ektar 100: satt, kontrastreich, kräftiges Rot und Blau bei feinem Korn.',
    category: 'farbe',
    spec: {
      balance: [1.01, 1, 0.99],
      contrast: 1.15,
      toe: 0.05,
      shoulder: 0.2,
      saturation: 1.15,
      shadowSat: 0.85,
      hues: [
        { hue: HUE.red, width: 40, sat: 1.15 },
        { hue: HUE.skin, width: 25, sat: 0.92 },
        { hue: HUE.blue, width: 50, sat: 1.15 },
      ],
    },
    defaults: { grain: 0.1, grainSize: 0.7, halation: 0.1, vignette: 0.15 },
  },
  {
    id: 'golden-summer',
    name: 'Goldener Sommer',
    description: 'Angelehnt an Kodak Gold 200: warm-gelblich und nostalgisch wie alte Urlaubsbilder.',
    category: 'farbe',
    spec: {
      balance: [1.04, 1.01, 0.92],
      contrast: 1,
      shoulder: 0.35,
      fade: [0.03, 0.027, 0.015],
      hues: [
        { hue: HUE.yellow, width: 40, sat: 1.15 },
        { hue: HUE.orange, width: 35, sat: 1.1 },
        { hue: HUE.green, width: 45, shift: -8 },
        { hue: HUE.blue, width: 50, sat: 0.85, shift: -6 },
      ],
      highlightTint: [0.002, 0.012],
    },
    defaults: { grain: 0.3, grainSize: 1.1, halation: 0.2, vignette: 0.25 },
  },
  {
    id: 'green-everyday',
    name: 'Grüner Alltag',
    description: 'Angelehnt an Fujicolor Superia 400: kühle Grün- und Cyantöne in den Schatten, leichtes Magenta.',
    category: 'farbe',
    spec: {
      contrast: 1.08,
      toe: 0.05,
      shoulder: 0.3,
      saturation: 1.05,
      hues: [{ hue: HUE.green, width: 45, shift: 14, sat: 1.05 }],
      shadowTint: [-0.016, -0.004],
      highlightTint: [0.006, -0.002],
    },
    defaults: { grain: 0.3, grainSize: 1, halation: 0.15, vignette: 0.15 },
  },
  {
    id: 'retro-negative',
    name: 'Retro-Negativ',
    description: 'Angelehnt an Fujis Classic Negative: harte Schatten, Cyan-Grün, entsättigtes Rot, Retro-Stimmung.',
    category: 'farbe',
    spec: {
      // Etwas Farbtrennung wie bei kräftigen Negativ-Farbstoffen.
      matrix: [1.05, -0.03, -0.02, -0.02, 1.04, -0.02, 0, -0.04, 1.04],
      contrast: 1.1,
      toe: 0.25,
      shoulder: 0.3,
      saturation: 0.9,
      hues: [
        { hue: HUE.red, width: 40, sat: 0.75, shift: 6 },
        { hue: HUE.green, width: 50, shift: 14, sat: 0.9 },
        { hue: HUE.blue, width: 50, shift: -10 },
      ],
      shadowTint: [-0.01, -0.008],
      highlightTint: [0.004, 0.012],
    },
    defaults: { grain: 0.2, grainSize: 1, halation: 0.1, vignette: 0.2 },
  },
  {
    id: 'vivid-slide',
    name: 'Leuchtdia',
    description: 'Angelehnt an Fujichrome Velvia 50: sehr satt, tiefe Schatten, leuchtendes Grün und Blau.',
    category: 'diafilm',
    spec: {
      contrast: 1.25,
      toe: 0.2,
      shoulder: 0.25,
      saturation: 1.22,
      shadowSat: 0.85,
      hues: [
        { hue: HUE.green, width: 50, sat: 1.12 },
        { hue: HUE.blue, width: 50, sat: 1.12 },
        { hue: HUE.red, width: 40, sat: 1.05 },
        { hue: HUE.skin, width: 25, sat: 0.9 },
      ],
    },
    defaults: { grain: 0.08, grainSize: 0.6, halation: 0.05, vignette: 0.2 },
  },
  {
    id: 'clear-slide',
    name: 'Klares Dia',
    description: 'Angelehnt an Fujichrome Provia 100: neutral und sauber mit etwas mehr Kontrast.',
    category: 'diafilm',
    spec: { contrast: 1.12, toe: 0.08, shoulder: 0.15, saturation: 1.08 },
    defaults: { grain: 0.06, grainSize: 0.6, vignette: 0.1 },
  },
  {
    id: 'reportage',
    name: 'Reportage',
    description: 'Angelehnt an Fujis Classic Chrome: entsättigt, dichte Schatten, gedämpftes Blau und Cyan.',
    category: 'diafilm',
    spec: {
      contrast: 1.08,
      toe: 0.25,
      shoulder: 0.3,
      saturation: 0.78,
      hues: [
        { hue: HUE.blue, width: 50, sat: 0.75, shift: -8, light: -0.02 },
        { hue: HUE.cyan, width: 40, sat: 0.75 },
        { hue: HUE.red, width: 35, sat: 0.85, shift: 4 },
        { hue: HUE.green, width: 45, sat: 0.75, shift: -8 },
      ],
      shadowTint: [-0.002, -0.004],
      highlightTint: [0.002, 0.006],
    },
    defaults: { grain: 0.15, grainSize: 1, vignette: 0.15 },
  },
  {
    id: 'tungsten-800',
    name: 'Kunstlicht 800',
    description: 'Angelehnt an Cinestill 800T: Kunstlichtfilm bei Tageslicht – kühl, Cyan-Schatten, starkes rotes Leuchten.',
    category: 'kino',
    spec: {
      balance: [0.94, 1, 1.06],
      contrast: 1.05,
      toe: -0.05,
      shoulder: 0.35,
      fade: 0.02,
      hues: [{ hue: HUE.red, width: 40, sat: 1.1 }],
      shadowTint: [-0.012, -0.012],
      highlightTint: [0.006, 0.006],
    },
    defaults: { grain: 0.35, grainSize: 1.3, halation: 0.7, vignette: 0.2 },
  },
  {
    id: 'cine-flat',
    name: 'Kinonegativ',
    description: 'Angelehnt an Fujifilm Eterna: flach, entsättigt und ruhig wie ein Kinobild.',
    category: 'kino',
    spec: {
      contrast: 0.9,
      toe: -0.05,
      shoulder: 0.3,
      fade: 0.05,
      saturation: 0.75,
      hues: [
        { hue: HUE.skin, width: 40, sat: 1.1 },
        { hue: HUE.blue, width: 50, shift: -8 },
        { hue: HUE.green, width: 45, shift: 8 },
      ],
      shadowTint: [-0.006, -0.006],
      highlightTint: [0.003, 0.008],
    },
    defaults: { grain: 0.15, grainSize: 1, halation: 0.1, vignette: 0.15 },
  },
  {
    id: 'bw-street',
    name: 'Straße SW 400',
    description: 'Angelehnt an Kodak Tri-X 400: kräftiger Kontrast und deutliches Korn.',
    category: 'schwarzweiss',
    spec: { bw: [0.24, 0.58, 0.18], contrast: 1.3, toe: 0.15, shoulder: 0.25, fade: 0.02 },
    defaults: { grain: 0.55, grainSize: 1.4, vignette: 0.2 },
  },
  {
    id: 'bw-soft',
    name: 'Weiches SW 400',
    description: 'Angelehnt an Ilford HP5 Plus: weichere Tonwerte und mittleres Korn.',
    category: 'schwarzweiss',
    spec: { bw: [0.25, 0.57, 0.18], contrast: 1.1, toe: -0.02, shoulder: 0.35, fade: 0.035 },
    defaults: { grain: 0.4, grainSize: 1.2, vignette: 0.15 },
  },
  {
    id: 'bw-fine',
    name: 'Feines SW 100',
    description: 'Angelehnt an Fujifilm Neopan Acros 100: feinkörnig, tiefe Schwärzen, glatte Mitteltöne.',
    category: 'schwarzweiss',
    spec: { bw: [0.27, 0.6, 0.13], contrast: 1.18, toe: 0.25, shoulder: 0.2 },
    defaults: { grain: 0.12, grainSize: 0.6, vignette: 0.12 },
  },
];

export const LOOKS: FilmLook[] = LOOK_SPECS.map(({ spec, ...look }) => ({
  ...look,
  buildLut: () => buildLut(spec, 33, look.name),
}));
