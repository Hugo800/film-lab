// Aufmachung der Filmschachteln im Look-Rad der Startseite: je Look Farben, Filmtyp, ISO und Aufschrift.
// Eigene Gestaltung, nur an Farbe und Stil der Marken angelehnt – keine Logos, keine Nachbauten echter Packungen.
import type { LookEntry } from '../lookRegistry';

/** Gestaltungsfamilie: bestimmt Muster und Aufbau der Schachtel (siehe .schachtel in index.css). */
export type Familie = 'kodak' | 'fuji' | 'leica' | 'ricoh' | 'eigen';
export type FilmTyp = 'Farbnegativ' | 'Farbdia' | 'Schwarzweiß' | 'Kino' | 'Farbe' | 'Look';

export interface Filmschachtel {
  familie: Familie;
  /** Aufschrift, groß. */
  name: string;
  /** Kleine Zeile unter dem Namen (Filter, Variante). */
  zusatz?: string;
  typ: FilmTyp;
  /** Empfindlichkeit, wo sinnvoll (bei Kinofilmen mit Lichtart, z. B. „500T“). */
  iso?: string;
  /** Großes Kürzel in Akzentfarbe unten rechts (Variante, Filter), damit keine Schachtel dort leer bleibt. */
  zeichen?: string;
  /** Klein in der Ecke: „135-36“ (Kleinbild, 36 Aufnahmen), „Look“ (Leica) bzw. „GR“ (Ricoh). */
  kennung: string;
  /** Karton: Verlauf von `grund` nach `grund2`. */
  grund: string;
  grund2: string;
  /** Streifen, Kanten, Band. */
  akzent: string;
  schrift: string;
}

type Teil = Omit<Filmschachtel, 'familie' | 'kennung'>;

const KB = '135-36';
const kodak = (t: Teil): Filmschachtel => ({ familie: 'kodak', kennung: KB, ...t });
const fuji = (t: Teil): Filmschachtel => ({ familie: 'fuji', kennung: KB, ...t });

