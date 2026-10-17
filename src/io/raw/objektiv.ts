// Objektivkorrektur für Sony-ARW: Verzeichnung und Farbsäume nach den Korrekturdaten, die die Kamera in die RAW
// schreibt. libraw wendet sie nicht an; ohne sie zeigt z. B. das E PZ 16-50 bei 16 mm stark tonnenförmige Verzeichnung,
// die Kamera-JPEGs sind dagegen korrigiert. Gemeinsame Quelle für den ARW-Import (objektivWorker.ts) und die
// Beispielfotos (scripts/beispiele-erzeugen.mjs). Die Vignettierung (0x7032) bleibt bewusst stehen: die Kamera-JPEGs
// gleichen sie nicht aus (gemessen an der eingebetteten Vorschau, siehe Wissensdepot libraw-wasm-raw-im-browser).
import type { Area } from './pixels';

/**
 * Korrekturkurven über den Radius 0 … halbe Bilddiagonale: Stützstellen gleichmäßig verteilt, dazwischen linear,
 * dahinter konstant (wie darktable). Die Werte sind Faktoren: ein Ausgabepunkt im Abstand r holt aus der Quelle bei
 * r · f(r).
 */
export interface Objektivkorrektur {
  /** Verzeichnung (alle Kanäle). Fehlt, wenn die Kamera sie nicht anwendet. */
  verzeichnung?: number[];
  /** Farbsäume: zusätzlicher Faktor für Rot und Blau. Fehlt, wenn die Kamera sie nicht anwendet. */
  farbsaum?: { rot: number[]; blau: number[] };
}

const SUBIFD = 0x14a;
const FARBSAUM_AN = 0x7034;
const FARBSAUM = 0x7035;
const VERZEICHNUNG_AN = 0x7036;
const VERZEICHNUNG = 0x7037;
/** Schalter der Kamera (Menü „Objektivkompensation“): 0 = aus, 255 = keine Korrekturdaten; 1 = Auto, 17 = vom Objektiv vorgegeben. */
const AUS = new Set([0, 255]);

/** Alle Tags 0x7034–0x7037 (int16) aus IFD0, Folge-IFDs und SubIFDs (bei Sony: IFD der Rohdaten). */
function sonyTags(bytes: Uint8Array): Map<number, number[]> {
  const found = new Map<number, number[]>();
  const le = bytes[0] === 0x49 && bytes[1] === 0x49;
  if (!le && !(bytes[0] === 0x4d && bytes[1] === 0x4d)) return found;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint16(2, le) !== 42) return found;
  const seen = new Set<number>();
  const queue = [v.getUint32(4, le)];
  while (queue.length > 0 && seen.size < 64) {
    const off = queue.shift()!;
    if (!off || seen.has(off) || off + 2 > bytes.length) continue;
    seen.add(off);
    const n = v.getUint16(off, le);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      const tag = v.getUint16(e, le);
      const type = v.getUint16(e + 2, le);
      const count = v.getUint32(e + 4, le);
      if (tag === SUBIFD && (type === 4 || type === 13) && count > 0) {
        const at = count === 1 ? e + 8 : v.getUint32(e + 8, le);
        for (let k = 0; k < Math.min(count, 8); k++) queue.push(v.getUint32(at + 4 * k, le));
      } else if (tag >= FARBSAUM_AN && tag <= VERZEICHNUNG && (type === 3 || type === 8) && count > 0 && count <= 64 && !found.has(tag)) {
        const at = count <= 2 ? e + 8 : v.getUint32(e + 8, le);
        found.set(tag, Array.from({ length: count }, (_, k) => v.getInt16(at + 2 * k, le)));
      }
    }
    queue.push(v.getUint32(off + 2 + n * 12, le));
  }
  return found;
}

