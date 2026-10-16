// Kreisbahn des Look-Rads: Die Schachteln liegen auf einem Bogen am rechten Rand der Kachel. Die mittlere (aktive)
// ragt am weitesten nach links, die übrigen weichen nach oben und unten zum Rand zurück und werden kleiner und blasser.

/** Ab hier (|d|) ist eine Schachtel ganz ausgeblendet; ab |d| = 3 blendet sie aus. */
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
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Bahn in einer Kachel der Größe w×h: hochkant (Handy, 4:5), flach (Handy quer, 2:1) oder breit (3:2). */
export function geometrie(w: number, h: number): Geometrie {
  const hoch = w < h;
  const flach = w > h * 1.8;
  // Mit der Kachel wachsend, aber nie kleiner als 74 × 118 px: So bleibt der Name der mittleren Schachtel ≥ 9 px groß.
  const boxH = clamp(h * (flach ? 0.25 : 0.17), 74, 120);
  const boxW = boxH * 1.6;
  const gap = boxH * 0.14;
  // Wie weit die Schachtel bei d = ±4 gegenüber der Mitte nach rechts zurückweicht: in der breiten Kachel ein deutlicher
  // Halbkreis, hochkant flacher, sonst bleibt links zu wenig Platz für Name und Knopf.
  const bulge = boxW * (hoch ? 0.65 : flach ? 1 : 1.4);
  const rand = hoch ? 10 : clamp(w * 0.035, 16, 36);
  const y4 = hub(4, boxH, gap);
  const r = (y4 * y4 + bulge * bulge) / (2 * bulge);
  // Schachteln bis |d| = voll ragen rechts nicht aus der Kachel; hochkant dürfen es ±3 knapp (sie liegen dort ohnehin
  // oben bzw. unten am Rand), so rückt der Bogen vom Text weg.
  const voll = hoch ? 2 : 3;
  let aus = boxW / 2;
  for (let d = 1; d <= voll; d++) aus = Math.max(aus, rueckzug(hub(d, boxH, gap), r) + (scaleAt(d) * boxW) / 2);
  const xMitte = w - rand - aus;
  // Hochkant: Mitte höher, damit unten links Platz für Name und Knopf bleibt (der untere Bogen weicht dort schon zurück).
  const cy = h * (hoch ? 0.34 : 0.5);
  return { boxW, boxH, gap, r, xMitte, cy };
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
    opacity: clamp((SICHTBAR - Math.abs(d)) / (SICHTBAR - 3), 0, 1),
    dunkel: Math.min(0.5, 0.13 * Math.abs(d)),
    rot: (-winkel * 180 * 0.25) / Math.PI,
  };
}
