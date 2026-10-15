import { Zip, ZipPassThrough } from 'fflate';

/** ZIP ohne Kompression (JPEGs lassen sich nicht weiter packen); liest die Blobs als Stream. */
export async function buildZip(items: { name: string; blob: Blob }[]): Promise<Blob> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let failure: Error | null = null;
  const zip = new Zip((err, data) => {
    if (err) failure = err;
    else chunks.push(data as Uint8Array<ArrayBuffer>);
  });
  for (const { name, blob } of items) {
    const entry = new ZipPassThrough(name);
    zip.add(entry);
    const reader = blob.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      entry.push(value);
    }
    entry.push(new Uint8Array(0), true);
  }
  zip.end();
  if (failure) throw failure;
  return new Blob(chunks, { type: 'application/zip' });
}
