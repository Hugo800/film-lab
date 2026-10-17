import { describe, expect, it } from 'vitest';
import { istEditorPfad } from './route';

describe('istEditorPfad', () => {
  it('erkennt /lab mit und ohne Schrägstrich, sonst Startseite', () => {
    expect(istEditorPfad('/lab')).toBe(true);
    expect(istEditorPfad('/lab/')).toBe(true);
    expect(istEditorPfad('/')).toBe(false);
    expect(istEditorPfad('/index.html')).toBe(false);
    expect(istEditorPfad('/labor')).toBe(false);
    expect(istEditorPfad('/lab/x')).toBe(false);
  });

  it('gilt relativ zur Basis der App', () => {
    expect(istEditorPfad('/vorschau/lab', '/vorschau/')).toBe(true);
    expect(istEditorPfad('/lab', '/vorschau/')).toBe(false);
  });
});
