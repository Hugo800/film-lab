import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { importOfficialLuts } from './officialLuts';

const enc = new TextEncoder();
const cube = enc.encode(['LUT_3D_SIZE 2', ...Array.from({ length: 8 }, (_, i) => `${i & 1} ${(i >> 1) & 1} ${i >> 2}`)].join('\n'));
const file = (name: string, data: Uint8Array) => new File([data as BlobPart], name);
const fails = (files: File[]) => importOfficialLuts(files, () => {}).then(() => '', (e: Error) => e.message);

describe('importOfficialLuts: Fehlertexte', () => {
  it('erkennt eine kaputte ZIP-Datei', async () => {
    expect(await fails([file('x.zip', enc.encode('keine zip datei'))])).toBe('Das ist keine ZIP-Datei, oder sie ist beschädigt.');
  });

  it('erkennt ein Paket ohne Filmsimulationen (nur ETERNA/WDR)', async () => {
    const zip = zipSync({ 'a/FLog2_to_ETERNA_33grid_V.1.00.cube': cube, 'a/FLog2_to_WDR-709_33grid.cube': cube });
    expect(await fails([file('nur-eterna.zip', zip)])).toMatch(/keine Filmsimulationen wie Provia oder Velvia.*GFX ETERNA 55/);
    expect(await fails([file('FLog2_to_WDR-709_33grid.cube', cube)])).toMatch(/keine Filmsimulationen/);
  });

  it('nennt kein ZIP „von Fujifilm“ bei fremden Dateien und verlangt PROVIA nur bei echten Simulationen', async () => {
    expect(await fails([file('foto.cube', cube)])).toMatch(/Keine Fujifilm-LUT gefunden\. Erwartet werden Dateien wie „FLog2_to_CLASSIC-CHROME/);
    expect(await fails([file('foto.cube', cube)])).not.toMatch(/ZIP von Fujifilm/);
    expect(await fails([file('FLog2_to_ASTIA_33grid_V.1.00.cube', cube)])).toMatch(/PROVIA fehlt/);
  });
});
