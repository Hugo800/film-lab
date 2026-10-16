import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initPersist } from './persist';
import { useStore } from './store';

const HINT = /^Tipp: Teilen/;
let stored: Map<string, string>;

beforeEach(() => {
  vi.useFakeTimers();
  stored = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v) });
  vi.stubGlobal('navigator', { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5, standalone: false });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  useStore.setState({ presets: [], customLuts: [], officialKeys: [], notice: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const savePreset = () => {
  // Wie RecipeDialog/Adjust: erst speichern, dann die eigene Meldung.
  useStore.setState({ presets: [{ id: 'preset:1', name: 'X', lookId: 'none', params: {} as never }] });
  useStore.getState().notify('Rezept „X“ gespeichert');
};

it('iOS-Hinweis erscheint nach der Meldung zum ersten Rezept, statt von ihr verdrängt zu werden', () => {
  initPersist();
  savePreset();
  expect(stored.size).toBe(0);
  vi.advanceTimersByTime(5000);
  expect(useStore.getState().notice?.text).toMatch(HINT);
  expect(stored.size).toBe(1);
});

it('iOS-Hinweis wartet, solange „Rückgängig“ angeboten wird, und merkt sich erst dann', () => {
  initPersist();
  savePreset();
  useStore.getState().notify('Foto entfernt', 'info', { label: 'Rückgängig', run: () => {} });
  vi.advanceTimersByTime(5000);
  expect(useStore.getState().notice?.text).toBe('Foto entfernt');
  expect(stored.size).toBe(0);
  useStore.getState().dismissNotice();
  vi.advanceTimersByTime(5000);
  expect(useStore.getState().notice?.text).toMatch(HINT);
});
