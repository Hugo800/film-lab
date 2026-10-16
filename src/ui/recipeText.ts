// Fuji-Rezepttext (Format wie bei Fuji X Weekly, englisch) → Look + LookParams. Reine Funktionen, ohne DOM.
// Was nicht erkannt oder nicht umsetzbar ist, landet in `skipped` und wird dem Nutzer gezeigt, nie geraten.
import type { Level, LookParams } from '../types';
import { fmtSigned } from './format';

/** Das Nötigste eines Looks, um den Filmnamen eines Rezepts zuzuordnen. */
export interface RecipeLookRef {
  id: string;
  name: string;
  category: string;
}

export interface ParsedRecipe {
  /** Titel, falls der Text mit einer Zeile ohne Doppelpunkt beginnt. */
  title?: string;
  /** Filmsimulation, wie im Text geschrieben („Classic Chrome“). */
  film?: string;
  /** Farbfilter bei Acros/Monochrom (Ye, R, G), wird nicht umgesetzt. */
  filmFilter?: string;
  params: Partial<LookParams>;
  /** Was gesetzt wird, für die Anzeige. */
  applied: { label: string; value: string }[];
  /** Nicht übernommen: Zeile samt Grund. */
  skipped: { line: string; reason: string }[];
}

export const RECIPE_EXAMPLE = `Film Simulation: Classic Chrome
Dynamic Range: DR400
Highlight: -1
Shadow: +0.5
Color: +2
Sharpness: -2
Clarity: -2
Grain Effect: Strong, Small
Color Chrome Effect: Strong
Color Chrome FX Blue: Off
White Balance: 5500K, +2 Red & -4 Blue
Exposure Compensation: +1/3 to +1`;

const MINUS = /[−‒–—]/g;

// „+ 0“ macht aus -0 eine 0 (sonst unterscheiden sich Tests und Anzeige).
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)) + 0;
const snap = (v: number, step: number) => Math.round(v / step) * step;

/** Alle Zahlen eines Werts: „+1/3 to +1“ → [0,333; 1]; „1 1/3“ → [1,333]; „-1,5“ → [-1,5]. */
export function numbersIn(value: string): number[] {
  // Gedankenstrich mit Leerzeichen trennt einen Bereich, direkt vor einer Zahl ist er ein Minus.
  const text = value.replace(/\s+(?:to|bis|[–—])\s+/gi, ' | ').replace(MINUS, '-');
  const out: number[] = [];
  const re = /([+-])?\s?(\d+(?:[.,]\d+)?)(?:\s+(\d+)\/(\d+)|\/(\d+))?/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let n = Number(m[2].replace(',', '.'));
    if (m[3] && m[4]) n += Number(m[3]) / Number(m[4]);
    else if (m[5]) n /= Number(m[5]);
    out.push(m[1] === '-' ? -n : n);
  }
  return out;
}

/** Mittel aller Zahlen im Text (bei Bereichen die Mitte), undefined ohne Zahl. */
function mean(value: string): number | undefined {
  const n = numbersIn(value);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : undefined;
}

/** Schlüssel für Namensvergleiche: klein, ohne Satzzeichen, ohne Zusätze wie „Film Simulation“. */
export function filmKey(name: string): string {
  const k = name
    .toLowerCase()
    .replace(/film\s*simulation/g, '')
    .replace(/[^a-z0-9]+/g, '');
  const alias: Record<string, string> = {
    classicnegative: 'classicneg',
    pronegativestandard: 'pronegstd',
    pronegstandard: 'pronegstd',
    pronegativehi: 'proneghi',
    pronegativehigh: 'proneghi',
    nostalgicnegative: 'nostalgicneg',
    eternacinema: 'eterna',
    proviastandard: 'provia',
    astiasoft: 'astia',
    velviavivid: 'velvia',
    standard: 'provia',
    bleachbypass: 'eternableachbypass',
  };
  return alias[k] ?? k;
}

