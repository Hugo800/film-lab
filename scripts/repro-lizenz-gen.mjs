// Erzeugt kaputte/riesige Testdateien nach test-output/lizenz/bad/ (nur lokal).
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { deflateSync, deflateRawSync } from 'node:zlib';
import { zipSync, strToU8 } from 'fflate';
import { randomBytes } from 'node:crypto';
const D = 'test-output/lizenz/bad/';
mkdirSync(D, { recursive: true });
const jpg = readFileSync('testbilder/DSC03982.JPEG');
const arw = readFileSync('testbilder/raw/DSC01542.ARW');
const w = (n, b) => writeFileSync(D + n, b);
w('leer.jpg', Buffer.alloc(0));
w('text.jpg', 'Das ist kein Bild.\n'.repeat(100));
w('abgeschnitten.jpg', jpg.subarray(0, Math.floor(jpg.length * 0.3)));
const mid = Buffer.from(jpg); randomBytes(1_500_000).copy(mid, 2_000_000); w('mitte-kaputt.jpg', mid);
// SOF0/SOF2 Maße auf 65535 x 65535
const big = Buffer.from(jpg);
for (let i = 2; i < big.length - 10; ) { if (big[i] !== 0xff) { i++; continue; } const m = big[i + 1]; if (m === 0xc0 || m === 0xc1 || m === 0xc2) { big.writeUInt16BE(65535, i + 5); big.writeUInt16BE(65535, i + 7); console.log('SOF bei', i, m.toString(16)); break; } if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; } i += 2 + big.readUInt16BE(i + 2); }
w('riesig-65535.jpg', big);
// PNG-Bombe: 20000 x 20000 Graustufen 8 Bit, nur Nullen (komprimiert wenige 100 KB)
function crcTable() { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const T = crcTable(); const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const png = (W, H) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 0;
  const row = Buffer.alloc(W + 1); const z = deflateSync(Buffer.concat(Array(1).fill(row)), { level: 9 });
  // eine Zeile komprimiert; für H Zeilen den Rohstrom streamen: wir bauen einen Deflate-Strom aus H identischen Zeilen blockweise
  const chunks = []; const rowsPer = 2000; const blk = Buffer.alloc((W + 1) * rowsPer);
  const parts = []; for (let y = 0; y < H; y += rowsPer) parts.push(deflateRawSync(blk.subarray(0, (W + 1) * Math.min(rowsPer, H - y)), { level: 9 }));
  // Rohe Deflate-Ströme lassen sich nicht einfach aneinanderhängen (Final-Bit); stattdessen alles am Stück
  return { ihdr, row, parts };
};
// Einfacher: kompletten Rohdaten-Puffer 20000x2000 mehrfach? -> Speicher: 20000*20001 = 400 MB, machbar in Node.
{
  const W = 20000, H = 20000; const raw = Buffer.alloc((W + 1) * H);
  const z = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8;
  w('png-bombe-20000.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z), chunk('IEND', Buffer.alloc(0))]));
  console.log('png-bombe', z.length);
}
w('abgeschnitten.arw', arw.subarray(0, Math.floor(arw.length * 0.4)));
w('zufall.arw', randomBytes(5_000_000));
w('leer.arw', Buffer.alloc(0));
w('text.arw', 'kein raw');
const arwMid = Buffer.from(arw); randomBytes(2_000_000).copy(arwMid, 1_000_000); w('mitte-kaputt.arw', arwMid);
w('fake.heic', Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(4), Buffer.from('heicmif1'), randomBytes(5000)]));
// Exif-Schleife: APP1 mit IFD0 -> next = IFD0
function withExif(tiff) {
  const seg = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const len = Buffer.alloc(2); len.writeUInt16BE(seg.length + 2);
  let i = 2; while (jpg[i] === 0xff && jpg[i + 1] >= 0xe0 && jpg[i + 1] <= 0xef) i += 2 + jpg.readUInt16BE(i + 2);
  return Buffer.concat([jpg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, seg, jpg.subarray(i)]);
}
const le = (...v) => Buffer.from(v);
const ifdLoop = Buffer.alloc(8 + 2 + 4); ifdLoop.write('II'); ifdLoop.writeUInt16LE(42, 2); ifdLoop.writeUInt32LE(8, 4); ifdLoop.writeUInt16LE(0, 8); ifdLoop.writeUInt32LE(8, 10);
w('exif-schleife.jpg', withExif(ifdLoop));
const manyEntries = Buffer.alloc(8 + 2 + 4); manyEntries.write('MM'); manyEntries.writeUInt16BE(42, 2); manyEntries.writeUInt32BE(8, 4); manyEntries.writeUInt16BE(65535, 8);
w('exif-65535-eintraege.jpg', withExif(manyEntries));
// ZIPs
w('zufall.zip', randomBytes(100000));
w('leer.zip', Buffer.alloc(0));
w('ohne-cube.zip', Buffer.from(zipSync({ 'a.txt': strToU8('hallo') })));
const cubeOk = (n) => 'LUT_3D_SIZE ' + n + '\n' + Array.from({ length: n ** 3 }, (_, i) => `${(i % n) / (n - 1)} ${(Math.floor(i / n) % n) / (n - 1)} ${Math.floor(i / n / n) / (n - 1)}`).join('\n');
w('flog2-unsinn.zip', Buffer.from(zipSync({ 'FLog2_to_PROVIA_33grid_V.1.00.cube': strToU8(cubeOk(5)), 'FLog2_to_VELVIA_33grid_V.1.00.cube': strToU8('murks') })));
const zipReal = readFileSync('testbilder/luts/fujifilm-official/zips/gfx-eterna-55-3d-lut-v110.zip');
w('echt-abgeschnitten.zip', zipReal.subarray(0, Math.floor(zipReal.length / 2)));
// Zip-Bombe: .cube mit 600 MB Nullen
{
  const raw = Buffer.alloc(600 * 1024 * 1024, 0x20);
  const z = zipSync({ 'FLog2_to_PROVIA_33grid_V.1.00.cube': [new Uint8Array(raw.buffer, raw.byteOffset, raw.length), { level: 9 }] });
  w('zip-bombe.zip', Buffer.from(z)); console.log('zip-bombe', z.length);
}
// .cube
w('cube-zufall.cube', randomBytes(100000));
w('cube-65-leer.cube', 'LUT_3D_SIZE 65\n0 0 0\n');
w('cube-nan.cube', 'LUT_3D_SIZE 2\n' + 'NaN NaN NaN\n'.repeat(8));
w('cube-1e999.cube', 'LUT_3D_SIZE 2\n' + '1e999 -1e999 0\n'.repeat(8));
w('cube-lange-zeile.cube', 'TITLE "' + 'A'.repeat(5_000_000) + '"\nLUT_3D_SIZE 2\n' + '0 0 0\n1 1 1\n'.repeat(4));
w('cube-gross-1d.cube', 'LUT_1D_SIZE 65536\n' + '0.5 0.5 0.5\n'.repeat(65536));
w('cube-domain-entartet.cube', 'DOMAIN_MIN 0 0 0\nDOMAIN_MAX 1e-300 1 1\nLUT_3D_SIZE 2\n' + '0 0 0\n1 1 1\n'.repeat(4));
w('cube-65-voll.cube', cubeOk(65));
