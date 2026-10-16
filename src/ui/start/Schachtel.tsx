import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { Filmschachtel } from './filmschachteln';

/** Relative Leuchtdichte nach WCAG (sRGB). */
function leuchtdichte(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
}
const kontrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Schrift auf dem Band: dunkel oder hell, je nachdem, was zur Akzentfarbe den höheren Kontrast hat. */
const BAND_DUNKEL = '#16120c';
const BAND_HELL = '#fff6e6';
function bandschrift(akzent: string) {
  const l = leuchtdichte(akzent);
  return kontrast(l, leuchtdichte(BAND_DUNKEL)) >= kontrast(l, leuchtdichte(BAND_HELL)) ? BAND_DUNKEL : BAND_HELL;
}

/** Kleinste Namensgröße (cqw); darunter bricht ein zu langes Wort notfalls um. */
const NAME_MIN = 5;

/**
 * Vorderseite einer stilisierten Kleinbild-Filmschachtel (Gestaltung in index.css unter .schachtel): Aufschrift,
 * Filmtyp, ISO bzw. Kürzel und ein Sichtfenster mit der Live-Vorschau des Looks. Maße kommen vom Elternelement
 * (1,6 : 1); alle Innenmaße sind in cqw, damit die Schachtel in jeder Größe gleich aussieht.
 */
export function Schachtel({ s, url, pos, mini }: { s: Filmschachtel; url: string | null; pos: string; mini?: string }) {
  // Startgröße nach dem längsten Wort (eine Trennstelle \u00AD teilt es); passt es in der echten Schrift trotzdem
  // nicht, verkleinert der Effekt unten.
  const laengstes = Math.max(...s.name.split(/[\s\u00AD]+/).map((w) => w.length));
  const start = Math.min(10, 76 / Math.max(1, laengstes));
  const nameRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    // Einmal messen, sobald die Schachtel sichtbar ist (ausgeblendet hat sie keine Breite); nicht in jedem Bild.
    const passen = () => {
      if (!el.clientWidth) return false;
      el.style.overflowWrap = '';
      let g = start;
      el.style.fontSize = `${g}cqw`;
      // Zu breit: ein Wort ragt hinaus. Zu hoch: mehr als zwei Zeilen (die Glyphen selbst ragen bei line-height < 1
      // ohnehin etwas über, deshalb erst ab einer halben Zeile).
      const zuGross = () =>
        el.scrollWidth > el.clientWidth + 0.5 || el.scrollHeight > el.clientHeight + parseFloat(getComputedStyle(el).fontSize) * 0.5;
      while (g > NAME_MIN && zuGross()) {
        g = Math.max(NAME_MIN, g - 0.5);
        el.style.fontSize = `${g}cqw`;
      }
      if (zuGross()) el.style.overflowWrap = 'anywhere';
      return true;
    };
    if (passen()) return;
    const ro = new ResizeObserver(() => passen() && ro.disconnect());
    ro.observe(el);
    return () => ro.disconnect();
  }, [s.name, start]);

  const style = {
    '--grund': s.grund,
    '--grund2': s.grund2,
    '--akzent': s.akzent,
    '--schrift': s.schrift,
    '--bandschrift': bandschrift(s.akzent),
  } as CSSProperties;
  const gross = s.zeichen ?? s.iso;
  return (
    <span className="schachtel" data-familie={s.familie} style={style} aria-hidden>
      <span className="schachtel-karton">
        <span className="schachtel-muster" />
        <span className="schachtel-fenster">
          {/* Bis die Vorschau gerechnet ist: das kleine Foto gedämpft, statt eines leeren schwarzen Fensters. */}
          {mini && <img src={mini} alt="" draggable={false} className="schachtel-platzhalter" />}
          {url && <img key={url} src={url} alt="" draggable={false} className="ueberblenden" style={{ objectPosition: pos }} />}
        </span>
        <span className="schachtel-text">
          <span ref={nameRef} className="schachtel-name" style={{ fontSize: `${start}cqw` }}>
            {s.name}
          </span>
          {s.zusatz && <span className="schachtel-zusatz">{s.zusatz}</span>}
          {gross && (
            <span className="schachtel-iso">
              {s.zeichen && <span className="schachtel-zeichen">{s.zeichen}</span>}
              {s.zeichen && s.iso ? <span className="schachtel-iso-klein">{s.iso}</span> : !s.zeichen && s.iso}
            </span>
          )}
        </span>
        <span className="schachtel-band">
          <span>{s.typ}</span>
          <span className="schachtel-kennung">{s.kennung}</span>
        </span>
        <span className="schachtel-glanz" />
        <span className="schachtel-dunkel" />
      </span>
    </span>
  );
}
