import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildZip } from './zip';

// toEqual vergleicht große Typed Arrays Element für Element über Sekunden; so geht es in Millisekunden.
const same = (x: Uint8Array, y: Uint8Array) => x.length === y.length && x.every((v, i) => v === y[i]);

describe('buildZip', () => {
  it('packt Blobs unverändert und lesbar', async () => {
    const a = new Uint8Array(200_000).map((_, i) => (i * 7) % 256);
    const b = new Uint8Array([1, 2, 3]);
    const zip = await buildZip([
      { name: 'a_filmlab.jpg', blob: new Blob([a]) },
      { name: 'b_filmlab.jpg', blob: new Blob([b]) },
    ]);
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(files)).toEqual(['a_filmlab.jpg', 'b_filmlab.jpg']);
    expect(same(files['a_filmlab.jpg'], a)).toBe(true);
    expect(files['b_filmlab.jpg']).toEqual(b);
  });
});
