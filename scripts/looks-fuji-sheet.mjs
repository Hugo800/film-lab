// Kontaktbögen der Fujifilm-Looks (LUT in JS angewendet, wie looks-sheet; Voreinstellungen = nur LUT):
//   node scripts/looks-fuji-sheet.mjs [id ...]
// test-output/fuji-looks/<id>.png: je Bildpaar [Provia-Referenz | unser Look darauf | Kamerabild | Referenz-LUT darauf]
// test-output/fuji-looks/nutzer-<bild>.png: Original + alle Looks auf einem Nutzer-Testbild.
// Referenzbilder liegen nur lokal (testbilder/); die Bögen nicht veröffentlichen.
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { LOOKS } from '../src/looks/looks.ts';
import { parseCube } from '../src/looks/cube.ts';
import { readImage, shrink, writePng, sampleLut, mapImage, imageDE } from './looks-lib.mjs';
import { T, TARGETS, SW_PAIRS, pair } from './looks-refs.mjs';

const OUT = 'test-output/fuji-looks';
const TILE = 360, LABEL = 22;
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);

// Kamerabilder derselben Szene, aber nicht deckungsgleich (nur zum Ansehen, kein ΔE).
const SHOTKIT = { acros: 'acros', monochrome: 'monochrome', sepia: 'sepia', 'pro-neg-hi': 'pro-neg-hi' };

// 5×7-Pixelschrift für Beschriftungen (Großbuchstaben, Ziffern, wenige Zeichen).
const GLYPHS = {
  A: '0e11111f111111', B: '1e11111e11111e', C: '0e11101010110e', D: '1e11111111111e', E: '1f10101e10101f', F: '1f10101e101010',
  G: '0e111017111f0f', H: '1111111f111111', I: '0e04040404040e', J: '0702020202120c', K: '11121418141211', L: '1010101010101f',
  M: '111b1515111111', N: '11111915131111', O: '0e11111111110e', P: '1e11111e101010', Q: '0e11111115120d', R: '1e11111e141211',
  S: '0f10100e01011e', T: '1f040404040404', U: '1111111111110e', V: '11111111110a04', W: '1111111515150a', X: '11110a040a1111',
  Y: '1111110a040404', Z: '1f01020408101f', 0: '0e11131519110e', 1: '040c040404040e', 2: '0e11010204081f', 3: '1f02040201110e',
  4: '02060a121f0202', 5: '1f101e0101110e', 6: '0608101e11110e', 7: '1f010204080808', 8: '0e11110e11110e', 9: '0e11110f01020c',
  '.': '00000000000c0c', '-': '0000001f000000', '/': '01010204081010', '+': '0004041f040400', ',': '000000000c0408',
  '(': '02040808080402', ')': '08040202020408', ':': '000c0c000c0c00', '>': '08040201020408', ' ': '00000000000000',
};

function text(img, x0, y0, str, scale = 2) {
  let x = x0;
  for (const ch of str.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let row = 0; row < 7; row++) {
      const bits = parseInt(g.slice(row * 2, row * 2 + 2), 16);
      for (let col = 0; col < 5; col++)
        if (bits & (16 >> col))
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++) {
              const px = x + col * scale + sx, py = y0 + row * scale + sy;
              if (px < img.w && py < img.h) img.rgb.fill(0.93, (py * img.w + px) * 3, (py * img.w + px) * 3 + 3);
            }
    }
    x += 6 * scale;
  }
}

/** Raster aus Kacheln (je { img, label } oder null); Kacheln werden auf TILE Breite gebracht. */
function sheet(rows) {
  const cols = Math.max(...rows.map((r) => r.length));
  const rowH = rows.map((r) => Math.max(...r.filter(Boolean).map((t) => Math.round((t.img.h * TILE) / t.img.w))) + LABEL);
  const S = { w: cols * TILE, h: rowH.reduce((a, b) => a + b, 0), rgb: null };
  S.rgb = new Float32Array(S.w * S.h * 3).fill(0.12);
  let y0 = 0;
  rows.forEach((r, ri) => {
    r.forEach((t, ci) => {
      if (!t) return;
      const h = Math.round((t.img.h * TILE) / t.img.w);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < TILE; x++) {
          const sx = Math.min(t.img.w - 1, Math.floor(((x + 0.5) * t.img.w) / TILE)), sy = Math.min(t.img.h - 1, Math.floor(((y + 0.5) * t.img.h) / h));
          for (let c = 0; c < 3; c++) S.rgb[((y0 + LABEL + y) * S.w + ci * TILE + x) * 3 + c] = t.img.rgb[(sy * t.img.w + sx) * 3 + c];
        }
      text(S, ci * TILE + 6, y0 + 4, t.label);
    });
    y0 += rowH[ri];
  });
  return S;
}

const applyLut = (img, lut) => {
  const o = [0, 0, 0];
  return mapImage(img, (r, g, b, out) => Object.assign(out, sampleLut(lut, r, g, b, o)));
};
const f2 = (v) => v.toFixed(1);

const looks = LOOKS.filter((l) => !only.length || only.includes(l.id));
for (const look of looks) {
  const lut = look.buildLut();
  const t = TARGETS[look.id] ?? {};
  const ref = t.cube && existsSync(t.cube) ? parseCube(readFileSync(t.cube, 'utf8')) : null;
  const pairs = [...(t.pairs ?? []), ...(SW_PAIRS[look.id] ?? [])].filter(([a, b]) => existsSync(a) && existsSync(b));
  const base = look.id.replace(/-(ye|r|g)$/, '');
  if (SHOTKIT[base] && !pairs.length) pairs.push(pair('shotkit', 'provia.jpg', `${SHOTKIT[base]}.jpg`));
  const rows = [];
  for (const [a, b] of pairs) {
    const P = shrink(await readImage(a), 640), S = shrink(await readImage(b), 640);
    const ours = applyLut(P, lut);
    const aligned = P.w === S.w && P.h === S.h && !a.includes('shotkit');
    const row = [
      { img: P, label: `Provia${aligned ? ` dE ${f2(imageDE(P, S))}` : ''}` },
      { img: ours, label: `${look.name}${aligned ? ` dE ${f2(imageDE(ours, S))}` : ''}` },
      { img: S, label: aligned ? 'Kamera' : 'Kamera (andere Aufnahme)' },
    ];
    if (ref) {
      const viaRef = applyLut(P, ref);
      row.push({ img: viaRef, label: aligned ? `Ref-LUT dE ${f2(imageDE(viaRef, S))}` : 'Ref-LUT' });
    }
    rows.push(row);
  }
  if (!rows.length) continue;
  const S = sheet(rows);
  writePng(`${OUT}/${look.id}.png`, S.w, S.h, S.rgb);
  console.log(`${OUT}/${look.id}.png`);
}

// Nutzer-Testbilder: Original + alle Looks.
if (!only.length) {
  const luts = LOOKS.map((l) => [l.name, l.buildLut()]);
  for (const f of readdirSync(T).filter((x) => /\.jpe?g$/i.test(x))) {
    const img = shrink(await readImage(`${T}/${f}`), 480);
    const tiles = [{ img, label: 'Original' }, ...luts.map(([name, lut]) => ({ img: applyLut(img, lut), label: name }))];
    const rows = [];
    for (let i = 0; i < tiles.length; i += 6) rows.push(tiles.slice(i, i + 6));
    const S = sheet(rows);
    const out = `${OUT}/nutzer-${f.replace(/\.\w+$/, '')}.png`;
    writePng(out, S.w, S.h, S.rgb);
    console.log(out);
  }
}
