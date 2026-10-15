// .cube-Dateien (Adobe/Resolve) lesen. Ergebnis immer mit Eingangsbereich 0..1 und Werten 0..1.
import type { Lut3D } from '../types';

export function identityLut(size: number): Lut3D {
  const data = new Float32Array(size * size * size * 3);
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const i = (r + g * size + b * size * size) * 3;
        data[i] = r / (size - 1);
        data[i + 1] = g / (size - 1);
        data[i + 2] = b / (size - 1);
      }
  return { size, data };
}

const NUM = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const SIZE_1D_TO_3D = 33;

function fail(line: number, msg: string): never {
  throw new Error(line > 0 ? `Zeile ${line}: ${msg}` : msg);
}

function nums(tokens: string[], count: number, line: number, what: string): number[] {
  if (tokens.length !== count || !tokens.every((t) => NUM.test(t)))
    fail(line, `${what} erwartet ${count} Zahl${count > 1 ? 'en' : ''}, gefunden „${tokens.join(' ')}“`);
  return tokens.map(Number);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Lineare Interpolation in einer 1D-Tabelle (Kanal ch), t in Tabellenkoordinaten. */
function sample1d(table: Float32Array, n: number, ch: number, t: number): number {
  const x = Math.min(n - 1, Math.max(0, t));
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  return table[i * 3 + ch] * (1 - f) + table[(i + 1) * 3 + ch] * f;
}

/** Trilinear in einer 3D-Tabelle, Koordinaten in Gitterpunkten. */
function sample3d(src: Float32Array, n: number, x: number, y: number, z: number, out: number[]): void {
  const cl = (v: number) => Math.min(n - 1, Math.max(0, v));
  x = cl(x);
  y = cl(y);
  z = cl(z);
  const x0 = Math.min(n - 2, Math.floor(x)), y0 = Math.min(n - 2, Math.floor(y)), z0 = Math.min(n - 2, Math.floor(z));
  const fx = x - x0, fy = y - y0, fz = z - z0;
  for (let c = 0; c < 3; c++) {
    const at = (i: number, j: number, k: number) => src[((x0 + i) + (y0 + j) * n + (z0 + k) * n * n) * 3 + c];
    const c00 = at(0, 0, 0) * (1 - fx) + at(1, 0, 0) * fx;
    const c10 = at(0, 1, 0) * (1 - fx) + at(1, 1, 0) * fx;
    const c01 = at(0, 0, 1) * (1 - fx) + at(1, 0, 1) * fx;
    const c11 = at(0, 1, 1) * (1 - fx) + at(1, 1, 1) * fx;
    out[c] = (c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz;
  }
}

/**
 * Liest eine .cube-Datei. TITLE aus der Datei hat Vorrang vor `title`.
 * 1D-LUTs werden in eine 33³-LUT umgerechnet, abweichende DOMAIN_MIN/MAX auf 0..1 umgetastet.
 */
export function parseCube(text: string, title?: string): Lut3D {
  let size3 = 0;
  let size1 = 0;
  let min = [0, 0, 0];
  let max = [1, 1, 1];
  let fileTitle: string | undefined;
  let data: Float32Array | null = null;
  let count = 0;
  let expected = 0;

  const lines = text.split(/\r\n|\r|\n/);
  for (let ln = 0; ln < lines.length; ln++) {
    const lineNo = ln + 1;
    const raw = lines[ln].trim();
    // Im Titel darf ein # stehen, sonst beginnt damit ein Kommentar.
    const hash = raw.startsWith('TITLE') ? -1 : raw.indexOf('#');
    const line = hash >= 0 ? raw.slice(0, hash).trim() : raw;
    if (!line) continue;
    const tokens = line.split(/\s+/);
    const key = tokens[0];

    if (/^[A-Z][A-Z0-9_]*$/.test(key)) {
      if (data) fail(lineNo, `Schlüsselwort ${key} nach Beginn der Daten`);
      const rest = tokens.slice(1);
      switch (key) {
        case 'TITLE': {
          const m = /^TITLE\s+"?([^"]*)"?\s*$/.exec(line);
          fileTitle = m?.[1].trim() || undefined;
          break;
        }
        case 'LUT_3D_SIZE': {
          const [n] = nums(rest, 1, lineNo, 'LUT_3D_SIZE');
          if (!Number.isInteger(n) || n < 2 || n > 65) fail(lineNo, `LUT_3D_SIZE muss eine ganze Zahl von 2 bis 65 sein, nicht ${rest[0]}`);
          size3 = n;
          break;
        }
        case 'LUT_1D_SIZE': {
          const [n] = nums(rest, 1, lineNo, 'LUT_1D_SIZE');
          if (!Number.isInteger(n) || n < 2 || n > 65536) fail(lineNo, `LUT_1D_SIZE muss eine ganze Zahl von 2 bis 65536 sein, nicht ${rest[0]}`);
          size1 = n;
          break;
        }
        case 'DOMAIN_MIN':
          min = nums(rest, 3, lineNo, 'DOMAIN_MIN');
          break;
        case 'DOMAIN_MAX':
          max = nums(rest, 3, lineNo, 'DOMAIN_MAX');
          break;
        case 'LUT_1D_INPUT_RANGE':
        case 'LUT_3D_INPUT_RANGE': {
          const [a, b] = nums(rest, 2, lineNo, key);
          min = [a, a, a];
          max = [b, b, b];
          break;
        }
        default:
          // Unbekannte Schlüsselwörter (z. B. LUT_IN_VIDEO_RANGE) überspringen wie andere Programme auch.
          break;
      }
      continue;
    }

    if (!data) {
      if (size3 && size1) fail(lineNo, 'Datei enthält LUT_1D_SIZE und LUT_3D_SIZE – kombinierte LUTs werden nicht unterstützt');
      if (!size3 && !size1) fail(lineNo, 'Daten vor LUT_3D_SIZE bzw. LUT_1D_SIZE');
      for (let c = 0; c < 3; c++)
        if (!(max[c] > min[c])) fail(0, `DOMAIN_MAX muss größer als DOMAIN_MIN sein (Kanal ${'RGB'[c]})`);
      expected = size3 ? size3 ** 3 : size1;
      data = new Float32Array(expected * 3);
    }
    if (count >= expected) fail(lineNo, `zu viele Datenzeilen, erwartet ${expected}`);
    const v = nums(tokens, 3, lineNo, 'Datenzeile');
    data[count * 3] = v[0];
    data[count * 3 + 1] = v[1];
    data[count * 3 + 2] = v[2];
    count++;
  }

  if (!size3 && !size1) fail(0, 'Keine LUT gefunden: LUT_3D_SIZE oder LUT_1D_SIZE fehlt');
  if (count < expected || !data) fail(0, `Datei unvollständig: ${expected} Datenzeilen erwartet, ${count} gefunden`);
  const name = fileTitle ?? title;
  const isUnitDomain = min.every((v) => v === 0) && max.every((v) => v === 1);

  if (size1) {
    const n = SIZE_1D_TO_3D;
    const lut = identityLut(n);
    const d = lut.data;
    for (let i = 0; i < d.length; i++) {
      const c = i % 3;
      const t = ((d[i] - min[c]) / (max[c] - min[c])) * (size1 - 1);
      d[i] = clamp01(sample1d(data, size1, c, t));
    }
    return { size: n, data: d, title: name };
  }

  if (isUnitDomain) {
    for (let i = 0; i < data.length; i++) data[i] = clamp01(data[i]);
    return { size: size3, data, title: name };
  }

  // Eingang 0..1 auf den Domain-Bereich der Datei abbilden und neu abtasten.
  const n = size3;
  const out = new Float32Array(data.length);
  const px = [0, 0, 0];
  const s = n - 1;
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++) {
        const t = [r / s, g / s, b / s].map((v, c) => ((v - min[c]) / (max[c] - min[c])) * s);
        sample3d(data, n, t[0], t[1], t[2], px);
        const i = (r + g * n + b * n * n) * 3;
        out[i] = clamp01(px[0]);
        out[i + 1] = clamp01(px[1]);
        out[i + 2] = clamp01(px[2]);
      }
  return { size: n, data: out, title: name };
}