/**
 * Liest die Objektivkorrektur aus einer Sony-ARW (TIFF): 0x7037 Verzeichnung (erster Wert = Anzahl n der
 * Stützstellen, Faktor 1 + v/2^14), 0x7035 Farbsäume (erster Wert = 2n, erst n Werte Rot, dann n Blau, Faktor
 * 1 + v/2^21). Hat die Kamera eine Korrektur ausgeschaltet (0x7036 bzw. 0x7034), fehlt sie auch hier – das Ergebnis
 * entspricht dann wie das Kamera-JPEG der Einstellung im Menü. `null`, wenn nichts anzuwenden ist (keine ARW, Tags
 * fehlen oder sind unbrauchbar).
 */
export function leseObjektivkorrektur(bytes: Uint8Array): Objektivkorrektur | null {
  let tags: Map<number, number[]>;
  try {
    tags = sonyTags(bytes);
  } catch {
    return null; // Verweis hinter das Dateiende: kaputte oder abgeschnittene Datei
  }
  const an = (tag: number) => !AUS.has(tags.get(tag)?.[0] ?? 1);
  const out: Objektivkorrektur = {};
  const verz = tags.get(VERZEICHNUNG);
  if (verz && an(VERZEICHNUNG_AN)) {
    const n = verz[0];
    const werte = verz.slice(1, n + 1).map((x) => 1 + x / 2 ** 14);
    if (n >= 2 && n <= 16 && werte.length === n && werte.every((f) => f > 0.5 && f < 1.5) && werte.some((f) => f !== 1)) {
      out.verzeichnung = werte;
    }
  }
  const ca = tags.get(FARBSAUM);
  if (ca && an(FARBSAUM_AN)) {
    const n = ca[0] / 2;
    const rot = ca.slice(1, n + 1).map((x) => 1 + x / 2 ** 21);
    const blau = ca.slice(n + 1, 2 * n + 1).map((x) => 1 + x / 2 ** 21);
    if (Number.isInteger(n) && n >= 2 && n <= 16 && blau.length === n && [...rot, ...blau].some((f) => f !== 1)) {
      out.farbsaum = { rot, blau };
    }
  }
  return out.verzeichnung || out.farbsaum ? out : null;
}

/** Stückweise lineare Kurve über r ∈ [0, 1], gleichmäßige Stützstellen, dahinter konstant. */
function kurve(werte: number[] | Float64Array, r: number): number {
  const t = Math.min(r, 1) * (werte.length - 1);
  const i = Math.min(werte.length - 2, Math.floor(t));
  return werte[i] + (werte[i + 1] - werte[i]) * (t - i);
}

const EINS = [1, 1];

/** Faktor f(r) für Kanal 0 (Rot), 1 (Grün) oder 2 (Blau); r in halben Bilddiagonalen. */
export function faktor(k: Objektivkorrektur, kanal: number, r: number): number {
  const d = kurve(k.verzeichnung ?? EINS, r);
  if (kanal === 1 || !k.farbsaum) return d;
  return d * kurve(kanal === 0 ? k.farbsaum.rot : k.farbsaum.blau, r);
}

/** Abbildung Ausgabe → Quelle für ein Bild von `breite`×`hoehe` (Ausgabe und Quelle gleich groß). */
export interface Abbildung {
  breite: number;
  hoehe: number;
  korrektur: Objektivkorrektur;
  /**
   * Bildfeld: Faktor auf den Abstand zur Mitte, bevor die Korrektur greift. So gewählt, dass die Ausgabe wie in der
   * Kamera ganz aus Bildinhalt besteht (keine leeren Ränder), bei 16 mm am E PZ 16-50 etwa 1,05.
   */
  massstab: number;
  /** Zusätzliche Drehung um die Bildmitte in Grad im Uhrzeigersinn (nur für die Beispielfotos, die App nutzt 0). */
  drehen: number;
}

/**
 * Quellpunkt (kontinuierliche Koordinaten, Bildmitte = breite/2, hoehe/2; Pixel i hat seine Mitte bei i + 0,5) für den
 * Ausgabepunkt (x, y) im Kanal `kanal`.
 */