// Kodak: warmes Gelb/Gold mit rotem Akzent; Portra cremeweiß, Kinofilme dunkel, Schwarzweiß gelb-schwarz.
const DUNKEL = '#2a1a08';
const CREME = '#f3e7cf';
const KODAK: Record<string, Filmschachtel> = {
  'kodak-portra-160': kodak({ name: 'Portra', iso: '160', typ: 'Farbnegativ', grund: '#f6efdf', grund2: '#e6d4a6', akzent: '#c99a3a', schrift: DUNKEL }),
  'kodak-portra-400': kodak({ name: 'Portra', iso: '400', typ: 'Farbnegativ', grund: '#f4e9cf', grund2: '#dfc58c', akzent: '#c98a1e', schrift: DUNKEL }),
  'kodak-portra-800': kodak({ name: 'Portra', iso: '800', typ: 'Farbnegativ', grund: '#f1e2bf', grund2: '#d6b16c', akzent: '#a8641a', schrift: DUNKEL }),
  'kodak-ektar-100': kodak({ name: 'Ektar', iso: '100', typ: 'Farbnegativ', grund: '#f7c623', grund2: '#eaa10e', akzent: '#c5232b', schrift: DUNKEL }),
  'kodak-gold-200': kodak({ name: 'Gold', iso: '200', typ: 'Farbnegativ', grund: '#f8b91c', grund2: '#e88a0c', akzent: '#b51e26', schrift: DUNKEL }),
  'kodak-ultramax-400': kodak({ name: 'UltraMax', iso: '400', typ: 'Farbnegativ', grund: '#f5b01b', grund2: '#de7311', akzent: '#9f141c', schrift: DUNKEL }),
  'kodak-colorplus-200': kodak({ name: 'ColorPlus', iso: '200', typ: 'Farbnegativ', grund: '#f3c535', grund2: '#e5a419', akzent: '#d0432b', schrift: DUNKEL }),
  'kodak-kodacolor-vr-200': kodak({ name: 'Kodacolor VR', iso: '200', typ: 'Farbnegativ', grund: '#f0a71e', grund2: '#d56d19', akzent: '#6f1b12', schrift: DUNKEL }),
  'kodak-kodachrome-64': kodak({ name: 'Kodachrome', iso: '64', typ: 'Farbdia', grund: '#f5c72c', grund2: '#e7a314', akzent: '#c3212b', schrift: DUNKEL }),
  'kodak-kodachrome-25': kodak({ name: 'Kodachrome', iso: '25', typ: 'Farbdia', grund: '#f3d25a', grund2: '#e1ad2b', akzent: '#9b1a22', schrift: DUNKEL }),
  'kodak-ektachrome-e100': kodak({ name: 'Ektachrome', iso: '100', typ: 'Farbdia', grund: '#f6d672', grund2: '#e5b13b', akzent: '#b3202a', schrift: DUNKEL }),
  'kodak-vision3-250d': kodak({ name: 'Vision3', iso: '250D', zusatz: 'Tageslicht', typ: 'Kino', grund: '#24211e', grund2: '#100e0c', akzent: '#d42b2b', schrift: CREME }),
  'kodak-vision3-500t': kodak({ name: 'Vision3', iso: '500T', zusatz: 'Kunstlicht', typ: 'Kino', grund: '#1e1e24', grund2: '#0b0b0f', akzent: '#c8202a', schrift: CREME }),
  'kodak-cinestill-800t': kodak({ name: 'CineStill', iso: '800T', zusatz: 'Kunstlicht', typ: 'Kino', grund: '#17181d', grund2: '#07080a', akzent: '#e33b30', schrift: '#f5ede2' }),
  'kodak-tri-x-400': kodak({ name: 'Tri-X', iso: '400', typ: 'Schwarzweiß', grund: '#f4c534', grund2: '#e2a619', akzent: '#121212', schrift: '#121212' }),
  'kodak-t-max-400': kodak({ name: 'T-Max', iso: '400', typ: 'Schwarzweiß', grund: '#1b1b1b', grund2: '#0a0a0a', akzent: '#f2c22a', schrift: '#f2c22a' }),
  'kodak-t-max-100': kodak({ name: 'T-Max', iso: '100', typ: 'Schwarzweiß', grund: '#202020', grund2: '#0c0c0c', akzent: '#e9b824', schrift: '#f0cf5c' }),
};

