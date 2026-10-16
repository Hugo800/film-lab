// Passt die Konstanten von Color Chrome und FX Blau (src/engine/shaders.ts, colorChrome) an Kamerapaare an:
//   TEST_PORT=5187 node scripts/abgleich-cc-fit.mjs
// Paare „aus“/„stark“: Alik Griffin (GFX100 II, In-Kamera, nur der Effekt geändert) und Fujifilms Learning
// Centre. Fujis Paare enthalten zusätzlich eine globale Änderung (auch neutrale Pixel werden dunkler und
// satter); die wird als Störgröße mitgeschätzt (L- und Chroma-Faktor), damit nur der Effekt in die Konstanten geht.
// Rechnet das Shader-Modell in JS nach (OKLab wie im Shader); Ergebnis nur als Zahlen auf der Konsole.
import { launch, startDevServer } from './lib/browser.mjs';

const R = 'testbilder/referenz';
const F = `${R}/fujifilm-offiziell-effekte`, G = `${R}/alikgriffin/AGriffin_GFX100II_45_RealaAce_Kalina_JPG`;
const PAIRS = {
  cc: [[`${G}_Standard-L.jpg`, `${G}_CC_S-L.jpg`, false], [`${F}/colorchrome-aus.jpg`, `${F}/colorchrome-strong.jpg`, true]],
  blau: [[`${G}_Standard-L.jpg`, `${G}_CChB_S-L.jpg`, false], [`${F}/colorchrome-fxblue-aus.jpg`, `${F}/colorchrome-fxblue-strong.jpg`, true]],
};

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function oklab(r, g, b) {
  const R = lin(r / 255), G = lin(g / 255), B = lin(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

// Shader-Modell bei Stufe „stark“ (0,5 · 2 = 1). p: Parameter, welcher Effekt: 'cc' | 'blau'.
const D = Math.PI / 180;
function model(lab, p, which) {
  const C = Math.hypot(lab[1], lab[2]);
  if (C < 1e-5) return lab;
  const h = Math.atan2(lab[2], lab[1]);
  let fL = 1, fC = 1;
  if (which === 'cc') {
    const cc = p.k * (1 - Math.exp(-C / p.c0)) * (p.base + (1 - p.base) * Math.min(1, Math.max(0, 1.3 * Math.cos(h - p.h0 * D))));
    fL = 1 - cc;
    fC = 1 + p.kc * cc;
  } else {
    const dh = ((h - p.h0 * D + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    const cb = Math.abs(dh) < Math.PI / 2 ? p.k * (1 - Math.exp(-C / p.c0)) * Math.max(Math.cos(p.wid * dh), 0) : 0;
    fL = 1 - cb;
    fC = 1 + p.kc * cb;
  }
  return [lab[0] * fL, lab[1] * fC, lab[2] * fC];
}

function cost(data, p, which) {
  let s = 0, n = 0;
  for (const d of data) {
    const gL = d.nuisance ? p.gL : 1, gC = d.nuisance ? p.gC : 1;
    for (let i = 0; i < d.off.length; i++) {
      const q = model(d.off[i], p, which), t = d.on[i];
      const w = 1 + Math.hypot(t[1], t[2]) / 0.05; // gesättigte Pixel zählen mehr
      s += w * ((q[0] * gL - t[0]) ** 2 + (q[1] * gC - t[1]) ** 2 + (q[2] * gC - t[2]) ** 2);
      n += w;
    }
  }
  return s / n;
}

// Nelder-Mead über die Schlüssel in keys.
function fit(f, p0, keys, iters = 600) {
  const vec = (x) => ({ ...p0, ...Object.fromEntries(keys.map((k, i) => [k, x[i]])) });
  let S = [keys.map((k) => p0[k])];
  for (let i = 0; i < keys.length; i++) {
    const x = [...S[0]];
    x[i] = x[i] === 0 ? 0.05 : x[i] * 1.2;
    S.push(x);
  }
  let F = S.map((x) => f(vec(x)));
  for (let it = 0; it < iters; it++) {
    const o = F.map((v, i) => i).sort((a, b) => F[a] - F[b]);
    S = o.map((i) => S[i]); F = o.map((i) => F[i]);
    const c = keys.map((_, j) => S.slice(0, -1).reduce((a, x) => a + x[j], 0) / keys.length);
    const pt = (t) => c.map((v, j) => v + t * (S.at(-1)[j] - v));
    const xr = pt(-1), fr = f(vec(xr));
    if (fr < F[0]) { const xe = pt(-2), fe = f(vec(xe)); [S[S.length - 1], F[F.length - 1]] = fe < fr ? [xe, fe] : [xr, fr]; }
    else if (fr < F.at(-2)) { S[S.length - 1] = xr; F[F.length - 1] = fr; }
    else {
      const xc = pt(0.5), fc = f(vec(xc));
      if (fc < F.at(-1)) { S[S.length - 1] = xc; F[F.length - 1] = fc; }
      else for (let i = 1; i < S.length; i++) { S[i] = S[i].map((v, j) => S[0][j] + 0.5 * (v - S[0][j])); F[i] = f(vec(S[i])); }
    }
  }
  return { p: vec(S[0]), cost: F[0] };
}

const server = await startDevServer();
const { browser, page } = await launch({ log: false });
const A = (fn, ...args) => page.evaluate((fn, args) => window.A[fn](...args), fn, args);
try {
  await page.goto(`${server.url}/scripts/abgleich-seite.html`);
  await page.waitForFunction('window.ready === true', { timeout: 120_000 });
  const get = async (key) => {
    const { b64 } = await A('pixels', key);
    const b = Buffer.from(b64, 'base64'), out = [];
    for (let i = 0; i < b.length; i += 4) out.push(oklab(b[i], b[i + 1], b[i + 2]));
    return out;
  };
  // Startwerte = aktuelle Shader-Konstanten.
  const START = {
    cc: { k: 0.075, c0: 0.06, base: 0.15, h0: 70, kc: 1.8, gL: 1, gC: 1 },
    blau: { k: 0.165, c0: 0.05, h0: 240, wid: 1.8, kc: 0.3, gL: 1, gC: 1 },
  };
  for (const which of ['cc', 'blau']) {
    const data = [];
    for (const [off, on, nuisance] of PAIRS[which]) {
      // 8× verkleinert: Blätter und Wellen bewegen sich zwischen den Aufnahmen.
      const { w, h } = await A('load', 'off', `/${off}`, 256);
      await A('load', 'on', `/${on}`, 0, [w, h]);
      data.push({ off: await get('off'), on: await get('on'), nuisance, name: off.split('/').pop() });
    }
    const p0 = START[which];
    const report = (p, label) => {
      const per = data.map((d) => `${d.name.slice(0, 28)} ${(Math.sqrt(cost([d], p, which)) * 100).toFixed(3)}`).join(' · ');
      console.log(`${which} ${label}: ${per}  ${JSON.stringify(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, +v.toFixed(4)])))}`);
    };
    const nuis = (p) => ({ ...p, ...fit((q) => cost(data.filter((d) => d.nuisance), q, which), p, ['gL', 'gC']).p });
    report(nuis({ ...p0, k: 0 }), 'ohne Effekt');
    report(nuis(p0), 'Start');
    // c0 fest (bei Blau läuft es sonst ins Lineare davon), Grundgewicht von Color Chrome ≥ 0 → fest 0.
    const keys = which === 'cc' ? ['k', 'h0', 'kc', 'gL', 'gC'] : ['k', 'h0', 'wid', 'kc', 'gL', 'gC'];
    for (const c0 of which === 'cc' ? [0.08, 0.16] : [0.1, 0.3]) {
      const r = fit((p) => cost(data, p, which), { ...p0, c0, base: 0 }, keys, 1500);
      report(r.p, `angepasst c0 ${c0}`);
      report({ ...r.p, k: r.p.k / 2 }, `  dieselben Konstanten „schwach“ (halb)`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