export function quellpunkt(abb: Abbildung, kanal: number, x: number, y: number): [number, number] {
  const { breite: W, hoehe: H } = abb;
  const t = (abb.drehen * Math.PI) / 180;
  const ox = x - W / 2;
  const oy = y - H / 2;
  const cx = abb.massstab * (ox * Math.cos(t) + oy * Math.sin(t));
  const cy = abb.massstab * (-ox * Math.sin(t) + oy * Math.cos(t));
  const f = faktor(abb.korrektur, kanal, Math.hypot(cx, cy) / Math.hypot(W / 2, H / 2));
  return [W / 2 + cx * f, H / 2 + cy * f];
}

/**
 * Abbildung mit dem größten Bildfeld, bei dem jeder Randpunkt der Ausgabe (je Kanal, nach Drehung und Entzerrung) noch
 * in der Quelle liegt – so füllt das entzerrte Bild den Rahmen wie das Kamera-JPEG.
 */
export function objektivAbbildung(korrektur: Objektivkorrektur, breite: number, hoehe: number, drehen = 0): Abbildung {
  const abb: Abbildung = { breite, hoehe, korrektur, massstab: 1, drehen };
  const passt = (z: number) => {
    abb.massstab = z;
    for (let k = 0; k <= 400; k++) {
      const u = k / 400;
      for (const [x, y] of [[u * breite, 0], [u * breite, hoehe], [0, u * hoehe], [breite, u * hoehe]]) {
        for (let kanal = 0; kanal < 3; kanal++) {
          const [sx, sy] = quellpunkt(abb, kanal, x, y);
          if (sx < 0 || sx > breite || sy < 0 || sy > hoehe) return false;
        }
      }
    }
    return true;
  };
  let [lo, hi] = [0.5, 1.5];
  for (let i = 0; i < 30; i++) [lo, hi] = passt((lo + hi) / 2) ? [(lo + hi) / 2, hi] : [lo, (lo + hi) / 2];
  abb.massstab = lo;
  return abb;
}