// Fujifilm: Grün-, Blau- und Violetttöne je Film; Simulationen ohne echten Film als Schachteln derselben Familie.
const HELL = '#f5f8f7';
const FILTER = { ye: '#e9c43a', r: '#d4473c', g: '#4fb05c' } as const;
const FILTERNAME = { ye: 'Gelbfilter', r: 'Rotfilter', g: 'Grünfilter' } as const;
const FILTERZEICHEN = { ye: 'Ye', r: 'R', g: 'G' } as const;
const ACROS = { name: 'Acros', iso: '100', typ: 'Schwarzweiß', grund: '#13201a', grund2: '#070d0a', schrift: '#e6efe8' } as const;
const MONO = { name: 'Monochrom', typ: 'Schwarzweiß', grund: '#33393a', grund2: '#1b1f20', schrift: '#eef1f0' } as const;
const FUJI: Record<string, Filmschachtel> = {
  provia: fuji({ name: 'Provia', iso: '100', typ: 'Farbdia', grund: '#2257b5', grund2: '#123272', akzent: '#9cc8ff', schrift: HELL }),
  velvia: fuji({ name: 'Velvia', iso: '50', typ: 'Farbdia', grund: '#5f2b93', grund2: '#36145a', akzent: '#dcb0ff', schrift: HELL }),
  astia: fuji({ name: 'Astia', iso: '100', typ: 'Farbdia', grund: '#eef5f5', grund2: '#c9dfe2', akzent: '#3a8a9c', schrift: '#12363e' }),
  'classic-chrome': fuji({ name: 'Classic Chrome', zeichen: 'CC', typ: 'Farbdia', grund: '#59625f', grund2: '#353c3b', akzent: '#d2bd8e', schrift: HELL }),
  'reala-ace': fuji({ name: 'Reala Ace', zeichen: 'RA', typ: 'Farbnegativ', grund: '#1f7462', grund2: '#114638', akzent: '#bfe9d7', schrift: HELL }),
  'pro-neg-hi': fuji({ name: 'Pro Neg.', zeichen: 'Hi', typ: 'Farbnegativ', grund: '#2d6e88', grund2: '#18465a', akzent: '#a3dcec', schrift: HELL }),
  'pro-neg-std': fuji({ name: 'Pro Neg.', zeichen: 'Std', typ: 'Farbnegativ', grund: '#6d919b', grund2: '#465f68', akzent: '#dcf0f4', schrift: HELL }),
  'classic-neg': fuji({ name: 'Classic Neg.', zeichen: 'CN', typ: 'Farbnegativ', grund: '#2f8040', grund2: '#1a5226', akzent: '#d8f1a2', schrift: HELL }),
  'nostalgic-neg': fuji({ name: 'Nostalgic Neg.', zeichen: 'NN', typ: 'Farbnegativ', grund: '#8c6c2c', grund2: '#5a4218', akzent: '#f3c97f', schrift: HELL }),
  eterna: fuji({ name: 'Eterna', zeichen: 'ET', typ: 'Kino', grund: '#1e3d43', grund2: '#0e2226', akzent: '#7ccbc5', schrift: HELL }),
  'eterna-bleach-bypass': fuji({ name: 'Bleach Bypass', zusatz: 'Eterna', zeichen: 'BB', typ: 'Kino', grund: '#41484c', grund2: '#22272a', akzent: '#cfd8dc', schrift: HELL }),
  acros: fuji({ ...ACROS, akzent: '#43b26e' }),
  'acros-ye': fuji({ ...ACROS, zusatz: FILTERNAME.ye, zeichen: FILTERZEICHEN.ye, akzent: FILTER.ye }),
  'acros-r': fuji({ ...ACROS, zusatz: FILTERNAME.r, zeichen: FILTERZEICHEN.r, akzent: FILTER.r }),
  'acros-g': fuji({ ...ACROS, zusatz: FILTERNAME.g, zeichen: FILTERZEICHEN.g, akzent: FILTER.g }),
  monochrome: fuji({ ...MONO, zeichen: 'SW', akzent: '#aebdb4' }),
  'monochrome-ye': fuji({ ...MONO, zusatz: FILTERNAME.ye, zeichen: FILTERZEICHEN.ye, akzent: FILTER.ye }),
  'monochrome-r': fuji({ ...MONO, zusatz: FILTERNAME.r, zeichen: FILTERZEICHEN.r, akzent: FILTER.r }),
  'monochrome-g': fuji({ ...MONO, zusatz: FILTERNAME.g, zeichen: FILTERZEICHEN.g, akzent: FILTER.g }),
  sepia: fuji({ name: 'Sepia', zusatz: 'getont', zeichen: 'Se', typ: 'Schwarzweiß', grund: '#6e4c2f', grund2: '#45301c', akzent: '#e8c79c', schrift: '#f7ecdf' }),
};

// Leica: Farb-Looks schwarz, Schwarzweiß silbern; sehr reduziert, je Look eine schmale Farbkante und ein Farbstrich.
const leica = (name: string, akzent: string, mono = false, zusatz?: string): Filmschachtel =>
  mono
    ? { familie: 'leica', kennung: 'Look', name, zusatz, typ: 'Schwarzweiß', grund: '#c6c9cc', grund2: '#8b8f94', akzent, schrift: '#141516' }
    : { familie: 'leica', kennung: 'Look', name, zusatz, typ: 'Farbe', grund: '#2a2a2a', grund2: '#121212', akzent, schrift: '#e6e6e3' };
