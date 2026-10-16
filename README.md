# Film Lab

Film Lab gibt Kamerafotos den Look analoger Filme und Kamerasimulationen. Die Bearbeitung läuft komplett im Browser (WebGL2), Export in voller Auflösung mit Aufnahmedaten. Live: https://lab.hugobarthelmess.de

Die Einstellungen folgen dem Fuji-Bildmenü, damit sich Rezepte wie bei Fuji X Weekly eintragen oder einfügen lassen.

## Looks

- **Fujifilm:** 20 Filmsimulationen (Provia, Velvia, Astia, Classic Chrome, Reala Ace, Pro Neg., Classic Neg., Nostalgic Neg., Eterna, Acros mit Filtern, Monochrom mit Filtern, Sepia u. a.).
- **Leica:** 18 Looks (Standard, Vivid, Natural, Classic, Chrome, Silver, Teal, Cine, Monochrom-Varianten u. a.).
- **Kodak:** 17 Filme als Fuji-Rezepte (Portra 160/400/800, Ektar 100, Gold 200, UltraMax 400, Kodachrome, Ektachrome E100, Vision3, CineStill 800T, Tri-X 400, T-Max u. a.).
- **Eigene:** eigene `.cube`-LUTs und gespeicherte Rezepte.

Die Looks sind nachempfunden und keine Originalprofile. Fujifilm, Leica und Kodak sind Marken ihrer Inhaber; Film Lab steht in keiner Verbindung zu ihnen.

## Bedienung

- **Looks wählen:** Chips oben (Fujifilm · Leica · Kodak · Eigene). Der aktive Chip folgt der Scrollposition. „Rezept einfügen“ steht daneben.
- **Look wechseln:** Auf dem Bild nach links oder rechts wischen. Mit der Tastatur ↑ / ↓.
- **Original zeigen:** Bild gedrückt halten, oder Leertaste bzw. `\` halten.
- **100-%-Lupe:** Doppeltipp oder Doppelklick, oder `Z`. Im Zoom verschiebt das Mausrad das Bild. `Esc` verlässt die Lupe.
- **Vorher/Nachher:** `B`.
- **Foto wechseln:** ← / → (Filmstreifen am Rand).
- **Export:** `Strg+E` (am Mac `⌘E`).
- **Rückgängig:** `Strg+Z` (am Mac `⌘Z`). Foto entfernen: `Entf`.
- **Alle Tastenkürzel:** `?`.

### Einstellungen

Der Tab „Anpassen“ hat die Fuji-Bildeinstellungen: Dynamic Range (DR100/200/400), Lichter- und Schatten-Ton, Farbe, Schärfe, Klarheit, Weißabgleich mit Feinabstimmung (Rot/Cyan, Blau/Gelb), Korn (Stärke und Größe), Color Chrome Effect, Color Chrome FX Blue, Monochrom-Tönung. Dazu als Extras Halation, Vignette, Lichtlecks. Die Stärke des Looks (Mischung mit dem Original) steht im Tab „Looks“.

### Rezept einfügen

„Rezept einfügen“ nimmt den Text eines Rezepts (Format wie bei Fuji X Weekly, englisch: `Film Simulation: …`, `Dynamic Range: …`, `Grain Effect: …` usw.) und stellt Look und Einstellungen ein. Was nicht erkannt oder nicht umsetzbar ist, wird angezeigt und nicht geraten. Eigene Rezepte werden im Browser gemerkt.

### Fujifilm-LUTs (optional)

Film Lab liefert die offiziellen Fujifilm-LUTs nicht mit: Die Daten gehören Fujifilm und werden nicht ins Repo oder in die App aufgenommen. Ohne sie rechnet Film Lab die Fujifilm-Looks nach. Mit den Originalen kommen sie näher an das Vorbild heran:

1. Auf fujifilm-x.com die LUT-Downloads öffnen und das Paket „GFX ETERNA 55“ laden.
2. Die ZIP-Datei in Film Lab unter „Fujifilm-LUTs“ wählen oder ins Fenster ziehen.
3. Die Dateien bleiben auf dem Gerät und werden nicht hochgeladen.

## Sony a6000 aufs Handy

- JPEG oder Sony-RAW (ARW) sind möglich. RAW-Dateien kommen nur per Speicherkarte oder über den PC in Film Lab, nicht über die Smartphone-Verbindung.
- Per Imaging Edge Mobile: Kamera mit „An Smartphone senden“ verbinden, Bildgröße „Original“ wählen. Danach die Fotos in Film Lab aus der Galerie wählen.

## Als App installieren und offline nutzen

Film Lab ist eine PWA. Im Browser „Zum Home-Bildschirm“ (iPhone: Teilen → „Zum Home-Bildschirm“) oder „App installieren“ (Chrome, Edge) wählen. Danach läuft die App auch ohne Netz. Die neue Version kommt beim nächsten Start, nicht mitten in einer Bearbeitung.

## Datenschutz

Alles läuft im Browser. Fotos werden nicht hochgeladen. Die Seite setzt keine Cookies und hat kein Tracking. Die Content-Security-Policy erlaubt Verbindungen nur zur eigenen Seite (`deploy/security-headers.conf`). Rezepte und eigene LUTs bleiben im Speicher dieses Browsers (localStorage und IndexedDB) und verlassen ihn nicht.

## Entwicklung

Voraussetzungen: Node 22.

```bash
npm install
npm run dev          # Entwicklungsserver
npm test             # Typecheck, Lint, Unit-Tests (vitest)
npm run build        # Produktionsbuild nach dist/
```

Weitere Tests: `npm run test:engine`, `test:io`, `test:raw`, `test:pwa` und `test:browser` (Ende-zu-Ende mit headless Chrome). Der Browser-Test nutzt `CHROME_BIN` (Standard: `~/.local/bin/chrome-headless`) und den Port aus `TEST_PORT` (Standard 5190). Die Testbilder liegen privat in `testbilder/` und sind nicht im Repo.

## Deployment

Film Lab ist eine statische Seite in einem nginx-Container. Einrichtung und Ablauf stehen in [docs/DEPLOY.md](docs/DEPLOY.md). Die CI testet jeden Push, ein grüner Push auf `main` geht live, sobald das Deployment eingerichtet ist.

## Aufbau

Jedes Modul hat seinen Ordner:

- `src/looks/`: Film-Looks als 3D-LUT und `.cube`-Parser (reine Funktionen).
- `src/io/`: Dateien einlesen (JPEG, PNG, HEIC, ARW), Metadaten, JPEG-Ausgabe.
- `src/engine/`: WebGL2-Pipeline für Vorschau und Export.
- `src/ui/`: React-Oberfläche mit zustand.

Der gemeinsame Vertrag steht in [src/types.ts](src/types.ts).

## Lizenzen und Drittanbieter

Film Lab nutzt Open-Source-Bibliotheken, unter anderem LibRaw (RAW-Dekodierung), mozjpeg über `@jsquash/jpeg` (JPEG-Kodierung), `libraw-wasm`, fflate, lucide-react, React und zustand. Die Lizenzhinweise stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Die vollständigen Lizenztexte liegen in `public/licenses.txt` (`npm run licenses`).
