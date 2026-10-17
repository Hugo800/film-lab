import { describe, expect, it } from 'vitest';
import { entzerren, faktor, leseObjektivkorrektur, objektivAbbildung, quellpunkt, streifen, type Abbildung, type Objektivkorrektur } from './objektiv';

// Werte aus einer a6000-ARW mit E PZ 16-50 bei 16 mm (DSC04866): erster Wert = Anzahl, bei 0x7035 = 2 × Anzahl.
const VERZ_16MM = [11, 72, -7, -129, -266, -453, -654, -898, -1143, -1409, -1667, -1941, 0, 0, 0, 0, 0];
const CA_16MM = [22, 128, 128, 128, 256, 256, 512, 640, 896, 1280, 1664, 1920, 1664, 1408, 1280, 1152, 896, 640, 384, 128, -128, -384, -1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Minimales TIFF wie eine Sony-ARW: IFD0 mit SubIFD-Zeiger (0x14a), dort die Korrektur-Tags als int16. */
function arw(tags: Record<number, number[]>, { le = true, typ = 8 }: { le?: boolean; typ?: number } = {}): Uint8Array {
  const list = Object.entries(tags).map(([t, v]) => [Number(t), v] as const).sort((a, b) => a[0] - b[0]);
  const sub = 26;
  const daten = sub + 2 + list.length * 12 + 4;
  const groesse = daten + list.reduce((s, [, v]) => s + (v.length > 2 ? v.length * 2 : 0), 0);
  const b = new Uint8Array(groesse);
  const v = new DataView(b.buffer);
  b.set(le ? [0x49, 0x49] : [0x4d, 0x4d]);
  v.setUint16(2, 42, le);
  v.setUint32(4, 8, le);
  v.setUint16(8, 1, le);
  v.setUint16(10, 0x14a, le);
  v.setUint16(12, 4, le);
  v.setUint32(14, 1, le);
  v.setUint32(18, sub, le);
  v.setUint32(22, 0, le);
  v.setUint16(sub, list.length, le);
  let frei = daten;
  list.forEach(([tag, werte], i) => {
    const e = sub + 2 + i * 12;
    v.setUint16(e, tag, le);
    v.setUint16(e + 2, typ, le);
    v.setUint32(e + 4, werte.length, le);
    const at = werte.length > 2 ? frei : e + 8;
    if (werte.length > 2) {
      v.setUint32(e + 8, frei, le);
      frei += werte.length * 2;
    }
    werte.forEach((x, k) => v.setInt16(at + 2 * k, x, le));
  });
  return b;
}

const voll = (extra: Record<number, number[]> = {}) => arw({ 0x7034: [1], 0x7035: CA_16MM, 0x7036: [17], 0x7037: VERZ_16MM, ...extra });

describe('leseObjektivkorrektur', () => {
  it('liest Verzeichnung und Farbsäume (Faktoren 1 + v/2^14 bzw. 1 + v/2^21)', () => {
    const k = leseObjektivkorrektur(voll())!;
    expect(k.verzeichnung).toHaveLength(11);
    expect(k.verzeichnung![0]).toBe(1 + 72 / 16384);
    expect(k.verzeichnung![10]).toBe(1 - 1941 / 16384);
    expect(k.farbsaum!.rot).toHaveLength(11);
    expect(k.farbsaum!.rot[10]).toBe(1 + 1920 / 2 ** 21);
    expect(k.farbsaum!.blau[0]).toBe(1 + 1664 / 2 ** 21);
    expect(k.farbsaum!.blau[10]).toBe(1 - 1024 / 2 ** 21);
  });

  it('Big-Endian und Typ SHORT werden ebenso gelesen', () => {
    const a = leseObjektivkorrektur(voll());
    expect(leseObjektivkorrektur(arw({ 0x7035: CA_16MM, 0x7037: VERZ_16MM }, { le: false }))).toEqual(a);
    expect(leseObjektivkorrektur(arw({ 0x7035: CA_16MM, 0x7037: VERZ_16MM }, { typ: 3 }))).toEqual(a);
  });

  it('in der Kamera ausgeschaltet (0) oder ohne Daten (255): diese Korrektur entfällt', () => {
    expect(leseObjektivkorrektur(voll({ 0x7036: [0] }))).toEqual({ farbsaum: expect.any(Object) });
    expect(leseObjektivkorrektur(voll({ 0x7034: [0] }))).toEqual({ verzeichnung: expect.any(Array) });
    expect(leseObjektivkorrektur(voll({ 0x7036: [255], 0x7034: [255] }))).toBeNull();
    // Schalter fehlt: wie „Auto“.
    expect(leseObjektivkorrektur(arw({ 0x7037: VERZ_16MM }))?.verzeichnung).toHaveLength(11);
  });

  it('fehlende Tags, kein TIFF, leere Datei: null', () => {
    expect(leseObjektivkorrektur(arw({}))).toBeNull();
    expect(leseObjektivkorrektur(arw({ 0x7032: [11, 0, 0, 192, 512, 1024, 1600, 2368, 3328, 4864, 7296, 10816] }))).toBeNull();
    expect(leseObjektivkorrektur(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]))).toBeNull();
    expect(leseObjektivkorrektur(new Uint8Array(0))).toBeNull();
  });

  it('kaputte Tags: unbrauchbare Teile entfallen, ohne Ausnahme', () => {
    // Anzahl größer als die Werte, Anzahl unsinnig, ungerade Farbsaum-Anzahl, Faktor außerhalb 0,5 … 1,5, alles 0
    expect(leseObjektivkorrektur(voll({ 0x7037: [11, 1, 2, 3] }))?.verzeichnung).toBeUndefined();
    expect(leseObjektivkorrektur(voll({ 0x7037: [40, ...VERZ_16MM.slice(1)] }))?.verzeichnung).toBeUndefined();
    expect(leseObjektivkorrektur(voll({ 0x7037: [1, 5, 0] }))?.verzeichnung).toBeUndefined();
    expect(leseObjektivkorrektur(voll({ 0x7037: [3, 0, -9000, 0] }))?.verzeichnung).toBeUndefined();
    expect(leseObjektivkorrektur(voll({ 0x7035: [21, ...CA_16MM.slice(1)] }))?.farbsaum).toBeUndefined();
    expect(leseObjektivkorrektur(voll({ 0x7035: [22, 1, 2] }))?.farbsaum).toBeUndefined();
    expect(leseObjektivkorrektur(arw({ 0x7037: [11, ...new Array(11).fill(0)], 0x7035: [22, ...new Array(22).fill(0)] }))).toBeNull();
  });

  it('abgeschnittene Datei und Verweise ins Leere: null bzw. kein Absturz', () => {
    const b = voll();
    expect(leseObjektivkorrektur(b.subarray(0, 60))).toBeNull();
    const v = new DataView(b.buffer);
    v.setUint32(18, 0x7fffffff, true); // SubIFD-Zeiger hinter das Dateiende
    expect(leseObjektivkorrektur(b)).toBeNull();
    // Zyklus: IFD0 zeigt als Folge-IFD auf sich selbst
    const c = voll();
    new DataView(c.buffer).setUint32(22, 8, true);
    expect(leseObjektivkorrektur(c)?.verzeichnung).toHaveLength(11);
  });
});

