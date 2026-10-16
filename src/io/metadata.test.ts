import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { detectFormat, readHeifProfile, readPngProfile, readWebpProfile } from './containers';
import { patchExif, readOrientation } from './exif';
import { colorSpaceFromIcc, iccDescription, joinIcc, splitIcc } from './icc';
import { extractMetadata, parseJpegHead, readJpegSize, replaceAppSegments } from './jpeg';
import { withMetadata } from './metadata';
import { patchXmp } from './xmp';
import { ascii, buildExif, fakeIcc, fakeJpeg, readTag, segment } from './testutil';
import { zlibSync } from 'fflate';

const XMP_ID = 'http://ns.adobe.com/xap/1.0/\0';
const xmpBytes = (xml: string) => Uint8Array.from([...ascii(XMP_ID), ...new TextEncoder().encode(xml)]);
const xmpText = (b: Uint8Array) => new TextDecoder().decode(b.subarray(XMP_ID.length));
const NEW = { width: 4000, height: 6000 };
// toEqual vergleicht große Typed Arrays Element für Element über Sekunden; so geht es in Millisekunden.
const same = (x: Uint8Array, y: Uint8Array) => x.length === y.length && x.every((v, i) => v === y[i]);

describe('patchExif', () => {
  for (const le of [true, false]) {
    for (const dimType of [3, 4] as const) {
      it(`${le ? 'Little' : 'Big'} Endian, Maße als ${dimType === 3 ? 'SHORT' : 'LONG'}`, () => {
        const src = buildExif({ le, dimType, orientation: 6, width: 5000, height: 3000, thumbnail: true });
        const out = patchExif(src, NEW);
        expect(readTag(out, 8, 0x0112)?.value).toBe(1);
        const exifIfd = readTag(out, 8, 0x8769)!.value;
        expect(readTag(out, exifIfd, 0xa002)?.value).toBe(4000);
        expect(readTag(out, exifIfd, 0xa003)?.value).toBe(6000);
        expect(readTag(out, 8, 0x0110)?.value).toBe(12345);
        // IFD1 abgekoppelt, Vorschau-Bytes genullt
        expect(new DataView(out.buffer, 6).getUint32(8 + 2 + 36, le)).toBe(0);
        expect(out.subarray(6 + 140, 6 + 180).every((x) => x === 0)).toBe(true);
        // Eingabe unverändert
        expect(readTag(src, 8, 0x0112)?.value).toBe(6);
        expect(readOrientation(src)).toBe(6);
        expect(readOrientation(out)).toBe(1);
      });
    }
  }

  it('macht aus SHORT ein LONG, wenn die neue Größe nicht mehr passt', () => {
    const out = patchExif(buildExif({ le: true, dimType: 3, width: 100, height: 100 }), { width: 70000, height: 80000 });
    const exifIfd = readTag(out, 8, 0x8769)!.value;
    expect(readTag(out, exifIfd, 0xa002)).toEqual({ type: 4, value: 70000 });
    expect(readTag(out, exifIfd, 0xa003)).toEqual({ type: 4, value: 80000 });
  });

  it('wirft bei kaputten Eingaben statt Müll zu schreiben', () => {
    const good = buildExif({ le: true });
    expect(() => patchExif(good.subarray(0, 20), NEW)).toThrow();
    expect(() => patchExif(Uint8Array.from(ascii('Exif\0\0garbagegarbage')), NEW)).toThrow();
    const badOffset = good.slice();
    new DataView(badOffset.buffer).setUint32(6 + 4, 9999, true);
    expect(() => patchExif(badOffset, NEW)).toThrow();
    expect(() => patchExif(Uint8Array.from(ascii('JFIF\0\0') .concat(new Array(20).fill(0))), NEW)).toThrow();
  });

  it('liest die Orientierung nur aus gültigem Exif', () => {
    expect(readOrientation(undefined)).toBeUndefined();
    expect(readOrientation(Uint8Array.from([1, 2, 3]))).toBeUndefined();
    expect(readOrientation(buildExif({ le: false, orientation: 8 }))).toBe(8);
  });
});

