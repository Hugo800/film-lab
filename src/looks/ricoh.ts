// Ricoh-GR-Effekte (Image Control der GR IV) als eigene parametrische Nachempfindungen. Ricoh veröffentlicht keine LUTs:
// Die Parameter in ricoh-fit.ts sind an Vergleichsserien abgestimmt (dieselbe Szene in „Standard“ und im Effekt, dazu
// eine Farbtafel in allen Effekten; siehe scripts/looks-ricoh-refs.mjs und docs/kamera-looks-referenz.md, Abschnitt 3a).
// „Ricoh Standard“ ist das unveränderte Foto. Was keine LUT ist, übernehmen die Regler: Retro dunkelt die Ränder ab
// (Vignette), Hi-Contrast B&W bringt kräftiges Korn mit. HDR Tone fehlt (wirkt lokal). Markennamen gehören ihren Inhabern.
import type { FilmLook, LookParams } from '../types';
import { buildLut, type LookSpec } from './model.ts';
import { FIT } from './ricoh-fit.ts';

interface RicohDef {
  id: string;
  name: string;
  description: string;
  monochrome?: boolean;
  defaults?: Partial<LookParams>;
}

// Reihenfolge wie im Kameramenü der GR IV: Farbe, dann Schwarzweiß.
const DEFS: RicohDef[] = [
  { id: 'ricoh-standard', name: 'Ricoh Standard', description: 'Ricohs neutrale Grundabstimmung – das Foto bleibt, wie es ist.' },
  { id: 'ricoh-vivid', name: 'Ricoh Vivid', description: 'Etwas kräftigere Farben, vor allem in Blau, bei sonst unverändertem Bild.' },
  { id: 'ricoh-positive-film', name: 'Ricoh Positive Film', description: 'Wie Diafilm: dichtes Blau, kräftiges Rot, etwas dunklere Mitten und satter Kontrast.' },
  { id: 'ricoh-negative-film', name: 'Ricoh Negative Film', description: 'Wie Farbnegativ: hellere Mitten, warme, etwas zurückgenommene Farben – Rot kippt nach Orange.' },
  { id: 'ricoh-retro', name: 'Ricoh Retro', description: 'Verblasste, kühl-violette Farben mit gedämpftem Rot und dunklen Rändern wie ein alter Abzug.', defaults: { vignette: 1 } },
  { id: 'ricoh-bleach-bypass', name: 'Ricoh Bleach Bypass', description: 'Hell und stark entsättigt, mit kühlem Blaugrün in Himmel und Schatten.' },
  { id: 'ricoh-cross-process', name: 'Ricoh Cross Process', description: 'Crossentwicklung: Blau kippt nach Türkis, helle Töne werden gelblich, kräftiger Kontrast.' },
  { id: 'ricoh-cinema-yellow', name: 'Ricoh Cinema Yellow', description: 'Kinolook mit gelblichem Stich, dunkleren Mitten und zurückgenommenen Farben.' },
  { id: 'ricoh-cinema-green', name: 'Ricoh Cinema Green', description: 'Kinolook mit kühl-grünem Stich und gedämpften Farben.' },
  { id: 'ricoh-monotone', name: 'Ricoh Monotone', description: 'Schlichtes Schwarzweiß mit neutralen Tonwerten.', monochrome: true },
  { id: 'ricoh-soft-monotone', name: 'Ricoh Soft Monotone', description: 'Weiches Schwarzweiß: hellere Schatten, gedämpfte Lichter.', monochrome: true },
  { id: 'ricoh-hard-monotone', name: 'Ricoh Hard Monotone', description: 'Hartes Schwarzweiß wie mit Rotfilter: blauer Himmel wird fast schwarz, kräftiger Kontrast.', monochrome: true },
  { id: 'ricoh-hi-contrast-bw', name: 'Ricoh Hi-Contrast B&W', description: 'Grafisches Schwarzweiß mit sehr hartem Kontrast, hellen Lichtern, tiefen Schatten und kräftigem Korn.', monochrome: true, defaults: { grainEffect: 2, grainSize: 'klein' } },
];

export const RICOH_LOOKS: FilmLook[] = DEFS.map(({ defaults, ...d }) => {
  const spec: LookSpec = FIT[d.id] ?? {};
  return { ...d, category: 'ricoh', defaults: defaults ?? {}, buildLut: () => buildLut(spec, 33, d.name) };
});
