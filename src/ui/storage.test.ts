import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadObjektivkorrektur, loadPresets, saveObjektivkorrektur } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('loadPresets', () => {
  it('legt die Stärke aufs 1 %-Raster des Reglers (s = 0,02), s = 1 bleibt exakt', () => {
    const list = [0.85, 1, 0.3, undefined].map((strength, i) => ({ id: `p${i}`, name: 'X', lookId: 'velvia', params: { strength } }));
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(list) });
    expect(loadPresets().map((p) => p.params.strength)).toEqual([0.86, 1, 0.3, 1]);
  });
});

describe('Objektivkorrektur', () => {
  it('ist ohne gespeicherte Wahl aus und merkt sich an/aus', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
    expect(loadObjektivkorrektur()).toBe(false);
    saveObjektivkorrektur(true);
    expect(loadObjektivkorrektur()).toBe(true);
    saveObjektivkorrektur(false);
    expect(loadObjektivkorrektur()).toBe(false);
  });

  it('bleibt aus, wenn der Speicher gesperrt ist', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('gesperrt');
      },
    });
    expect(loadObjektivkorrektur()).toBe(false);
  });
});