// Neuabtastung in linearem Licht: sRGB-Wert → linear (Tabelle), zurück über eine feine Tabelle (2^16 Stufen, damit
// auch dunkle Werte bei Abbildung 1:1 exakt zurückkommen).
const LIN = Float32Array.from({ length: 256 }, (_, v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
const STUFEN = 65535;
let srgbTabelle: Uint8Array | null = null;
function srgb(): Uint8Array {
  srgbTabelle ??= Uint8Array.from({ length: STUFEN + 1 }, (_, i) => {
    const x = i / STUFEN;
    return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
  });
  return srgbTabelle;
}

const TABELLE = 16384;
/** Größter Radius in der Tabelle: Ecke bei Bildfeld bis 1,5 (wie die Suche in objektivAbbildung). */
const RMAX = 1.5;

/**
 * Pixel als Bytes, `kanaele` Werte je Pixel (RGB oder RGBA), Zeilen ohne Lücke. Liegt nur ein Streifen des Bildes vor
 * (Zeilen `ab` … ab + data.length/(breite·kanaele)), nennt `hoehe` trotzdem die volle Bildhöhe.
 */
export interface Bildpuffer {
  data: Uint8Array | Uint8ClampedArray;
  breite: number;
  hoehe: number;
  kanaele: number;
  /** Erste enthaltene Zeile (Vorgabe 0). */
  ab?: number;
}

/**
 * Bikubisch (Catmull-Rom) in linearem Licht an der Stelle (sx, sy) (Pixelindex-Koordinaten, Pixelmitte bei ganzen
 * Zahlen) im Kanal k. Am Bildrand werden die Abgriffe auf das Bild geklemmt. `zeilen` = vorhandene Zeilen ab `ab`.
 */
function bikubisch(src: Uint8Array | Uint8ClampedArray, breite: number, hoehe: number, n: number, ab: number, zeilen: number, k: number, sx: number, sy: number): number {
  const x = Math.floor(sx);
  const y = Math.floor(sy);
  const tx = sx - x;
  const ty = sy - y;
  const ax = ((-0.5 * tx + 1) * tx - 0.5) * tx;
  const bx = (1.5 * tx - 2.5) * tx * tx + 1;
  const cx = ((-1.5 * tx + 2) * tx + 0.5) * tx;
  const dx = (0.5 * tx - 0.5) * tx * tx;
  const ay = ((-0.5 * ty + 1) * ty - 0.5) * ty;
  const by = (1.5 * ty - 2.5) * ty * ty + 1;
  const cy = ((-1.5 * ty + 2) * ty + 0.5) * ty;
  const dy = (0.5 * ty - 0.5) * ty * ty;
  const zeile = breite * n;
  if (x >= 1 && y >= ab + 1 && x + 2 < breite && y + 2 < ab + zeilen) {
    let i = (y - 1 - ab) * zeile + (x - 1) * n + k;
    const n2 = 2 * n;
    const n3 = 3 * n;
    const r0 = ax * LIN[src[i]] + bx * LIN[src[i + n]] + cx * LIN[src[i + n2]] + dx * LIN[src[i + n3]];
    i += zeile;
    const r1 = ax * LIN[src[i]] + bx * LIN[src[i + n]] + cx * LIN[src[i + n2]] + dx * LIN[src[i + n3]];
    i += zeile;
    const r2 = ax * LIN[src[i]] + bx * LIN[src[i + n]] + cx * LIN[src[i + n2]] + dx * LIN[src[i + n3]];
    i += zeile;
    const r3 = ax * LIN[src[i]] + bx * LIN[src[i + n]] + cx * LIN[src[i + n2]] + dx * LIN[src[i + n3]];
    return ay * r0 + by * r1 + cy * r2 + dy * r3;
  }
  // Rand: auf das Bild klemmen (und auf den vorhandenen Streifen, der laut streifen() alle nötigen Zeilen enthält).
  const wx = [ax, bx, cx, dx];
  const wy = [ay, by, cy, dy];
  let acc = 0;
  for (let j = 0; j < 4; j++) {
    const yy = Math.min(hoehe - 1, ab + zeilen - 1, Math.max(0, ab, y - 1 + j)) - ab;
    let row = 0;
    for (let i = 0; i < 4; i++) row += wx[i] * LIN[src[yy * zeile + Math.min(breite - 1, Math.max(0, x - 1 + i)) * n + k]];
    acc += wy[j] * row;
  }
  return acc;
}

/**
 * Entzerrt die Fläche `flaeche` der Quelle nach `abb` in ein neues RGBA-Bild derselben Breite (Alpha 255), Zeilen
 * `zeilen` (halboffen, Vorgabe alle). Abgriffe dürfen über die Fläche hinaus in die Quelle reichen (bei der RAW:
 * Sensorrand außerhalb des Bildes). Rot und Blau werden mit ihrem eigenen Faktor abgetastet (Farbsäume).
 */
export function entzerren(quelle: Bildpuffer, flaeche: Area, abb: Abbildung, zeilen: [number, number] = [0, abb.hoehe]): Uint8Array {
  const W = abb.breite;
  const H = abb.hoehe;
  if (flaeche.width !== W || flaeche.height !== H) throw new Error(`Fläche ${flaeche.width}×${flaeche.height} passt nicht zur Abbildung ${W}×${H}`);
  const [y0, y1] = zeilen;
  const out = new Uint8Array(W * (y1 - y0) * 4);
  const aus = srgb();
  const { data: src, breite, hoehe, kanaele: n } = quelle;
  const ab = quelle.ab ?? 0;
  const vorhanden = src.length / (breite * n);
  // Faktor je Kanal als feine Tabelle über r (0 … RMAX halbe Diagonalen), dazwischen linear: spart je Pixel die
  // Kurvensuche (Abweichung zur Kurve < 0,01 px).
  const tab = [0, 1, 2].map((kanal) => Float64Array.from({ length: TABELLE + 2 }, (_, i) => faktor(abb.korrektur, kanal, (i / TABELLE) * RMAX)));
  const [tr, tg, tb] = tab;
  const t = (abb.drehen * Math.PI) / 180;
  const c = abb.massstab * Math.cos(t);
  const s = abb.massstab * Math.sin(t);
  const skala = TABELLE / RMAX / Math.hypot(W / 2, H / 2);
  // Quellindex = Mitte + Abstand · f; Pixelmitte i + 0,5 → Index i.
  const mx = flaeche.left + W / 2 - 0.5;
  const my = flaeche.top + H / 2 - 0.5;
  let o = 0;
  for (let y = y0; y < y1; y++) {
    const oy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++, o += 4) {
      const ox = x + 0.5 - W / 2;
      const cx = ox * c + oy * s;
      const cy = -ox * s + oy * c;
      const q = Math.sqrt(cx * cx + cy * cy) * skala;
      const qi = q | 0;
      const qf = q - qi;
      const fr = tr[qi] + (tr[qi + 1] - tr[qi]) * qf;
      const d = tg[qi] + (tg[qi + 1] - tg[qi]) * qf;
      const fb = tb[qi] + (tb[qi + 1] - tb[qi]) * qf;
      const lr = bikubisch(src, breite, hoehe, n, ab, vorhanden, 0, mx + cx * fr, my + cy * fr);
      const lg = bikubisch(src, breite, hoehe, n, ab, vorhanden, 1, mx + cx * d, my + cy * d);
      const lb = bikubisch(src, breite, hoehe, n, ab, vorhanden, 2, mx + cx * fb, my + cy * fb);
      out[o] = aus[((lr < 0 ? 0 : lr > 1 ? 1 : lr) * STUFEN + 0.5) | 0];
      out[o + 1] = aus[((lg < 0 ? 0 : lg > 1 ? 1 : lg) * STUFEN + 0.5) | 0];
      out[o + 2] = aus[((lb < 0 ? 0 : lb > 1 ? 1 : lb) * STUFEN + 0.5) | 0];
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Teilt die Ausgabe in `teile` Streifen gleicher Höhe und nennt je Streifen die Quellzeilen (halboffen, in der Quelle
 * mit `quelleHoehe` Zeilen), die entzerren() dafür liest – so kann jeder Streifen mit einem Ausschnitt der Quelle in
 * einem eigenen Worker laufen. Die Extremwerte liegen auf dem Rand des Streifens (Abbildung stetig und in y monoton).
 */
export function streifen(abb: Abbildung, flaeche: Area, quelleHoehe: number, teile: number): { zeilen: [number, number]; quelle: [number, number] }[] {
  const { breite: W, hoehe: H } = abb;
  const out: { zeilen: [number, number]; quelle: [number, number] }[] = [];
  for (let i = 0; i < teile; i++) {
    const y0 = Math.round((i * H) / teile);
    const y1 = Math.round(((i + 1) * H) / teile);
    if (y1 <= y0) continue;
    let lo = Infinity;
    let hi = -Infinity;
    const pruefe = (x: number, y: number) => {
      for (let kanal = 0; kanal < 3; kanal++) {
        const sy = quellpunkt(abb, kanal, x, y)[1] + flaeche.top - 0.5;
        lo = Math.min(lo, sy);
        hi = Math.max(hi, sy);
      }
    };
    for (let x = 0; x < W; x++) {
      pruefe(x + 0.5, y0 + 0.5);
      pruefe(x + 0.5, y1 - 0.5);
    }
    for (let y = y0; y < y1; y++) {
      pruefe(0.5, y + 0.5);
      pruefe(W - 0.5, y + 0.5);
    }
    // Bikubisch liest Zeile floor(sy) − 1 … floor(sy) + 2; eine Zeile Reserve gegen Rundung.
    out.push({ zeilen: [y0, y1], quelle: [Math.max(0, Math.floor(lo) - 2), Math.min(quelleHoehe, Math.floor(hi) + 4)] });
  }
  return out;
}
