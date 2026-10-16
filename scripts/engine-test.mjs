// Browser-Prüfung der Engine: npm run test:engine [-- schritt …]
// Startet den Test-Dev-Server selbst (Port TEST_PORT, Vorgabe 5190).
// Schritte: identity seams compare timing abort jpeg thumbs loss mobile shots grain cc strips (ohne Angabe: alle).
// Vergleichsbilder je Effekt (strips, grain, cc) nach test-output/engine-v2/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const server = await startDevServer();
const BASE = server.url;
const OUT = 'test-output/engine';
mkdirSync(OUT, { recursive: true });
const OUT2 = 'test-output/engine-v2';
mkdirSync(OUT2, { recursive: true });

// Alle Effekte gleichzeitig (für Nähte, Vorschau ≈ Export, Laufzeit).
const ALL = {
  exposure: 0.3, wbKelvin: 6200, wbShiftR: 2, wbShiftB: -3, dynamicRange: 400, highlightTone: 1.5, shadowTone: -1,
  color: 2, sharpness: 3, clarity: 4, grainEffect: 2, grainSize: 'klein', colorChrome: 2, colorChromeBlue: 2,
  monoWarmCool: 4, monoMagentaGreen: -2, halation: 0.7, vignette: 0.5, leak: 0.7, leakSeed: 3,
};
const steps = process.argv.slice(2);
const want = (s) => steps.length === 0 || steps.includes(s);
const results = {};
let failed = false;
const expect = (ok, msg) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FEHLER'} ${msg}`);
};
const save = (name, b64, dir = OUT) => writeFileSync(`${dir}/${name}.png`, Buffer.from(b64, 'base64'));

