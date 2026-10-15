// XMP-Patch für den Export: tiff:Orientation und exif:PixelX/YDimension (Attribut- und Elementform).

const XMP_ID = 'http://ns.adobe.com/xap/1.0/\0';

function setProp(xml: string, name: string, value: number): string {
  const n = name.replace(':', '\\:');
  const attr = new RegExp(`(\\b${n}\\s*=\\s*)(["'])\\d+\\2`, 'g');
  const elem = new RegExp(`(<${n}>\\s*)\\d+(\\s*</${n}>)`, 'g');
  return xml.replace(attr, `$1$2${value}$2`).replace(elem, `$1${value}$2`);
}

/** Gepatchte Kopie; unverändert, wenn nichts zu ändern war. Wirft bei Nicht-UTF-8 oder fehlender Kennung. */
export function patchXmp(xmp: Uint8Array, size: { width: number; height: number }): Uint8Array {
  const idLen = XMP_ID.length;
  const id = new TextDecoder().decode(xmp.subarray(0, idLen));
  if (id !== XMP_ID) throw new Error('XMP: Kennung fehlt');
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(xmp.subarray(idLen));
  let out = setProp(xml, 'tiff:Orientation', 1);
  out = setProp(out, 'exif:PixelXDimension', size.width);
  out = setProp(out, 'exif:PixelYDimension', size.height);
  if (out === xml) return xmp;
  const body = new TextEncoder().encode(out);
  const res = new Uint8Array(idLen + body.length);
  res.set(xmp.subarray(0, idLen));
  res.set(body, idLen);
  return res;
}
