// Abgleich der ganzen Pipeline (echte Engine + Looks) gegen echte Kamerabilder:
//   TEST_PORT=5187 node scripts/abgleich-pipeline.mjs [fuji|korn|cc|wb|uebersicht …]   (ohne Angabe: alle)
// Schreibt Bögen und Tabellen nach test-output/abgleich/. Referenzen nur lokal (testbilder/, gitignoriert);
// die Bögen enthalten Ausschnitte fremder Bilder – nicht veröffentlichen.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, startDevServer } from './lib/browser.mjs';
import { TARGETS, SW_PAIRS, pair } from './looks-refs.mjs';

const OUT = 'test-output/abgleich';
mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const on = (s) => want.length === 0 || want.includes(s);
const f1 = (v) => (v == null ? '–' : v.toFixed(2).replace('.', ','));
const R = 'testbilder/referenz';
const OFFICIAL_ZIP = 'testbilder/luts/fujifilm-official/zips/gfx-eterna-55-3d-lut-v110.zip';

const server = await startDevServer();
const { browser, page } = await launch();
const A = (fn, ...args) => page.evaluate((fn, args) => window.A[fn](...args), fn, args);
const save = async (file, rows, tileW, title) => {
  const url = await A('sheet', rows, tileW, title);
  writeFileSync(`${OUT}/${file}`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`  → ${OUT}/${file}`);
};

function sourceOf(p) {
  if (p.includes('raster')) return 'Peltier-Raster (Kamera-JPEG, ohne Beschriftung)';
  if (p.includes('peltier')) return 'Peltier (Kamera-JPEG)';
  if (p.includes('keithwee-xh1')) return 'Keith Wee X-H1 (Lightroom)';
  if (p.includes('keithwee-xpro3')) return p.includes('set') ? 'Keith Wee X-Pro3 (Rollen unsicher)' : 'Keith Wee X-Pro3 (Kamera-JPEG)';
  if (p.includes('alikgriffin')) return 'Alik Griffin GFX100 II (Lightroom)';
  if (p.includes('kiechle')) return 'Kiechle X-T30 (Capture One)';
  return p;
}

// Alle pixelgleichen Paare [Provia, Simulation] je Look: die der Anpassung plus Kiechles Farbserie
// und Keith Wees zweite X-Pro3-Serie.
function fujiPairs() {
  const kie = (n) => pair('kiechle', 'filmsim01.jpg', `filmsim${String(n).padStart(2, '0')}.jpg`);
  const extra = {
    velvia: [kie(2)], astia: [kie(3)], 'classic-chrome': [kie(4)], 'pro-neg-hi': [kie(5)], 'pro-neg-std': [kie(6)], eterna: [kie(7)],
    'classic-neg': [pair('keithwee-xpro3', 'set2-a.jpg', 'set1-a.jpg'), pair('keithwee-xpro3', 'set2-c.jpg', 'set1-c.jpg')],
  };
  const out = {};
  for (const id of new Set([...Object.keys(TARGETS), ...Object.keys(SW_PAIRS), ...Object.keys(extra)]))
    out[id] = [...(TARGETS[id]?.pairs ?? []), ...(SW_PAIRS[id] ?? []), ...(extra[id] ?? [])];
  return out;
}

