// Passt die parametrischen Fujifilm-Looks (src/looks/model.ts) an lokale Messreferenzen an.
//   node scripts/looks-fit.mjs [id ...] [--write] [--fresh] [--iters N]
// Referenzen (nur lokal unter testbilder/, gitignoriert, nie committen): „Provia → Simulation“-Würfel in der
// JPEG-Domäne (aus den offiziellen F-Log2-LUTs bzw. abpy) und Bildpaare derselben Szene.
// Fehlermaß: ΔE2000 auf Stichproben, gewichtet nach Farben natürlicher Fotos (Nutzer- und Referenzbilder)
// plus ein gleichmäßiges Gitter. Optimierung: Levenberg–Marquardt mit numerischer Jacobi-Matrix.
// --write schreibt nur die gefundenen Parameter nach src/looks/fujifilm-fit.ts – keine Tabellen.
// --leica: Leica-Looks gegen Leicas Beispielbilder (Standard → Look, scripts/looks-leica-refs.mjs) → src/looks/leica-fit.ts.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compileLook, buildLut, CURVE_X } from '../src/looks/model.ts';
import { parseCube } from '../src/looks/cube.ts';
import { readImage, shrink, sampleLut, mapImage, toLab, dE2000, imageDE } from './looks-lib.mjs';
import { T, R, DER, TARGETS as FUJI_TARGETS, LEICA_TARGETS, ag, ras } from './looks-refs.mjs';
import { LEICA_DIR, leicaPairs, pairsToSamples } from './looks-leica-refs.mjs';

const LEICA = process.argv.includes('--leica');
const TARGETS = LEICA ? LEICA_TARGETS : FUJI_TARGETS;
const OUT = LEICA ? 'test-output/leica-fit' : 'test-output/fuji-fit';
const FIT_FILE = LEICA ? 'src/looks/leica-fit.ts' : 'src/looks/fujifilm-fit.ts';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const ITERS = opt('--iters', 40);
const UNIFORM = opt('--uniform', 0.1); // Anteil des gleichmäßigen Gitters am Fehlermaß
const ids = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--iters', '--uniform'].includes(args[i - 1])));
const selected = ids.length ? ids : Object.keys(TARGETS);
for (const id of selected) if (!TARGETS[id]) throw new Error(`unbekannter Look ${id}`);
if (!existsSync(LEICA ? LEICA_DIR : DER)) {
  console.log(`Referenzen fehlen (${LEICA ? LEICA_DIR : DER}) – nichts zu tun.`);
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });

// ---------- Stichproben: Farben natürlicher Fotos ----------
const BINS = 32;
async function naturalSamples() {
  const cache = `${OUT}/samples.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'));
  const user = readdirSync(T).filter((f) => /\.jpe?g$/i.test(f)).map((f) => `${T}/${f}`);
  const refs = [
    ...readdirSync(`${R}/peltier/paare`).map((d) => `${R}/peltier/paare/${d}/provia.png`).filter((f) => existsSync(f)),
    `${R}/keithwee-xh1/provia.jpg`, `${R}/keithwee-xpro3/dscf0283-provia.jpg`, `${R}/keithwee-xpro3/dscf0294-provia.jpg`,
    ag('45', '')[0], ag('80', '')[0], `${R}/shotkit/provia.jpg`, ras('')[0],
  ];
  const acc = new Map();
  for (const [list, share] of [[user, 0.5], [refs, 0.5]])
    for (const f of list) {
      const img = shrink(await readImage(f), 400);
      const n = img.w * img.h, w = share / list.length / n;
      for (let i = 0; i < n * 3; i += 3) {
        const r = img.rgb[i], g = img.rgb[i + 1], b = img.rgb[i + 2];
        const key = Math.min(BINS - 1, (r * BINS) | 0) + BINS * (Math.min(BINS - 1, (g * BINS) | 0) + BINS * Math.min(BINS - 1, (b * BINS) | 0));
        const e = acc.get(key) ?? [0, 0, 0, 0];
        e[0] += r * w;
        e[1] += g * w;
        e[2] += b * w;
        e[3] += w;
        acc.set(key, e);
      }
    }
  const out = [...acc.values()].filter((e) => e[3] > 1e-7).map((e) => [e[0] / e[3], e[1] / e[3], e[2] / e[3], e[3]]);
  const sum = out.reduce((s, e) => s + e[3], 0);
  for (const e of out) e[3] /= sum;
  writeFileSync(cache, JSON.stringify(out.map((e) => e.map((v) => +v.toFixed(5)))));
  return out;
}

/** Stichproben aus Bildpaaren: Provia-Pixel gebündelt, Ziel = mittlere Farbe der Simulation im Bündel. */
async function pairSamples(pairs) {
  const acc = new Map();
  for (const [a, b] of pairs) {
    const A = shrink(await readImage(a), 300), B = shrink(await readImage(b), 300);
    const n = A.w * A.h, w = 1 / pairs.length / n;
    for (let i = 0; i < n * 3; i += 3) {
      const key = ((A.rgb[i] * 24) | 0) + 25 * (((A.rgb[i + 1] * 24) | 0) + 25 * ((A.rgb[i + 2] * 24) | 0));
      const e = acc.get(key) ?? [0, 0, 0, 0, 0, 0, 0];
      for (let c = 0; c < 3; c++) {
        e[c] += A.rgb[i + c] * w;
        e[3 + c] += B.rgb[i + c] * w;
      }
      e[6] += w;
      acc.set(key, e);
    }
  }
  return [...acc.values()].map((e) => ({ x: [e[0] / e[6], e[1] / e[6], e[2] / e[6]], y: [e[3] / e[6], e[4] / e[6], e[5] / e[6]], w: e[6] }));
}

const grid = (n) => {
  const g = [];
  for (let b = 0; b < n; b++) for (let gg = 0; gg < n; gg++) for (let r = 0; r < n; r++) g.push([r / (n - 1), gg / (n - 1), b / (n - 1)]);
  return g;
};

// ---------- Parametervektor ↔ LookSpec ----------
const NC = CURVE_X.length, NH = 12;
function layoutOf(mono) {
  if (mono) return mono === 'tint' ? [['bw', 2], ['curve0', NC], ['tint', 4]] : [['bw', 2], ['curve0', NC]];
  return [['mat', 6], ['curve0', NC], ['curve1', NC], ['curve2', NC], ['glob', 4], ['hueSat', NH], ['hueShift', NH], ['hueLight', NH]];
}
function toSpec(p, mono) {
  let i = 0;
  const take = (n) => Array.from(p.slice(i, (i += n)));
  if (mono) {
    const [wr, wb] = take(2);
    const spec = { bw: [wr, 1 - wr - wb, wb], curves: [take(NC)] };
    if (mono === 'tint') {
      spec.tint = take(2);
      spec.tintWhite = take(2);
    }
    return spec;
  }
  const m = take(6);
  const spec = { matrix: [1 - m[0] - m[1], m[0], m[1], m[2], 1 - m[2] - m[3], m[3], m[4], m[5], 1 - m[4] - m[5]] };
  spec.curves = [take(NC), take(NC), take(NC)];
  [spec.saturation, spec.chromaKnee, spec.shadowSat, spec.highlightSat] = take(4);
  spec.hueSat = take(NH);
  spec.hueShift = take(NH);
  spec.hueLight = take(NH);
  return spec;
}
function fromSpec(s, mono) {
  if (mono) return [s.bw[0] / (s.bw[0] + s.bw[1] + s.bw[2]), s.bw[2] / (s.bw[0] + s.bw[1] + s.bw[2]), ...s.curves[0], ...(mono === 'tint' ? [...(s.tint ?? [0, 0]), ...(s.tintWhite ?? s.tint ?? [0, 0])] : [])];
  const M = s.matrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const c = s.curves ?? [CURVE_X, CURVE_X, CURVE_X];
  return [M[1], M[2], M[3], M[5], M[6], M[7], ...c[0], ...(c[1] ?? c[0]), ...(c[2] ?? c[0]),
    s.saturation ?? 1, s.chromaKnee ?? 0, s.shadowSat ?? 1, s.highlightSat ?? 1,
    ...(s.hueSat ?? Array(NH).fill(1)), ...(s.hueShift ?? Array(NH).fill(0)), ...(s.hueLight ?? Array(NH).fill(0))];
}
function stepsOf(mono) {
  const st = [];
  for (const [name, n] of layoutOf(mono)) for (let k = 0; k < n; k++) st.push(name === 'hueShift' ? 0.05 : 1e-3);
  return st;
}

/** Glättungs- und Vorwissens-Residuen (klein gegen die Bildfehler). */
function regularize(p, mono, prior, out) {
  let i = 0;
  for (const [name, n] of layoutOf(mono)) {
    const v = p.slice(i, i + n);
    if (name.startsWith('curve')) for (let k = 1; k < n; k++) out.push(10 * Math.min(0, v[k] - v[k - 1]));
    // Leica: Schwarz nicht unter 0 ziehen (die Nachtszenen liefern sonst eine fallende Grauachse ganz unten).
    if (LEICA && name.startsWith('curve')) out.push(10 * Math.min(0, v[0]));
    const lam = { hueSat: 0.6, hueShift: 0.02, hueLight: 4 }[name];
    if (lam) for (let k = 0; k < n; k++) out.push(lam * (v[(k + n - 1) % n] - 2 * v[k] + v[(k + 1) % n]));
    if (name === 'mat') for (const x of v) out.push(0.5 * x);
    if (prior) for (let k = 0; k < n; k++) out.push((name.startsWith('curve') || name === 'glob' ? 0.5 : name === 'hueShift' ? 0.05 : 4) * (v[k] - prior[i + k]));
    i += n;
  }
}

function residuals(p, mono, S, prior) {
  const fn = compileLook(toSpec(p, mono));
  const o = [0, 0, 0], lab = [0, 0, 0], parts = [0, 0, 0];
  const r = [];
  for (let s = 0; s < S.n; s++) {
    fn(S.x[s * 3], S.x[s * 3 + 1], S.x[s * 3 + 2], o);
    toLab(o[0], o[1], o[2], lab);
    dE2000(S.lab[s * 3], S.lab[s * 3 + 1], S.lab[s * 3 + 2], lab[0], lab[1], lab[2], parts);
    const w = S.sw[s];
    r.push(parts[0] * w, parts[1] * w, parts[2] * w);
  }
  regularize(p, mono, prior, r);
  return Float64Array.from(r);
}

/** Levenberg–Marquardt; minimiert die Quadratsumme der Residuen. */
function levenberg(f, p0, steps, iters, log) {
  let p = Float64Array.from(p0), r = f(p), cost = r.reduce((s, v) => s + v * v, 0), lam = 1e-3;
  const P = p.length;
  for (let it = 0; it < iters; it++) {
    const J = [];
    for (let j = 0; j < P; j++) {
      const q = Float64Array.from(p);
      q[j] += steps[j];
      const rj = f(q);
      const col = new Float64Array(r.length);
      for (let k = 0; k < r.length; k++) col[k] = (rj[k] - r[k]) / steps[j];
      J.push(col);
    }
    const A = Array.from({ length: P }, () => new Float64Array(P)), g = new Float64Array(P);
    for (let a = 0; a < P; a++) {
      for (let b = a; b < P; b++) {
        let s = 0;
        for (let k = 0; k < r.length; k++) s += J[a][k] * J[b][k];
        A[a][b] = A[b][a] = s;
      }
      let s = 0;
      for (let k = 0; k < r.length; k++) s += J[a][k] * r[k];
      g[a] = s;
    }
    let improved = false;
    for (let tries = 0; tries < 8 && !improved; tries++) {
      const M = A.map((row, a) => Float64Array.from(row, (v, b) => (a === b ? v * (1 + lam) + 1e-12 : v)));
      const d = solve(M, g.map((v) => -v));
      const q = p.map((v, j) => v + d[j]);
      const rq = f(q), cq = rq.reduce((s, v) => s + v * v, 0);
      if (cq < cost) {
        p = q;
        r = rq;
        const rel = (cost - cq) / cost;
        cost = cq;
        lam = Math.max(1e-7, lam / 3);
        improved = true;
        if (rel < 1e-5) it = iters;
      } else lam *= 4;
    }
    log?.(it, cost);
    if (!improved) break;
  }
  return p;
}

function solve(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[piv][c])) piv = i;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let i = c + 1; i < n; i++) {
      const f = M[i][c] / M[c][c];
      for (let k = c; k <= n; k++) M[i][k] -= f * M[c][k];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k];
    x[i] = s / M[i][i];
  }
  return x;
}

function packSamples(list) {
  const n = list.length, x = new Float64Array(n * 3), lab = new Float64Array(n * 3), sw = new Float64Array(n), l = [0, 0, 0];
  list.forEach((s, i) => {
    x.set(s.x, i * 3);
    toLab(s.y[0], s.y[1], s.y[2], l);
    lab.set(l, i * 3);
    sw[i] = Math.sqrt(s.w);
  });
  return { n, x, lab, sw };
}

// ---------- Auswertung ----------
function lutDE(lut, ref, samples) {
  const a = [0, 0, 0], b = [0, 0, 0], la = [0, 0, 0], lb = [0, 0, 0];
  let s = 0, ws = 0;
  for (const [r, g, bb, w] of samples) {
    sampleLut(lut, r, g, bb, a);
    sampleLut(ref, r, g, bb, b);
    toLab(b[0], b[1], b[2], lb);
    toLab(a[0], a[1], a[2], la);
    s += w * dE2000(lb[0], lb[1], lb[2], la[0], la[1], la[2]);
    ws += w;
  }
  return s / ws;
}
const fmt = (v) => v.toFixed(2);

async function main() {
  const all = existsSync(FIT_FILE) ? { ...(await import(`../${FIT_FILE}`)).FIT } : {};
  const fitted = args.includes('--fresh') ? {} : { ...all };
  const nat = await naturalSamples();
  const uni = grid(9).map(([r, g, b]) => [r, g, b, 1 / 729]);
  const grid33 = grid(33).map(([r, g, b]) => [r, g, b, 1]);
  console.log(`${nat.length} natürliche Stichproben`);
  const rows = [];
  for (const id of selected) {
    const t = TARGETS[id];
    const mono = t.mono ?? false;
    const ref = t.cube ? parseCube(readFileSync(t.cube, 'utf8')) : null;
    let list = [];
    if (ref) {
      const o = [0, 0, 0];
      const add = (src, share) => {
        for (const [r, g, b, w] of src) list.push({ x: [r, g, b], y: [...sampleLut(ref, r, g, b, o)], w: w * share });
      };
      add(nat, 1 - UNIFORM);
      add(uni, UNIFORM);
    }
    if (t.fitPairs) list = list.concat(await pairSamples(t.pairs));
    const leicaP = t.leica ? await leicaPairs(t.leica) : null;
    if (leicaP) list = list.concat(pairsToSamples(leicaP));
    const S = packSamples(list);
    const neutral = fromSpec(mono ? { bw: [0.2126, 0.7152, 0.0722], curves: [CURVE_X] } : {}, mono);
    const prior = t.prior === 'neutral' ? neutral : t.prior ? fromSpec(all[t.prior] ?? fitted[t.prior], mono) : null;
    const start = fitted[id] ? fromSpec(fitted[id], mono) : prior ?? neutral;
    const t0 = Date.now();
    const p = levenberg((q) => residuals(q, mono, S, prior), start, stepsOf(mono), ITERS, (it, c) => process.stdout.write(`\r${id}: Schritt ${it + 1}, Kosten ${c.toFixed(4)}   `));
    const spec = round(toSpec(p, mono));
    all[id] = spec;
    const lut = buildLut(spec, 33);
    const row = { look: id, sek: Math.round((Date.now() - t0) / 1000) };
    if (ref) {
      row['ΔE natürlich'] = fmt(lutDE(lut, ref, nat));
      row['ΔE Gitter'] = fmt(lutDE(lut, ref, grid33));
      row['ohne Look'] = fmt(lutDE({ size: 2, data: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1]) }, ref, nat));
    }
    for (const c of t.check ?? []) row['ΔE abpy'] = fmt(lutDE(lut, parseCube(readFileSync(c, 'utf8')), nat));
    if (t.pairs) {
      const res = [];
      for (const [a, b] of t.pairs) {
        const A = shrink(await readImage(a), 300), B = shrink(await readImage(b), 300);
        const o = [0, 0, 0];
        const ours = imageDE(mapImage(A, (r, g, bb, out) => Object.assign(out, sampleLut(lut, r, g, bb, o))), B);
        const viaRef = ref ? imageDE(mapImage(A, (r, g, bb, out) => Object.assign(out, sampleLut(ref, r, g, bb, o))), B) : NaN;
        res.push(`${fmt(imageDE(A, B))}→${fmt(ours)}${ref ? ` (Ref ${fmt(viaRef)})` : ''}`);
      }
      row['Paare: Provia→unser'] = res.join(' | ');
    }
    if (leicaP) {
      // ΔE2000 je Bildpaar über gültige Pixel: Standard gegen Look, dann unser Look auf Standard gegen Look.
      const o = [0, 0, 0], p = [0, 0, 0], q = [0, 0, 0];
      const res = leicaP.map((P) => {
        let before = 0, after = 0, n = 0;
        for (let i = 0; i < P.mask.length; i++) {
          if (!P.mask[i]) continue;
          const [r, g, b] = P.std.subarray(i * 3, i * 3 + 3);
          toLab(...P.look.subarray(i * 3, i * 3 + 3), q);
          before += dE2000(...q, ...toLab(r, g, b, p));
          sampleLut(lut, r, g, b, o);
          after += dE2000(...q, ...toLab(o[0], o[1], o[2], p));
          n++;
        }
        return `${fmt(before / n)}→${fmt(after / n)}`;
      });
      row['Paare: Standard→unser'] = res.join(' | ');
    }
    rows.push(row);
    process.stdout.write('\n');
  }
  console.table(rows);
  writeFileSync(`${OUT}/ergebnis.json`, JSON.stringify(rows, null, 1));
  if (args.includes('--write')) writeFit(all);
}

function round(spec) {
  // saturation und hueSat sind gemeinsam nur bis auf einen Faktor bestimmt: Mittel von hueSat = 1.
  if (spec.hueSat) {
    const m = spec.hueSat.reduce((a, b) => a + b, 0) / spec.hueSat.length;
    spec.hueSat = spec.hueSat.map((v) => v / m);
    spec.saturation *= m;
  }
  const r = (v) => (Array.isArray(v) ? v.map(r) : typeof v === 'number' ? +v.toFixed(4) : v);
  return Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, r(v)]));
}

function writeFit(all) {
  const body = Object.entries(all)
    .map(([id, s]) => `  '${id}': {\n${Object.entries(s).map(([k, v]) => `    ${k}: ${JSON.stringify(v).replace(/,/g, ', ')},`).join('\n')}\n  },`)
    .join('\n');
  writeFileSync(
    FIT_FILE,
    `// Erzeugt von scripts/looks-fit.mjs${LEICA ? ' --leica' : ''} – nicht von Hand ändern.\n` +
      `// Eigene Modellparameter (Tonkurven, Mischung, Farbtonkorrekturen), abgestimmt gegen lokale Messungen.\n` +
      `import type { LookSpec } from './model';\n\nexport const FIT: Record<string, LookSpec> = {\n${body}\n};\n`,
  );
  console.log(`geschrieben: ${FIT_FILE}`);
}

await main();
