// Fujifilm-Filmsimulationen als eigene parametrische Nachempfindungen, Reihenfolge wie im Kameramenü.
// Annahme: Das Eingangsfoto ist „Provia-artig“; jeder Look bildet „Provia → Simulation“ nach.
// Die Parameter in fujifilm-fit.ts sind an Messungen abgestimmt (scripts/looks-fit.mjs), die übrigen
// Looks sind nach Beschreibung und Kamerabildern eingestellt. Markennamen gehören ihren Inhabern.
// Importe mit .ts-Endung, damit scripts/looks-*.mjs die Datei direkt in Node laden können.
import type { FilmLook, LookParams } from '../types';
import { buildLut, type LookSpec, type Vec3 } from './model.ts';
import { FIT } from './fujifilm-fit.ts';
import { LEICA_LOOKS } from './leica.ts';
import { kodakLooks } from './kodak.ts';
import { RICOH_LOOKS } from './ricoh.ts';

interface LookDef {
  id: string;
  name: string;
  description: string;
  spec: LookSpec;
  monochrome?: boolean;
  officialKey?: string;
  defaults?: Partial<LookParams>;
}

// SW-Filter: Kanalgewichte in linearem Licht, gemessen an pixelgleichen Kamerabildern gegen das Provia-Bild
// (docs/kamera-looks-referenz.md, Abschnitt 1.5). Monochrom: Provia-Tonwerte auf dieser Helligkeit.
const MONO_W: Record<'base' | 'ye' | 'r' | 'g', Vec3> = {
  base: [0.19, 0.73, 0.08], ye: [0.35, 0.71, -0.05], r: [0.52, 0.65, -0.17], g: [0.09, 0.79, 0.12],
};
const ACROS_W: Record<'base' | 'ye' | 'r' | 'g', Vec3> = {
  base: [0.2, 0.69, 0.12], ye: [0.36, 0.67, -0.01], r: [0.54, 0.61, -0.13], g: [0.09, 0.79, 0.12],
};
// Acros selbst ist an Fujifilms LUT angepasst; die Filter wirken relativ dazu wie gemessen.
const ACROS = FIT.acros;
const acrosFilter = (f: 'ye' | 'r' | 'g'): LookSpec => ({
  ...ACROS,
  bw: ACROS.bw!.map((w, i) => w + ACROS_W[f][i] - ACROS_W.base[i]) as Vec3,
});
const mono = (f: keyof typeof MONO_W): LookSpec => ({ bw: MONO_W[f] });

