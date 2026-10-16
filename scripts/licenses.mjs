// Sammelt die Lizenztexte der ausgelieferten Pakete nach public/licenses.txt.
// Aufruf: node scripts/licenses.mjs            (schreibt die Datei)
//         node scripts/licenses.mjs --check    (prüft nur, ob sie aktuell ist)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const nm = join(root, 'node_modules');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// Pakete mit eigenem Hinweis in THIRD_PARTY_NOTICES.md (keine LICENSE-Datei im Paket).
const MANUAL = new Set(['libraw-wasm']);
// Zusätzliche Dateien, die im Paket liegen, aber nicht LICENSE heißen.
const EXTRA = { '@jsquash/jpeg': ['codec/LICENSE.codec.md'] };
const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE'];

// Ausgeliefert werden alle Laufzeitabhängigkeiten, dazu Workbox (sw.js) und Tailwind (CSS).
const names = [
  ...Object.keys(pkg.dependencies),
  'tailwindcss',
  ...readdirSync(nm).filter((n) => n.startsWith('workbox-')),
].sort();

function licenseText(name) {
  const dir = join(nm, name);
  const files = [...LICENSE_NAMES, ...(EXTRA[name] ?? [])]
    .map((f) => join(dir, f))
    .filter((f) => existsSync(f));
  if (files.length === 0) throw new Error(`Keine Lizenzdatei für ${name} (ist es ein Handarbeits-Eintrag?)`);
  return files.map((f) => readFileSync(f, 'utf8').trimEnd()).join('\n\n');
}

function build() {
  const parts = [
    'Film Lab – Lizenzen der ausgelieferten Software',
    'Automatisch erzeugt mit scripts/licenses.mjs. Nicht von Hand bearbeiten.',
    '',
    readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8').trimEnd(),
  ];
  for (const name of names) {
    if (MANUAL.has(name)) continue;
    const version = JSON.parse(readFileSync(join(nm, name, 'package.json'), 'utf8')).version;
    parts.push('', '='.repeat(72), `${name} ${version}`, '='.repeat(72), '', licenseText(name));
  }
  return parts.join('\n') + '\n';
}

const out = join(root, 'public', 'licenses.txt');
const text = build();
if (process.argv.includes('--check')) {
  const have = existsSync(out) ? readFileSync(out, 'utf8') : null;
  if (have !== text) {
    console.error('public/licenses.txt fehlt oder ist veraltet: npm run licenses');
    process.exit(1);
  }
  console.log('public/licenses.txt ist aktuell.');
} else {
  writeFileSync(out, text);
  console.log(`geschrieben: ${out} (${names.length} Pakete)`);
}
