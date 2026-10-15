// Reine Rechenfunktionen der Engine (ohne WebGL), damit sie in Node testbar sind.
import type { LookParams } from '../types';

export interface Size {
  width: number;
  height: number;
}

/** Halboffenes Rechteck [x0, x1) × [y0, y1) in Pixeln. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Größe nach Begrenzung der längsten Kante (nie vergrößern). */
export function fitLongEdge(w: number, h: number, maxEdge: number): Size {
  const long = Math.max(w, h);
  if (!(maxEdge > 0) || maxEdge >= long) return { width: w, height: h };
  const s = maxEdge / long;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/** Bild eingepasst (contain) in eine Fläche, ganzzahlig und mittig. y0 von oben. */
export function containRect(imgW: number, imgH: number, boxW: number, boxH: number): Rect {
  const s = Math.min(boxW / imgW, boxH / imgH);
  const w = Math.max(1, Math.round(imgW * s));
  const h = Math.max(1, Math.round(imgH * s));
  const x0 = Math.floor((boxW - w) / 2);
  const y0 = Math.floor((boxH - h) / 2);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

export interface SourceTile {
  /** Bereich, dessen Zielpixel diese Kachel rendert (Quellpixel). */
  inner: Rect;
  /** Hochzuladender Ausschnitt inkl. Rand für den Verkleinerungsfilter. */
  upload: Rect;
}

/**
 * Teilt die Quelle in Kacheln mit Innenmaß `inner` und Rand `margin`.
 * Die Innenbereiche überdecken die Quelle lückenlos und ohne Überlappung.
 */
export function planSourceTiles(srcW: number, srcH: number, inner: number, margin: number): SourceTile[] {
  const tiles: SourceTile[] = [];
  const step = Math.max(1, Math.floor(inner));
  for (let y = 0; y < srcH; y += step)
    for (let x = 0; x < srcW; x += step) {
      const r = { x0: x, y0: y, x1: Math.min(srcW, x + step), y1: Math.min(srcH, y + step) };
      tiles.push({
        inner: r,
        upload: {
          x0: Math.max(0, r.x0 - margin),
          y0: Math.max(0, r.y0 - margin),
          x1: Math.min(srcW, r.x1 + margin),
          y1: Math.min(srcH, r.y1 + margin),
        },
      });
    }
  return tiles;
}

/**
 * Zielpixel j gehört zur Kachel, in deren Innenbereich sein Mittelpunkt (j+0,5)·k fällt.
 * Liefert [j0, j1) für den Quellbereich [a, b). Benachbarte Kacheln teilen sich die Grenze,
 * deshalb entsteht exakt eine Zerlegung.
 */
export function targetSpan(a: number, b: number, srcLen: number, outLen: number): [number, number] {
  const k = srcLen / outLen;
  const j0 = a <= 0 ? 0 : Math.ceil(a / k - 0.5);
  const j1 = b >= srcLen ? outLen : Math.ceil(b / k - 0.5);
  return [j0, Math.max(j0, j1)];
}

/** Rand in Quellpixeln, den der Box-Filter bei Verkleinerungsfaktor k braucht. */
export function filterMargin(k: number): number {
  return Math.ceil(Math.max(1, k) / 2) + 2;
}

const LUMA = [0.2126, 0.7152, 0.0722];

/**
 * Kanalfaktoren in linearem Licht: Belichtung (2^EV) × Weißabgleich.
 * Der Weißabgleich ist luminanzerhaltend (Rec.-709-Luminanz bleibt gleich).
 */
export function channelGains(p: Pick<LookParams, 'exposure' | 'temperature' | 'tint'>): [number, number, number] {
  const t = p.temperature * 0.4; // Blendenstufen zwischen Rot und Blau
  const m = p.tint * 0.3; // Blendenstufen Grün ↔ Magenta
  const g = [2 ** (t + m / 2), 2 ** -m, 2 ** (-t + m / 2)];
  const y = g[0] * LUMA[0] + g[1] * LUMA[1] + g[2] * LUMA[2];
  const e = 2 ** p.exposure;
  return [(g[0] / y) * e, (g[1] / y) * e, (g[2] / y) * e];
}

/** Ein Lichteinfall: Kante, Lage, Ausdehnung und Farbe, alles relativ zur kürzeren Bildseite. */
export interface LeakSpec {
  /** 0 links, 1 rechts, 2 oben, 3 unten. */
  edge: number;
  /** Lage entlang der Kante, 0..1 der Kantenlänge. */
  pos: number;
  /** Ausdehnung entlang der Kante (Kurzseiten-Einheiten). */
  spread: number;
  /** Eindringtiefe ins Bild (Kurzseiten-Einheiten). */
  depth: number;
  color: [number, number, number];
  intensity: number;
  /** Versatz des Rauschfelds für die unregelmäßige Form. */
  noise: [number, number];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsv(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/** 1–3 warme Lichteinfälle, deterministisch aus dem Samen. */
export function leakSpecs(seed: number): LeakSpec[] {
  const rnd = mulberry32(Math.imul((seed | 0) ^ 0x5bd1e995, 0x27d4eb2d) + 0x9e3779b9);
  rnd();
  const count = 1 + Math.floor(rnd() * 3);
  const first = Math.floor(rnd() * 4);
  const out: LeakSpec[] = [];
  for (let i = 0; i < count; i++) {
    // Mehrere Einfälle bevorzugt von derselben oder der gegenüberliegenden Kante,
    // wie bei undichter Kamerarückwand.
    const edge = i === 0 ? first : rnd() < 0.6 ? first : first ^ 1;
    const hue = 0.005 + rnd() * 0.095; // tiefrot .. bernstein
    out.push({
      edge,
      pos: 0.08 + rnd() * 0.84,
      spread: 0.2 + rnd() * 0.45,
      depth: 0.15 + rnd() * 0.35,
      color: hsv(hue, 0.75 + rnd() * 0.2, 1),
      intensity: (i === 0 ? 1.1 : 0.6) + rnd() * 0.4,
      noise: [rnd() * 100, rnd() * 100],
    });
  }
  return out;
}

/** Gitterpunkte des Korns pro kürzerer Bildseite (Korngröße 1 ≈ 1,8 px bei 24 MP). */
export function grainLattice(grainSize: number): number {
  return 2200 / Math.min(3, Math.max(0.5, grainSize));
}
