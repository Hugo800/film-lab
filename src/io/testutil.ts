// Hilfen für die Unit-Tests: synthetische Exif-/JPEG-Bytes.
export interface ExifOptions {
  le: boolean;
  orientation?: number;
  width?: number;
  height?: number;
  /** SHORT oder LONG für PixelX/YDimension. */
  dimType?: 3 | 4;
  thumbnail?: boolean;
}

/** „Exif\0\0“ + TIFF: IFD0 (Orientation, ExifIFD-Zeiger, Next→IFD1), ExifIFD (PixelX/Y), IFD1 mit Vorschaubild. */
export function buildExif(o: ExifOptions): Uint8Array {
  const b = new Uint8Array(400);
  const v = new DataView(b.buffer);
  const le = o.le;
  b.set([0x45, 0x78, 0x69, 0x66, 0, 0]);
  const t = 6;
  b.set(le ? [0x49, 0x49] : [0x4d, 0x4d], t);
  v.setUint16(t + 2, 42, le);
  v.setUint32(t + 4, 8, le);
  const entry = (at: number, tag: number, type: number, value: number) => {
    v.setUint16(t + at, tag, le);
    v.setUint16(t + at + 2, type, le);
    v.setUint32(t + at + 4, 1, le);
    if (type === 3) v.setUint16(t + at + 8, value, le);
    else v.setUint32(t + at + 8, value, le);
  };
  // IFD0 bei 8: 3 Einträge → endet bei 8+2+36+4 = 50
  v.setUint16(t + 8, 3, le);
  entry(10, 0x0112, 3, o.orientation ?? 6);
  entry(22, 0x8769, 4, 60);
  entry(34, 0x0110, 4, 12345); // Dummy-Tag, bleibt unberührt
  v.setUint32(t + 46, o.thumbnail ? 100 : 0, le);
  // ExifIFD bei 60: 2 Einträge → endet bei 60+2+24+4 = 90
  v.setUint16(t + 60, 2, le);
  const dt = o.dimType ?? 3;
  entry(62, 0xa002, dt, o.width ?? 5000);
  entry(74, 0xa003, dt, o.height ?? 3000);
  // IFD1 bei 100: 2 Einträge → endet bei 100+2+24+4 = 130, Vorschau bei 140..180
  if (o.thumbnail) {
    v.setUint16(t + 100, 2, le);
    entry(102, 0x0201, 4, 140);
    entry(114, 0x0202, 4, 40);
    b.fill(0xaa, t + 140, t + 180);
  }
  return b.slice(0, t + (o.thumbnail ? 180 : 130));
}

export function readTag(exif: Uint8Array, ifdOffset: number, tag: number): { type: number; value: number } | undefined {
  const v = new DataView(exif.buffer, exif.byteOffset + 6);
  const le = String.fromCharCode(exif[6]) === 'I';
  const n = v.getUint16(ifdOffset, le);
  for (let i = 0; i < n; i++) {
    const at = ifdOffset + 2 + i * 12;
    if (v.getUint16(at, le) === tag) {
      const type = v.getUint16(at + 2, le);
      return { type, value: type === 3 ? v.getUint16(at + 8, le) : v.getUint32(at + 8, le) };
    }
  }
  return undefined;
}

export function segment(marker: number, payload: ArrayLike<number>): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...Array.from(payload)];
}

export function ascii(s: string): number[] {
  return Array.from(s, (c) => c.charCodeAt(0));
}

/** Gerüst-JPEG (nicht dekodierbar): SOI, Segmente, SOF0 mit Größe, SOS, Daten, EOI. */
export function fakeJpeg(segments: number[][], size = { width: 10, height: 20 }): Uint8Array {
  const sof = segment(0xc0, [8, size.height >> 8, size.height & 255, size.width >> 8, size.width & 255, 1, 1, 0x11, 0]);
  const sos = segment(0xda, [1, 1, 0, 0, 63, 0]);
  return Uint8Array.from([0xff, 0xd8, ...segments.flat(), ...sof, ...sos, 1, 2, 0xff, 0x00, 3, 0xff, 0xd9]);
}

/** Gültig aufgebautes Mini-ICC-Profil mit 'desc'-Tag (v2 oder mluc). */
export function fakeIcc(description: string, kind: 'desc' | 'mluc' = 'desc', pad = 0): Uint8Array {
  const textLen = kind === 'desc' ? 12 + description.length + 1 : 28 + description.length * 2;
  const tagOffset = 132 + 12;
  const total = tagOffset + textLen + pad;
  const b = new Uint8Array(total);
  const v = new DataView(b.buffer);
  v.setUint32(0, total);
  b.set(ascii('acsp'), 36);
  v.setUint32(128, 1);
  b.set(ascii('desc'), 132);
  v.setUint32(136, tagOffset);
  v.setUint32(140, textLen);
  b.set(ascii(kind), tagOffset);
  if (kind === 'desc') {
    v.setUint32(tagOffset + 8, description.length + 1);
    b.set(ascii(description), tagOffset + 12);
  } else {
    v.setUint32(tagOffset + 8, 1);
    v.setUint32(tagOffset + 12, 12);
    b.set(ascii('enUS'), tagOffset + 16);
    v.setUint32(tagOffset + 20, description.length * 2);
    v.setUint32(tagOffset + 24, 28);
    for (let i = 0; i < description.length; i++) v.setUint16(tagOffset + 28 + i * 2, description.charCodeAt(i));
  }
  return b;
}
