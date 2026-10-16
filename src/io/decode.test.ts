import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetProbe } from './decode';
import { loadFile } from './index';
import { fakeJpeg } from './testutil';

// Ein abgeschnittenes JPEG: createImageBitmap(blob) meldet „could not be decoded“, der <img>-Weg
// dekodiert teilweise und scheitert erst beim Bitmap mit „could not be allocated“.
describe('Dekodierfehler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetProbe();
  });

  it('meldet bei defekter Datei „beschädigt“, nicht Speichermangel', async () => {
    vi.stubGlobal('createImageBitmap', async (src: unknown) => {
      throw new Error(src instanceof Blob ? 'The source image could not be decoded.' : 'The ImageBitmap could not be allocated.');
    });
    vi.stubGlobal('Image', class { src = ''; decode = async () => undefined; });
    resetProbe();
    const file = new File([fakeJpeg([]) as BlobPart], 'IMG_0001.JPG', { type: 'image/jpeg' });
    await expect(loadFile(file)).rejects.toThrow(/beschädigt/);
  });
});
