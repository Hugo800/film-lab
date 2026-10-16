import { describe, expect, it } from 'vitest';
import { fmtThirds } from './format';

describe('fmtThirds', () => {
  it('zeigt Drittelstufen wie an der Kamera', () => {
    expect(fmtThirds(0)).toBe('0 EV');
    expect(fmtThirds(1 / 3)).toBe('+1/3 EV');
    expect(fmtThirds(2 / 3)).toBe('+2/3 EV');
    expect(fmtThirds(1)).toBe('+1 EV');
    expect(fmtThirds(4 / 3)).toBe('+1 1/3 EV');
    expect(fmtThirds(2)).toBe('+2 EV');
  });

  it('nimmt das echte Minuszeichen und rundet auf das nächste Drittel', () => {
    expect(fmtThirds(-1 / 3)).toBe('−1/3 EV');
    expect(fmtThirds(-5 / 3)).toBe('−1 2/3 EV');
    expect(fmtThirds(0.67)).toBe('+2/3 EV');
    expect(fmtThirds(0.33333333333333304)).toBe('+1/3 EV');
    expect(fmtThirds(0.05)).toBe('0 EV');
  });
});
