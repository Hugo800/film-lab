import { describe, expect, it } from 'vitest';
import { identityLut, parseCube } from './cube';

const grid2 = ['0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1'];

describe('parseCube', () => {
  it('liest eine gültige 3D-LUT mit Titel, Kommentaren und Leerzeilen', () => {
    const text = ['# Kommentar', 'TITLE "Mein Look #1"', '', 'LUT_3D_SIZE 2', ...grid2, ''].join('\n');
    const lut = parseCube(text, 'datei.cube');
    expect(lut.size).toBe(2);
    expect(lut.title).toBe('Mein Look #1');
    expect(Array.from(lut.data)).toEqual(Array.from(identityLut(2).data));
  });

  it('nimmt den übergebenen Titel, wenn die Datei keinen hat', () => {
    expect(parseCube(['LUT_3D_SIZE 2', ...grid2].join('\n'), 'datei').title).toBe('datei');
  });

  it('versteht CRLF, Tabs, wissenschaftliche Notation und Kommentare am Zeilenende', () => {
    const rows = grid2.map((r, i) => (i === 1 ? '1.0e0\t0E-3 -0.0  # rot' : r));
    const lut = parseCube(['LUT_3D_SIZE 2', ...rows].join('\r\n'));
    expect(lut.data[3]).toBe(1);
    expect(lut.data[4]).toBe(0);
  });

  it('begrenzt Werte außerhalb 0..1', () => {
    const rows = grid2.map((r, i) => (i === 7 ? '1.5 1.2 -0.3' : r));
    const lut = parseCube(['LUT_3D_SIZE 2', ...rows].join('\n'));
    expect(Array.from(lut.data.slice(21))).toEqual([1, 1, 0]);
  });

  it('tastet abweichende DOMAIN_MIN/MAX auf 0..1 um', () => {
    // Domain 0..2, Tabelle halbiert: Ergebnis muss x/2 für Eingang x in 0..1 sein.
    const rows: string[] = [];
    for (let b = 0; b < 3; b++) for (let g = 0; g < 3; g++) for (let r = 0; r < 3; r++) rows.push(`${r / 2} ${g / 2} ${b / 2}`);
    const lut = parseCube(['LUT_3D_SIZE 3', 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 2 2 2', ...rows].join('\n'));
    const i = (2 + 1 * 3) * 3; // r = 1, g = 0.5, b = 0
    expect(lut.data[i]).toBeCloseTo(0.5, 6);
    expect(lut.data[i + 1]).toBeCloseTo(0.25, 6);
    expect(lut.data[i + 2]).toBeCloseTo(0, 6);
  });

  it('wandelt eine 1D-LUT in eine 33er-3D-LUT um', () => {
    const lut = parseCube(['TITLE "Kurve"', 'LUT_1D_SIZE 3', '0 1 0', '0.25 0.5 0.5', '1 0 1'].join('\n'));
    expect(lut.size).toBe(33);
    expect(lut.data.length).toBe(33 ** 3 * 3);
    const at = (r: number, g: number, b: number) => Array.from(lut.data.slice((r + g * 33 + b * 33 * 33) * 3, (r + g * 33 + b * 33 * 33) * 3 + 3));
    expect(at(0, 0, 0)).toEqual([0, 1, 0]);
    expect(at(16, 16, 16).map((v) => +v.toFixed(5))).toEqual([0.25, 0.5, 0.5]);
    expect(at(32, 0, 32)).toEqual([1, 1, 1]);
  });

  it.each([
    ['ohne Größe', ['0 0 0'], /Zeile 1: Daten vor LUT_3D_SIZE/],
    ['leere Datei', ['# nur Kommentar'], /LUT_3D_SIZE oder LUT_1D_SIZE fehlt/],
    ['Größe zu klein', ['LUT_3D_SIZE 1'], /Zeile 1: LUT_3D_SIZE muss/],
    ['Größe zu groß', ['LUT_3D_SIZE 66'], /Zeile 1: LUT_3D_SIZE muss/],
    ['Größe keine Zahl', ['LUT_3D_SIZE zwei'], /Zeile 1: LUT_3D_SIZE erwartet 1 Zahl/],
    ['zu wenige Zeilen', ['LUT_3D_SIZE 2', ...grid2.slice(0, 5)], /8 Datenzeilen erwartet, 5 gefunden/],
    ['zu viele Zeilen', ['LUT_3D_SIZE 2', ...grid2, '0 0 0'], /Zeile 10: zu viele Datenzeilen/],
    ['Text statt Zahl', ['LUT_3D_SIZE 2', '0 0 0', '1 x 0'], /Zeile 3: Datenzeile erwartet 3 Zahlen/],
    ['zwei Werte', ['LUT_3D_SIZE 2', '0 0'], /Zeile 2: Datenzeile/],
    ['NaN', ['LUT_3D_SIZE 2', 'NaN 0 0'], /Zeile 2: Datenzeile/],
    ['Schlüsselwort nach Daten', ['LUT_3D_SIZE 2', '0 0 0', 'DOMAIN_MIN 0 0 0'], /Zeile 3: Schlüsselwort/],
    ['1D und 3D', ['LUT_1D_SIZE 2', 'LUT_3D_SIZE 2', '0 0 0'], /Zeile 3: .*kombinierte/],
    ['Domain verkehrt', ['LUT_3D_SIZE 2', 'DOMAIN_MIN 1 1 1', 'DOMAIN_MAX 0 0 0', ...grid2], /DOMAIN_MAX muss größer/],
  ])('lehnt kaputte Dateien ab: %s', (_name, lines, msg) => {
    expect(() => parseCube(lines.join('\n'))).toThrow(msg);
  });
});

describe('identityLut', () => {
  it('liefert die Einheits-LUT', () => {
    const lut = identityLut(3);
    expect(lut.data.length).toBe(81);
    expect(Array.from(lut.data.slice(3 * 5, 3 * 5 + 3))).toEqual([1, 0.5, 0]);
  });
});