/** Die Id des Looks zu einem Filmnamen; bei gleichem Namen gewinnt Fujifilm. */
export function findLook(film: string, looks: RecipeLookRef[]): RecipeLookRef | undefined {
  const key = filmKey(film);
  if (!key) return undefined;
  const hits = looks.filter((l) => filmKey(l.name) === key);
  return hits.find((l) => l.category === 'fujifilm') ?? hits[0];
}

/** Look zu einem Rezept: bei Acros/Monochrom mit Farbfilter der Look „… + Ye“, sonst der ohne Filter. */
export function findRecipeLook(r: Pick<ParsedRecipe, 'film' | 'filmFilter'>, looks: RecipeLookRef[]): { look?: RecipeLookRef; filterIgnored: boolean } {
  if (!r.film) return { filterIgnored: false };
  if (r.filmFilter) {
    const f = r.filmFilter.toLowerCase();
    const short = f.startsWith('y') ? 'ye' : f.startsWith('r') ? 'r' : 'g';
    const withFilter = findLook(`${r.film} ${short}`, looks);
    if (withFilter) return { look: withFilter, filterIgnored: false };
    return { look: findLook(r.film, looks), filterIgnored: true };
  }
  return { look: findLook(r.film, looks), filterIgnored: false };
}

const LEVEL_WORDS: [RegExp, Level][] = [
  [/\b(off|none|aus)\b/i, 0],
  [/\b(weak|low|schwach)\b/i, 1],
  [/\b(strong|high|stark)\b/i, 2],
];
function levelOf(value: string): Level | undefined {
  return LEVEL_WORDS.find(([re]) => re.test(value))?.[1];
}

/** Weißabgleichsnamen → Kelvin (0 = Auto). Leuchtstoff-Werte sind Schätzungen, Fuji nennt keine. */
const WB_NAMES: { re: RegExp; kelvin: number; note?: string }[] = [
  { re: /\bauto|\bawb\b|ambience|white priority/i, kelvin: 0 },
  { re: /fluorescent\s*(?:light\s*)?(?:3|iii)\b/i, kelvin: 4200, note: 'geschätzt' },
  { re: /fluorescent\s*(?:light\s*)?(?:2|ii)\b/i, kelvin: 3500, note: 'geschätzt' },
  { re: /fluorescent/i, kelvin: 6000, note: 'geschätzt' },
  { re: /daylight|tageslicht|sunny|\bsun\b/i, kelvin: 5500 },
  { re: /cloud|overcast|bew[oö]lkt/i, kelvin: 6500 },
  { re: /shade|schatten/i, kelvin: 7500 },
  { re: /tungsten|incandescent|indoor|kunstlicht|gl[uü]hlampe/i, kelvin: 3200 },
];

interface Wb {
  kelvin?: number;
  r?: number;
  b?: number;
  note?: string;
  unknownName?: boolean;
}

function parseShift(value: string): { r?: number; b?: number } {
  const v = value.replace(MINUS, '-');
  const sign = (s: string) => Number(s.replace(/^\+/, ''));
  // „+2 Red & -4 Blue“
  let r = /([+-]?\d+)\s*(?:red|r)\b/i.exec(v)?.[1];
  let b = /([+-]?\d+)\s*(?:blue|b)\b/i.exec(v)?.[1];
  // „Red +2, Blue -4“ oder „R: +2 B: -4“
  r ??= /\b(?:red|r)\s*:?\s*([+-]?\d+)/i.exec(v)?.[1];
  b ??= /\b(?:blue|b)\s*:?\s*([+-]?\d+)/i.exec(v)?.[1];
  return { r: r === undefined ? undefined : clamp(Math.round(sign(r)), -9, 9), b: b === undefined ? undefined : clamp(Math.round(sign(b)), -9, 9) };
}

