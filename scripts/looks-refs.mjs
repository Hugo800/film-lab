// Lokale Messreferenzen für die Fujifilm-Looks (testbilder/ ist gitignoriert; nie committen oder einbetten).
// Genutzt von looks-fit.mjs (Anpassung) und looks-fuji-sheet.mjs (Kontaktbögen).
export const T = 'testbilder';
export const R = `${T}/referenz`;
export const DER = `${T}/luts/abgeleitet-lokal`;
export const ABPY = `${T}/luts/abpy-fujifilm-camera-profiles/provia-conversion`;

export const pair = (dir, a, b) => [`${R}/${dir}/${a}`, `${R}/${dir}/${b}`];
export const pel = (sim) => pair(`peltier/paare/${sim}`, 'provia.png', 'sim.png');
export const kw = (sim) => pair('keithwee-xh1', 'provia.jpg', `${sim}.jpg`);
export const ras = (sim) => pair('peltier/paare/raster-6-simulationen', 'provia.png', `${sim}.png`);
export const ag = (scene, sim) => pair('alikgriffin', `AGriffin_GFX100II_${scene}_Provia_${scene === '45' ? 'Kalina' : 'Monkey'}_RAW-L.jpg`, `AGriffin_GFX100II_${scene}_${sim}_${scene === '45' ? 'Kalina' : 'Monkey'}_RAW-L.jpg`);

// cube: Referenzwürfel für die Anpassung; check: weitere Würfel nur zum Vergleich; pairs: Bildpaare [Provia, Simulation].
// fitPairs: Paare gehen in die Anpassung ein (nur wo es keinen Würfel gibt); prior: Ausgangs-Look, an den die Farbe gebunden bleibt.
export const TARGETS = {
  velvia: { cube: `${DER}/provia-zu-Velvia_srgb_33.cube`, pairs: [pel('velvia'), ras('velvia')] },
  astia: { cube: `${DER}/provia-zu-ASTIA_srgb_33.cube`, pairs: [pel('astia'), kw('astia')] },
  'classic-chrome': { cube: `${DER}/provia-zu-CLASSIC-CHROME_srgb_33.cube`, pairs: [pel('classic-chrome'), kw('classic-chrome'), ag('80', 'ClassicChrome'), ras('classic-chrome')] },
  'reala-ace': { cube: `${DER}/provia-zu-REALA-ACE_srgb_33.cube`, pairs: [ag('45', 'RealaAce'), ag('80', 'RealaAce'), ras('reala-ace')] },
  'pro-neg-std': { cube: `${DER}/provia-zu-PRO-Neg.Std_srgb_33.cube`, pairs: [pel('pro-neg-std')] },
  // ohne Würfel: an Bildpaare angepasst, Farbe an Pro Neg. Std gebunden (muss vorher stehen)
  'pro-neg-hi': { fitPairs: true, prior: 'pro-neg-std', pairs: [pel('pro-neg-hi'), kw('pro-neg-hi')] },
  'classic-neg': {
    cube: `${DER}/provia-zu-CLASSIC-Neg._srgb_33.cube`,
    check: [`${ABPY}/Provia to Classic Neg sRGB.cube`],
    pairs: [pel('classic-neg'), pair('keithwee-xpro3', 'dscf0283-provia.jpg', 'dscf0283-classic-neg.jpg'), pair('keithwee-xpro3', 'dscf0294-provia.jpg', 'dscf0294-classic-neg.jpg'), ras('classic-neg')],
  },
  // ohne Würfel (abpys Würfel steht unter CC-BY-NC-SA): an Bildpaare angepasst, Farbe an Classic Neg. gebunden
  'nostalgic-neg': { fitPairs: true, prior: 'classic-neg', pairs: [ag('80', 'NostalgicNeg'), ras('nostalgic-neg')] },
  eterna: { cube: `${DER}/provia-zu-ETERNA_srgb_33.cube`, pairs: [pel('eterna'), kw('eterna')] },
  'eterna-bleach-bypass': { cube: `${DER}/provia-zu-ETERNA-BB_srgb_33.cube`, check: [`${ABPY}/Provia to Bleach Bypass sRGB.cube`], pairs: [pel('eterna-bleach-bypass')] },
  acros: { mono: true, cube: `${DER}/provia-zu-ACROS_srgb_33.cube` },
};

// Kiechle (X-T30, Capture One), eine Aufnahme in allen Simulationen. Ye und G sind auf der Quellseite vertauscht
// beschriftet; hier die gemessene Zuordnung (docs/kamera-looks-referenz.md, 1.5). Nur zum Vergleich, nicht angepasst.
const kie = (n) => pair('kiechle', 'filmsim01.jpg', `filmsim${String(n).padStart(2, '0')}.jpg`);
export const SW_PAIRS = {
  acros: [kie(8)], 'acros-g': [kie(9)], 'acros-r': [kie(10)], 'acros-ye': [kie(11)],
  monochrome: [kie(12)], 'monochrome-g': [kie(13)], 'monochrome-r': [kie(14)], 'monochrome-ye': [kie(15)], sepia: [kie(16)],
};

// Leica (looks-fit.mjs --leica): Quelle = Core-ID oder Name der Essential-Serie in testbilder/referenz/leica-offiziell/
// (siehe looks-leica-refs.mjs). Keine Würfel; Vorwissen = neutraler Look, damit Farben außerhalb der Szenen ruhig bleiben.
const leica = (src, mono) => ({ leica: src, prior: 'neutral', ...(mono ? { mono } : {}) });
export const LEICA_TARGETS = {
  'leica-vivid': leica('vivid'), 'leica-natural': leica('natural'),
  'leica-mono-natural': leica('mono-natural', true), 'leica-mono-hc': leica('mono-hc', true),
  'leica-classic': leica('Classic'), 'leica-contemporary': leica('Contemporary'), 'leica-eternal': leica('Eternal'),
  'leica-chrome': leica('Chrome'), 'leica-silver': leica('Silver'), 'leica-bleach': leica('Bleach'), 'leica-teal': leica('Teal'),
  'leica-brass': leica('Brass'), 'leica-pure': leica('Pure'), 'leica-cine': leica('Cine'),
  'leica-selenium': leica('Selenium', 'tint'), 'leica-sepia': leica('Sepia', 'tint'), 'leica-blue': leica('Blue', 'tint'),
};

// Ricoh GR (looks-fit.mjs --ricoh): Quelle = Effektname der Serien in testbilder/referenz/ricoh/ (siehe looks-ricoh-refs.mjs).
// Vorwissen = neutraler Look wie bei Leica; die Serien zeigen nur wenige Farben (Himmel, Meer, Beton, Fels, rote Autos).
const ricoh = (src, mono) => ({ ricoh: src, prior: 'neutral', ...(mono ? { mono } : {}) });
export const RICOH_TARGETS = {
  'ricoh-vivid': ricoh('vivid'), 'ricoh-positive-film': ricoh('positive-film'), 'ricoh-negative-film': ricoh('negative-film'),
  'ricoh-retro': ricoh('retro'), 'ricoh-bleach-bypass': ricoh('bleach-bypass'), 'ricoh-cross-process': ricoh('cross-process'),
  'ricoh-cinema-yellow': ricoh('cinema-yellow'), 'ricoh-cinema-green': ricoh('cinema-green'),
  'ricoh-monotone': ricoh('monotone', true), 'ricoh-soft-monotone': ricoh('soft-monotone', true),
  'ricoh-hard-monotone': ricoh('hard-monotone', true), 'ricoh-hi-contrast-bw': ricoh('hi-contrast-bw', true),
};