describe('objektivAbbildung', () => {
  const k = leseObjektivkorrektur(voll())!;
  const W = 6000;
  const H = 4000;
  const abb = objektivAbbildung(k, W, H);

  it('Faktor: Stützstellen gleichmäßig bis zur halben Diagonale, dazwischen linear, dahinter konstant', () => {
    expect(faktor(k, 1, 0)).toBe(k.verzeichnung![0]);
    expect(faktor(k, 1, 0.05)).toBeCloseTo((k.verzeichnung![0] + k.verzeichnung![1]) / 2, 12);
    expect(faktor(k, 1, 1)).toBe(k.verzeichnung![10]);
    expect(faktor(k, 1, 1.3)).toBe(k.verzeichnung![10]);
    expect(faktor(k, 0, 1)).toBeCloseTo(k.verzeichnung![10] * k.farbsaum!.rot[10], 12);
    expect(faktor(k, 2, 1)).toBeCloseTo(k.verzeichnung![10] * k.farbsaum!.blau[10], 12);
  });

  it('Bildmitte bleibt fest (alle Kanäle)', () => {
    for (const kanal of [0, 1, 2]) {
      const [x, y] = quellpunkt(abb, kanal, W / 2, H / 2);
      expect(x).toBeCloseTo(W / 2, 9);
      expect(y).toBeCloseTo(H / 2, 9);
    }
  });

  it('monoton: weiter außen in der Ausgabe heißt weiter außen in der Quelle', () => {
    for (const [dx, dy] of [[1, 0], [0, 1], [3, 2], [-1, 0.3]]) {
      for (const kanal of [0, 1, 2]) {
        let vorher = -1;
        for (let t = 0; t <= 1; t += 0.001) {
          const [x, y] = quellpunkt(abb, kanal, W / 2 + (t * dx * W) / 2, H / 2 + (t * dy * H) / 2);
          const r = Math.hypot(x - W / 2, y - H / 2);
          expect(r).toBeGreaterThan(vorher);
          vorher = r;
        }
      }
    }
  });

  it('Maßstab füllt den Rahmen: alle Randpunkte in der Quelle, ein wenig größer nicht mehr', () => {
    expect(abb.massstab).toBeGreaterThan(1.045);
    expect(abb.massstab).toBeLessThan(1.06);
    const rand = (a: Abbildung) => {
      let innen = true;
      for (let u = 0; u <= 1; u += 1 / 500)
        for (const [x, y] of [[u * W, 0], [u * W, H], [0, u * H], [W, u * H]])
          for (const kanal of [0, 1, 2]) {
            const [sx, sy] = quellpunkt(a, kanal, x, y);
            if (sx < 0 || sx > W || sy < 0 || sy > H) innen = false;
          }
      return innen;
    };
    expect(rand(abb)).toBe(true);
    expect(rand({ ...abb, massstab: abb.massstab * 1.001 })).toBe(false);
  });

  it('Hochformat: gleicher Maßstab, nur Farbsäume: fast 1', () => {
    expect(objektivAbbildung(k, H, W).massstab).toBeCloseTo(abb.massstab, 6);
    const nurCa = objektivAbbildung({ farbsaum: k.farbsaum }, W, H).massstab;
    expect(Math.abs(nurCa - 1)).toBeLessThan(0.002);
  });
});

