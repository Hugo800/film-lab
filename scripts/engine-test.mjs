// Browser-Prüfung der Engine: npm run test:engine [-- schritt …]
// Startet den Test-Dev-Server selbst (Port TEST_PORT, Vorgabe 5190).
// Schritte: identity seams compare timing abort jpeg thumbs loss mobile shots (ohne Angabe: alle).
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';

const server = await startDevServer();
const BASE = server.url;
const OUT = 'test-output/engine';
mkdirSync(OUT, { recursive: true });

const ALL = { grain: 0.6, halation: 0.7, vignette: 0.5, leak: 0.7, leakSeed: 3, exposure: 0.3, temperature: 0.2, tint: 0.1 };
const steps = process.argv.slice(2);
const want = (s) => steps.length === 0 || steps.includes(s);
const results = {};
let failed = false;
const expect = (ok, msg) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FEHLER'} ${msg}`);
};
const save = (name, b64) => writeFileSync(`${OUT}/${name}.png`, Buffer.from(b64, 'base64'));

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
      ['DSC03427.JPEG', { ...ALL, grain: 0 }],
    ]) {
      const r = await T('previewVsExport', name, params, LOOK);
      save(`compare-${name}-preview`, r.png.preview);
      save(`compare-${name}-export-down`, r.png.down);
      delete r.png;
      results[`compare ${name}`] = r;
      expect(r.vsDownscaledFull.mean < 3, `c) Vorschau vs. verkleinerter Vollexport ${name}${params.grain ? '' : ' (ohne Korn)'} ${r.rect[2]}×${r.rect[3]}: Mittel ${r.vsDownscaledFull.mean.toFixed(2)}, max ${r.vsDownscaledFull.max}; vs. Export maxEdge: Mittel ${r.vsSmall?.mean.toFixed(2)}; Rauschen σ Vorschau ${r.noise.preview.toFixed(2)} / Vollexport verkleinert ${r.noise.downFull.toFixed(2)}`);
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
    const shots = {
      original: [{}, null],
      lut: [{}, LOOK],
      grain: [{ grain: 0.8 }, null],
      halation: [{ halation: 1 }, null],
      vignette: [{ vignette: 0.8 }, null],
      leak1: [{ leak: 0.9, leakSeed: 1 }, null],
      leak2: [{ leak: 0.9, leakSeed: 2 }, null],
      leak3: [{ leak: 0.9, leakSeed: 3 }, null],
      wb: [{ temperature: 0.8, tint: -0.3, exposure: 0.5 }, null],
      combined: [ALL, LOOK],
    };
    const only = process.env.SHOTS?.split(',');
    const img = process.env.SHOT_IMG ?? 'DSC03982.JPEG';
    for (const [name, [params, lut]] of Object.entries(shots)) {
      if (only && !only.includes(name)) continue;
      // Pixel wie gerechnet (sRGB), nicht über den Compositor.
      const r = await T('show', img, params, lut, {});
      save(`shot-${name}`, r.png);
      console.log(`Bild shot-${name}.png, render ${r.ms.toFixed(1)} ms`);
    }
    if (!only || only.includes('split')) {
      save('shot-split', (await T('show', img, ALL, LOOK, { split: 0.5 })).png);
    }
    // 100-%-Ausschnitte für Korn und Halation.
    for (const [name, params, rx, ry] of [
      ['grain', { grain: 0.6 }, 0.5, 0.5],
      ['halation', { halation: 1 }, Number(process.env.HX ?? 0.5), Number(process.env.HY ?? 0.3)],
    ]) {
      if (only && !only.includes('crop-' + name)) continue;
      const r = await T('fullCrop', process.env.CROP_IMG ?? img, params, null, rx, ry, 800, 600);
      save(`crop100-${name}`, r.png);
      console.log(`Bild crop100-${name}.png, Rauschen σ ${r.noise.toFixed(2)}`);
    }
  }
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