describe('patchXmp', () => {
  it('Attributform', () => {
    const x = xmpBytes(`<rdf:Description tiff:Orientation="6" exif:PixelXDimension='5000' exif:PixelYDimension="3000" x:foo="1"/>`);
    expect(xmpText(patchXmp(x, NEW))).toBe(
      `<rdf:Description tiff:Orientation="1" exif:PixelXDimension='4000' exif:PixelYDimension="6000" x:foo="1"/>`,
    );
  });
  it('Elementform', () => {
    const x = xmpBytes('<tiff:Orientation>8</tiff:Orientation><exif:PixelXDimension> 5000 </exif:PixelXDimension><exif:PixelYDimension>3000</exif:PixelYDimension>');
    expect(xmpText(patchXmp(x, NEW))).toBe(
      '<tiff:Orientation>1</tiff:Orientation><exif:PixelXDimension> 4000 </exif:PixelXDimension><exif:PixelYDimension>6000</exif:PixelYDimension>',
    );
  });
  it('lässt XMP ohne die Felder unverändert und erhält UTF-8', () => {
    const x = xmpBytes('<x:a>Größe 5000</x:a>');
    expect(patchXmp(x, NEW)).toBe(x);
  });
  it('wirft ohne Kennung oder bei ungültigem UTF-8', () => {
    expect(() => patchXmp(Uint8Array.from(ascii('nope')), NEW)).toThrow();
    expect(() => patchXmp(Uint8Array.from([...ascii(XMP_ID), 0xff, 0xfe]), NEW)).toThrow();
  });
});

describe('ICC', () => {
  it('erkennt Display P3 (desc v2 und mluc v4), sonst sRGB', () => {
    const p3 = splitIcc(fakeIcc('Display P3'));
    expect(colorSpaceFromIcc(p3)).toBe('display-p3');
    expect(colorSpaceFromIcc(splitIcc(fakeIcc('Display P3', 'mluc')))).toBe('display-p3');
    expect(colorSpaceFromIcc(splitIcc(fakeIcc('sRGB IEC61966-2.1')))).toBe('srgb');
    expect(colorSpaceFromIcc(undefined)).toBe('srgb');
    expect(colorSpaceFromIcc([Uint8Array.from([1, 2, 3])])).toBe('srgb');
    expect(iccDescription(fakeIcc('Apple Test', 'mluc'))).toBe('Apple Test');
  });
  it('zerlegt große Profile in nummerierte Teile und setzt sie wieder zusammen', () => {
    const profile = fakeIcc('Display P3', 'desc', 150_000);
    const parts = splitIcc(profile);
    expect(parts.length).toBe(3);
    expect(parts.every((p) => p.length <= 65533)).toBe(true);
    expect([parts[0][12], parts[0][13], parts[2][12], parts[2][13]]).toEqual([1, 3, 3, 3]);
    expect(same(joinIcc(parts)!, profile)).toBe(true);
  });
  it('verwirft abgeschnittene Profile', () => {
    const parts = splitIcc(fakeIcc('x', 'desc', 150_000));
    expect(joinIcc(parts.slice(0, 2))).toBeNull();
  });
});