const { browser, page } = await launch({ viewport: { width: 1280, height: 800 } });
try {
  await page.goto(`${BASE}/scripts/harness/engine-test.html`);
  await page.waitForFunction('window.ready === true', { timeout: 60_000 });
  const T = (fn, ...args) => page.evaluate((fn, args) => window.T[fn](...args), fn, args);
  console.log('GPU', await T('gpu'), 'Looks', await T('looks'));
  const looks = await T('looks');
  const LOOK = looks[0] ?? null;

  if (want('identity')) {
    // sRGB-Quelle (Rohwerte als sRGB ausgegeben): bitgenau.
    for (const name of ['DSC03427.JPEG', 'DSC04866.JPEG']) {
      const r = await T('identity', name, 2048, 'srgb');
      results[`identity srgb ${name}`] = r;
      expect(r.max === 0, `a) Identität sRGB ${name} ${r.w}×${r.h}: max ${r.max}, Mittel ${r.mean.toFixed(4)}, gespiegelt wäre Mittel ${r.vsFlipped.toFixed(1)} (${(r.ms / 1000).toFixed(1)} s)`);
    }
    // Display-P3-Quelle: gegen die Umrechnung des Browsers (Canvas-Dekodierung nach sRGB).
    for (const name of ['DSC03427.JPEG', 'DSC04866.JPEG', 'DSC01603.JPEG']) {
      const r = await T('identity', name, 2048, 'display-p3');
      results[`identity p3 ${name}`] = r;
      expect(r.mean <= 1.5 && r.max <= 8 && r.mean < r.rawVsRef / 10, `a) P3 → sRGB ${name} ${r.w}×${r.h}: Mittel ${r.mean.toFixed(3)}, max ${r.max}, >2: ${(r.over2 / (r.w * r.h * 3) * 100).toFixed(3)} %; ohne Umrechnung wäre Mittel ${r.rawVsRef.toFixed(2)} (${(r.ms / 1000).toFixed(1)} s)`);
    }
  }

  if (want('identity')) {
    const r = await T('identityRaw', 'DSC03427.JPEG');
    expect(r.max === 0 && r.smallVsBitmap === 0, `a) Identität RGBA-Quelle (RAW-Pfad) ${r.w}×${r.h}: max ${r.max}; verkleinert vs. Bitmap-Quelle max ${r.smallVsBitmap}`);
  }

  if (want('seams')) {
    const r = await T('seams', 'DSC01603.JPEG', ALL, LOOK);
    results.seams = r;
    expect(r.max <= 1, `b) Kacheln 512 vs. 2048 (alle Effekte, LUT ${LOOK}): max ${r.max}, Mittel ${r.mean.toFixed(5)}`);
  }

  if (want('compare')) {
    for (const [name, params] of [
      ['DSC01603.JPEG', ALL],
      ['DSC03427.JPEG', ALL],
      ['DSC03427.JPEG', { ...ALL, grainEffect: 0 }],
    ]) {
      const r = await T('previewVsExport', name, params, LOOK);
      save(`compare-${name}-preview`, r.png.preview);
      save(`compare-${name}-export-down`, r.png.down);
      delete r.png;
      results[`compare ${name}`] = r;
      expect(r.vsDownscaledFull.mean < 3, `c) Vorschau vs. verkleinerter Vollexport ${name}${params.grainEffect ? '' : ' (ohne Korn)'} ${r.rect[2]}×${r.rect[3]}: Mittel ${r.vsDownscaledFull.mean.toFixed(2)}, max ${r.vsDownscaledFull.max}; vs. Export maxEdge: Mittel ${r.vsSmall?.mean.toFixed(2)}; Rauschen σ Vorschau ${r.noise.preview.toFixed(2)} / Vollexport verkleinert ${r.noise.downFull.toFixed(2)}`);
    }
  }

  if (want('timing')) {
    const r = await T('timing', 'DSC01603.JPEG', ALL, LOOK);
    results.timing = r;
    expect(r.w === 6000 && r.h === 4000, `d) Export 24 MP alle Effekte: ${(r.ms / 1000).toFixed(1)} s, Fortschritt ${r.steps.join(' ')}`);
  }

  if (want('abort')) {
    const r = await T('abort', 'DSC01603.JPEG');
    expect(r === 'AbortError', `Abbruch per AbortSignal: ${r}`);
  }

  if (want('jpeg')) {
    const r = await T('jpeg', 'DSC03427.JPEG', ALL, LOOK);
    results.jpeg = r;
    if (r.error) console.log(`HINWEIS exportJpeg: ${r.error}`);
    else expect(r.w === 3670 && r.h === 5505 && r.segs.some((x) => x.startsWith('e1:Exif')) && !r.segs.some((x) => x.startsWith('e2:')) && r.transferred,
      `exportJpeg mit io.loadFile: ${r.w}×${r.h}, ${(r.bytes / 1e6).toFixed(2)} MB, ${(r.ms / 1000).toFixed(1)} s, Quelle ${r.colorSpace}, Segmente ${r.segs.join(' ')} (ohne ICC), RGBA-Puffer verschoben: ${r.transferred}`);
  }

  if (want('thumbs')) {
    const r = await T('thumbs', 'DSC03982.JPEG', looks.length ? looks.slice(0, 8) : [null, 'identity']);
    save('thumbs', r.png);
    expect(r.ms < 2000, `Look-Kacheln: ${r.ms.toFixed(0)} ms je Kachel`);
  }

  if (want('loss')) {
    const r = await T('contextLoss', 'DSC04866.JPEG', ALL);
    expect(r.max <= 1, `Kontextverlust + Wiederherstellung: Vorschau vorher/nachher max ${r.max}, Kachel ${r.thumb}`);
    expect((await T('dispose')) === 'ok', 'dispose + neue Engine auf demselben Canvas');
  }

  if (want('mobile')) {
    // iPhone-artig: 393×852 CSS-Pixel, DPR 3 → Puffer auf 4 MP begrenzt.
    const m = await launch({ viewport: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true } });
    try {
      await m.page.goto(`${BASE}/scripts/harness/engine-test.html`);
      await m.page.waitForFunction('window.ready === true', { timeout: 60_000 });
      const r = await m.page.evaluate((p, l) => window.T.show('DSC03982.JPEG', p, l, {}), ALL, LOOK);
      const info = await m.page.evaluate(() => window.T.canvasInfo());
      save('shot-mobile', r.png);
      expect(info.buffer[0] * info.buffer[1] <= 4_010_000 && info.colorSpace === 'srgb',
        `Mobil: Puffer ${info.buffer.join('×')} (CSS ${info.css.join('×')}, DPR ${info.dpr}), ${info.colorSpace}`);
    } finally {
      await m.browser.close();
    }
  }

  if (want('shots')) {
    const img = process.env.SHOT_IMG ?? 'DSC03982.JPEG';
    for (const [name, params, lut] of [['original', {}, null], ['lut', {}, LOOK], ['combined', ALL, LOOK]]) {
      const r = await T('show', img, params, lut, {});
      save(`shot-${name}`, r.png);
      console.log(`Bild shot-${name}.png, render ${r.ms.toFixed(1)} ms`);
    }
    save('shot-split', (await T('show', img, ALL, LOOK, { split: 0.5 })).png);
  }

  // Korn: Messung auf einem Grauverlauf gegen Fujis Grain Effect (100-%-Ausschnitte einer X-T30, 26 MP).
  // Zugabe = √(σ_an² − σ_aus²) in hellen Mitteltönen; Referenz schwach ≈ 1,2–2,7, stark ≈ 4–7 (8 Bit).
  if (want('grain')) {
    const ref = 'referenz/fujixweekly-grain-xt30/';
    for (const f of ['ausschnitt1-iso640-grain-off', 'ausschnitt1-iso640-grain-weak', 'ausschnitt1-iso640-grain-strong',
      'ausschnitt2-iso640-grain-off', 'ausschnitt2-iso640-grain-weak', 'ausschnitt2-iso640-grain-strong']) {
      const r = await T('refGrain', ref + f + '.jpg');
      console.log(`Referenz ${f}: σ ${r.sigma.map((v) => v?.toFixed(2) ?? '-').join(' ')}, AK1 ${r.ak1.toFixed(2)}, Farbe ${r.colorRatio.toFixed(2)}`);
    }
    const res = {};
    for (const [label, p] of [['schwach klein', { grainEffect: 1 }], ['stark klein', { grainEffect: 2 }], ['schwach groß', { grainEffect: 1, grainSize: 'gross' }], ['stark groß', { grainEffect: 2, grainSize: 'gross' }]]) {
      const r = (res[label] = await T('grainMeasure', p));
      console.log(`Film Lab ${label}: voll σ ${r.full.sigma.map((v) => v?.toFixed(2) ?? '-').join(' ')}, AK1 ${r.full.ak1.toFixed(2)}, Farbe ${r.full.colorRatio.toFixed(2)}; Vorschau 2560 σ ${r.preview.sigma.map((v) => v?.toFixed(2) ?? '-').join(' ')}`);
    }
    results.grain = res;
    const mid = (r) => r.full.sigma[4];
    expect(mid(res['schwach klein']) > 1.2 && mid(res['schwach klein']) < 2.8 && mid(res['stark klein']) > 4 && mid(res['stark klein']) < 7,
      `Korn-Stärke wie Fuji (Mitteltöne): schwach ${mid(res['schwach klein']).toFixed(2)}, stark ${mid(res['stark klein']).toFixed(2)}`);
    expect(res['stark groß'].full.ak1 > res['stark klein'].full.ak1 + 0.15, `„groß“ gröber: AK1 ${res['stark klein'].full.ak1.toFixed(2)} → ${res['stark groß'].full.ak1.toFixed(2)}`);
    // 100-%-Ausschnitte (3× vergrößert): Film Lab auf a6000-Foto neben der Referenz.
    const v = [['Aus', 0, 'klein'], ['Schwach klein', 1, 'klein'], ['Stark klein', 2, 'klein'], ['Schwach groß', 1, 'gross'], ['Stark groß', 2, 'gross']]
      .map(([label, g, size]) => ({ label, params: { grainEffect: g, grainSize: size } }));
    save('grain-stufen-100', (await T('strip', 'DSC01603.JPEG', v, null, 0, [0.8, 0.04, 120, 120, 3])).png, OUT2);
    save('grain-stufen-verlauf', (await T('strip', 'ramp', v, null, 0, [0.5, 0.5, 120, 120, 3])).png, OUT2);
    console.log(`Bilder ${OUT2}/grain-stufen-100.png, grain-stufen-verlauf.png`);
  }

  // Color Chrome: Fujis Beispielpaare (aus/stark); Film Lab rechnet aus „aus“ und wird mit „stark“ verglichen.
  if (want('cc')) {
    const ref = 'referenz/fujifilm-offiziell-effekte/';
    for (const [name, off, on, params] of [
      ['colorchrome', 'colorchrome-aus', 'colorchrome-strong', { colorChrome: 2 }],
      ['colorchrome-fxblau', 'colorchrome-fxblue-aus', 'colorchrome-fxblue-strong', { colorChromeBlue: 2 }],
    ]) {
      const r = await T('colorChrome', ref + off + '.jpg', ref + on + '.jpg', params);
      save(`${name}-referenz`, r.png, OUT2);
      delete r.png;
      results[name] = r;
      // Maß auf 8× verkleinerten Bildern: Blätter im Wind bewegen sich zwischen den Aufnahmen.
      expect(r.small.oursVsOn.dE < r.small.offVsOn.dE * 0.7 && r.small.satOursVsOn.dE < r.small.satOffVsOn.dE * 0.7,
        `${name}: ΔE_OK (×100) aus↔stark ${r.refOffVsOn.dE.toFixed(2)}, Film Lab↔stark ${r.oursVsOn.dE.toFixed(2)}; gesättigte Pixel ${r.satOffVsOn.dE.toFixed(2)} → ${r.satOursVsOn.dE.toFixed(2)} (ΔL Referenz ${r.satOffVsOn.dL.toFixed(2)}, Film Lab ${r.satOffVsOurs.dL.toFixed(2)})`);
      console.log(`     8× verkleinert: aus↔stark ${r.small.offVsOn.dE.toFixed(2)}, Film Lab↔stark ${r.small.oursVsOn.dE.toFixed(2)}; gesättigt ${r.small.satOffVsOn.dE.toFixed(2)} → ${r.small.satOursVsOn.dE.toFixed(2)}`);
    }
  }

  // Stufen je Effekt nebeneinander (ganzes Bild, lange Kante 640).
  if (want('strips')) {
    const E = 640;
    const st = (key, values, fmt = (v) => `${key} ${v}`, extra = {}) => values.map((v) => ({ label: fmt(v), params: { ...extra, [key]: v } }));
    const strips = [
      ['wb-kelvin', 'DSC03982.JPEG', st('wbKelvin', [0, 3500, 5500, 7500, 10000], (v) => (v ? `${v} K` : 'Auto'))],
      ['wb-shift-r', 'DSC03982.JPEG', st('wbShiftR', [-9, -4, 0, 4, 9], (v) => `R ${v}`)],
      ['wb-shift-b', 'DSC03982.JPEG', st('wbShiftB', [-9, -4, 0, 4, 9], (v) => `B ${v}`)],
      ['dynamikbereich', 'DSC03982.JPEG', st('dynamicRange', [100, 200, 400], (v) => `DR${v}`, { exposure: 0.7 })],
      ['lichter-ton', 'DSC03982.JPEG', st('highlightTone', [-2, -1, 0, 2, 4], (v) => `Lichter ${v}`)],
      ['schatten-ton', 'DSC01603.JPEG', st('shadowTone', [-2, -1, 0, 2, 4], (v) => `Schatten ${v}`)],
      ['farbe', 'DSC03982.JPEG', st('color', [-4, -2, 0, 2, 4], (v) => `Farbe ${v}`)],
      ['color-chrome', 'DSC03982.JPEG', st('colorChrome', [0, 1, 2], (v) => `Color Chrome ${['Aus', 'Schwach', 'Stark'][v]}`)],
      ['color-chrome-blau', 'DSC03982.JPEG', st('colorChromeBlue', [0, 1, 2], (v) => `FX Blau ${['Aus', 'Schwach', 'Stark'][v]}`)],
      ['klarheit', 'DSC04866.JPEG', st('clarity', [-5, -2, 0, 2, 5], (v) => `Klarheit ${v}`)],
      ['halation-vignette-leak', 'DSC03982.JPEG', [
        { label: 'Aus', params: {} }, { label: 'Halation 1', params: { halation: 1 } },
        { label: 'Vignette 0,8', params: { vignette: 0.8 } }, { label: 'Leak 0,9', params: { leak: 0.9, leakSeed: 2 } }]],
    ];
    const only = process.env.STRIPS?.split(',');
    for (const [name, img, variants] of strips) {
      if (only && !only.includes(name)) continue;
      save(name, (await T('strip', img, variants, null, E)).png, OUT2);
      console.log(`Bild ${OUT2}/${name}.png`);
    }
    if (!only || only.includes('monochrom')) {
      const mono = looks.find((id) => /acros|mono|sw/i.test(id)) ?? null;
      const v = [[0, 0], [9, 0], [18, 0], [-18, 0], [0, 18], [0, -18]].map(([w, m]) => ({ label: `WK ${w} MG ${m}`, params: { monoWarmCool: w, monoMagentaGreen: m, color: mono ? 0 : -4 } }));
      save('monochrom-toenung', (await T('strip', 'DSC03982.JPEG', v, mono, E)).png, OUT2);
      console.log(`Bild ${OUT2}/monochrom-toenung.png (Look ${mono ?? 'ohne, Farbe −4'})`);
    }
    if (!only || only.includes('schaerfe')) {
      const v = [-4, -2, 0, 2, 4].map((s) => ({ label: `Schärfe ${s}`, params: { sharpness: s } }));
      save('schaerfe-100', (await T('strip', 'DSC04866.JPEG', v, null, 0, [0.5, 0.45, 160, 160, 2])).png, OUT2);
      save('schaerfe-vorschau', (await T('strip', 'DSC04866.JPEG', v, null, E)).png, OUT2);
      console.log(`Bild ${OUT2}/schaerfe-100.png, schaerfe-vorschau.png`);
    }
  }
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