function parseWb(value: string): Wb {
  const out: Wb = parseShift(value);
  const k = /(\d{4,5})\s*k\b/i.exec(value);
  if (k) {
    out.kelvin = clamp(Math.round(Number(k[1]) / 50) * 50, 2500, 10000);
    return out;
  }
  const name = WB_NAMES.find((n) => n.re.test(value));
  if (name) {
    out.kelvin = name.kelvin;
    out.note = name.note;
  } else if (out.r === undefined && out.b === undefined) out.unknownName = true;
  else if (/\w{3,}/.test(value.replace(/red|blue/gi, ''))) out.unknownName = true;
  return out;
}

type Handler = (value: string, ctx: Ctx) => void;
interface Ctx {
  set<K extends keyof LookParams>(label: string, key: K, v: LookParams[K], shown: string): void;
  skip(reason: string): never;
}

/** Wird innerhalb eines Handlers geworfen, um die Zeile als nicht übernommen zu melden. */
class Skip extends Error {}

const tone = (key: 'highlightTone' | 'shadowTone', label: string): Handler => (value, c) => {
  const m = mean(value);
  if (m === undefined) return c.skip('Wert nicht lesbar');
  const v = clamp(snap(m, 0.5), -2, 4);
  c.set(label, key, v, fmtSigned(v, Number.isInteger(v) ? 0 : 1));
};

const intOf = (key: 'color' | 'sharpness' | 'clarity', label: string, lo: number, hi: number): Handler => (value, c) => {
  const m = mean(value);
  if (m === undefined) return c.skip('Wert nicht lesbar');
  const v = clamp(Math.round(m), lo, hi);
  c.set(label, key, v, fmtSigned(v, 0));
};

const LEVEL_TEXT = ['Aus', 'Schwach', 'Stark'];
const levelOfKey = (key: 'colorChrome' | 'colorChromeBlue', label: string): Handler => (value, c) => {
  const l = levelOf(value);
  if (l === undefined) return c.skip('Aus, Weak oder Strong erwartet');
  c.set(label, key, l, LEVEL_TEXT[l]);
};

const toneCurve: Handler = (value, c) => {
  const v = value.replace(MINUS, '-');
  const h = /([+-]?\d+(?:[.,]\d+)?)\s*h\b/i.exec(v)?.[1];
  const s = /([+-]?\d+(?:[.,]\d+)?)\s*s\b/i.exec(v)?.[1];
  if (h === undefined && s === undefined) return c.skip('Format „+1H & -1S“ erwartet');
  if (h !== undefined) {
    const x = clamp(snap(Number(h.replace(',', '.')), 0.5), -2, 4);
    c.set('Lichter', 'highlightTone', x, fmtSigned(x, Number.isInteger(x) ? 0 : 1));
  }
  if (s !== undefined) {
    const x = clamp(snap(Number(s.replace(',', '.')), 0.5), -2, 4);
    c.set('Schatten', 'shadowTone', x, fmtSigned(x, Number.isInteger(x) ? 0 : 1));
  }
};

const NO_EQUIVALENT = 'hat in Film Lab keine Entsprechung';
const SHOOTING = 'Aufnahmeeinstellung, ohne Wirkung auf die Bearbeitung';