/** Glattes Testbild (RGB): Wellen in jedem Kanal verschieden. */
function testbild(w: number, h: number, kanaele = 3): Uint8Array {
  const b = new Uint8Array(w * h * kanaele);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) b[(y * w + x) * kanaele + c] = Math.round(128 + 100 * Math.sin(x / (9 + 3 * c)) * Math.cos(y / (11 + c)));
  return b;
}

describe('entzerren', () => {
  it('Abbildung 1:1 gibt jedes Pixel unverändert zurück (auch dunkle Werte)', () => {
    const w = 256;
    const h = 3;
    const rgb = Uint8Array.from({ length: w * h * 3 }, (_, i) => Math.floor(i / 3) % 256);
    const abb: Abbildung = { breite: w, hoehe: h, korrektur: {}, massstab: 1, drehen: 0 };
    const out = entzerren({ data: rgb, breite: w, hoehe: h, kanaele: 3 }, { left: 0, top: 0, width: w, height: h }, abb);
    for (let i = 0; i < w * h; i++) {
      expect([out[i * 4], out[i * 4 + 1], out[i * 4 + 2], out[i * 4 + 3]]).toEqual([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255]);
    }
  });

  // Stark überzeichnete Korrektur, damit die Wirkung auf einem kleinen Bild messbar ist.
  const stark: Objektivkorrektur = {
    verzeichnung: [1, 0.98, 0.94, 0.88, 0.8],
    farbsaum: { rot: [1, 1.003, 1.006, 1.01, 1.015], blau: [1, 0.997, 0.994, 0.99, 0.985] },
  };
  const W = 240;
  const H = 160;
  const rand = 6;
  const quelle = { data: testbild(W + 2 * rand, H + 2 * rand), breite: W + 2 * rand, hoehe: H + 2 * rand, kanaele: 3 };
  const flaeche = { left: rand, top: rand, width: W, height: H };
  const abb = objektivAbbildung(stark, W, H);
  const ganz = entzerren(quelle, flaeche, abb);

  it('jeder Kanal holt seinen Wert aus seinem eigenen Quellpunkt (Rot und Blau getrennt)', () => {
    // Unabhängige Referenz: bilinear an quellpunkt(); auf dem glatten Bild bis auf wenige Stufen gleich.
    const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    const enc = (l: number) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
    const px = (x: number, y: number, c: number) => lin(quelle.data[(y * quelle.breite + x) * 3 + c]);
    let max = 0;
    let rotGleichGruen = 0;
    for (let y = 2; y < H; y += 7)
      for (let x = 2; x < W; x += 5)
        for (const c of [0, 1, 2]) {
          const [sx, sy] = quellpunkt(abb, c, x + 0.5, y + 0.5);
          const qx = sx + rand - 0.5;
          const qy = sy + rand - 0.5;
          const x0 = Math.floor(qx);
          const y0 = Math.floor(qy);
          const fx = qx - x0;
          const fy = qy - y0;
          const l = (px(x0, y0, c) * (1 - fx) + px(x0 + 1, y0, c) * fx) * (1 - fy) + (px(x0, y0 + 1, c) * (1 - fx) + px(x0 + 1, y0 + 1, c) * fx) * fy;
          max = Math.max(max, Math.abs(ganz[(y * W + x) * 4 + c] - enc(l)));
          if (c === 0) rotGleichGruen += +(quellpunkt(abb, 0, x + 0.5, y + 0.5)[0] === quellpunkt(abb, 1, x + 0.5, y + 0.5)[0]);
        }
    expect(max).toBeLessThan(4);
    expect(rotGleichGruen).toBeLessThan(5); // nur nahe der Mitte fallen die Punkte zusammen
  });

  it('in Streifen gerechnet bitgleich zum ganzen Bild, mit nur den geplanten Quellzeilen', () => {
    for (const teile of [2, 3, 5]) {
      const plan = streifen(abb, flaeche, quelle.hoehe, teile);
      expect(plan.map((p) => p.zeilen)).toEqual(plan.map((_, i) => [Math.round((i * H) / teile), Math.round(((i + 1) * H) / teile)]));
      for (const p of plan) {
        const [q0, q1] = p.quelle;
        const zeile = quelle.breite * 3;
        const teil = entzerren({ ...quelle, data: quelle.data.slice(q0 * zeile, q1 * zeile), ab: q0 }, flaeche, abb, p.zeilen);
        expect(teil).toEqual(ganz.subarray(p.zeilen[0] * W * 4, p.zeilen[1] * W * 4));
      }
    }
  });

  it('RGBA-Quelle (4 Kanäle) liefert dasselbe wie RGB', () => {
    const rgba = new Uint8Array((quelle.data.length / 3) * 4);
    for (let i = 0; i < quelle.data.length / 3; i++) rgba.set([...quelle.data.subarray(i * 3, i * 3 + 3), 255], i * 4);
    expect(entzerren({ ...quelle, data: rgba, kanaele: 4 }, flaeche, abb)).toEqual(ganz);
  });

  it('Fläche muss zur Abbildung passen', () => {
    expect(() => entzerren(quelle, { ...flaeche, width: W - 1 }, abb)).toThrow();
  });
});