const DEFS: LookDef[] = [
  { id: 'provia', name: 'Provia/Standard', description: 'Die neutrale Grundabstimmung: natürliche Farben, ausgewogener Kontrast – das Foto bleibt, wie es ist.', spec: {}, officialKey: 'PROVIA' },
  { id: 'velvia', name: 'Velvia/Vivid', description: 'Kräftige, leuchtende Farben und satter Kontrast für Landschaft und Natur.', spec: FIT.velvia, officialKey: 'VELVIA' },
  { id: 'astia', name: 'Astia/Soft', description: 'Weichere Kontraste und schmeichelnde Hauttöne bei trotzdem lebendigem Blau und Grün.', spec: FIT.astia, officialKey: 'ASTIA' },
  { id: 'classic-chrome', name: 'Classic Chrome', description: 'Gedämpfte Farben, kräftige Schatten und ein dokumentarischer, leicht nostalgischer Ton.', spec: FIT['classic-chrome'], officialKey: 'CLASSIC-CHROME' },
  { id: 'reala-ace', name: 'Reala Ace', description: 'Natürliche, treue Farben mit etwas mehr Kontrast – vielseitig wie ein Negativfilm.', spec: FIT['reala-ace'], officialKey: 'REALA-ACE' },
  { id: 'pro-neg-hi', name: 'Pro Neg. Hi', description: 'Porträtfarben wie Pro Neg. Std, aber mit mehr Kontrast und Brillanz.', spec: FIT['pro-neg-hi'] },
  { id: 'pro-neg-std', name: 'Pro Neg. Std', description: 'Weich und zurückhaltend, mit natürlichen Hauttönen – für Porträts im Studio.', spec: FIT['pro-neg-std'], officialKey: 'PRO-NEG-STD' },
  { id: 'classic-neg', name: 'Classic Neg.', description: 'Wie ein Farbnegativ aus der Drogerie: harte Schatten, Cyan-Grün und entsättigtes Rot.', spec: FIT['classic-neg'], officialKey: 'CLASSIC-NEG' },
  { id: 'nostalgic-neg', name: 'Nostalgic Neg.', description: 'Warme, bernsteinfarbene Lichter und weiche Schatten wie Abzüge aus den 1970ern.', spec: FIT['nostalgic-neg'] },
  { id: 'eterna', name: 'Eterna/Cinema', description: 'Flach und zurückhaltend gesättigt wie Kinofilm, mit viel Zeichnung in den Schatten.', spec: FIT.eterna, officialKey: 'ETERNA' },
  { id: 'eterna-bleach-bypass', name: 'Eterna Bleach Bypass', description: 'Stark entsättigt und kontrastreich wie die Bleichbad-Überbrückung im Kopierwerk.', spec: FIT['eterna-bleach-bypass'], officialKey: 'ETERNA-BB' },
  { id: 'acros', name: 'Acros', description: 'Schwarzweiß mit feinen Tonwerten, tiefen Schatten und plastischen Mitteltönen.', spec: ACROS, monochrome: true, officialKey: 'ACROS' },
  { id: 'acros-ye', name: 'Acros + Ye', description: 'Acros mit Gelbfilter, dem mildesten Kontrastfilter: etwas dunklerer Himmel, mehr Zeichnung in Wolken.', spec: acrosFilter('ye'), monochrome: true },
  { id: 'acros-r', name: 'Acros + R', description: 'Acros mit Rotfilter, dem stärksten Kontrastfilter: fast schwarzer Himmel, helle Haut und Ziegel.', spec: acrosFilter('r'), monochrome: true },
  { id: 'acros-g', name: 'Acros + G', description: 'Acros mit Grünfilter für Porträts: Rot und Lippen etwas dunkler, Haut kräftiger.', spec: acrosFilter('g'), monochrome: true },
  { id: 'monochrome', name: 'Monochrom', description: 'Klassisches Schwarzweiß mit den neutralen Tonwerten von Provia.', spec: mono('base'), monochrome: true },
  { id: 'monochrome-ye', name: 'Monochrom + Ye', description: 'Monochrom mit Gelbfilter, dem mildesten Kontrastfilter: etwas dunklerer Himmel, mehr Zeichnung in Wolken.', spec: mono('ye'), monochrome: true },
  { id: 'monochrome-r', name: 'Monochrom + R', description: 'Monochrom mit Rotfilter, dem stärksten Kontrastfilter: fast schwarzer Himmel, helle Haut und Ziegel.', spec: mono('r'), monochrome: true },
  { id: 'monochrome-g', name: 'Monochrom + G', description: 'Monochrom mit Grünfilter für Porträts: Rot und Lippen etwas dunkler, Haut kräftiger.', spec: mono('g'), monochrome: true },
  { id: 'sepia', name: 'Sepia', description: 'Schwarzweiß in warmem Braun wie ein alter Abzug.', spec: { ...mono('base'), tint: [0.03, 0.042] }, monochrome: true },
];

const FUJI_LOOKS: FilmLook[] = DEFS.map(({ spec, defaults, ...look }) => ({
  ...look,
  category: 'fujifilm',
  defaults: defaults ?? {},
  buildLut: () => buildLut(spec, 33, look.name),
}));

/** Alle Looks in Anzeige-Reihenfolge: Fujifilm, Leica, Kodak (Rezepte auf Fujifilm-Basis), Ricoh. */
export const LOOKS: FilmLook[] = [...FUJI_LOOKS, ...LEICA_LOOKS, ...kodakLooks(FUJI_LOOKS), ...RICOH_LOOKS];