/** Kleingeschriebene Schlüssel ohne Satzzeichen → Auswertung. */
const HANDLERS: Record<string, Handler> = {
  dynamicrange: (value, c) => {
    const m = /(?<!\d)(100|200|400)(?!\d)/.exec(value);
    if (!m) return c.skip('DR100, DR200 oder DR400 erwartet (Auto gibt es hier nicht)');
    const dr = Number(m[1]) as 100 | 200 | 400;
    c.set('Dynamikbereich', 'dynamicRange', dr, `DR${dr}`);
  },
  highlight: tone('highlightTone', 'Lichter'),
  shadow: tone('shadowTone', 'Schatten'),
  tonecurve: toneCurve,
  color: intOf('color', 'Farbe', -4, 4),
  sharpness: intOf('sharpness', 'Schärfe', -4, 4),
  clarity: intOf('clarity', 'Klarheit', -5, 5),
  graineffect: (value, c) => {
    const l = levelOf(value);
    if (l === undefined) return c.skip('Off, Weak oder Strong erwartet');
    c.set('Körnung', 'grainEffect', l, LEVEL_TEXT[l]);
    if (l === 0) return;
    const size = /\b(small|klein)\b/i.test(value) ? 'klein' : /\b(large|big|gro(?:ss|ß))\b/i.test(value) ? 'gross' : undefined;
    if (size) c.set('Korngröße', 'grainSize', size, size === 'klein' ? 'Klein' : 'Groß');
  },
  colorchromeeffect: levelOfKey('colorChrome', 'Color Chrome'),
  colorchromefxblue: levelOfKey('colorChromeBlue', 'Color Chrome FX Blau'),
  monochromaticcolor: (value, c) => {
    const v = value.replace(MINUS, '-');
    const wc = /\bwc\s*:?\s*([+-]?\d+)/i.exec(v)?.[1];
    const mg = /\bmg\s*:?\s*([+-]?\d+)/i.exec(v)?.[1];
    if (wc === undefined && mg === undefined) return c.skip('Format „WC +3 & MG -1“ erwartet');
    if (wc !== undefined) {
      const x = clamp(Math.round(Number(wc)), -18, 18);
      c.set('Monochrom-Tönung warm/kalt', 'monoWarmCool', x, fmtSigned(x, 0));
    }
    if (mg !== undefined) {
      const x = clamp(Math.round(Number(mg)), -18, 18);
      c.set('Monochrom-Tönung Magenta/Grün', 'monoMagentaGreen', x, fmtSigned(x, 0));
    }
  },
  whitebalance: (value, c) => {
    const wb = parseWb(value);
    if (wb.unknownName) return c.skip('Weißabgleich nicht erkannt (Auto, Kelvin, Daylight, Shade, Fluorescent 1–3, Tungsten erwartet)');
    if (wb.kelvin !== undefined)
      c.set('Weißabgleich', 'wbKelvin', wb.kelvin, wb.kelvin === 0 ? 'Auto' : `${wb.kelvin} K${wb.note ? ` (${wb.note})` : ''}`);
    if (wb.r !== undefined) c.set('WB-Verschiebung Rot', 'wbShiftR', wb.r, fmtSigned(wb.r, 0));
    if (wb.b !== undefined) c.set('WB-Verschiebung Blau', 'wbShiftB', wb.b, fmtSigned(wb.b, 0));
  },
  whitebalanceshift: (value, c) => {
    const s = parseShift(value);
    if (s.r === undefined && s.b === undefined) return c.skip('Format „+2 Red & -4 Blue“ erwartet');
    if (s.r !== undefined) c.set('WB-Verschiebung Rot', 'wbShiftR', s.r, fmtSigned(s.r, 0));
    if (s.b !== undefined) c.set('WB-Verschiebung Blau', 'wbShiftB', s.b, fmtSigned(s.b, 0));
  },
  exposurecompensation: (value, c) => {
    const m = mean(value);
    if (m === undefined) return c.skip('Wert nicht lesbar');
    const v = clamp(Math.round(m * 100) / 100, -2, 2);
    c.set('Belichtung', 'exposure', v, `${fmtSigned(v, 2)} EV`);
  },
};

/** Schreibweisen → Schlüssel in HANDLERS. */
const KEY_ALIASES: Record<string, string> = {
  dr: 'dynamicrange',
  highlights: 'highlight',
  highlighttone: 'highlight',
  shadows: 'shadow',
  shadowtone: 'shadow',
  saturation: 'color',
  sharpening: 'sharpness',
  sharpen: 'sharpness',
  grain: 'graineffect',
  colorchrome: 'colorchromeeffect',
  colorchromeblue: 'colorchromefxblue',
  colorchromeeffectblue: 'colorchromefxblue',
  ccfxblue: 'colorchromefxblue',
  monochromecolor: 'monochromaticcolor',
  monochromatictint: 'monochromaticcolor',
  wb: 'whitebalance',
  wbshift: 'whitebalanceshift',
  exposure: 'exposurecompensation',
  expcomp: 'exposurecompensation',
  ev: 'exposurecompensation',
};