describe('JPEG-Segmente', () => {
  const exif = buildExif({ le: false, orientation: 6 });
  const xmp = xmpBytes('<x/>');
  const icc = splitIcc(fakeIcc('Display P3'))[0];

  it('extractMetadata findet Exif, XMP und ICC-Teile in Dateireihenfolge', () => {
    const jpeg = fakeJpeg([segment(0xe0, ascii('JFIF\0')), segment(0xe1, exif), segment(0xe1, xmp), segment(0xe2, icc)]);
    const m = extractMetadata(jpeg);
    expect(m.exif).toEqual(exif);
    expect(m.xmp).toEqual(xmp);
    expect(m.icc).toEqual([icc]);
    expect(readJpegSize(jpeg)).toEqual({ width: 10, height: 20 });
  });

  it('Teile mehrteiliger Profile bleiben in Reihenfolge', () => {
    const parts = splitIcc(fakeIcc('Display P3', 'desc', 100_000));
    const jpeg = fakeJpeg(parts.map((p) => segment(0xe2, p)));
    const icc = extractMetadata(jpeg).icc!;
    expect(icc.length === parts.length && icc.every((p, i) => same(p, parts[i]))).toBe(true);
  });

  it('kaputte Strukturen liefern keine Metadaten statt Fehler', () => {
    expect(extractMetadata(Uint8Array.from([1, 2, 3]))).toEqual({});
    expect(parseJpegHead(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0]))).toBeNull();
    expect(replaceAppSegments(Uint8Array.from([1, 2, 3, 4]), [])).toEqual(Uint8Array.from([1, 2, 3, 4]));
  });

  it('withMetadata ersetzt alte APPn-Segmente und patcht Exif/XMP', () => {
    const fresh = fakeJpeg([segment(0xe0, ascii('JFIF\0')), segment(0xee, ascii('Adobe\0')), segment(0xfe, ascii('hi'))], { width: 4000, height: 6000 });
    const meta = {
      exif: buildExif({ le: true, orientation: 6, thumbnail: true }),
      xmp: xmpBytes('<a tiff:Orientation="6" exif:PixelXDimension="5000" exif:PixelYDimension="3000"/>'),
      icc: [icc],
    };
    const out = withMetadata(fresh, meta, NEW);
    const head = parseJpegHead(out)!;
    expect(head.segments.map((s) => s.marker.toString(16))).toEqual(['e1', 'e1', 'e2', 'ee', 'fe', 'c0']);
    expect(head.segments[0].start).toBe(2); // Exif direkt hinter SOI
    const m = extractMetadata(out);
    expect(readOrientation(m.exif)).toBe(1);
    expect(readTag(m.exif!, readTag(m.exif!, 8, 0x8769)!.value, 0xa002)?.value).toBe(4000);
    expect(xmpText(m.xmp!)).toContain('tiff:Orientation="1" exif:PixelXDimension="4000" exif:PixelYDimension="6000"');
    expect(m.icc).toEqual([icc]);
    expect(readJpegSize(out)).toEqual({ width: 4000, height: 6000 });
    // Bilddaten unverändert am Ende
    const scan = fresh.subarray(parseJpegHead(fresh)!.scanStart);
    expect(out.subarray(out.length - scan.length)).toEqual(scan);
  });

  it('lässt unbrauchbare Teile weg, behält den Rest', () => {
    const fresh = fakeJpeg([]);
    const bad = withMetadata(
      fresh,
      { exif: Uint8Array.from(ascii('Exif\0\0nonsense....')), xmp: Uint8Array.from(ascii('kein xmp')), icc: [Uint8Array.from([1, 2, 3])] },
      NEW,
    );
    expect(parseJpegHead(bad)!.segments.map((s) => s.marker.toString(16))).toEqual(['c0']);
    const onlyIcc = withMetadata(fresh, { exif: Uint8Array.from([1]), icc: [icc] }, NEW);
    expect(parseJpegHead(onlyIcc)!.segments.map((s) => s.marker.toString(16))).toEqual(['e2', 'c0']);
  });

  it('lässt zu große Exif-Segmente weg', () => {
    const big = new Uint8Array(70_000);
    big.set(buildExif({ le: true }));
    const out = withMetadata(fakeJpeg([]), { exif: big }, NEW);
    expect(parseJpegHead(out)!.segments.map((s) => s.marker)).toEqual([0xc0]);
  });

  it('gibt Nicht-JPEG unverändert zurück', () => {
    const junk = Uint8Array.from([9, 9, 9, 9, 9]);
    expect(withMetadata(junk, { icc: [icc] }, NEW)).toBe(junk);
  });
});

