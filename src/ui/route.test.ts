import { afterEach, describe, expect, it, vi } from 'vitest';
import { adresseBereinigen, seiteVon } from './route';

afterEach(() => vi.unstubAllGlobals());

describe('seiteVon', () => {
  it('Startseite, Upload-Seite der App und Editor, jeweils auch mit Schrägstrich', () => {
    expect(seiteVon('/')).toBe('start');
    expect(seiteVon('/index.html')).toBe('start');
    expect(seiteVon('/app')).toBe('app');
    expect(seiteVon('/app/')).toBe('app');
    expect(seiteVon('/lab')).toBe('editor');
    expect(seiteVon('/lab/')).toBe('editor');
  });

  it('alles andere ist unbekannt', () => {
    for (const p of ['/test', '/labor', '/lab/x', '/app/x', '/apps', '//lab']) expect(seiteVon(p)).toBeNull();
  });

  it('gilt relativ zur Basis der App', () => {
    expect(seiteVon('/vorschau/lab', '/vorschau/')).toBe('editor');
    expect(seiteVon('/vorschau/', '/vorschau/')).toBe('start');
    expect(seiteVon('/lab', '/vorschau/')).toBeNull();
  });
});

describe('adresseBereinigen', () => {
  const mit = (pathname: string, search = '', hash = '') => {
    const replaceState = vi.fn();
    vi.stubGlobal('location', { pathname, search, hash });
    vi.stubGlobal('history', { state: null, replaceState });
    adresseBereinigen();
    return replaceState.mock.calls.map((c) => c[2]);
  };

  it('unbekannte Pfade → Startseite, ohne Rest in der Adresse', () => {
    expect(mit('/test')).toEqual(['/']);
    expect(mit('/test', '?x=1', '#y')).toEqual(['/']);
  });

  it('Schrägstrich am Ende fällt weg, Abfrage und Anker bleiben', () => {
    expect(mit('/lab/', '?x=1')).toEqual(['/lab?x=1']);
    expect(mit('/app/')).toEqual(['/app']);
    expect(mit('/index.html')).toEqual(['/']);
  });

  it('bekannte Adressen bleiben unangetastet', () => {
    expect(mit('/')).toEqual([]);
    expect(mit('/lab')).toEqual([]);
    expect(mit('/app')).toEqual([]);
  });
});
