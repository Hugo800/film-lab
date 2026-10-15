import { describe, expect, it } from 'vitest';
import { activeArea, rgbToRgba } from './pixels';

describe('activeArea', () => {
  const a6000 = { cleft: 65535, ctop: 65535, cwidth: 6000, cheight: 4000 };

  it('a6000: 6024×4024 → mittig 6000×4000', () => {
    expect(activeArea(a6000, 6024, 4024)).toEqual({ left: 12, top: 12, width: 6000, height: 4000 });
  });

  it('Hochformat (libraw hat schon gedreht): Maße vertauscht', () => {
    expect(activeArea(a6000, 4024, 6024)).toEqual({ left: 12, top: 12, width: 4000, height: 6000 });
  });

  it('gültiger Versatz wird übernommen', () => {
    expect(activeArea({ cleft: 8, ctop: 4, cwidth: 100, cheight: 50 }, 120, 60)).toEqual({ left: 8, top: 4, width: 100, height: 50 });
  });

  it('ohne Angabe oder mit unsinnigen Werten: ganzes Bild', () => {
    const full = { left: 0, top: 0, width: 6024, height: 4024 };
    expect(activeArea(undefined, 6024, 4024)).toEqual(full);
    expect(activeArea({ cleft: 65535, ctop: 65535, cwidth: 0, cheight: 0 }, 6024, 4024)).toEqual(full);
    expect(activeArea({ cleft: 65535, ctop: 65535, cwidth: 7000, cheight: 4000 }, 6024, 4024)).toEqual(full);
    expect(activeArea({ cleft: 100, ctop: 0, cwidth: 6000, cheight: 4000 }, 6024, 4024)).toEqual(full);
  });
});

describe('rgbToRgba', () => {
  // 3×2 Pixel, Werte = Pixelnummer*3 + Kanal
  const rgb = Uint8Array.from({ length: 18 }, (_, i) => i);

  it('ganzes Bild: Alpha 255, Kanäle unverändert', () => {
    const out = rgbToRgba(rgb, 3, { left: 0, top: 0, width: 3, height: 2 });
    expect(Array.from(out.subarray(0, 8))).toEqual([0, 1, 2, 255, 3, 4, 5, 255]);
    expect(out.length).toBe(24);
    expect(out[23]).toBe(255);
  });

  it('Ausschnitt: nimmt die richtigen Pixel', () => {
    const out = rgbToRgba(rgb, 3, { left: 1, top: 1, width: 2, height: 1 });
    expect(Array.from(out)).toEqual([12, 13, 14, 255, 15, 16, 17, 255]);
  });
});