try {
  await page.goto(`${server.url}/scripts/abgleich-seite.html`);
  await page.waitForFunction('window.ready === true', { timeout: 120_000 });
  const looks = await A('looks');
  const nameOf = Object.fromEntries(looks.map((l) => [l.id, l.name]));

  if (on('fuji')) {
    const o = await A('official', `/${OFFICIAL_ZIP}`);
    console.log(`Originale: ${o.keys.length} LUTs in ${o.ms} ms (${o.keys.join(', ')})`);
    const table = [];
    const pairs = fujiPairs();
    for (const look of looks.filter((l) => pairs[l.id]?.length)) {
      const rows = [];
      for (const [i, [p, k]] of pairs[look.id].entries()) {
        const key = `fuji/${look.id}/${i}`;
        const r = await A('pair', key, `/${p}`, `/${k}`, look.id, 640, k.includes('raster') ? 0.2 : 0);
        const src = sourceOf(k);
        table.push({ id: look.id, name: look.name, src, ...r });
        console.log(`${look.name.padEnd(22)} ${src.padEnd(38)} nichts ${f1(r.none)}  eigen ${f1(r.own)}  Original ${f1(r.off)}`);
        rows.push([
          { key: `${key}/p`, label: `Provia (nichts tun) ΔE ${f1(r.none)}` },
          { key: `${key}/o`, label: `Film Lab ΔE ${f1(r.own)}` },
          r.off != null ? { key: `${key}/f`, label: `Fujifilm-Original-LUT ΔE ${f1(r.off)}` } : null,
          { key: `${key}/k`, label: `Kamera: ${src}` },
        ]);
      }
      await save(`fuji-${look.id}.png`, rows, 360, `${look.name}: Provia | Film Lab | Original | Kamera (ΔE2000 zum Kamerabild)`);
      await A('drop', `fuji/${look.id}/`);
    }
    // Zusammenfassung je Simulation (Mittel über die Paare).
    const lines = ['| Simulation | Paare | ΔE eigener Look | ΔE Original | ΔE nichts tun |', '|---|---:|---:|---:|---:|'];
    for (const id of [...new Set(table.map((t) => t.id))]) {
      const t = table.filter((x) => x.id === id);
      const mean = (f) => (t.every((x) => x[f] != null) ? t.reduce((s, x) => s + x[f], 0) / t.length : null);
      lines.push(`| ${nameOf[id]} | ${t.length} | ${f1(mean('own'))} | ${f1(mean('off'))} | ${f1(mean('none'))} |`);
    }
    lines.push('', '| Simulation | Quelle | eigen | Original | nichts |', '|---|---|---:|---:|---:|');
    for (const t of table) lines.push(`| ${t.name} | ${t.src} | ${f1(t.own)} | ${f1(t.off)} | ${f1(t.none)} |`);
    writeFileSync(`${OUT}/fuji-tabelle.md`, lines.join('\n') + '\n');
    writeFileSync(`${OUT}/fuji-tabelle.json`, JSON.stringify(table, null, 1));
    console.log(lines.join('\n'));
  }
  if (on('korn')) {
    // Referenzen 1:1 (X-T30-Ausschnitte = 100 % bei 26 MP; a6000 hat 24 MP, also fast gleiche Pixelgröße).
    const X = `${R}/fujixweekly-grain-xt30`, W = `${R}/fujixweekly-grain`;
    const refs = {
      'xt30-1-aus': `${X}/ausschnitt1-iso640-grain-off.jpg`, 'xt30-1-schwach': `${X}/ausschnitt1-iso640-grain-weak.jpg`, 'xt30-1-stark': `${X}/ausschnitt1-iso640-grain-strong.jpg`,
      'xt30-2-aus': `${X}/ausschnitt2-iso640-grain-off.jpg`, 'xt30-2-schwach': `${X}/ausschnitt2-iso640-grain-weak.jpg`, 'xt30-2-stark': `${X}/ausschnitt2-iso640-grain-strong.jpg`,
      'xt5-schwach-klein': `${W}/xt5-weak-small-ausschnitt.jpg`, 'xt5-stark-gross': `${W}/xt5-strong-large-ausschnitt.jpg`,
      'gfx-schwach-klein': `${W}/gfx100sii-weak-small-ausschnitt.jpg`, 'gfx-stark-gross': `${W}/gfx100sii-strong-large-ausschnitt.jpg`,
    };
    const stats = {};
    for (const [k, url] of Object.entries(refs)) {
      await A('load', `korn/${k}`, `/${url}`, 1e9);
      stats[k] = await A('grain', `korn/${k}`);
    }
    // Film Lab: Nutzerfoto in voller Auflösung, glatter Himmel oben rechts, 800×800 wie die Referenz.
    const variants = { aus: {}, 'schwach-klein': { grainEffect: 1 }, 'stark-klein': { grainEffect: 2 }, 'schwach-gross': { grainEffect: 1, grainSize: 'gross' }, 'stark-gross': { grainEffect: 2, grainSize: 'gross' } };
    for (const [k, p] of Object.entries(variants)) {
      await A('photo', `korn/fl-${k}`, '/testbilder/DSC01603.JPEG', null, p, undefined, [4400, 20, 800, 800]);
      stats[`fl-${k}`] = await A('grain', `korn/fl-${k}`);
    }
    const add = (on, off) => Math.sqrt(Math.max(0, stats[on].sigma ** 2 - stats[off].sigma ** 2));
    for (const [k, s] of Object.entries(stats)) console.log(`${k.padEnd(20)} σ ${f1(s.sigma)}  r1 ${f1(s.ac1)}  Luma ${s.luma.toFixed(0)}  (${s.blocks} Blöcke)`);
    const added = {
      'X-T30 schwach': [add('xt30-1-schwach', 'xt30-1-aus'), add('xt30-2-schwach', 'xt30-2-aus')],
      'X-T30 stark': [add('xt30-1-stark', 'xt30-1-aus'), add('xt30-2-stark', 'xt30-2-aus')],
      'Film Lab schwach klein': [add('fl-schwach-klein', 'fl-aus')], 'Film Lab stark klein': [add('fl-stark-klein', 'fl-aus')],
      'Film Lab schwach groß': [add('fl-schwach-gross', 'fl-aus')], 'Film Lab stark groß': [add('fl-stark-gross', 'fl-aus')],
    };
    for (const [k, v] of Object.entries(added)) console.log(`zugefügtes Korn ${k.padEnd(24)} σ ${v.map(f1).join(' / ')}`);
    writeFileSync(`${OUT}/korn-messung.json`, JSON.stringify({ stats, added }, null, 1));
    const lab = (k, name) => `${name}: σ ${f1(stats[k].sigma)}, r1 ${f1(stats[k].ac1)}`;
    // Gleiche Darstellungsgröße: 200×200-Pixel-Ausschnitte, 2× vergrößert (nächster Nachbar).
    const z = (key, name, rect) => ({ key, label: lab(key.slice(5), name), rect, zoom: true });
    const sky1 = [560, 10, 200, 200], sky2 = [300, 20, 200, 200], fl = [300, 100, 200, 200];
    await save('korn-xt30-vs-filmlab.png', [
      [z('korn/xt30-1-aus', 'X-T30 Szene 1 aus', sky1), z('korn/xt30-1-schwach', 'X-T30 Szene 1 schwach', sky1), z('korn/xt30-1-stark', 'X-T30 Szene 1 stark', sky1)],
      [z('korn/xt30-2-aus', 'X-T30 Szene 2 aus', sky2), z('korn/xt30-2-schwach', 'X-T30 Szene 2 schwach', sky2), z('korn/xt30-2-stark', 'X-T30 Szene 2 stark', sky2)],
      [z('korn/fl-aus', 'Film Lab aus', fl), z('korn/fl-schwach-klein', 'Film Lab schwach klein', fl), z('korn/fl-stark-klein', 'Film Lab stark klein', fl)],
      [null, z('korn/fl-schwach-gross', 'Film Lab schwach groß', fl), z('korn/fl-stark-gross', 'Film Lab stark groß', fl)],
    ], 400, 'Grain Effect 200×200 px, 2× vergrößert: Fuji X-T30 (Fuji X Weekly) | Film Lab (a6000, 24 MP)');
    const skyT5 = [0, 0, 200, 200];
    await save('korn-groesse-xt5-vs-filmlab.png', [
      [z('korn/xt5-schwach-klein', 'X-T5 schwach/klein', skyT5), z('korn/xt5-stark-gross', 'X-T5 stark/groß', skyT5), z('korn/gfx-schwach-klein', 'GFX schwach/klein', skyT5), z('korn/gfx-stark-gross', 'GFX stark/groß', skyT5)],
      [z('korn/fl-schwach-klein', 'Film Lab schwach klein', fl), z('korn/fl-stark-gross', 'Film Lab stark groß', fl), z('korn/fl-stark-klein', 'Film Lab stark klein', fl), z('korn/fl-schwach-gross', 'Film Lab schwach groß', fl)],
    ], 400, 'Korngröße 200×200 px, 2×: Fuji X-T5/GFX (Rezepte, Maßstab unsicher) | Film Lab');
    const q = (r) => [r[0], r[1], 100, 100];
    await save('korn-zoom4.png', [
      [z('korn/xt30-2-schwach', 'X-T30 schwach', q(sky2)), z('korn/xt30-2-stark', 'X-T30 stark', q(sky2)), z('korn/xt5-stark-gross', 'X-T5 stark/groß', q(skyT5))],
      [z('korn/fl-schwach-klein', 'Film Lab schwach klein', q(fl)), z('korn/fl-stark-klein', 'Film Lab stark klein', q(fl)), z('korn/fl-stark-gross', 'Film Lab stark groß', q(fl))],
    ], 400, 'Kornstruktur 100×100 px, 4× vergrößert');
    await save('korn-1zu1.png', [
      [{ key: 'korn/xt30-2-stark', label: 'X-T30 stark, 100 %' }, { key: 'korn/fl-stark-klein', label: 'Film Lab stark klein, 100 %' }, { key: 'korn/fl-stark-gross', label: 'Film Lab stark groß, 100 %' }],
    ], 800, 'Grain Effect stark, 800×800 px 1:1');
    await A('drop', 'korn/');
  }
  if (on('cc')) {
    // Color Chrome / FX Blau: „aus“-Bild durch die Engine (ohne LUT, nur der Effekt) gegen das „stark“-Bild.
    // Fuji Learning Centre (offiziell) und Alik Griffin (GFX100 II, Reala Ace, In-Kamera-JPEGs).
    const F = `${R}/fujifilm-offiziell-effekte`, G = `${R}/alikgriffin/AGriffin_GFX100II_45_RealaAce_Kalina_JPG`;
    const cases = [
      ['fuji-cc', 'Fujifilm: Color Chrome', `${F}/colorchrome-aus.jpg`, `${F}/colorchrome-strong.jpg`, { colorChrome: 2 }],
      ['fuji-blau', 'Fujifilm: FX Blau', `${F}/colorchrome-fxblue-aus.jpg`, `${F}/colorchrome-fxblue-strong.jpg`, { colorChromeBlue: 2 }],
      ['alik-cc', 'Alik Griffin: Color Chrome', `${G}_Standard-L.jpg`, `${G}_CC_S-L.jpg`, { colorChrome: 2 }],
      ['alik-blau', 'Alik Griffin: FX Blau', `${G}_Standard-L.jpg`, `${G}_CChB_S-L.jpg`, { colorChromeBlue: 2 }],
      ['alik-beide', 'Alik Griffin: beide', `${G}_Standard-L.jpg`, `${G}_CCCCB_S-L.jpg`, { colorChrome: 2, colorChromeBlue: 2 }],
    ];
    const rows = [], res = {};
    for (const [k, title, off, onUrl, p] of cases) {
      const { w, h } = await A('load', `cc/${k}/aus`, `/${off}`, 384);
      await A('load', `cc/${k}/an`, `/${onUrl}`, 0, [w, h]);
      await A('apply', `cc/${k}/fl`, `cc/${k}/aus`, null, p);
      const r = {
        nichts: await A('de', `cc/${k}/aus`, `cc/${k}/an`), filmlab: await A('de', `cc/${k}/fl`, `cc/${k}/an`),
        nichtsSatt: await A('de', `cc/${k}/aus`, `cc/${k}/an`, 25), filmlabSatt: await A('de', `cc/${k}/fl`, `cc/${k}/an`, 25),
        kamera: await A('effect', `cc/${k}/aus`, `cc/${k}/an`), unsere: await A('effect', `cc/${k}/aus`, `cc/${k}/fl`),
      };
      res[k] = r;
      console.log(`${title}: ΔE nichts ${f1(r.nichts.de)} (satt ${f1(r.nichtsSatt.de)}), Film Lab ${f1(r.filmlab.de)} (satt ${f1(r.filmlabSatt.de)})`);
      for (const sec of Object.keys(r.kamera).sort())
        if (r.kamera[sec].n > 200)
          console.log(`   ${sec.padEnd(8)} n ${String(r.kamera[sec].n).padStart(6)}  Kamera ΔL* ${f1(r.kamera[sec].dL)} C× ${f1(r.kamera[sec].cRatio)}   Film Lab ΔL* ${f1(r.unsere[sec].dL)} C× ${f1(r.unsere[sec].cRatio)}`);
      rows.push([
        { key: `cc/${k}/aus`, label: `${title} – aus (ΔE ${f1(r.nichts.de)} / satt ${f1(r.nichtsSatt.de)})` },
        { key: `cc/${k}/fl`, label: `Film Lab stark (ΔE ${f1(r.filmlab.de)} / satt ${f1(r.filmlabSatt.de)})` },
        { key: `cc/${k}/an`, label: 'Kamera stark' },
      ]);
    }
    writeFileSync(`${OUT}/colorchrome-messung.json`, JSON.stringify(res, null, 1));
    await save('colorchrome.png', rows, 420, 'Color Chrome / FX Blau stark: aus | Film Lab | Kamera (ΔE2000 zur Kamera, „satt“ = C* > 25)');
    await A('drop', 'cc/');
  }
  if (on('wb')) {
    // Weißabgleich-Verschiebung: Fuji X Weekly hat dieselbe Aufnahme (GFX100S II) in der Kamera mit mehreren
    // Kodak-Rezepten entwickelt. Der Farbstich-Unterschied zwischen zwei Rezepten auf fast neutralen Flächen
    // wird mit Film Labs Vorhersage auf einem Grauverlauf verglichen; die Schrittweite wird über den Faktor α
    // skaliert (α = 1 ist WB_SHIFT_STOPS). Korn/Klarheit/Schärfe aus (ändern den Farbstich nicht).
    const RZ = `${R}/fujixweekly-rezepte-gfx`;
    const rec = { kd64: ['kodachrome-64', 'kodak-kodachrome-64'], gold: ['gold-200', 'kodak-gold-200'], p800: ['portra-800-v3', 'kodak-portra-800'], e100: ['ektachrome-e100', 'kodak-ektachrome-e100'] };
    const pairs = [['kd64', 'gold'], ['kd64', 'p800'], ['gold', 'p800'], ['kd64', 'e100'], ['gold', 'e100']];
    const meas = {};
    for (const sz of ['szene1', 'szene2'])
      for (const [k, [file]] of Object.entries(rec)) await A('load', `wb/${sz}/${k}`, `/${RZ}/${sz}-${file}.jpg`, 400);
    for (const [a, b] of pairs) {
      const m = [await A('castDiff', `wb/szene1/${a}`, `wb/szene1/${b}`), await A('castDiff', `wb/szene2/${a}`, `wb/szene2/${b}`)];
      meas[`${a}>${b}`] = { da: (m[0].da + m[1].da) / 2, db: (m[0].db + m[1].db) / 2, n: m[0].n + m[1].n };
    }
    // Vorhersage: Grauverlauf 24..232 durch Rezept A und B.
    await A('ramp', 'wb/ramp', 256, 8);
    const def = {};
    for (const [k, [, id]] of Object.entries(rec)) def[k] = await A('paramsOf', id);
    const quiet = { grainEffect: 0, clarity: 0, sharpness: 0, exposure: 0 };
    const res = [];
    // α skaliert die Schrittweite, D = Kelvin, die Fujis Voreinstellung „Daylight“ in Film Lab entspricht (5500 = Annahme).
    for (const alpha of [0.8, 1, 1.25, 1.5])
      for (const D of [4800, 5100, 5500, 5800]) {
        let err = 0;
        const line = [];
        for (const [a, b] of pairs) {
          for (const k of [a, b]) {
            const kelvin = def[k].wbKelvin === 5500 ? D : def[k].wbKelvin;
            await A('apply', `wb/p/${k}`, 'wb/ramp', rec[k][1], { ...quiet, wbKelvin: kelvin, wbShiftR: def[k].wbShiftR * alpha, wbShiftB: def[k].wbShiftB * alpha }, [24, 0, 208, 8]);
          }
          const p = await A('castDiff', `wb/p/${a}`, `wb/p/${b}`, 100);
          const m = meas[`${a}>${b}`];
          err += (p.da - m.da) ** 2 + (p.db - m.db) ** 2;
          line.push(`${a}>${b} Δa ${f1(p.da)} Δb ${f1(p.db)}`);
        }
        res.push({ alpha, D, rms: Math.sqrt(err / pairs.length) });
        console.log(`α ${alpha} D ${D}: RMS ${f1(Math.sqrt(err / pairs.length))}  | ${line.join(' | ')}`);
      }
    console.log('Kamera:', Object.entries(meas).map(([k, m]) => `${k} Δa ${f1(m.da)} Δb ${f1(m.db)} (n ${m.n})`).join(' | '));
    writeFileSync(`${OUT}/wb-messung.json`, JSON.stringify({ meas, res }, null, 1));
    await A('drop', 'wb/');
  }
  if (on('uebersicht')) {
    // Alle Looks mit ihren Voreinstellungen (inkl. Korn, Color Chrome, WB der Rezepte) auf zwei Nutzerfotos.
    for (const img of ['DSC01603', 'DSC04866'])
      for (const [cat, title] of [['fujifilm', 'Fujifilm-Simulationen'], ['leica', 'Leica Looks'], ['kodak', 'Kodak-Rezepte (auf Fujifilm-Basis)']]) {
        const ids = looks.filter((l) => l.category === cat).map((l) => l.id);
        const tiles = [{ key: `ue/orig`, label: 'Original' }];
        await A('photo', 'ue/orig', `/testbilder/${img}.JPEG`, null, {}, 480);
        for (const id of ids) {
          await A('photo', `ue/${id}`, `/testbilder/${img}.JPEG`, id, {}, 480);
          tiles.push({ key: `ue/${id}`, label: nameOf[id] });
        }
        const rows = [];
        for (let i = 0; i < tiles.length; i += 6) rows.push(tiles.slice(i, i + 6));
        await save(`uebersicht-${cat}-${img}.png`, rows, 320, `${title} – ${img}, Voreinstellungen über die Engine`);
        await A('drop', 'ue/');
      }
  }
} finally {
  await browser.close();
  await server.close();
}