const FILM_KEYS = new Set(['filmsimulation', 'filmsim', 'simulation', 'film']);
const NO_EQUIVALENT_KEYS = new Set(['noisereduction', 'highisonr', 'highisonoisereduction', 'hisnr', 'nr', 'smoothskineffect', 'lensmodulationoptimizer', 'longexposurenr']);
const SHOOTING_KEYS = new Set(['iso', 'isorange', 'shutterspeed', 'aperture', 'focus', 'drivemode', 'filmsimulationbracketing', 'sensor', 'camera', 'lens']);

/** Zerlegt in Zeilen; „A: x / B: y“ in einer Zeile wird getrennt, „+1/3“ bleibt heil. */
function lines(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\r/g, '\n').split('\n')) {
    const line = raw.replace(/[*_`]/g, '').replace(/^\s*(?:[-–—•·▪►]|\d+[.)])\s+/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+\/\s+|\s*[|;]\s*/);
    const merged: string[] = [];
    for (const p of parts) {
      if (merged.length === 0 || /^[A-Za-zÄÖÜäöü][^:]{0,40}:/.test(p)) merged.push(p);
      else merged[merged.length - 1] += ` / ${p}`;
    }
    out.push(...merged.map((m) => m.trim()).filter(Boolean));
  }
  return out;
}

function parseFilm(value: string): { film: string; filter?: string } {
  const m = /^(acros|monochrome|mono)\s*[+\s-]\s*(ye|yellow|r|red|g|green)$/i.exec(value.trim());
  if (m) return { film: m[1], filter: m[2] };
  return { film: value.trim() };
}

export function parseRecipe(text: string): ParsedRecipe {
  const r: ParsedRecipe = { params: {}, applied: [], skipped: [] };
  let first = true;
  for (const line of lines(text)) {
    const isFirst = first;
    first = false;
    const colon = line.indexOf(':');
    const value = colon < 0 ? '' : line.slice(colon + 1).trim();
    if (colon < 0) {
      if (isFirst && line.length <= 60) r.title = line;
      else r.skipped.push({ line, reason: 'keine Einstellung erkannt' });
      continue;
    }
    if (!value) continue; // Überschrift wie „Settings:“
    const key = line
      .slice(0, colon)
      .toLowerCase()
      .replace(/colour/g, 'color')
      .replace(/[^a-z0-9]+/g, '');
    if (FILM_KEYS.has(key)) {
      const f = parseFilm(value);
      r.film = f.film;
      r.filmFilter = f.filter;
      continue;
    }
    if (NO_EQUIVALENT_KEYS.has(key)) {
      r.skipped.push({ line, reason: NO_EQUIVALENT });
      continue;
    }
    if (SHOOTING_KEYS.has(key)) {
      r.skipped.push({ line, reason: SHOOTING });
      continue;
    }
    const handler = HANDLERS[KEY_ALIASES[key] ?? key];
    if (!handler) {
      r.skipped.push({ line, reason: 'unbekannte Einstellung' });
      continue;
    }
    const ctx: Ctx = {
      set(label, k, v, shown) {
        (r.params as Record<string, unknown>)[k] = v;
        const at = r.applied.findIndex((a) => a.label === label);
        if (at >= 0) r.applied[at] = { label, value: shown };
        else r.applied.push({ label, value: shown });
      },
      skip(reason) {
        throw new Skip(reason);
      },
    };
    try {
      handler(value, ctx);
    } catch (err) {
      if (!(err instanceof Skip)) throw err;
      r.skipped.push({ line, reason: err.message });
    }
  }
  return r;
}
