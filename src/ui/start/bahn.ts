// Kreisbahn des Look-Rads: Die Schachteln liegen auf einem Bogen am rechten Rand. Die mittlere (aktive) ragt am
// weitesten nach links, die übrigen weichen nach oben und unten zum Rand zurück und werden kleiner und blasser.

/** Ab hier (|d|) ist eine Schachtel ganz ausgeblendet. */
export const SICHTBAR = 5;

export interface Geometrie {
  /** Größe der aktiven Schachtel (CSS-px); die übrigen werden per scale verkleinert. */
  boxW: number;
  boxH: number;
  /** Abstand zwischen zwei Schachteln (unverkleinert). */
  gap: number;
  /** Radius der Bahn, Mittelpunkt (xMitte + r, cy). */
  r: number;
  /** Mitte der aktiven Schachtel. */
  xMitte: number;
  cy: number;
  /** Ab hier (|d|) ist eine Schachtel ganz durchsichtig; ab |d| = 3 blendet sie aus. */
  leer: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Bahn für einen Abschnitt der Größe w×h: am Handy kleinere Schachteln und ein engerer Bogen. */
export function geometrie(w: number, h: number): Geometrie {
  const flach = h < 520; // Handy quer
  const handy = !flach && w < 640;
  const desktop = !flach && !handy;
  const boxH = flach ? clamp(h * 0.2, 56, 90) : handy ? clamp(h * 0.088, 58, 84) : clamp(h * 0.135, 90, 168);
  const boxW = boxH * 1.6;
  // Am Desktop enger gestaffelt, damit ±3 oben und unten im Bild bleiben.
  const gap = boxH * (desktop ? 0.14 : 0.16);
  // Wie weit die Schachtel bei d = ±4 gegenüber der Mitte nach rechts zurückweicht: am Desktop ein deutlicher Halbkreis.
  const bulge = boxW * (handy ? 0.7 : flach ? 0.5 : 1.5);
  const rand = handy ? 10 : flach ? 16 : clamp(w * 0.035, 24, 72);
  const y4 = hub(4, boxH, gap);
  const r = (y4 * y4 + bulge * bulge) / (2 * bulge);
  // Kleines Handy: die äußersten (±4) reichen oben bis an den Markenschalter, deshalb schon dort ganz ausgeblendet.
  const leer = handy && h < 720 ? 4 : SICHTBAR;
  // Schachteln bis |d| = voll ragen rechts nicht aus dem Bild; am Desktop verschwinden die äußersten (±4) nach rechts,
  // auf kleinen Handys (dort ±4 ganz ausgeblendet) ebenso – so rückt der Bogen nach rechts, weg vom Markenschalter.
  const voll = desktop || leer <= 4 ? 3 : 4;
  let aus = boxW / 2;
  for (let d = 1; d <= voll; d++) aus = Math.max(aus, rueckzug(hub(d, boxH, gap), r) + (scaleAt(d) * boxW) / 2);
  const xMitte = w - rand - aus;
  // Kleines Handy: Bogenmitte höher, damit der untere Bogen nicht neben Überschrift und Knopf liegt.
  const cy = flach ? h * 0.54 : handy ? h * (h < 720 ? 0.4 : 0.45) : h * 0.5;
  return { boxW, boxH, gap, r, xMitte, cy, leer };
}

/** Waagerechter Rückzug der Bahn bei senkrechtem Abstand dy von der Mitte. */
function rueckzug(dy: number, r: number) {
  const y = clamp(dy, -r * 0.999, r * 0.999);
  return r * (1 - Math.cos(Math.asin(y / r)));
}

const scaleAt = (d: number) => Math.max(0, 1 - 0.12 * Math.abs(d));

/** Senkrechter Abstand von der Mitte: Höhe der (verkleinerten) Schachteln plus fester Zwischenraum, aufsummiert. */
export function hub(d: number, boxH: number, gap: number) {
  const a = Math.min(Math.abs(d), SICHTBAR + 1);
  return Math.sign(d) * (boxH * (a - 0.06 * a * a) + gap * a);
}

export interface Punkt {
  x: number;
  y: number;
  scale: number;
  /** Nur zum Ausblenden am Rand; die nahen Schachteln bleiben deckend. */
  opacity: number;
  /** Abdunkeln im Karton (0…1): nach außen blasser, ohne durchsichtig zu werden. */
  dunkel: number;
  /** Neigung in Grad, der Bahn folgend. */
  rot: number;
}

/** Lage der Schachtel mit Versatz d = i − aktuellerIndex (stetig). */
export function bahnPunkt(d: number, g: Geometrie): Punkt {
  const dy = clamp(hub(d, g.boxH, g.gap), -g.r * 0.999, g.r * 0.999);
  const winkel = Math.asin(dy / g.r);
  return {
    x: g.xMitte + g.r * (1 - Math.cos(winkel)),
    y: g.cy + dy,
    scale: scaleAt(d),
    opacity: clamp((g.leer - Math.abs(d)) / (g.leer - 3), 0, 1),
    dunkel: Math.min(0.5, 0.13 * Math.abs(d)),
    rot: (-winkel * 180 * 0.25) / Math.PI,
  };
}