describe('Formaterkennung und Container', () => {
  const heif = (brand: string, compat: string[] = []) => {
    const payload = [...ascii(brand), 0, 0, 0, 0, ...compat.flatMap(ascii)];
    return Uint8Array.from([0, 0, 0, 8 + payload.length, ...ascii('ftyp'), ...payload]);
  };
  it('Magic Bytes', () => {
    expect(detectFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('jpeg');
    expect(detectFormat(Uint8Array.from([0x89, ...ascii('PNG\r\n'), 0x1a, 0x0a]))).toBe('png');
    expect(detectFormat(Uint8Array.from([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBPVP8 ')]))).toBe('webp');
    expect(detectFormat(heif('heic'))).toBe('heic');
    expect(detectFormat(heif('mif1', ['heic']))).toBe('heic');
    expect(detectFormat(heif('avif'))).toBe('avif');
    expect(detectFormat(heif('qt  '))).toBeNull();
    expect(detectFormat(Uint8Array.from(ascii('GIF89a......')))).toBeNull();
    expect(detectFormat(new Uint8Array(0))).toBeNull();
  });

  const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...ascii(type), ...data, 0, 0, 0, 0];

  it('PNG iCCP', () => {
    const z = Array.from(zlibSync(fakeIcc('Display P3')));
    const png = Uint8Array.from([0x89, ...ascii('PNG\r\n'), 0x1a, 0x0a, ...chunk('IHDR', new Array(13).fill(0)), ...chunk('iCCP', [...ascii('p3'), 0, 0, ...z]), ...chunk('IDAT', [0])]);
    const info = readPngProfile(png);
    expect(info.colorSpace).toBe('display-p3');
    expect(joinIcc(info.meta.icc!)).toEqual(fakeIcc('Display P3'));
    expect(readPngProfile(Uint8Array.from([0x89, ...ascii('PNG\r\n'), 0x1a, 0x0a, ...chunk('IDAT', [0])])).colorSpace).toBe('srgb');
  });

  it('WebP ICCP', () => {
    const icc = fakeIcc('Display P3');
    const le = (n: number) => [n & 255, (n >> 8) & 255, 0, 0];
    const body = [...ascii('WEBP'), ...ascii('VP8X'), ...le(10), ...new Array(10).fill(0), ...ascii('ICCP'), ...le(icc.length), ...Array.from(icc)];
    const webp = Uint8Array.from([...ascii('RIFF'), ...le(body.length), ...body]);
    expect(readWebpProfile(webp).colorSpace).toBe('display-p3');
  });

  it('HEIC colr (prof und nclx)', () => {
    const box = (type: string, payload: number[]) => [0, 0, 0, 8 + payload.length, ...ascii(type), ...payload];
    const build = (colr: number[]) =>
      Uint8Array.from([...box('ftyp', [...ascii('heic'), 0, 0, 0, 0]), ...box('meta', [0, 0, 0, 0, ...box('iprp', box('ipco', [...box('hvcC', [1, 2]), ...colr]))]), ...box('mdat', [1, 2, 3])]);
    const prof = readHeifProfile(build(box('colr', [...ascii('prof'), ...Array.from(fakeIcc('Display P3'))])));
    expect(prof.colorSpace).toBe('display-p3');
    expect(prof.meta.icc).toBeDefined();
    expect(readHeifProfile(build(box('colr', [...ascii('nclx'), 0, 12, 0, 13, 0, 6, 0x80]))).colorSpace).toBe('display-p3');
    expect(readHeifProfile(build(box('colr', [...ascii('nclx'), 0, 1, 0, 13, 0, 6, 0x80]))).colorSpace).toBe('srgb');
    expect(readHeifProfile(build([])).colorSpace).toBe('srgb');
    expect(readHeifProfile(Uint8Array.from([0, 0, 0, 200, ...ascii('meta')])).colorSpace).toBe('srgb');
  });
});

const dir = new URL('../../testbilder/', import.meta.url);
const photos = ['DSC01603.JPEG', 'DSC03427.JPEG', 'DSC03982.JPEG', 'DSC04866.JPEG'].filter((f) => existsSync(new URL(f, dir)));

describe.skipIf(photos.length === 0)('echte Testbilder', () => {
  for (const f of photos) {
    it(`${f}: Metadaten lesen, patchen, neu lesen`, () => {
      const jpeg = new Uint8Array(readFileSync(new URL(f, dir)));
      const m = extractMetadata(jpeg);
      const size = readJpegSize(jpeg)!;
      expect(m.exif && m.xmp && m.icc?.length).toBeTruthy();
      expect(colorSpaceFromIcc(m.icc)).toBe('display-p3');
      expect(readOrientation(m.exif)).toBe(1);

      // Neue Maße und Orientation 6 im Original simulieren: Quell-Exif patchen heißt Werte setzen.
      const target = { width: 1234, height: 567 };
      const fresh = fakeJpeg([segment(0xe0, ascii('JFIF\0'))], target);
      const out = withMetadata(fresh, m, target);
      const n = extractMetadata(out);
      const exifIfd = readTag(n.exif!, 8, 0x8769)!.value;
      expect(readTag(n.exif!, exifIfd, 0xa002)?.value).toBe(1234);
      expect(readTag(n.exif!, exifIfd, 0xa003)?.value).toBe(567);
      expect(readOrientation(n.exif)).toBe(1);
      expect(n.icc).toEqual(m.icc);
      expect(n.xmp!.length).toBeGreaterThan(30);
      expect(size.width * size.height).toBeGreaterThan(1_000_000);
      expect(xmpText(n.xmp!)).not.toMatch(/PixelXDimension="(?!1234")/);
    });
  }
});