const LEICA: Record<string, Filmschachtel> = {
  'leica-standard': leica('Standard', '#b9bdc1'),
  'leica-vivid': leica('Vivid', '#cf6480'),
  'leica-natural': leica('Natural', '#a9b59b'),
  'leica-mono-natural': leica('Monochrom', '#4a4d50', true, 'Natural'),
  'leica-mono-hc': leica('Monochrom', '#141516', true, 'High Contrast'),
  'leica-classic': leica('Classic', '#c9a77a'),
  // Trennstelle (weiches Trennzeichen): zweizeilig in lesbarer Größe statt einzeilig winzig.
  'leica-contemporary': leica('Contem\u00ADporary', '#d4a49b'),
  'leica-eternal': leica('Eternal', '#b56c91'),
  'leica-chrome': leica('Chrome', '#a8b1b5'),
  'leica-silver': leica('Silver', '#d2d9df'),
  'leica-bleach': leica('Bleach', '#8fa5b9'),
  'leica-teal': leica('Teal', '#5eaaa6'),
  'leica-brass': leica('Brass', '#caa24b'),
  'leica-pure': leica('Pure', '#bebeb9'),
  'leica-cine': leica('Cine', '#c8935f'),
  'leica-selenium': leica('Selenium', '#7d6fa3', true),
  'leica-sepia': leica('Sepia', '#8a5a2c', true),
  'leica-blue': leica('Blue', '#3f6fb4', true),
};

// Ricoh GR: graphitgrau und schlicht wie die Kamera; je Effekt eine feine Farblinie oben, Schwarzweiß etwas heller.
const ricoh = (name: string, akzent: string, mono = false, zusatz?: string): Filmschachtel => ({
  familie: 'ricoh', kennung: 'GR', name, zusatz, typ: mono ? 'Schwarzweiß' : 'Farbe',
  grund: mono ? '#4a4c4f' : '#2b2c2e', grund2: mono ? '#26282a' : '#131415', akzent, schrift: '#ecece8',
});
const RICOH: Record<string, Filmschachtel> = {
  'ricoh-standard': ricoh('Standard', '#b8bcc0'),
  'ricoh-vivid': ricoh('Vivid', '#3f8fe0'),
  'ricoh-positive-film': ricoh('Positive', '#d8452f', false, 'Film'),
  'ricoh-negative-film': ricoh('Negative', '#e59a3a', false, 'Film'),
  'ricoh-retro': ricoh('Retro', '#9c86b8'),
  'ricoh-bleach-bypass': ricoh('Bleach Bypass', '#a9d3cf'),
  'ricoh-cross-process': ricoh('Cross Process', '#22b3b8'),
  'ricoh-cinema-yellow': ricoh('Cinema', '#d9b84a', false, 'Yellow'),
  'ricoh-cinema-green': ricoh('Cinema', '#6fae84', false, 'Green'),
  'ricoh-monotone': ricoh('Monotone', '#9a9da1', true),
  'ricoh-soft-monotone': ricoh('Monotone', '#d6d8da', true, 'Soft'),
  'ricoh-hard-monotone': ricoh('Monotone', '#111213', true, 'Hard'),
  'ricoh-hi-contrast-bw': ricoh('Hi-Contrast', '#f2f2f0', true, 'B&W'),
};

export const FILMSCHACHTELN: Readonly<Record<string, Filmschachtel>> = { ...FUJI, ...LEICA, ...KODAK, ...RICOH };

/** Schachtel zu einem Look; unbekannte und eigene Looks bekommen eine neutrale Schachtel mit ihrem Namen. */
export function schachtelFuer(entry: Pick<LookEntry, 'id' | 'name' | 'monochrome'>): Filmschachtel {
  return (
    FILMSCHACHTELN[entry.id] ?? {
      familie: 'eigen',
      name: entry.name,
      typ: entry.monochrome ? 'Schwarzweiß' : 'Look',
      kennung: 'LUT',
      grund: '#3a3a3f',
      grund2: '#1e1e22',
      akzent: '#e6b450',
      schrift: '#ecebe8',
    }
  );
}
