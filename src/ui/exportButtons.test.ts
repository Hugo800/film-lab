import { describe, expect, it } from 'vitest';
import { exportActionLabel, exportButtons } from './exportButtons';

describe('exportButtons', () => {
  it('iPhone/iPad mit Teilen: genau ein Knopf „In Fotos sichern“ samt Hinweis', () => {
    const b = exportButtons({ ios: true, touch: true, canShare: true });
    expect(b).toEqual({ primary: 'sichern', hint: 'Im Teilen-Menü „Bild sichern“ wählen.' });
    expect(b.secondary).toBeUndefined();
  });
  it('iPad mit Desktop-Kennung (touch ohne coarse) bleibt bei einem Knopf', () => {
    expect(exportButtons({ ios: true, touch: false, canShare: true }).secondary).toBeUndefined();
  });
  it('Android mit Teilen: Teilen primär, Herunterladen sekundär', () => {
    expect(exportButtons({ ios: false, touch: true, canShare: true })).toEqual({ primary: 'teilen', secondary: 'herunterladen' });
  });
  it('PC: nur Herunterladen, auch wenn der Browser Teilen kann', () => {
    expect(exportButtons({ ios: false, touch: false, canShare: true })).toEqual({ primary: 'herunterladen' });
    expect(exportButtons({ ios: false, touch: false, canShare: false })).toEqual({ primary: 'herunterladen' });
  });
  it('ohne Teilen-Unterstützung: Herunterladen, auch am Handy', () => {
    expect(exportButtons({ ios: true, touch: true, canShare: false })).toEqual({ primary: 'herunterladen' });
    expect(exportButtons({ ios: false, touch: true, canShare: false })).toEqual({ primary: 'herunterladen' });
  });
});

describe('exportActionLabel', () => {
  it('beschriftet nach Aktion und Anzahl', () => {
    expect(exportActionLabel('sichern', 3)).toBe('In Fotos sichern');
    expect(exportActionLabel('teilen', 1)).toBe('Teilen');
    expect(exportActionLabel('herunterladen', 1)).toBe('Herunterladen');
    expect(exportActionLabel('herunterladen', 2)).toBe('ZIP herunterladen');
  });
});
