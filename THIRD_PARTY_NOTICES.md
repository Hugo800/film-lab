# Drittanbieter-Software

Film Lab nutzt Open-Source-Bibliotheken. Ausgeliefert werden sie als Teil der Web-App.
Die vollständigen Lizenztexte stehen in `public/licenses.txt`, abrufbar unter
https://lab.hugobarthelmess.de/licenses.txt. Die Datei entsteht mit `npm run licenses`
aus diesem Abschnitt und den LICENSE-Dateien der Pakete. Nach Abhängigkeits-Updates
mit `node scripts/licenses.mjs --check` prüfen.

Die folgenden Komponenten haben keine eigene LICENSE-Datei im Paket oder brauchen einen
Hinweis, der von Hand kommt:

## LibRaw (RAW-Dekodierung, `libraw-*.wasm`)

- Lizenz: LGPL-2.1 oder CDDL-1.0 (nach Wahl des Nutzers)
- Quelle: https://www.libraw.org (Version laut Build in `libraw-wasm`)
- Copyright-Vermerke: siehe die Datei COPYRIGHT der verwendeten LibRaw-Version
- Vollständiger Text LGPL-2.1: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt
- Vollständiger Text CDDL-1.0: https://opensource.org/license/cddl-1-0

## Little CMS (Farbmanagement, in `libraw-*.wasm` enthalten)

- Lizenz: MIT
- Quelle: https://www.littlecms.com
- Copyright: Marti Maria Saguer (Vermerk laut LICENSE der verwendeten Version)

## mozjpeg / libjpeg-turbo (JPEG-Kodierung, `mozjpeg_enc-*.wasm` über `@jsquash/jpeg`)

- Lizenzen: IJG, BSD-3-Clause, zlib. Der Lizenztext steht unten (aus `@jsquash/jpeg/codec/LICENSE.codec.md`).
- Quelle: https://github.com/mozilla/mozjpeg
- Hinweis: Diese Software basiert teilweise auf der Arbeit der Independent JPEG Group.

## libraw-wasm (JavaScript-Wrapper für LibRaw)

- Lizenz: ISC
- Copyright (c) ybouane

Permission to use, copy, modify, and/or distribute this software for any purpose with or
without fee is hereby granted, provided that the above copyright notice and this permission
notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL
THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY
DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF
CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE
OR PERFORMANCE OF THIS SOFTWARE.

## Emscripten-Laufzeit (in `libraw-*.wasm` und `mozjpeg_enc-*.wasm`)

- Lizenz: MIT
- Quelle: https://emscripten.org
- Copyright: Emscripten-Autoren (siehe Datei AUTHORS im Emscripten-Projekt)

## Aus den Paketen übernommen

Die folgenden Lizenztexte stehen automatisch in `public/licenses.txt`:
`@jsquash/jpeg` (Apache-2.0), `fflate` (MIT), `lucide-react` (ISC, mit Feather-Anteil MIT),
`react` und `react-dom` (MIT), `zustand` (MIT), `tailwindcss` (MIT), `workbox-*` (MIT)
und `libraw-wasm` (ISC, siehe oben).
