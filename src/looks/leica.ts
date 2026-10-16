// Leica Looks als eigene parametrische Nachempfindungen. Leica veröffentlicht keine Foto-LUTs: Die Parameter in
// leica-fit.ts sind an Leicas Beispielbilder abgestimmt (Core Looks: eine deckungsgleiche Aufnahme in allen Looks;
// Essential Looks: je 4–5 Bilder mit eingeblendetem „Standard“-Inset, siehe scripts/looks-leica-refs.mjs).
// „Leica Standard“ ist das unveränderte Foto. Die Leica-Regler (Kontrast, Lichter, Schatten, Sättigung −2…+2,
// Intensität) gibt es hier nicht; die Intensität entspricht der Stärke. Markennamen gehören ihren Inhabern.
import type { FilmLook } from '../types';
import { buildLut, type LookSpec } from './model.ts';
import { FIT } from './leica-fit.ts';

interface LeicaDef {
  id: string;
  name: string;
  description: string;
  monochrome?: boolean;
}

// Reihenfolge: Core Looks wie im Kameramenü, dann die Essential Looks (Farbe, danach getöntes Schwarzweiß).
const DEFS: LeicaDef[] = [
  { id: 'leica-standard', name: 'Leica Standard', description: 'Ausgewogen und vielseitig: realistische Farben, mäßiger Kontrast – das Foto bleibt, wie es ist.' },
  { id: 'leica-vivid', name: 'Leica Vivid', description: 'Kräftigere Farben, besonders Rot und Magenta, mit hellen Mitteltönen und dichteren Schatten.' },
  { id: 'leica-natural', name: 'Leica Natural', description: 'Gedämpfte Sättigung und weiche Übergänge bei mäßigem Kontrast.' },
  { id: 'leica-mono-natural', name: 'Leica Monochrom Natural', description: 'Natürliches, zurückhaltendes Schwarzweiß mit sanften Abstufungen.', monochrome: true },
  { id: 'leica-mono-hc', name: 'Leica Monochrom High Contrast', description: 'Schwarzweiß mit kräftiger S-Kurve: tiefere Schatten, hellere Lichter.', monochrome: true },
  { id: 'leica-classic', name: 'Leica Classic', description: 'Analog und filmisch: weiche Sättigung, warme, leicht ausgewaschene Farben und hellere Mitten.' },
  { id: 'leica-contemporary', name: 'Leica Contemporary', description: 'Modern mit hellen Schatten, natürlichen Farben und dezent rötlichem Stich – schmeichelt der Haut.' },
  { id: 'leica-eternal', name: 'Leica Eternal', description: 'Starker Kontrast und kräftige Farben mit leichtem Magenta-Stich.' },
  { id: 'leica-chrome', name: 'Leica Chrome', description: 'Gedämpfte Palette mit feinem Kontrast und angehobenen Schatten – klassischer Charme.' },
  { id: 'leica-silver', name: 'Leica Silver', description: 'Kühle, stählerne Farben, weicher Kontrast, klare Lichter und deutlich angehobene Schatten.' },
  { id: 'leica-bleach', name: 'Leica Bleach', description: 'Stark gedämpfte Sättigung mit kühlen Blautönen – zeitgemäß und stimmungsvoll.' },
  { id: 'leica-teal', name: 'Leica Teal', description: 'Kühler, filmischer Blaugrün-Ton bei gedämpften Farben.' },
  { id: 'leica-brass', name: 'Leica Brass', description: 'Warmes Licht der goldenen Stunde mit betonten Mitten und Lichtern.' },
  { id: 'leica-pure', name: 'Leica Pure', description: 'Natürlich und filmisch mit subtilem Kontrast und etwas dunkleren Mitten – eine ruhige Grundlage.' },
  { id: 'leica-cine', name: 'Leica Cine', description: 'Warmer Kinolook mit fein abgestimmter, zurückgenommener Palette, sanftem Kontrast und weichen Lichtern.' },
  { id: 'leica-selenium', name: 'Leica Selenium', description: 'Schwarzweiß mit kühlem, leicht violettem Ton und weichem Kontrast wie nach Selen-Tonung.', monochrome: true },
  { id: 'leica-sepia', name: 'Leica Sepia', description: 'Schwarzweiß in Braun- und Gelbtönen bis ins cremeweiße Papier – klassischer Vintage-Look.', monochrome: true },
  { id: 'leica-blue', name: 'Leica Blue', description: 'Schwarzweiß in den Blautönen eines Cyanotypie-Drucks.', monochrome: true },
];

export const LEICA_LOOKS: FilmLook[] = DEFS.map((d) => {
  const spec: LookSpec = FIT[d.id] ?? {};
  return { ...d, category: 'leica', defaults: {}, buildLut: () => buildLut(spec, 33, d.name) };
});
