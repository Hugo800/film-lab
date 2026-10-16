import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPresets } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('loadPresets', () => {
  it('legt die Stärke aufs 1 %-Raster des Reglers (s = 0,02), s = 1 bleibt exakt', () => {
    const list = [0.85, 1, 0.3, undefined].map((strength, i) => ({ id: `p${i}`, name: 'X', lookId: 'velvia', params: { strength } }));
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(list) });
    expect(loadPresets().map((p) => p.params.strength)).toEqual([0.86, 1, 0.3, 1]);
  });
});
