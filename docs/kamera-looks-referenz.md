# Kamera-Looks als Vorbild: Fujifilm-Filmsimulationen, Leica Looks, Kodak-Rezepte

Stand **16.10.2026**. Recherchebericht für Film Lab (WebGL2-Looks für Sony-a6000-Fotos). Ziel: die Looks sollen
so aussehen und sich so einstellen lassen wie die Presets in Fujifilm- und Leica-Kameras. Das Dokument trennt
sauber, was **belegt**, was **von mir gemessen** und was **Einschätzung** ist.

**Kennzeichnung**

- **[B]** belegt durch eine genannte Quelle (Hersteller, Handbuch, Artikel).
- **[M]** von mir gemessen an Referenzdaten (Methode steht dabei). Rohdaten und Bilder liegen lokal unter
  `testbilder/referenz/` (gitignored, urheberrechtlich geschützt, nur zum Messen), Herkunft siehe
  `testbilder/referenz/QUELLEN.md`.
- **[E]** Einschätzung oder Schluss aus den Daten, nicht direkt belegt.
- **[?]** offen oder unsicher.

Eigene Worte, keine langen Zitate. Quellen-URLs stehen je Abschnitt.

---

## 0. Datenlage in einem Blick (wichtigste Funde)

1. **Fujifilm hat die Farb- und Tonumsetzung von 10 Filmsimulationen als offizielle 3D-LUTs veröffentlicht**
   (F-Log2 → PROVIA, Velvia, ASTIA, CLASSIC CHROME, REALA ACE, PRO Neg. Std, CLASSIC Neg., ETERNA, ETERNA
   BLEACH BYPASS, ACROS; Paket „GFX ETERNA 55“ Ver. 1.10, 16.04.2026). Das ist die genaueste verfügbare Quelle,
   weil sie dieselbe Eingabe durch alle Looks schickt. Ich habe sie ausgewertet (Tonkurve, Chroma, Farbton,
   Abschnitt 1.2–1.4). Einschränkung: Videopfad (Rec.709-Ausgabe), nicht der Standbild-JPEG-Pfad **[?]**.
2. **Fujifilm veröffentlicht außerdem ein Charakterdiagramm je Simulation** (Farbe 14 Stufen, Lichter 10, Schatten 10,
   „Eigenheit“ 5) und Fuji-eigene Beschreibungen für alle 20 Simulationen, abrufbar über die WordPress-REST-Schnittstelle
   von fujifilm-x.com (Abschnitt 1.1).
3. **Zu Nostalgic Neg. und Pro Neg. Hi gibt es keine LUT**; dort bleiben nur Bildpaare (Abschnitt 1.4/1.6).
4. **Leica:** Es gibt offizielle LUTs für **Leica Cine** und **Leica Pure** (SL3-P, L-Log) sowie für zwei ältere SL2-S-Looks
   („Classic“ = Film V6.3, „Natural“ = Modern V6.2) und **64 Standard↔Look-Bildpaare** auf Leicas Looks-Seite
   (13 Essential Looks × 4–5 Szenen, mit eingeblendetem „Standard“-Inset), dazu die fünf Core Looks auf einer
   identischen Aufnahme (Abschnitt 3).
5. **Korn:** Kein pixelgleiches Off/Weak/Strong × Small/Large auf derselben Aufnahme gefunden – größte Lücke
   (Abschnitt 2.1).
6. **Kodak-Rezepte:** für 17 Kodak-Filme (Portra 160/400/800, Ektar 100, Gold 200, UltraMax 400, ColorPlus 200, Kodacolor VR 200,
   Kodachrome 64/25, Ektachrome E100, Tri-X 400, T-Max 100/400, Vision3 250D, Vision3 500T über CineStill 800T) mindestens ein Rezept mit
   vollständigen Einstellungen (Fuji X Weekly plus zwei weitere Quellen), dazu Reggie’s Portra und Classic Cuban Neg., Charakterbeschreibungen der
   echten Filme und Datenblatt-Fakten (Abschnitt 4).

---

## 1. Fujifilm-Filmsimulationen (Stand 2023–2026: X-T5, X100VI, X-H2, GFX)

Fuji führt derzeit **20 Simulationen** (Reala Ace kam am 12.09.2023 mit der GFX100 II als 20.): PROVIA, Velvia, ASTIA,
CLASSIC CHROME, REALA ACE, PRO Neg. Hi, PRO Neg. Std, CLASSIC Neg., NOSTALGIC Neg., ETERNA, ETERNA BLEACH BYPASS,
ACROS (+Ye/R/G), MONOCHROME (+Ye/R/G), SEPIA. **[B]**

Quellen (gesamter Abschnitt):
- Fujifilm Film-Simulation-Seiten, Texte und Charakterdiagramme (REST: `https://www.fujifilm-x.com/en-gb/wp-json/wp/v2/film-simulation?per_page=100`;
  Einzelseiten z. B. <https://www.fujifilm-x.com/en-gb/products/film-simulation/classic-chrome/>). Hinweis: `curl` wird von Cloudflare
  geblockt, ein Headless-Chrome-`--dump-dom` funktioniert.
- Offizielle LUTs: <https://www.fujifilm-x.com/en-gb/support/download/lut/> (Download `https://dl.fujifilm-x.com/support/lut/gfx-eterna-55-3d-lut-v110.zip`),
  Beschreibung im beiliegenden `F-Log2_LUT_overview_Ver.2.1E.pdf`. Presse: <https://petapixel.com/2025/11/18/fujifilms-new-f-log2-and-f-log2c-film-simulation-luts-look-fantastic>.
- Bildpaare: Kiechle (X-T30) <https://www.kiechle.com/photography/filmsims/index.htm>, Peltier <https://jmpeltier.com/fujifilm-film-simulation-differences/>,
  Keith Wee <https://keithwee.com/2018/02/19/23-comparing-eterna-and-other-film-simulations-part-2-on-the-fujifilm-x-h1/> und
  <https://keithwee.com/2019/10/30/fujifilm-x-pro3-review-part-ii-comparing-classic-negative-with-provia/>, Alik Griffin
  <https://alikgriffin.com/reala-ace-film-simulator>.
- Fuji X Weekly: <https://fujixweekly.com/2023/09/12/new-reala-ace-film-simulation>, <https://fujixweekly.com/2025/09/11/nostalgic-negative-makes-your-photos-feel-like-memories/>,
  <https://fujixweekly.com/2026/10/08/why-do-fujifilm-photographers-love-kodak-film-simulation-recipes-so-much/>.

### 1.0 Methode der Messungen

- **LUT-Auswertung [M].** Die `.cube`-Dateien (33³) habe ich per trilinearer Interpolation ausgewertet. Eingang: F-Log2 mit der
  veröffentlichten Kennlinie (`y = 0,245281·log10(5,555556·x + 0,064829) + 0,384316`, linearer Ast darunter) **[E]** – die Konstanten
  habe ich aus dem Gedächtnis angesetzt; Kontrolle: 18 % Grau landet in allen Simulationen bei **114–120 von 255**
  (sRGB-Erwartung 118), das spricht für die richtige Dekodierung. Der Eingangsfarbraum der LUTs ist laut Datei „F-Gamut“;
  ich habe F-Gamut als BT.2020-Primärvalenzen angenommen **[E]**; es ändert nur die absolute Lage der Testfarben, nicht die
  Verhältnisse zwischen den Simulationen. Ausgabe BT.709 (Datei: „F-Gamut to ITU-R BT.709“). Für Lab habe ich die Ausgabe wie
  sRGB behandelt (Näherung).
- **Testfarben [M]:** 18 Felder eines ColorChecker (publizierte sRGB-Näherungswerte), als Szenenfarben durch die LUT geschickt.
  Alle Aussagen sind **relativ zu PROVIA** (gleiche Eingabe, nur LUT gewechselt).
- **Bildpaare [M]:** Pixelgleiche Serien habe ich auf 800–1500 px verkleinert, in CIELAB umgerechnet und je Helligkeitsklasse bzw.
  Farbtonsektor das Chroma-Verhältnis (Summe C\* Simulation / Summe C\* Provia), den Median der Farbtonverschiebung und die mittlere
  L\*-Differenz bestimmt.
- Alle Auswertungsskripte (Python/numpy/Pillow) liegen in `testbilder/referenz/auswertung/` (gitignored, siehe `QUELLEN.md` Abschnitt 14); die LUTs in `testbilder/referenz/fujifilm-flog2-luts/` und `…/leica-luts/`.

### 1.1 Offizielles Charakterdiagramm (Fujifilm) [B]

Jede Simulationsseite zeigt vier Skalen, in denen die Simulation gegen PROVIA aufgetragen ist. Ich habe die Zellenpositionen
aus der HTML-Struktur gelesen (Zelle 0 = linkes Ende). PROVIA steht immer auf 7 / 5 / 5 / 0. „–“ = in der Fuji-Grafik ist für die
Simulation kein eigener Marker gesetzt (ablesbar nicht möglich).

| Simulation | Farbe (0 matt … 13 kräftig) | Lichter (0 weich … 9 hart) | Schatten (0 weich … 9 hart) | Eigenheit (0 Standard … 4 einzigartig) |
|---|---:|---:|---:|---:|
| PROVIA (Referenz) | 7 | 5 | 5 | 0 |
| Velvia | 10 | 9 | 9 | 3 |
| ASTIA | 6 | 4 | 6 | 1 |
| CLASSIC CHROME | 4 | 6 | 8 | 3 |
| PRO Neg. Hi | 6 | 8 | 8 | 0 |
| PRO Neg. Std | 5 | 5 | 3 | 0 |
| CLASSIC Neg. | 3 | – | 6 | – |
| NOSTALGIC Neg. | 5 | 3 | 3 | 4 |
| REALA ACE | 6 | 7 | 4 | 2 |
| ETERNA | 4 | 1 | 1 | 0 |
| ETERNA BLEACH BYPASS | 0 | – | 6 | – |
| ACROS | (s/w) | 7 | 7 | 0 |
| ACROS + Ye / R / G | (s/w) | 7 / 7 / 7 | 7 / 7 / 7 | 1 / 1 / 2 |
| MONOCHROME | (s/w) | 5 | 5 | 0 |
| MONOCHROME + Ye / R / G | (s/w) | 5 / 5 / 5 | 5 / 5 / 5 | 1 / 1 / 2 |
| SEPIA | (s/w) | 5 | 5 | 0 |

Lesart **[E]**: „Lichter hart“ = steile Kurve im oberen Drittel (kontrastreiche Lichter), „Schatten hart“ = tiefe, dichte
Schatten. Das Diagramm ist nur ordinal; Fujis eigene Tonalität×Sättigung-Karte der Simulationen (`filmsim-positionen-diagramm.jpeg`)
passt dazu, enthält aber laut Fuji X Weekly Ungereimtheiten (z. B. Nostalgic Neg. als „zweitkräftigste“ Simulation, obwohl sie es
nicht ist).

### 1.2 Tonkurve (neutrale Achse) aus den offiziellen LUTs [M]

Ausgabewert (8 Bit, G-Kanal) für eine neutrale Fläche, die *n* Blenden über/unter 18 % Grau liegt. Eingabe: F-Log2-Code von
`0,18·2^n`.

| Blenden zu 18 % Grau | Provia | Velvia | Astia | Classic Chrome | Classic Neg. | Eterna | Eterna BB | Pro Neg. Std | Reala Ace | Acros |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| −5 | 5 | 1 | 5 | 2 | 4 | 10 | 6 | 7 | 4 | 4 |
| −4 | 10 | 2 | 9 | 5 | 9 | 19 | 13 | 12 | 9 | 8 |
| −3 | 20 | 8 | 17 | 12 | 19 | 31 | 21 | 22 | 23 | 16 |
| −2 | 39 | 27 | 35 | 30 | 35 | 48 | 33 | 41 | 42 | 32 |
| −1 | 72 | 69 | 71 | 67 | 64 | 75 | 60 | 74 | 72 | 67 |
| +0 | 117 | 119 | 120 | 118 | 118 | 117 | 117 | 118 | 115 | 115 |
| +1 | 163 | 160 | 164 | 168 | 179 | 162 | 182 | 163 | 172 | 163 |
| +2 | 201 | 197 | 198 | 205 | 216 | 196 | 219 | 201 | 211 | 201 |
| +3 | 220 | 222 | 217 | 222 | 233 | 216 | 234 | 220 | 227 | 223 |
| +4 | 232 | 237 | 229 | 234 | 242 | 229 | 242 | 232 | 238 | 236 |
| +5 | 243 | 247 | 241 | 243 | 248 | 241 | 248 | 242 | 247 | 245 |

Schwarzpunkt, Lichterverlauf, Mittenkontrast und Farbstich auf der Grauachse:

| Simulation | Ausgabe ≥ 8/255 ab (Blenden zu Grau) | Ausgabe bei +3 Blenden | Ausgabe bei +5 Blenden | Steigung −1…+1 Blende (Codewerte) | Neutral-Stich |
|---|---:|---:|---:|---:|---|
| Provia | −4,25 | 220 | 243 | 90 | neutral (≤ ±2 Codewerte) |
| Velvia | −2,75 | 222 | 247 | 90 | neutral (≤ ±2 Codewerte) |
| Astia | −4,00 | 217 | 241 | 92 | neutral (≤ ±2 Codewerte) |
| Classic Chrome | −3,25 | 222 | 243 | 101 | neutral (≤ ±2 Codewerte) |
| Classic Neg. | −4,00 | 233 | 248 | 115 | Schatten leicht grün (G +2…+4), Lichter rötlich (R +10 bei +2 Bl.) |
| Eterna | −5,25 | 216 | 241 | 87 | neutral (≤ ±2 Codewerte) |
| Eterna BB | −4,50 | 234 | 248 | 122 | neutral (≤ ±2 Codewerte) |
| Pro Neg. Std | −4,50 | 220 | 242 | 89 | neutral (≤ ±2 Codewerte) |
| Reala Ace | −4,00 | 227 | 247 | 100 | neutral (≤ ±2 Codewerte) |
| Acros | −4,00 | 223 | 245 | 95 | neutral (≤ ±2 Codewerte) |

Beobachtungen **[M]**, soweit nicht anders gekennzeichnet:

- **Alle Simulationen halten 18 % Grau bei 115–120/255** (Velvia, Classic Neg. etc. verschieben die Mitte nicht). Unterschiede
  entstehen in Schatten (Fuß) und Lichtern (Schulter) sowie in der Steigung.
- **Lichter laufen weich aus** (Provia: +3 Blenden 220, +5 Blenden 243), erst oberhalb ca. +5,5 Blenden werden 250/255 erreicht –
  in diesem Videopfad wird nicht hart geklippt. Im JPEG-Pfad liegt der Weißpunkt laut Erfahrung der Rezeptautoren (DR-Auswahl)
  anders **[?]**.
- **Velvia:** Schatten sehr dicht (Ausgabe ≥ 8/255 erst ab −2,75 Blenden gegenüber −4,25 bei Provia); Mitte wie Provia, Lichter
  eine Spur kräftiger.
- **Classic Chrome:** Schatten dichter (−3,25 Blenden), Mitten +12 % steiler, Lichter wie Provia.
- **Classic Neg.:** die härteste Kurve (Steigung +28 % gegenüber Provia, +1 Blende = 179 statt 163), zusätzlich ein **Farbstich auf der
  Grauachse**: Schatten leicht grün, Lichter rötlich/magenta (R +10 Codewerte bei +2 Blenden). Das passt zur offiziellen Beschreibung
  („cyan-grün in den Schatten, magenta in den Lichtern“).
- **Eterna:** Schwarzpunkt gehoben (Eingang Schwarz → 1,5/255, bei −4 Blenden 19 statt 10), Lichter etwas flacher (+3: 216, +5: 241),
  Mittensteigung ≈ Provia → ein Look mit **offenen Schatten und weicher Schulter**, nicht mit flacher Mitte.
- **Eterna Bleach Bypass:** zweit-härteste Kurve (Steigung +36 %), keine Schattenanhebung, +1 Blende = 182.
- **Reala Ace:** Schatten leicht angehoben (−3 Blenden 23 statt 20), Lichter heller (+1 Blende 172, +3 Blenden 227), Mitte +11 % steiler –
  „tiefe weiche Schatten und harte Lichter“ (Fuji-Wortlaut) ist numerisch bestätigt.
- **Pro Neg. Std:** Schatten leicht angehoben (22 vs. 20 bei −3), sonst Provia-ähnlich; **Astia:** Lichter minimal niedriger (−3 bei +3 Blenden).
- **Acros:** Kurve leicht härter als Provia (Schatten −3 Blenden 16 statt 20, Lichter +3: 223), ohne Farbstich.

### 1.3 Farbe relativ zu PROVIA aus den offiziellen LUTs [M]

Chroma-Verhältnis C\*(Simulation)/C\*(Provia) je Testfarbe (1,00 = wie Provia):

| Farbfeld (ColorChecker) | Velvia | Astia | Classic Chrome | Classic Neg. | Eterna | Eterna BB | Pro Neg. Std | Reala Ace |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| dunkle Haut | 1,42 | 1,16 | 0,94 | 0,76 | 0,62 | 0,46 | 0,69 | 0,98 |
| helle Haut | 1,07 | 0,92 | 0,72 | 1,03 | 0,69 | 0,47 | 0,77 | 0,96 |
| Himmelblau | 1,13 | 1,08 | 0,79 | 0,80 | 0,66 | 0,39 | 0,77 | 0,98 |
| Laub | 1,44 | 1,12 | 0,77 | 0,60 | 0,64 | 0,43 | 0,79 | 0,97 |
| Orange | 1,06 | 0,98 | 0,80 | 0,91 | 0,77 | 0,44 | 0,81 | 0,97 |
| Gelb | 1,03 | 1,00 | 0,75 | 0,77 | 0,80 | 0,51 | 0,91 | 1,02 |
| Grün | 1,19 | 0,97 | 0,74 | 0,63 | 0,68 | 0,44 | 0,80 | 0,88 |
| Rot | 1,16 | 1,04 | 0,93 | 1,05 | 0,73 | 0,55 | 0,75 | 0,97 |
| Blau | 1,44 | 1,21 | 0,83 | 0,67 | 0,66 | 0,45 | 0,77 | 1,01 |
| Violett | 1,53 | 1,17 | 0,81 | 0,48 | 0,64 | 0,41 | 0,80 | 1,01 |
| Magenta | 1,10 | 1,01 | 0,76 | 0,83 | 0,72 | 0,50 | 0,85 | 0,95 |
| Cyan | 1,05 | 1,09 | 0,92 | 0,99 | 0,81 | 0,55 | 0,85 | 0,91 |
| **Mittel (18 Felder)** | **1,18** | **1,03** | **0,79** | **0,78** | **0,70** | **0,46** | **0,80** | **0,96** |

Farbtonverschiebung in Grad (CIELAB-Hue; Reihenfolge der Farbtöne bei steigendem Winkel: Rot → Orange → Gelb → Grün → Cyan → Blau → Magenta;
**positiv = Richtung Grün/Cyan/Blau bzw. weiter im Uhrzeigersinn dieser Reihenfolge**, negativ = zurück). Beispiel: Himmelblau −13° bei
Classic Chrome heißt „Blau wandert Richtung Cyan“.

| Farbfeld (ColorChecker) | Velvia | Astia | Classic Chrome | Classic Neg. | Eterna | Eterna BB | Pro Neg. Std | Reala Ace |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| dunkle Haut | +4 | +3 | −4 | +7 | −2 | −10 | −1 | −0 |
| helle Haut | +3 | +4 | −1 | −1 | +3 | +1 | −0 | +1 |
| Himmelblau | +5 | +1 | −13 | −3 | −8 | −12 | −3 | −2 |
| Laub | −1 | −5 | −1 | +15 | −1 | +4 | −2 | −3 |
| Orange | +3 | +4 | +1 | −4 | +5 | +2 | +3 | +0 |
| Gelb | +0 | +1 | −1 | −2 | +3 | +6 | +3 | +0 |
| Grün | −2 | −5 | +1 | +15 | −2 | +3 | −3 | −4 |
| Rot | +4 | +2 | +1 | +9 | −0 | −8 | −7 | +0 |
| Blau | +5 | +1 | −4 | −4 | −6 | −5 | −4 | +1 |
| Violett | −2 | −4 | +1 | +11 | −2 | +1 | −4 | −3 |
| Magenta | −3 | −5 | +4 | +25 | +0 | +2 | −5 | −2 |
| Cyan | +4 | +10 | −11 | +8 | −19 | −23 | −12 | +0 |

Helligkeitsdifferenz ΔL\* je Farbe (positiv = heller als Provia):

| Farbfeld (ColorChecker) | Velvia | Astia | Classic Chrome | Classic Neg. | Eterna | Eterna BB | Pro Neg. Std | Reala Ace |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| dunkle Haut | −0,1 | −0,6 | −1,9 | −4,9 | +0,2 | −7,3 | −0,4 | −0,6 |
| helle Haut | −0,2 | +0,1 | +1,9 | +5,1 | −0,6 | +6,1 | −0,5 | +2,5 |
| Himmelblau | −0,0 | +0,9 | −0,0 | +3,5 | +0,3 | +1,9 | +0,3 | −2,7 |
| Laub | +1,7 | +1,6 | −1,5 | −5,1 | +0,0 | −5,0 | +0,3 | −1,0 |
| Orange | +2,4 | −0,5 | −0,1 | −0,5 | −3,0 | −1,2 | −2,2 | −2,0 |
| Gelb | +0,9 | +0,2 | −0,3 | +2,5 | −2,7 | +4,6 | −1,0 | +2,6 |
| Grün | +2,2 | +2,4 | −0,8 | −2,1 | −1,1 | −1,1 | −0,4 | −0,8 |
| Rot | +1,1 | −2,2 | −1,8 | −0,9 | −3,5 | −12,7 | −4,2 | −3,6 |
| Blau | −0,7 | −0,2 | −4,3 | −0,7 | +0,5 | −6,0 | −0,2 | −7,5 |
| Violett | −1,0 | −2,1 | −3,6 | −3,1 | +1,1 | −6,4 | −0,1 | −1,6 |
| Magenta | +0,6 | −2,2 | −0,3 | +2,5 | −1,8 | −2,0 | −1,7 | −1,1 |
| Cyan | +0,9 | +0,9 | −1,3 | +3,0 | −1,4 | −0,4 | −1,4 | −6,3 |
| **Mittel (18 Felder)** | **+0,5** | **−0,1** | **−0,8** | **+0,9** | **−1,1** | **−1,0** | **−0,8** | **−1,4** |

Die Zahlen zeigen die markantesten Charakterzüge konkret:

- **Velvia** sättigt selektiv: Blau, Violett, Laub, dunkle Haut ×1,4–1,5, Rot ×1,16, Orange/Gelb/Cyan nur ×1,03–1,06 – helle Haut
  bleibt natürlich (×1,07).
- **Classic Chrome:** fast alles ×0,72–0,83 gedämpft, nur Rot (×0,93), dunkle Haut (×0,94) und Cyan (×0,92) bleiben näher an Provia; **Blautöne wandern nach Cyan (−13°) und werden
  dunkler (Blau −4,3 L\*)**.
- **Astia** ist **nicht** blasser als Provia: Blau/Violett/dunkle Haut ×1,16–1,21, Rest ≈ ×1,0, helle Haut ×0,92 – „kräftige Farben,
  zurückhaltende Haut“.
- **Classic Neg.** ist farbtonabhängig: helle Haut und Rot werden gehalten (×1,03–1,08), Grün, Violett, Blau stark gedämpft (×0,48–0,67) und gedreht
  (Grün +15° Richtung Teal, Magenta +25° Richtung Rot, Blaugrün +25° Richtung Blau).
- **Eterna:** gleichmäßig ×0,62–0,81, Blau/Cyan Richtung Cyan (−6° bis −19°).
- **Eterna Bleach Bypass:** ×0,37–0,55 (nahezu s/w) mit Farbstich zu Cyan (−23° Cyan, −12° Himmel), Rot stark abgedunkelt (−12,7 L\*).
- **Pro Neg. Std:** gleichmäßig ×0,69–0,91, Gelb/Orange am meisten erhalten, Rot −7°.
- **Reala Ace:** Chroma fast Provia (×0,96), **aber tiefe Blautöne deutlich dunkler** (Blau −7,5 L\*, Cyan −6,3, Purpurblau −6,3) und Grün/Türkis
  leicht reduziert (×0,76–0,88). Damit wird Alik Griffins Beobachtung („wirkt wie eingebautes Color Chrome Blue“) messbar.

### 1.4 Steckbriefe der Simulationen

Quelle der Wortlaute: Fujifilm-Seiten (siehe oben), in meinen Worten. Zahlen = Messungen aus 1.2/1.3 bzw. den Bildserien (1.5).

**PROVIA (Standard).** Referenz und Standardeinstellung. Fuji nennt zwei Prinzipien: „Erinnerungsfarben“ und „Transparenz“; Magenta wird
so geführt, dass Himmel klar, Sonnenuntergänge kräftig, Grün satt und Orange blass (gut für Haut) wirken. **[B]** Neutral ohne Stich, weicher
Lichterauslauf, Schwarzpunkt tief (8/255 bei −4,25 Blenden). **[M]**

**Velvia.** Kräftige Farben, tiefe Schatten, ausgewogene Farbbalance (keine Farbe dominiert). Für Landschaft/Natur, auch Nachtstadt und Sport. **[B]**
Mittenkurve = Provia, aber Schatten stark verdichtet und Lichter eine Spur härter; selektive Sättigung (Abschnitt 1.3); Blau wandert bei Kiechle
(Capture One) um +12…+14° Richtung Violett (LUT: +5°) – Peltier: „Blau in Richtung Magenta“. **[M]**

**ASTIA.** Weicher Übergang von Lichtern zu Schatten bei erhaltener Sättigung; für Porträts bei Sonne, Nachtszenen mit gemischtem Licht, Landschaft ohne
Lichtkontrolle. **[B]** Kurve ≈ Provia, Schatten minimal härter, Lichter minimal weicher; Blau/Violett/Grün kräftiger, Haut zurückhaltender. **[M]**

**CLASSIC CHROME.** „Imaginärer Film“ nach dem Look der Fotojournalismus-Magazine des 20. Jahrhunderts: gedämpft, unterdrücktes Magenta,
kühle Schatten; vielseitig. **[B]** Dichte Schatten (Charakter 8 von 9), steile Mitten, Blau Richtung Cyan und dunkler, Rot/Haut-Dunkel erhalten. **[M]**
Basis fast aller Kodak-Nachbildungen (Abschnitt 4). Auf X-Trans V rendert Blau etwas tiefer als auf X-Trans IV
(Fuji X Weekly, Abschnitt 1.6) **[B]**.

**PRO Neg. Std / PRO Neg. Hi.** Profi-Negativfilme: Std für gut geführtes Licht/Studio (einfache, vorhersehbare Parameter); Hi erhöht den Kontrast,
„setzt Schatten auch in flachem Licht“, Lichter halten Zeichnung. **[B]** Std: Chroma ×0,80, Schatten leicht offen, Mitten/Lichter wie Provia
(LUT + Kiechle ×0,81). Hi (keine LUT): Chroma ≈ ×0,90–0,95, Schatten −2…−3,5 L\* tiefer als Provia (Kiechle), Lichter +0,5…+1, Farbtöne kaum gedreht (≤ ±3°;
Blau-Cast von Provia reduziert laut Peltier). **[M]**

**CLASSIC Neg.** Nach dem Vorbild des Konsumenten-Negativfilms, der lange in der Kamera lag: Cyan-Grün-Stich in Schatten, Magenta in Lichtern, harter
Kontrast und harter Farbkontrast; „lo-fi, aber vertraut“, funktioniert gut mit Korn. **[B]** Messung: härteste Kurve, Grauachsenstich, selektive
Dämpfung (Abschnitt 1.2/1.3). **[M]** **Widerspruch zwischen Quellen [?]:** Die X-Pro3-Paare (Keith Wee, 2019) zeigen **dunklere Mitten** (−5,6 und −7,0 L\*) als Provia, das
Peltier-Raster **hellere** (+3 L\*) und die LUT **hellere Lichter und dunklere Schatten** (S-Kurve); die Belichtung der Paare ist nicht garantiert
gleich. Vor dem Nachbau mit einer eigenen In-Kamera-RAW-Konvertierung gegenprüfen.

**NOSTALGIC Neg.** Seit GFX100S (2021), heute auf allen X-Trans-V-Kameras und neueren GFX. Aus der „New American Color“-Fotografie der 1970er
(Eggleston, Shore, Sternfeld): Schatten sinken nicht in Blau/Grün, sondern bekommen **Bernstein-Wärme**; Hauttöne in Schatten satt. **[B]** Fuji X Weekly:
liegt zwischen Classic Chrome und Eterna, warm und im Schatten lebendiger, weiche Tonalität. **[B]** Messung (keine LUT): Chroma ×0,89–0,94, Schatten
+1,5…+3,5 L\* offener, Mitten ≈ Provia, Gesamtstich zu Warm (Alik, Monkey-Szene: R +6,7, B +0,9 im Mittel). **[M]**

**REALA ACE.** Fuji nennt: tiefe, weiche Schatten, harte Lichter, „frei von digitaler Muddigkeit“; Sättigung wird um so stärker zurückgenommen, je gesättigter
das Motiv; gibt Violett und Gelbgrün gut wieder; für Schnappschüsse und Familienfotos. **[B]** Numerisch: wie Provia in Farbton und Sättigung, Schatten/Lichter
wie oben, tiefe Blautöne dunkler. Nach Fuji X Weekly „im Grunde Classic Negative v2“ **[B/E]**. Alik Griffin: „Provia mit etwas Punch“,
in Lightroom grob „+15 Klarheit, Schwarz +5, weichere Lichter“. **[B]**

**ETERNA.** Aus dem Kinofilm abgeleitet: relativ flache Tonabstufung, gedämpfte Farben, als Ausgangsmaterial für Nachbearbeitung gedacht. **[B]** Chroma ×0,70, Schatten
geöffnet, weiche Schulter, Blau/Cyan Richtung Cyan. **[M]**

**ETERNA BLEACH BYPASS.** Kombination aus hohem Kontrast und geringer Sättigung („kalt, unwirklich“), Vorbild Sci-Fi/Psychothriller; nicht per Matching von Kontrast und
Sättigung entstanden, sondern als „Was wäre bei Eterna-Aufnahme und -Entwicklung herausgekommen?“. **[B]** Chroma ×0,46, härteste Kurve nach Classic Neg., kühler Stich,
Hautkontrast verstärkt (dunkle Haut −7,3, helle +6,1 L\*). **[M]**

**ACROS (ohne und mit Ye/R/G).** Einführung 2016, Vorbild Neopan Acros; Fuji betont **luminanzabhängiges Korn** (das Sensorrauschen wird genutzt, um je nach Helligkeit
unterschiedliches Korn zu erzeugen) und „weiche Grautöne bei starkem Kontrast“. **[B]** Kurve leicht härter als Monochrome/Provia. **[M]** **Filter**: Fuji beschreibt Ye als schwächsten
Kontrastfilter (Himmel etwas dunkler, Grün abgesoffen), R als stärksten (Himmel fast schwarz), G für Porträts (Rot, Lippen abgedunkelt). **[B]** Gemessene
Kanalmischer-Gewichte (Abschnitt 1.5): Ye (0,36 / 0,67 / −0,01), R (0,54 / 0,61 / −0,13), G (0,09 / 0,79 / 0,12), ohne Filter (0,20 / 0,69 / 0,12). **[M]**

**MONOCHROME (ohne und mit Filtern).** Ein Grauwert-Abbild von PROVIA mit dessen Tonwerten, glatter („digitaler“) als Acros. **[B]** Gemessen: Helligkeit ≡ Provia (Abweichung ≤ 0,3 L\*
in allen Klassen, Kanalgewichte 0,19/0,73/0,08). **[M]**

**SEPIA.** Rötliches Monochrom; Lichter und Schatten färben sich wenig, die Mitten stärker. **[B]** Gemessen: Helligkeit ≡ Monochrome; Tönung a\*/b\* steigt von 5/5 in
den tiefsten Schatten auf **11/19 bei L\* 20–40**, fällt zu den Lichtern ab (3/7 bei L\* > 90). **[M]** (Tabelle 1.5)

### 1.5 Gegenprobe und Zusatzmessungen aus pixelgleichen Bildserien [M]

**Kiechle, X-T30, 16 Simulationen einer Aufnahme (Capture One).** Mittleres L\* der Simulation je L\*-Klasse der Provia-Version. Schatten: Velvia −2,8 L\* (Klasse 0–5), Classic Chrome −1,8,
Pro Neg. Hi −2,1; Eterna **+4,4** (angehobene Schwarz), Pro Neg. Std +0,9; Highlights: Eterna −2, Classic Chrome/Velvia/Hi +0,7. Das deckt sich qualitativ mit der LUT (Velvia dichter,
Eterna offen). Monochrome = Provia.

| Provia-L\*-Klasse | 0–5 | 5–10 | 10–20 | 20–30 | 30–40 | 40–50 | 50–60 | 60–70 | 70–80 | 80–90 | 90–100 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Provia (Basis, Ø L\*) | 3,7 | 7,7 | 15,0 | 25,2 | 35,1 | 45,2 | 54,4 | 65,7 | 74,5 | 82,8 | 93,8 |
| Velvia | 0,9 | 3,4 | 11,1 | 24,2 | 35,9 | 46,1 | 54,7 | 64,6 | 72,7 | 81,6 | 94,5 |
| Astia | 2,9 | 6,2 | 13,4 | 24,4 | 35,6 | 46,2 | 55,5 | 66,1 | 73,9 | 81,7 | 92,8 |
| Classic Chrome | 1,9 | 4,8 | 11,8 | 22,7 | 33,5 | 44,6 | 55,1 | 67,2 | 76,0 | 84,0 | 94,5 |
| Pro Neg. Hi | 1,6 | 4,3 | 11,4 | 22,9 | 34,6 | 45,2 | 54,3 | 65,3 | 74,3 | 82,8 | 94,5 |
| Pro Neg. Std | 4,6 | 9,7 | 17,1 | 26,5 | 35,9 | 45,3 | 54,5 | 65,8 | 74,7 | 82,9 | 93,8 |
| Eterna | 8,1 | 13,4 | 19,5 | 27,2 | 35,6 | 45,1 | 54,5 | 65,5 | 73,7 | 81,3 | 91,8 |
| Acros | 3,2 | 6,2 | 12,5 | 23,0 | 34,0 | 44,8 | 54,7 | 66,2 | 75,2 | 83,3 | 93,5 |
| Monochrome | 3,7 | 7,6 | 14,7 | 24,6 | 34,7 | 45,0 | 54,4 | 65,8 | 74,7 | 82,9 | 93,8 |

Farbwirkung nach Farbtonsektor der Provia-Basis (Pixel mit C\* > 15, Kiechle-Szene ist blau-/gelbgrün-lastig). Zellen: Chroma-Verhältnis / Median der Farbtonverschiebung / ΔL\*:

| Farbsektor der Provia-Basis (Pixel) | Velvia | Astia | Classic Chrome | Pro Neg. Hi | Pro Neg. Std | Eterna |
|---|---:|---:|---:|---:|---:|---:|
| Rot-Rosa 0–30° (6418) | ×1,22 / +3° / −0,3 | ×1,01 / +4° / −0,3 | ×0,83 / +1° / +0,4 | ×0,87 / −3° / −1,3 | ×0,81 / −6° / −0,8 | ×0,74 / +0° / −1,3 |
| Rot-Orange 30–60° (19091) | ×1,30 / +5° / +1,0 | ×1,10 / +6° / −0,2 | ×0,86 / −2° / −1,4 | ×0,88 / −3° / −2,9 | ×0,76 / −6° / −1,4 | ×0,74 / −1° / −1,0 |
| Orange-Gelb 60–90° (7555) | ×1,46 / +5° / +0,6 | ×1,20 / +2° / +0,9 | ×0,83 / −6° / −0,3 | ×0,95 / +2° / −0,5 | ×0,76 / +1° / +0,0 | ×0,69 / −1° / −0,3 |
| Gelb-Gelbgrün 90–120° (142672) | ×1,49 / −0° / +1,4 | ×1,20 / −4° / +1,0 | ×0,76 / −4° / −1,5 | ×1,03 / −2° / −0,5 | ×0,81 / +0° / +0,7 | ×0,66 / −1° / +0,4 |
| Grün 120–160° (24922) | ×1,58 / −1° / +0,5 | ×1,18 / −5° / +0,4 | ×0,74 / −2° / −1,9 | ×1,02 / −3° / −1,0 | ×0,81 / −1° / +1,1 | ×0,64 / −1° / +1,1 |
| Cyanblau 200–250° (47155) | ×1,26 / +14° / −1,6 | ×1,08 / +7° / −0,2 | ×0,79 / −12° / +1,4 | ×0,93 / +3° / −0,3 | ×0,83 / −2° / +0,2 | ×0,69 / −6° / −0,5 |
| Blau 250–290° (300663) | ×1,35 / +12° / −1,2 | ×1,13 / +5° / −0,1 | ×0,78 / −13° / +1,0 | ×0,93 / +2° / −0,2 | ×0,83 / −2° / +0,2 | ×0,70 / −7° / −0,4 |

Vergleich der Chroma-Verhältnisse **Bilder gegen LUT**: Classic Chrome 0,78 (Bild) / 0,79 (LUT), Pro Neg. Std 0,81 / 0,80, Eterna 0,69 / 0,70, Reala Ace 0,98 (Peltier) / 0,96,
Classic Neg. 0,80 (Peltier) / 0,78. Velvia (Bild 1,34–1,41 gegenüber LUT-Mittel 1,18) und Astia (1,15 gegenüber 1,03) liegen höher, weil die Bildszenen viel Blau/Grün enthalten, wo diese Simulationen am
stärksten sättigen (LUT: Blau ×1,44/×1,21, Laub ×1,44/×1,12). Die Capture-One-Konvertierung bildet die Fuji-Looks also in Chroma und Tonfuß gut nach. **[M]**

**Schwarzweiß-Filter (Kiechle):** Mittlere Helligkeit je Farbsektor, Differenz gegenüber „Acros ohne Filter“:

| Farbsektor (Provia-Basis) | Acros | Acros+Ye | Acros+R | Acros+G |
|---|---:|---:|---:|---:|
| Rot (340–30°) | 54,6 | +4,9 | +9,3 | −5,1 |
| Orange (30–80°) | 32,8 | +6,6 | +12,4 | −4,6 |
| Gelb/Gelbgrün (80–125°) | 34,8 | +1,6 | +2,8 | −0,0 |
| Grün (125–175°) | 33,3 | +0,4 | +0,5 | +0,6 |
| Cyanblau (200–250°) | 70,8 | −3,1 | −6,3 | +0,9 |
| Blau (250–290°) | 67,2 | −3,5 | −7,1 | +0,9 |

**Zuordnung korrigiert [M/E]:** Auf Kiechles Seite sind Ye und G laut Messung vertauscht beschriftet (Dateien 09/11 und 13/15). Gemessen hellt `filmsim11` Rot/Orange auf und dunkelt Blau ab (= Gelbfilter), `filmsim09`
dunkelt Rot/Orange ab (= Grünfilter), `filmsim10` ist der Rotfilter. Das stimmt mit den Fuji-Beschreibungen und der Entwicklungsreihenfolge überein. Die Tabelle oben nutzt die korrigierte Zuordnung.

Als **Kanalmischer** (lineares Licht, Basis = Provia-Bild, Regression über 400 000 Pixel, R² ≥ 0,997):

| Variante | w_R | w_G | w_B | R² |
|---|---:|---:|---:|---:|
| Acros | 0,20 | 0,69 | 0,12 | 0,999 |
| Acros+Ye | 0,36 | 0,67 | −0,01 | 0,998 |
| Acros+R | 0,54 | 0,61 | −0,13 | 0,997 |
| Acros+G | 0,09 | 0,79 | 0,12 | 0,999 |
| Monochrome | 0,19 | 0,73 | 0,08 | 1,000 |
| Mono+Ye | 0,35 | 0,71 | −0,05 | 0,999 |
| Mono+R | 0,52 | 0,65 | −0,17 | 0,998 |
| Mono+G | 0,09 | 0,79 | 0,12 | 0,999 |

Das lässt sich direkt als Graustufen-Mischmatrix übernehmen (nach Rec.709-Linearisierung des Provia-Looks); der Effekt der Filterwahl ist demnach ein reiner **Kanalmischer vor der Acros-/Monochrome-Tonkurve**.
Die G-Filter-Gewichte sind bei Acros und Monochrome identisch (0,09/0,79/0,12).

**Sepia-Tönung** (Kiechle):

| Provia-L\*-Klasse | L\* Sepia | a\* | b\* |
|---|---:|---:|---:|
| 0–5 | 4,0 | 4,8 | 4,5 |
| 5–10 | 8,3 | 7,8 | 9,4 |
| 10–20 | 15,6 | 10,1 | 15,8 |
| 20–30 | 25,5 | 11,3 | 18,6 |
| 30–40 | 35,4 | 10,6 | 17,6 |
| 40–50 | 45,5 | 9,6 | 16,5 |
| 50–60 | 54,9 | 9,0 | 15,6 |
| 60–70 | 66,2 | 8,3 | 14,8 |
| 70–80 | 75,0 | 7,9 | 14,1 |
| 80–90 | 83,2 | 7,1 | 13,0 |
| 90–100 | 93,7 | 3,1 | 7,4 |

**Zusatzserien:** Keith Wee X-H1 (Provia gegenüber Pro Neg. Hi, Eterna, Astia, Classic Chrome; Chroma-Verhältnisse 0,90 / 0,61 / 1,02 / 0,74, Eterna-Schatten +6,5 L\*, Mitten/Lichter −4,5) und Alik Griffin GFX100 II
(Reala Ace 0,94, Classic Chrome 0,71, Nostalgic Neg. 0,89) bestätigen die Größenordnungen; Eterna ist bei Keith Wee (Lightroom/Adobe-Profil) stärker als bei Kiechle und LUT (0,61 vs. 0,70).

### 1.6 Unterschiede zwischen Sensoren, Konvertern und Geräten [B/E]

- **X-Trans V gegenüber IV:** Blau wird auf Classic Chrome und Classic Neg. etwas tiefer gerendert; Fuji X Weekly empfiehlt, *Color Chrome FX Blue um eine Stufe zu senken*
  (Strong → Weak, Weak → Off). **[B]** (<https://fujixweekly.com/2025/12/03/reggies-portra-in-x-trans-v-cameras/>)
- **GFX (Bayer, 100 MP) gegenüber X-T5 (40 MP):** gleiche Simulation, aber das **Korn ist auf der GFX feiner** (Fuji X Weekly: „nicht gleich skaliert“; ein Korn „Medium“ fehlt). **[B]**
- **Konverter:** Capture One (Kiechle) und Lightroom/Adobe-Profile (Keith Wee, Alik Griffin) bilden die Looks nach; Alik berichtet beim GFX100 II fast identische Farben zwischen Adobe-Profil und
  In-Kamera-JPEG, Abweichung vor allem bei Belichtungsänderungen. **[B]** Die Verhältnisse in 1.5 stimmen mit der LUT überein. **[M]**
- **Video- gegenüber Standbildpfad:** Die LUTs sind laut Fuji für Videoprojekte (F-Log2 nach Rec.709); Standbild-JPEGs enthalten zusätzlich DR-/Highlight-/Shadow-Kurven und eine eigene Gamutabbildung. **[?]**
- **Verfügbarkeit:** Nostalgic Neg. nur X-Trans V/neuere GFX; Reala Ace ab GFX100 II (2023), später auch bei X-Bodies (Fuji listet sie z. B. bei der X-M5); Eterna Bleach Bypass ab X-T4; Classic Neg. ab X-Pro3 (2019). **[B]**
  (Fuji X Weekly, Fuji-Seiten)

---

## 2. Fujifilm-Bildeinstellungen, die Rezepte verwenden

Quellen (gesamter Abschnitt):
- Fuji X-T5-Online-Handbuch, Bildqualitäts-Einstellungen: <https://fujifilm-dsc.com/en/manual/x-t5/menu_shooting/image_quality_setting/>
- Fujifilm Learning Centre „Color Chrome and Film Grain Effects“: <https://fujifilm-x.com/en-gb/learning-centre/color-chrome-and-film-grain-effects>
- Fuji X Weekly: Korn <https://fujixweekly.com/2019/12/06/fujifilm-grain-settings/> und <https://fujixweekly.com/2025/01/03/fujifilm-grain-comparison-gfx100s-ii-vs-x-t5/>;
  WB-Shift <https://fujixweekly.com/2020/08/19/fujifilm-white-balance-shift-what-it-is-how-to-use-it/>; B&W-Toning <https://fujixweekly.com/2020/06/19/making-color-pictures-using-acros-bw-toning-multiple-exposures/>.
- JM Peltier: Highlight/Shadow <https://www.jmpeltier.com/fujifilm-highlight-shadow-tones/>, Dynamic Range <https://www.jmpeltier.com/2018/07/01/fujifilm-dynamic-range-settings/>.
- Fstoppers zum Grain Effect: <https://fstoppers.com/education/fujifilms-grain-effect-more-useful-think-heres-how-actually-use-it-903376>.

### 2.0 Übersicht der Parameter (Wertebereiche X-Trans V / GFX, Stand 2023–2026)

| Einstellung | Wertebereich | Wirkung (Kurz) | Beleg |
|---|---|---|---|
| **Grain Effect – Roughness** | Off / Weak / Strong | zufälliges Rauschen als Filmkorn; nur in JPEG/HEIF, nicht in RAW | [B] Handbuch, Learning Centre, Fstoppers |
| **Grain Effect – Size** | Small / Large (nur neuere X- und GFX-Modelle; ältere X-T3/X-T30/X100F: nur Off/Weak/Strong ohne Größe) | gröberes/feineres Korn | [B] Handbuch, Learning Centre |
| **Color Chrome Effect** | Off / Weak / Strong | größerer Tonumfang für stark gesättigte Farben (Rot, Gelb, Grün); nur JPEG/HEIF und In-Kamera-RAW-Konvertierung | [B] Handbuch, Learning Centre |
| **Color Chrome FX Blue** | Off / Weak / Strong | Tonumfang für Blau, nur blaue Bereiche | [B] Handbuch, Learning Centre |
| **Smooth Skin Effect** | Off / Weak / Strong | glättet Hauttöne (räumlich) | [B] Handbuch |
| **Highlight Tone** | −2 bis +4 (Halbschritte bei neueren Bodies; X-T3: Ganzschritte) | Kontrast im oberen Histogrammbereich | [B] Handbuch + Peltier, Rezeptlisten (z. B. −0,5, +1,5) |
| **Shadow Tone** | −2 bis +4 (Halbschritte) | Kontrast im unteren Histogrammbereich | [B] dito |
| **Color** | −4 bis +4 (Ganzschritte) | „Farbdichte“ | [B] Handbuch |
| **Sharpness** | −4 bis +4 | Konturschärfe | [B] Handbuch |
| **High ISO NR** | −4 bis +4 | Rauschminderung (−4: Struktur bleibt) | [B] Handbuch |
| **Clarity** | −5 bis +5 | lokaler Kontrast/Definition, Töne kaum verändert; verlängert Speicherzeit | [B] Handbuch |
| **Dynamic Range** | Auto / DR100 / DR200 / DR400 | Highlight-Schutz: Kamera unterbelichtet 1 bzw. 2 Blenden und hellt die Schatten im JPEG an; DR200 ab ISO 250, DR400 ab ISO 500 (X-T5, Basis-ISO 125); Auto wählt nur 100 oder 200 | [B] Handbuch, Peltier |
| **D Range Priority** | Off / Weak / Strong / Auto | steuert Tonkurve **und** DR automatisch (dann sind Highlight/Shadow/DR gesperrt); Weak ab ISO 250, Strong ab ISO 500 | [B] Handbuch |
| **White Balance** | Auto / White Priority / Ambience Priority, Custom 1–3, Kelvin 2500–10 000 K (10-K-Schritte), Daylight, Shade, Fluorescent 1–3, Incandescent, Underwater | – | [B] Handbuch |
| **WB-Shift** | R: −9…+9, B: −9…+9 (361 Positionen) | Feinabstimmung der Farbbalance zusätzlich zu jedem WB | [B] Handbuch, Fuji X Weekly |
| **Monochromatic Color (Toning)** | WC (warm–kalt) und MG (grün–magenta) je −18…+18 auf X-T4/X-Pro3 und neuer; X-T3/X-T30: eine Achse −9…+9 | Tönung für ACROS und MONOCHROME | [B] Handbuch, Fuji X Weekly |
| **Color Space** | sRGB / Adobe RGB | – | [B] Handbuch |

Hinweis: Praktisch alle Fuji-X-Weekly-Rezepte setzen High ISO NR auf −4 (möglichst viel Struktur) und nutzen Grain, Color Chrome und FX Blue als Stilmittel (Abschnitt 4).

### 2.1 Grain Effect (Korn)

**Was Fuji sagt [B]:** Der Grain Effect fügt dem Bild „kontrolliert zufälliges Rauschen“ hinzu, um das Kornmuster von Film nachzuempfinden. Er wirkt nur auf JPEG/HEIF, ist in das
Pixelraster eingebacken (Zuschneiden vergrößert das Korn) und wird auch bei der In-Kamera-RAW-Konvertierung angewandt. ACROS besitzt zusätzlich eigenes Korn, das mit dem ISO wächst und –
laut Fuji – je nach Helligkeit unterschiedlich ausfällt (das Sensorrauschen wird dafür genutzt).

**Wie das Korn aussieht – gemessen an den vorhandenen Ausschnitten [M, grob]:**

| Messung | Ergebnis |
|---|---|
| X-T30, ISO 640, glatter Himmel (L\* ≈ 176): σ des 9-px-Hochpass in 8-Bit-Stufen | Off **1,0**, Weak **1,6**, Strong **3,9** → hinzugefügtes Korn ≈ √(1,6²−1²) = **1,3** (Weak) und **3,8** (Strong): Strong ≈ 3 × Weak |
| dito, Autokorrelation bei 1 px Abstand | Off 0,75, Weak 0,49, **Strong 0,03** → Strong-Korn ist auf 26 MP praktisch **pixelbreites weißes Rauschen** |
| X-T5 (40 MP), Himmel: Weak/Small (Rezept Astia Summer) gegenüber Strong/Large (Rezept Gold Max 400) | σ 6,0 gegenüber 6,8 (enthält Sensorrauschen und JPEG), Autokorrelation 1 px 0,32 gegenüber 0,50; **Korrelationslänge ≈ 0,9 px (Small) gegenüber ≈ 1,4 px (Large)** → Large ≈ 1,5 × Small, beide im Bereich **1–1,5 Pixel** bei 40 MP |
| GFX100S II (100 MP), gleiche Rezepte | Korrelation 1 px 0,27 / 0,29 → ≈ 0,8 px; Fuji X Weekly bestätigt: feiner als X-T5, „nicht gleich skaliert“ |
| X RAW Studio, 100 %-Screenshot, X-T30, Acros+Ye, **Strong**, ISO 320 | σ in glatten Bereichen ≈ 12 Stufen (enthält Textur und ISO-Rauschen), **keine klare Abhängigkeit von der Helligkeit** (11–15 über 80–240); Autokorrelation 1 px (Screenshot-Pixel) 0,68; Screenshot vermutlich 2× skaliert (Retina) **[E]**, je Bildpixel also deutlich weniger |

Einschätzung **[E]**:
- Korn ist eine **pixelraster-gebundene, nahezu weiße Störung mit 1–1,5 px Korrelationslänge** (Small ≈ 1 px, Large ≈ 1,5 px bei 40 MP; Weak ≈ ⅓ der Amplitude von Strong). Für Film Lab heißt das: Korn
  auf der **Vollauflösung** erzeugen (a6000: 24 MP, ähnlich der 26-MP-X-Trans) und erst danach skalieren, sonst wird es zu grob oder verschwindet.
- Die **Amplitude scheint in 8-Bit-Codewerten weitgehend tonunabhängig** (kein film-typisches Maximum in den Mitten) – ein Blogger beobachtet ebenfalls „gleichmäßig über das Bild, auch in den Lichtern“ ([lifeunintended.com](https://lifeunintended.com/articles/my-favorite-fujifilm-film-simulation-settings/), nicht gegengeprüft). Bei Acros
  kommt das helligkeitsabhängige Eigenkorn dazu. **[?]** nicht sicher; ein sauberer Test bräuchte eine Graukeil-Aufnahme je Stufe.
- **Größe in Pixeln:** 26 MP und 40 MP wurden nicht getrennt vermessen; die Größen oben stammen aus 40 MP (X-T5) und 26 MP (X-T30, ohne Size-Regler). **[?]**
- **Nicht gefunden:** ein pixelgleiches Off/Weak/Strong × Small/Large auf derselben Aufnahme. Vorhandene Ausschnitte: `testbilder/referenz/fujixweekly-grain/` (X-T5 vs. GFX, Rezepte statt reiner Stufen), `…/fujixweekly-grain-xt30/`
  (gleiche Szene, getrennte Aufnahmen), `…/fujifilm-offiziell-effekte/grain-*.jpg` (Fuji, mit/ohne), `…/kiechle/xrawstudio2.jpg` (100 %-Screenshot).
- **Vorschlag zum Schließen der Lücke:** eine Fuji-Kamera mit X RAW Studio (oder In-Kamera-RAW-Konvertierung) auf eine **Graukarte/Graukeil-Aufnahme** anwenden und alle 6 Korn-Kombinationen speichern; daraus Amplitude je Helligkeit und
  Autokorrelation je Stufe messen.

### 2.2 Color Chrome Effect (CCE)

**Fuji [B]:** erweitert den Tonumfang für stark gesättigte Farben (Rot, Gelb, Grün), wirkt bei Aufnahme und bei In-Kamera-RAW-Konvertierung, nicht auf die RAW-Datei, mit jeder Simulation kombinierbar
(sRGB und Adobe RGB). Idee: Bei kontrastreichem, hellem Licht „überlaufen“ einzelne RGB-Kanäle, die Szene wirkt flach; Color Chrome erhält feine Tonunterschiede
und liefert „kräftig, aber mit Tiefe“. Inspiration: Fujichrome Fortia. Fuji betont: **nicht dasselbe wie Velvia mit Color +4.** Stufen Weak und Strong.

**Gemessen [M]** (Strong gegenüber Off):

| Quelle | Wirkung |
|---|---|
| Alik Griffin, GFX100 II, Reala Ace, gleiche Aufnahme (Standard gegenüber CC Strong) | Chroma **×1,00** (unverändert); ΔL\* **−1,0…−2,3** bei Pixeln mit C\* > 25 in Gelbgrün, Grün/Cyan, Rot/Orange (höchster Wert −2,5 bei C\* 60–80); **Blau und Neutral ±0**; Bildmittel −0,2 L\* |
| Fuji Learning Centre, Blumenfoto (andere Basis, nicht genannt) | ΔL\* −1,0 (C\* < 10) … **−3,2** (C\* 40–60), am stärksten bei Gelbgrün (−2,8); Chroma ×1,13–1,18 über alle Klassen (also mit zusätzlicher Sättigung, vermutlich andere Einstellung als reines CCE) |

Alik Griffin beschreibt es subjektiv als „schiebt vor allem Grün Richtung Magenta/Violett und lässt Haut und Blau in Ruhe“. **[B, Autor]**

**[E] Modell zum Nachbauen:** CCE ≈ **chromaabhängige Abdunklung** gesättigter Nicht-Blau-Farben: ΔL\* ≈ −k · f(C\*), mit k ≈ 2 (Strong, bei C\* ≈ 40–60) und ≈ 1 (Weak); Chroma konstant; Blau ausgenommen.

### 2.3 Color Chrome FX Blue

**Fuji [B]:** gleiche drei Stufen, wirkt nur in blauen Bereichen; hilfreich bei Küstenszenen, „ähnlich einem Polfilter“; X-Trans V rendert Blau auf manchen Simulationen von sich aus tiefer, deshalb in Rezepten
für X-Trans V eine Stufe weniger als für IV (Fuji X Weekly).

**Gemessen [M]** (Strong gegenüber Off, 200–300° Farbton):

| Quelle | Wirkung |
|---|---|
| Alik Griffin, GFX100 II, Reala Ace | Blau-Pixel ΔL\* **−8,0** (C\* 40–60), Chroma ×1,07; **alle anderen Farbtöne ΔL\* ±0,00**; Bildmittel −2,3 L\* |
| Fuji Learning Centre, Küstenfoto | Cyan/Blau ΔL\* **−10,8 / −12,2** (C\* 25–40), Chroma ×1,04; Gelbgrün ±0 |

**[E]:** CC FX Blue = **Farbton-selektive Abdunklung des Blaubereichs (≈ 200–300°)** um ≈ 8–12 L\* bei Strong, Weak ≈ halb; Chroma +4–7 %. Reala Ace enthält davon bereits etwas (Abschnitt 1.3, Blau −7,5 L\*).

### 2.4 Smooth Skin Effect

Handbuch [B]: „glättet Hauttöne“ (Off/Weak/Strong). Messung [M] (Alik, GFX100 II, Reala Ace, Strong gegenüber Off): **kein** Unterschied in Helligkeit oder Chroma (|ΔL\*| < 0,1, Chroma ×1,00 in allen Klassen) – rein räumlich
(Gesichts-/Hautbereichs-Weichzeichnung), für Film Lab ohne Gesichtserkennung nicht relevant. **[E]**

### 2.5 Highlight Tone / Shadow Tone

**[B]** Handbuch: „Tone Curve“; höhere Werte machen Lichter bzw. Schatten härter, niedrigere weicher. Peltier: Shadow Tone wirkt auf die linke, Highlight Tone auf die rechte Histogrammhälfte, **Mitten
bleiben weitgehend unberührt**; die Wirkung beginnt sanft in den Mittendunklen/-hellen und nimmt zu den Extremen stark zu, ähnlich gezielten Kurvenanpassungen in Lightroom, nicht wie ein globaler S-Kurven-Regler;
negative Werte verflachen und ziehen das Histogramm von den Rändern. Bereich +4/−2 (X RAW Studio, ältere Bodies ganzzahlig, neuere in Halbschritten laut Peltier-Leserantwort und Rezeptlisten).
Bei D-Range-Priority werden beide Kurven automatisch verstellt. **[B]**

**Größe eines Schritts: [?] nicht belegt, nicht gemessen.** Hinweis aus den LUT-Daten **[E]:** Die Simulationen selbst unterscheiden sich in den Extremen um ≈ 10–40 Codewerte pro Seite (z. B. Classic Chrome vs. Provia bei −3 Blenden
12 statt 20, +4 Blenden 234 statt 232); ein Highlight-/Shadow-Schritt von 1,0 dürfte in dieser Größenordnung liegen (Rezeptautoren nutzen +4/−2 als Extrem). **Messvorschlag:** Graukeil durch die Kamera/X RAW Studio je Stufe (−2…+4).

### 2.6 Dynamic Range (DR100/200/400) und D-Range-Priority

**[B]** DR100 = aus. DR200 unterbelichtet die Aufnahme um eine Blende, DR400 um zwei, und die dunklen Töne werden im JPEG wieder angehoben; Gewinn: mehr Lichterzeichnung, Preis: mehr Schattenrauschen. Mindest-ISO: bei
Basis-ISO 125 (X-T5, X-H2) DR200 ab ISO 250, DR400 ab ISO 500; bei ISO-160-Kameras 320/640. Auto wählt zwischen 100 und 200 (X-Trans V seltener 200). D-Range-Priority ist ein Paket aus automatischer Tonkurve
und DR. **[B]** (Handbuch, Peltier, Fuji X Weekly zu Reggie's Portra). Für Film Lab: DR200/400 entspricht einer **zusätzlichen, nach oben gestauchten Lichterkurve**, die man bei den Rezepten mit DR400
(z. B. Portra 400/800, Gold 200, CineStill 800T) in die Tonkurve einrechnen muss; die Schatten bleiben durch die Anhebung ähnlich hell. **[E]**

### 2.7 White Balance und WB-Shift

Kelvin-Bereich 2500–10 000 K in 10-K-Schritten **[B]**. WB-Shift: zwei Achsen R und B je −9…+9, also 19 × 19 = 361 Positionen („über 350“) **[B]**. **Wie groß ein Schritt ist: [?]** Fuji dokumentiert es nicht; ein Forennutzer
fand, dass ein Kelvin-Wechsel nicht einfach der vertikalen B-Achse entspricht (6300 K ≈ R −7 / B +9 relativ zu Daylight in seinem Test) **[B, Forum, unsicher]**. Faustregel **[E]:** Die vollen ±9 liefern deutliche, aber nicht absurde
Farbstiche (Fuji X Weekly zeigt neun Extremstellungen mit starkem Cast); ein Schritt entspricht grob einer schwachen Filterung der Größenordnung **einige Mired** (Mired = 10⁶/K, eine Einheit ≈ 9 K bei 3000 K, ≈ 25 K bei 5000 K).
Messvorschlag: Graukarte bei Daylight und Shift ±1, ±3, ±9 aufnehmen und das R/B-Verhältnis auswerten.

Hinweis für den Nachbau: Rezepte kombinieren WB und Shift, z. B. „Daylight +4 R / −5 B“ (Gold 200) oder „5200 K +1 R / −6 B“ (Portra 400 v2) – das sind **Farbtemperatur-Verschiebungen der gesamten Szene vor der
Filmkurve**, die dem Rezept die Warm-/Kaltcharakteristik geben.

### 2.8 Monochromatic Color (Toning)

Für ACROS und MONOCHROME (nicht Sepia): WC (Warm–Cool, positiv = warm) und MG (Magenta–Green, positiv = grün, negativ = magenta), jede −18…+18 auf X-T4/X-Pro3 und neuer; ältere Bodies nur eine Achse ±9 (X-T3/X-T30) **[B]**
(Fuji X Weekly, Handbuch). Auch WB und WB-Shift färben s/w-Bilder (Fuji X Weekly zeigt Acros+R mit 4200 K / B +9). Der T-Max-400-Rezeptautor nutzt WC +2 (≈ leichte Wärme). Ein Messwert pro Schritt liegt nicht vor **[?]**.

### 2.9 Reihenfolge in der Kamerapipeline

Belegt ist nur wenig **[B]:** D-Range-Priority überschreibt Tonkurve und DR; Color Chrome wirkt bei Aufnahme/In-Kamera-Konvertierung; Grain wirkt auf JPEG/HEIF und wird mit eingebacken; ein Blog beobachtet, dass das Korn **vor** der
Schärfung angewandt wird (nicht verifiziert). **Plausible Reihenfolge [E]:** Entrauschen → Weißabgleich/Shift → Filmsimulation (Farbmatrix/3D-LUT inkl. Tonkurve) → Dynamic Range/Highlight/Shadow → Color → Color Chrome/FX Blue → Clarity → Schärfen/NR → Korn → JPEG.
Das deckt sich mit den Messungen (Color Chrome verändert nur L\*/selektiv, Grain bleibt pixelbezogen). Für die Reihenfolge im Shader empfehle ich diese Abfolge, mit dem Korn zuletzt auf Vollauflösung.

---

## 3. Leica: Looks, Film Styles und einstellbare Parameter

Quellen (gesamter Abschnitt):
- Leica Looks (Katalog, Beschreibungen, Beispielbilder): <https://leica-camera.com/en-int/photography/leica-looks>
- Leica Q3 Bedienungsanleitung (EN): <https://leica-camera.com/sites/default/files/pm-19546-Leica-Q3_Instructions_en.pdf> (Seiten 65–66, 143–144, 147); Leica SL3 Bedienungsanleitung (EN):
  <https://leica-camera.com/sites/default/files/pm-14578-Leica-SL3_Instructions_en_1.0.pdf> (Seiten 96–99).
- Offizielle LUTs: SL3-P-Downloadseite <https://leica-camera.com/en-GB/photography/cameras/sl/sl3-p-black/downloads> (Archive `pm-28363-Leica-Cine.zip`, `pm-28364-Leica-Pure.zip`,
  `pm-14626-Leica-Look-Up-Tables--Legacy-.zip`); Einordnung: CineD <https://www.cined.com/leica-sl3-p-rev>.
- Foren/Dritte: <https://www.l-camera-forum.com/topic/403098-leica-looks-luts-and-c1>, <https://www.l-camera-forum.com/topic/394723-sl3-film-styles-looks-etc>, Robin Schimko
  <https://www.robinschimko.com/blog/the-leica-q3-look> (nicht abrufbar, nur über Forum bekannt).

### 3.1 Struktur: Film Styles, Core/Essential/Artist Looks

**[B]** Leica unterscheidet **drei Familien** von „Leica Looks“ (Seite „Leica Looks“, Stand Oktober 2026) und daneben das ältere **Film-Style-Menü** der Kameras:

- **Core Looks** (in der Kamera vorinstalliert, in der Kamera „Film Look“/„Leica Looks“): **Standard (STD), Vivid (VIV), Natural (NAT), Monochrome (BW+NAT, „Leica Monochrom Natural“), Monochrome High Contrast (BW+HC).**
- **Essential Looks** (per Leica FOTOS laden, bis zu 6 Looks gleichzeitig; Stand Oktober 2026): **Pure (PURE, „Cinema Look“), Cine (CINE, „Cinema Look“), Silver (SLV), Bleach (BLE), Teal (TEL), Brass (BRS), Chrome (CHR),
  Classic (CLS), Contemporary (CNT), Sepia (SEP), Blue (BLU), Selenium (SEL), Eternal (ETN).**
- **Artist Looks:** **Steve McCurry (STV MCY)**, kräftige, natürlich kontrastreiche Farben nach dokumentarischer Fotografie; **Greg Williams (WLM)**, Schwarzweiß, an klassischen **Tri-X-400-Scans** orientiert, mit einem Hauch Wärme.
- **Kompatibel (laut Leica-Seite):** Leica **Q3, Q3 43, SL3, SL3-S, SL3-P**. Die **M11** und die **D-Lux 8** sind dort **nicht** genannt; sie haben die klassischen JPG-/Film-Style-Einstellungen. Die Leica-LUX-App nutzt die Looks laut Forum auf dem Smartphone. **[B/?]**
- Looks gelten **für JPEG** (SL3: „Anpassung von JPG-Bildern“); in der DNG-Datei steckt nur eine eingebettete Style-Anweisung, die Leica FOTOS und die Kamera-Vorschau lesen (laut Forum), Lightroom nicht. **[B/?]**

**Film Style (SL3-Handbuch S. 96–99):** Farbprofile **Standard, Vivid, Natural**; Monochrom-Profile **Monochrome, Monochrome High Contrast**; je Profil einstellbar **Contrast, Highlight, Shadow, Sharpness, Saturation**
(Saturation nur bei Farbprofilen), jeweils **−2, −1, 0, +1, +2** (fünf Stufen). **Film Style und Leica Looks sind nicht gleichzeitig aktiv.** Sechs Speicherplätze für Looks. **[B]**

**Leica Looks einstellen (Q3-Handbuch S. 65–66):** Ein Look kann „individuell angepasst“ werden; die Konfigurationsübersicht ordnet **Core Looks → vollständig anpassbar** (Contrast / Highlight / Shadow / Sharpness / Saturation je −2…+2),
**Essential Looks (Teal, Chrome, Eternal …) → nur die Intensität (in Prozent)**, **Artist/Partner Looks (Greg Williams) → nicht anpassbar.** Die Intensität lässt sich in Prozent setzen. **[B]** (Zuordnung der Tabellenspalten
aus der Textextraktion gelesen, die Spaltenlage ist dort nicht eindeutig **[E]**.)
Video-Looks haben dieselben Parameter; bei Video-Gamma ≠ Off (HLG, L-Log) sind Looks gesperrt. **[B]**

### 3.2 Charakter der Looks (Leica-Beschreibung in eigenen Worten + Messung)

| Look | Leica-Beschreibung (sinngemäß) [B] | Messung gegenüber Standard [M]: C\*-Verhältnis (gesamt) / ΔL\* Schatten (L\*<30) / ΔL\* Mitten (30–70) |
|---|---|---|
| **Standard** | ausgewogen, vielseitig, realistische Farben, mäßiger Kontrast, ausgewogene Sättigung | Basis |
| **Natural** | gedämpfte Sättigung, weich übergehende Töne, mäßiger Kontrast | **×0,78** (alle Farbtöne ×0,75–0,83, kein Farbtonshift) / tiefste Schatten +1,4…+1,7, dann −1,2 / Mitten −0,6…−2,2 → flacher |
| **Vivid** | gesteigerte Sättigung, starke Kontraste, kräftige Farben | **×1,16** (Violett/Magenta ×1,24, Rot/Orange ×1,18, Blau ×1,14, Gelb/Grün ×1,08) / tiefste Schatten −1,3…−1,7 (dichter) / Mitten **+3,2…+3,4** (heller); Farbton ±2° |
| **Monochrome** (Natural) | natürlicher, zurückhaltender s/w-Look, sanfte Abstufungen | Helligkeit ≈ Standard (+1,2 in den tiefsten Schatten, sonst −0,1…−1,5 L\*) |
| **Monochrome High Contrast** | scharfes Spiel von Licht und Schatten, kontrastreich | **S-Kurve:** Schatten −3…−4 L\* tiefer (10–20: 11,8 statt 15,6), Lichter +5…+6 heller (70–80: 80,8 statt 74,9; 80–90: 90,4 statt 84,7) |
| **Classic (CLS)** | analoger, cineastischer Look; hoher Kontrast, weiche Sättigung, warme, leicht ausgewaschene Farben | **×0,85** / **+5,7** / **+9,0** → deutlich hellere Mitten und angehobene Schatten, gedämpfte Farbe |
| **Contemporary (CNT)** | modern, helle Schatten, natürliche Farben, dezent rötlicher Stich; ideal für Hauttöne | **×0,94** / **+8,2** / **+11,7** (hellste Mitten aller Looks) |
| **Eternal (ETN)** | starker Kontrast, kräftige Sättigung, Magenta-Stich | **×1,08** (Mitten ×1,20–1,28) / −1,4 (Schatten dichter) / +0,2; Magenta/Rot-Anteil in den Mitten ↑ |
| **Chrome (CHR)** | gedämpfte Palette, feiner Kontrast, klassischer Charme | **×0,84** / +6,6 / +2,5 |
| **Silver (SLV)** | kühle, stählerne Ästhetik, weicher Kontrast, klare Lichter, leicht angehobene Schatten | **×0,89** / **+12,6** / +9,8 (stärkste Schattenanhebung) |
| **Bleach (BLE)** | zeitgemäß, gedämpfte Sättigung, kühle Blautöne, stimmungsvoll | **×0,72** / +8,0 / +4,8 |
| **Teal (TEL)** | kühler, filmischer Blaugrün-Ton | **×0,76** / +2,6 / −2,3 |
| **Brass (BRS)** | warmes Licht der goldenen Stunde, betont Mitten und Lichter | **×1,02** / +4,6 / +6,5; Gelb-Anteil steigt |
| **Pure (PURE)** | natürlich, filmisch einsetzbar, subtiler Kontrast, leichter ausgewogener Charakter, Basis für Grading | **×0,88** / +3,4 / −6,2 (Mitten dunkler als Standard) |
| **Cine (CINE)** | warmer, filmischer Look, fein abgestimmte Palette, glatte Lichter, sanfter Kontrast | **×0,67** / +3,4 / −4,9 |
| **Sepia (SEP)** | klassischer Vintage-Look mit braunen und gelben Tönen | s/w mit Tönung: **b\* +3 (Schatten) … +10 (Lichter)**, a\* ≈ −1; Helligkeit ≈ Standard (C\* ×0,61: Restfarbe des Originals) |
| **Blue (BLU)** | Blautöne des Cyanotypie-Drucks | s/w mit Tönung: **b\* −3 (Schatten) … −7 (Mitten/Lichter)**, a\* ≈ −1 |
| **Selenium (SEL)** | kühle Töne, weicher Kontrast nach Selen-Tonung | s/w mit Tönung: **a\* +2…+3, b\* −4…−7** (kühl-violett); Schatten +4,3 |
| **Steve McCurry / Greg Williams** | siehe 3.1 | nicht messbar (keine Bildserie) |

**Messmethode (3.2) [M]:** Auf der Leica-Seite zeigt jedes Look-Bild links unten als **Inset dieselbe Aufnahme im „Standard“-Look** (662×439 px, exakt derselbe Bildausschnitt; Look-Bild 1682×1120). Das Look-Bild
wurde auf die Inset-Größe verkleinert, Beschriftungen und reinweiße Pixel wurden maskiert. Je Look 4–5 Szenen (Teal 4), 64 Paare insgesamt. Lichter oberhalb L\* ≈ 80 wurden wegen der Maskierung **nicht ausgewertet**.
Die Farbton-Richtung der Farb-Looks lässt sich aus Mittelwerten von a\*/b\* **nicht belastbar** bestimmen (Szeneninhalt und Entsättigung verfälschen); die Aussagen sind **Größenordnungen (±2 L\*, ±0,05 Chroma)**.
Offizielle Quellbilder siehe `testbilder/referenz/leica-offiziell/`, Auswertung: dieses Kapitel.

**Core-Looks auf identischer Aufnahme (Mailänder Galleria), volle 1920×1280 [M]:** mittleres L\* je Standard-L\*-Klasse:

| Standard-L\*-Klasse | 0–5 | 5–10 | 10–20 | 20–30 | 30–40 | 40–50 | 50–60 | 60–70 | 70–80 | 80–90 | 90–100 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Standard (Ø L\*) | 2,4 | 7,3 | 15,6 | 25,3 | 34,9 | 44,9 | 54,7 | 64,7 | 74,9 | 84,7 | 95,3 |
| Natural | 4,1 | 8,7 | 15,8 | 24,1 | 32,7 | 43,4 | 54,0 | 64,1 | 73,9 | 83,5 | 94,9 |
| Vivid | 1,1 | 5,6 | 15,4 | 27,2 | 38,1 | 48,3 | 58,0 | 67,5 | 77,4 | 86,5 | 96,0 |
| Monochrome | 3,6 | 7,7 | 15,2 | 24,3 | 33,4 | 43,5 | 53,5 | 63,9 | 74,7 | 84,6 | 95,3 |
| Mono HC | 1,2 | 5,2 | 11,8 | 22,6 | 34,5 | 46,2 | 57,3 | 68,8 | 80,8 | 90,4 | 97,3 |

Farbwirkung je Farbtonsektor (Chroma-Verhältnis / Median-Farbtonverschiebung / ΔL\*):

| Farbsektor der Standard-Basis (Pixel) | Natural | Vivid |
|---|---:|---:|
| Rot-Rosa 0–30° (9620) | ×0,76 / −0° / −0,5 | ×1,18 / +1° / +1,9 |
| Rot-Orange 30–60° (30922) | ×0,75 / −3° / −0,3 | ×1,18 / +2° / +1,8 |
| Orange-Gelb 60–90° (252936) | ×0,78 / −1° / −1,3 | ×1,15 / +1° / +2,9 |
| Gelb-Gelbgrün 90–130° (43715) | ×0,77 / −1° / −1,3 | ×1,09 / +0° / +2,6 |
| Grün 130–180° (1879) | ×0,83 / −0° / −1,6 | ×1,08 / −1° / +2,8 |
| Cyanblau 200–250° (1538) | ×0,79 / +2° / −0,3 | ×1,08 / −2° / +2,3 |
| Blau 250–290° (29238) | ×0,80 / −0° / +0,3 | ×1,14 / −0° / +1,8 |
| Violett-Magenta 290–360° (13348) | ×0,75 / +0° / −0,1 | ×1,24 / +0° / +1,1 |

### 3.3 Offizielle Leica-LUTs [M]

Leica stellt für die SL3-P (und früher SL2-S) 3D-LUTs bereit, die zu vier Looks passen:

- **Leica Cine / Leica Pure** (SL3-P, L-Log Rec.2020 → Rec.709 Gamma 2.4, 65³ und 33³-Viewing-LUT). Namen entsprechen den Essential Looks „Cine“ und „Pure“. **[B]**
- **Classic (SL2-S-Film V6.3)** und **Natural (SL2-S-Modern V6.2)**, je Rec.2020/Rec.709 mit Gamma 2.4, 33³ („Software Leica Camera LUT“). Ob „Classic“ hier derselbe Look wie der heutige Essential Look „Classic (CLS)“ ist, ist **nicht belegt [?]** – der
  Name und die Beschreibung („hoher Kontrast, weiche Sättigung“) passen, die Bildmessung (Classic: Mitten +9 L\*) und die LUT (S-Kurve) zeigen jedoch nur grob dieselbe Richtung.

Neutrale Graurampe, Ausgabe (8 Bit, G-Kanal) bei Eingangscode 0 … 100 % in 10-%-Schritten:

| Eingang (%) | 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pure (L-Log) | 0 | 3 | 13 | 43 | 92 | 145 | 195 | 231 | 248 | 253 | 255 |
| **Cine (L-Log)** | **7** | 9 | 16 | 39 | 88 | **154** | 203 | 227 | 235 | 238 | **240** |
| Natural (SL2-S Modern) | 0 | 3 | 16 | 41 | 82 | 130 | 176 | 219 | 245 | 255 | 255 |
| Classic (SL2-S Film) | 0 | 3 | 13 | 37 | 78 | 130 | 183 | 222 | 244 | 251 | 253 |

- **Cine** hebt Schwarz auf **7/255** und deckelt Weiß bei **240/255** (matter, „filmischer“ Look), mit steilerer Mitte (Eingang 50 % → 154 statt 145) und **Chroma ×0,66–0,86 gegenüber Pure** (je nach Helligkeit der Testfarben; Fotomessung Cine/Pure: 0,67/0,88 = 0,76 – passt),
  Farbtonverschiebungen bis ±30° in Blau-Grün-Bereichen. **[M]**
- **Classic** (Film) gegenüber Natural (Modern): S-Kurve (Schatten tiefer: 30 % → 37 statt 41, Mitten heller: 60 % → 183 statt 176, Lichter komprimiert, Weiß nur 253), Chroma ≈ gleich (×0,96–1,04), Farbton-Unterschiede ±5…17°. **[M]**

Eingangsraum von Classic/Natural ist offenbar bereits ein Rec.709-ähnlicher Videoeingang (Mitte 50 % → 130 bei beiden) **[E]**; für Cine/Pure ist es L-Log (L-Log-Konstanten wurden nicht zur Dekodierung genutzt, die Aussagen sind relativ).

### 3.4 Datenlage für Leica (Kurzfassung)

| Gegenstand | Daten |
|---|---|
| Core Looks (Standard/Natural/Vivid/Mono/Mono HC) | **Pixelgleiche Serie** einer Aufnahme (1920×1280); Kontrast-/Chroma-Verhältnisse gemessen (3.2) |
| Essential Looks (13) | 64 Standard↔Look-Paare mit Inset 662×439; grobe Statistik (3.2). Keine Pixel-Serie in voller Größe, keine Kurven, keine LUT außer Cine/Pure |
| Cine, Pure | **offizielle LUT** (L-Log) → genaue Kurve/Farbe messbar (3.3); Foto-Pfad nicht identisch **[?]** |
| Classic, Natural | LUT der **SL2-S** (Legacy), Zuordnung zu den heutigen Looks unklar **[?]** |
| Contemporary, Eternal, Chrome, Silver, Bleach, Teal, Brass, Sepia, Blue, Selenium | nur Beschreibung + Inset-Paare |
| Artist Looks | nur Beschreibung |
| Drittanbieter | Lightroom-Profile/-Presets für Classic und Contemporary (Robin Schimko, kostenlos), Cobalt-Profile (12/2025), Capture-One-Styles aus dem Forum – **nicht heruntergeladen**, Qualität unbekannt |
| Parameter | Contrast/Highlight/Shadow/Sharpness/Saturation −2…+2 (Film Style/Core Looks), Intensität 0–100 %; Schrittgrößen **nicht dokumentiert [?]** |
| Korn | **nicht** Teil der Leica Looks (kein Grain-Parameter in den Handbüchern gefunden) **[B/E]** |

---

## 4. Bekannte Fuji-Rezepte (Einstellungslisten) – inkl. Kodak-Filme

Rezepte sind Einstellungslisten (Fakten) und werden hier mit Quelle wiedergegeben. Quelle für fast alle: **Fuji X Weekly** (Ritchie Roesch, <https://fujixweekly.com/>); die Seiten habe ich per HTML ausgelesen, die Werte
stehen wörtlich dort. „High ISO NR“ steht in der Spalte **NR**. Alle Rezepte nutzen ISO Auto (meist bis 6400) und Dynamic-Range-Priority aus (außer wo DR-P genannt). **Sensor** = Generation, für die der Autor das Rezept schrieb
(X-Trans IV = z. B. X-Pro3, X100V, X-T4; X-Trans V = X-T5, X-H2, X-H2S, X-S20, X100VI, X-T50, X-E5; GFX = Bayer).
Rezepte desselben Autors für Ricoh-GR-Kameras (mit eigenen Filmbezügen): `ricoh-rezepte.md`.

### 4.1 Farbrezepte

Abkürzungen: **CC** = Classic Chrome, **CN** = Classic Negative, **NN** = Nostalgic Neg., **RA** = Reala Ace; **Korn** = Roughness, Size; **CCE** = Color Chrome Effect; **FXB** = Color Chrome FX Blue; **Clar.** = Clarity;
**Belichtung** = „typisch“ empfohlene Belichtungskorrektur (EV).

| Rezept (Film) | Basis | Korn | CCE | FXB | WB, Shift R / B | DR | High-light | Shadow | Color | Sharp | NR | Clar. | Belichtung | Sensor | Quelle |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|---|---|
| **Kodak Portra 160 v2** | CC | Weak, Small | Weak | Weak | Daylight, +4 / −5 | DR-P Auto | – | – | 0 | −1 | −4 | −2 | +1/3 … +1 | X-Trans V | [FXW 10.11.2023](https://fujixweekly.com/2023/11/10/kodak-portra-160-v2-fujifilm-x-t5-x-trans-v-film-simulation-recipe/) |
| **Kodak Portra 400 v2** | CC | Strong, Small | Strong | Off | 5200 K, +1 / −6 | DR400 | 0 | −2 | +2 | −2 | −4 | −2 | +1/3 … +1 | X-Trans V (X-T5) | [FXW 16.12.2022](https://fujixweekly.com/2022/12/16/kodak-portra-400-v2-fujifilm-x-t5-x-trans-v-film-simulation-recipe/) |
| **Kodak Portra 800 v3** | CC | Strong, Large | Strong | Off (V) / Weak (IV) | 6600 K, −1 / −3 | DR400 | −2 | −0,5 | +3 | −2 | −4 | −3 | +1/3 … +1 1/3 | X-Trans V (X-T5) und IV (X-E4) | [FXW 14.02.2024](https://fujixweekly.com/2024/02/14/kodak-portra-800-v3-fujifilm-x-t5-x-trans-v-x-e4-x-trans-iv-film-simulation-recipe/) |
| **Kodak Ektar 100** | CC | Off | Strong | Weak | 6050 K, +3 / 0 | DR-Auto | +1 | −2 | +4 | 0 | −4 | +3 | 0 … +2/3 | X-Trans IV (X100V, X-Pro3, X-T4; Autor: nur Annäherung, „CC nicht kräftig genug“) | [FXW 10.08.2020](https://fujixweekly.com/2020/08/10/fujifilm-x100v-film-simulation-recipe-kodak-ektar-100/) |
| *Ektar-Alternative: Kodak Negative* | NN | Weak, Large | Off | Off | Auto, +1 / −4 | DR400 | −0,5 | +2,5 | +4 | −1 | −4 | −3 | +1/3 … +2/3 | X-Trans V (X-T5; Autor: „erinnert an Ektar“) | [FXW 22.12.2022](https://fujixweekly.com/2022/12/22/kodak-negative-fujifilm-x-t5-x-trans-v-film-simulation-recipe/) |
| *Ektar-Alternative: Classic-Neg-Ektar (Nivla Oibiun)* | CN | – (nicht genannt) | – | – | Auto/Ambience, +4 / −4 | Auto | +1,5 | +1,5 | +4 | – | – | – | ISO bis 3200 | X-S20 | [FujiRumors 10.11.2025](https://www.fujirumors.com/?p=139137) (nur Kurzliste) |
| **Kodak Gold 200** | CC | Strong, Small | Weak | Off | Daylight, +4 / −5 | DR400 | −1,5 | +0,5 | +3 | −2 | −4 | −2 | +2/3 … +1 | X-Trans V (X-T5) | [FXW 24.10.2023](https://fujixweekly.com/2023/10/24/kodak-gold-200-fujifilm-x-t5-x-trans-v-film-simulation-recipe/) |
| **Kodak Ultramax 400** | CC | Strong, Large | Weak | Off | Auto, +1 / −5 | DR-Auto | +1 | +1 | +4 | 0 | −4 | +3 | +1/3 … +1 | X-Trans V (X-T5) | [FXW 17.01.2023](https://fujixweekly.com/2023/01/17/kodak-ultramax-400-a-film-simulation-recipe-for-the-fujifilm-x-t5-x-trans-v/) |
| **Kodak ColorPlus 200** (geringere Verlässlichkeit) | CC | Weak, Small | Off | Off | Daylight, 0 / −3 | DR100 | 0 | 0 | +2 | 0 | −4 | 0 | 0 … +1/3 | nicht genannt (Beispielbilder X100VI/X-T30 II) | [ShutterGroove](https://www.shuttergroove.com/fujifilm-recipes/35mm-film-recipes/kodak-colorplus-200-film-recipe/) |
| *ColorPlus-Alternative: Kodacolor VR 200* | CC | Weak, Large | Strong | Weak | 3000 K, +8 / −8 | DR200 | +1,5 | +2,5 | −4 | +1 | −4 | −2 | 0 … +2/3 | X-Trans V (X100VI, X-S20, GFX100S II) | [FXW 16.04.2025](https://fujixweekly.com/2025/04/16/kodacolor-vr-200-fujifilm-x-trans-v-film-simulation-recipe/) |
| **Kodachrome 64** | CC | Weak, Small | Strong | Off | Daylight, +2 / −5 | DR200 | 0 | +0,5 | +2 | +1 | −4 | +3 | 0 … +2/3 | X-Trans V (X-T5) | [FXW 28.11.2022](https://fujixweekly.com/2022/11/28/kodachrome-64-fujifilm-x-t5-x-trans-v-film-simulation-recipe/) |
| **Kodachrome 25** | CC | Off | Strong | Weak | Daylight, +2 / −4 | DR400 | +0,5 | −0,5 | +1 | +3 | −4 | +3 | 0 … +2/3 (ISO bis 1600) | X-Trans V (X-T5) | [FXW 06.03.2023](https://fujixweekly.com/2023/03/06/kodachrome-25-fujifilm-x-t5-x-trans-v-film-simulation-recipe/) |
| **Ektachrome E100** („Thommy’s Ektachrome“) | NN | Weak, Small | Weak | Off | 5000 K, −1 / +3 | DR100 | +1,5 | +1,5 | +1 | −1 | −4 | −2 | 0 … +1/3 | X-Trans V (X-T5) | [FXW 24.03.2023](https://fujixweekly.com/2023/03/24/thommys-ektachrome-fujifilm-x-t5-x-trans-v-film-simulation-recipe/) |
| *Ektachrome E100 (FXW-Eigenrezept)* | RA | – | – | – | – | – | – | – | – | – | – | – | – | X-Trans V (X-T50) | [FXW 07.08.2024](https://fujixweekly.com/2024/08/07/ektachrome-e100-fujifilm-x-t50-x-trans-v-fxw-app-patron-early-access-recipe/): **Einstellungen nur für Patrons, nicht öffentlich**; Autor nennt Reala Ace als Basis |
| **Kodak Vision3 250D v2** | NN | Strong, Small | Strong | Off | Fluorescent 1, −5 / 0 | DR200 | +4 | +3 | −1 | −2 | −4 | −2 | 0 … +2/3 | X-Trans V (X-T5) | [FXW 19.12.2023](https://fujixweekly.com/2023/12/19/kodak-vision3-250d-v2-fujifilm-x-t5-x-trans-v-film-simulation-recipe/) |
| **CineStill 800T v1** (≈ Vision3 500T) | Eterna | Strong, Large | Strong | Weak | Fluorescent 3, −6 / −4 | DR400 | 0 | +2 | +4 | −3 | −4 | −5 | −1/3 … +2/3 | X-Trans V (X-T5, X100VI) | [FXW 16.04.2024](https://fujixweekly.com/2024/04/16/cinestill-800t-fujifilm-x-trans-v-film-simulation-recipe/) |
| **CineStill 800T v2** | RA | Strong, Small | Off | Off | 4500 K, −1 / −3 | DR200 | +2 | 0 | +4 | −1 | −4 | −3 | −1/3 … +1/3 | X-Trans V (X-T5) | [FXW 29.09.2026](https://fujixweekly.com/2026/09/29/cinestill-800t-v2-a-fujifilm-recipes-for-x-trans-v-cameras/) |
| **Reggie’s Portra** (Reggie Ballesteros) | CC | Weak, Small | Strong | Weak (für V: Off) | Auto, +2 / −4 | DR-Auto | −1 | −1 | +2 | −2 | −4 | 0 | keine Angabe (Autor: +1/3…+1) | X-Trans IV (X-Pro3, X100V, X-T4, X-S10, X-E4); X-Trans V: nur FXB auf Off | [FXW 11.06.2022](https://fujixweekly.com/2022/06/11/fujifilm-x-trans-iv-film-simulation-recipe-reggies-portra/), [FXW 03.12.2025](https://fujixweekly.com/2025/12/03/reggies-portra-in-x-trans-v-cameras/) |
| **Classic Cuban Neg** (Osan) | CN | Strong, Large | Strong | Strong | Auto, +4 / −5 | DR400 (DR-P Off) | −2 | +1 | +4 | 0 | −4 | −4 | – | nicht genannt; für X-Trans V vermutlich FXB auf Weak **[E]** (Muster aus FXW) | [FujiRumors 07.06.2024](https://www.fujirumors.com/?p=128669) |

### 4.2 Schwarzweißrezepte

| Rezept (Film) | Basis (Filter) | Korn | CCE | FXB | WB, Shift R / B | DR | High-light | Shadow | Sharp | NR | Clar. | Toning | Belichtung | Sensor | Quelle |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---|---|---|---|
| **Kodak Tri-X 400** (Anders Lindborg) | Acros (Filter +Ye/+R/+G wählbar) | Strong, Large | Strong | Off | Daylight, +9 / −9 | DR200 | 0 | +3 | +1 | −4 | +4 | – | +1/3 … +1; ISO **1600–12800** | X-Trans IV (X100V); laut FXW auch III/V mit Acros | [FXW 18.06.2020](https://fujixweekly.com/2020/06/18/fujifilm-x100v-film-simulation-recipe-kodak-tri-x-400/) |
| **Kodak T-Max 400** | Monochrome (Filter +Ye/+R/+G wählbar) | Strong, Small | Strong | Off | Daylight, +9 / −9 | DR200 | 0 | +3 | +2 | −4 | +3 | WC +2, MG 0 | +1/3 … +1; ISO 1600–3200 ideal | X-Trans IV (X100V) | [FXW 31.08.2020](https://fujixweekly.com/2020/08/31/fujifilm-x100v-film-simulation-recipe-kodak-t-max-400/) |
| **Kodak T-Max 100 Hard Tone** (Dan Allen) | Monochrome + G | Weak, Large | Off | Off | Daylight, −6 / −3 | DR200 | +0,5 | +2,5 | −1 | −4 | −1 | WC 0, MG 0 | −2/3 … +2/3 | X-Trans IV und V (X-T5, X100VI) | [FXW 04.10.2024](https://fujixweekly.com/2024/10/04/kodak-t-max-100-hard-tone-a-film-simulation-recipe-for-fujifilm-x-trans-iv-x-trans-v-cameras-part-1/) |
| **Kodak T-Max 100 Soft Tone** (Dan Allen) | Monochrome + G | Weak, Large | Off | Off | Daylight, −6 / −3 | DR200 | −0,5 | +1,5 | −1 | −4 | −1 | WC 0, MG 0 | −2/3 … +2/3 | X-Trans IV und V | [FXW 07.10.2024](https://fujixweekly.com/2024/10/07/kodak-t-max-100-soft-tone-a-film-simulation-recipe-for-fujifilm-x-trans-iv-x-trans-v-cameras-part-2/) |

Hinweise: Die Tri-X-Seite gibt als Basis „Acros (+Y, +R, +G)“ an, das heißt, jeder der drei Acros-Filter funktioniert; Fuji X Weekly empfiehlt ISO 1600 und mehr (ISO 1600–3200 „neuerer Tri-X“, 6400–12800 „älterer
Tri-X“). Bei Rezepten mit Acros kommt das **eingebaute ISO-abhängige Acros-Korn** zusätzlich zum Grain Effect hinzu.

**Kodak Vision3 500T:** Es gibt kein eigenes Fuji-X-Weekly-Rezept; die Fuji-Community nutzt **CineStill 800T** (Remjet-freies Vision3 500T) als Stellvertreter. Fuji X Weekly betont allgemein, dass Rezepte Annäherungen an die Filme sind.
Das **T-Max-400-Rezept** wurde laut Fuji X Weekly mit Anders Lindborg gemeinsam entwickelt. **Ektar 100:** Fuji X Weekly nennt die Nachbildung „unmöglich“, weil nur Classic Chrome die passende Palette hat, aber nicht kräftig genug ist.

Zur Portierung auf die Sony a6000 **[?/E]**: Fuji gibt die Kelvin-Werte der WB-Presets nicht an; Näherung: Daylight ≈ 5500 K, „Fluorescent 1“ (Daylight-Leuchtstoff) ≈ 6000 K, „Fluorescent 3“ (Cool White) ≈ 4000–4500 K – **nicht belegt**. Auto-WB hat keine eindeutige
Entsprechung (Ambience Priority = wärmere Weißen unter Glühlampen).

### 4.3 Charakter der echten Filme (zum Gegenprüfen des Ergebnisses)

Datenblatt-Fakten **[B]** sind Kodak Alaris bzw. Eastman Kodak (PDFs, Stand 2015–2025): Portra 400 (E-4050, 01/2025), Portra 160 (E-4051), Portra 800 (E-4040), Ektar 100 (E-4046), Tri-X 320/400 (F-4017, 10/2021), Vision3 500T (H-1-5219, 2015);
Einschätzungen **[E]** sind mein Wissen über die Filme, nicht aus den Datenblättern. Die Charakterisierung bleibt qualitativ; die zugehörigen „Bilder echter Filme“ siehe Abschnitt 6.

| Film | Datenblatt/Quelle [B] | Charakter [E] |
|---|---|---|
| **Portra 160** | „deutlich feineres Korn, natürliche, glatte Hauttöne“ | Sehr geringer Kontrast, sanfte, leicht pastellige Farben, neutral-warme Haut, feinstes Korn der Portra-Reihe, flach scannend. |
| **Portra 400** | „feinkörnigster 400er Farbnegativfilm der Welt, echtes ISO 400, spektakuläre Hauttöne, ausgezeichnete Sättigung über weite Lichtbedingungen“ | Niedriger Kontrast, satte aber weiche Farben, warme (pfirsichfarbene) Haut, grünlich-gelbes Laub, helle, luftige Überbelichtung (+1…+2 EV). |
| **Portra 800** | „ausgewogene Sättigung, sehr feines Korn, beste Unterbelichtungstoleranz seiner Klasse“ | Etwas mehr Korn und Kontrast als 400, warmer Stich, etwas weniger Sättigung. |
| **Ektar 100** | „feinkörnigster Farbnegativfilm der Welt, ISO 100, hohe Sättigung, ultra-lebendige Farben“ | Knackige Rot/Orange, tiefe Blau (Himmel Richtung Cyan), hoher Kontrast; Haut kippt leicht ins Rote. |
| **Gold 200** | (Händlertext) Tageslicht, lebhafte Sättigung, feines Korn, hohe Schärfe, für 1-Stunden-Labore | Warmer Gelb-Orange-Stich, goldene Grüntöne, mittlerer Kontrast, „Familienalbum-Look“. |
| **UltraMax 400** | (Händlertext) Tageslicht, ISO 400, lebhafte Farben, weitgehend feinkörnig | Neutraler/kühler als Gold, knackige Primärfarben, mehr Korn und Kontrast. |
| **ColorPlus 200** | (nur Händler-/Blogtexte; ShutterGroove: warm, verzeihend, gelb-rot-betont, Blau gedämpft, nicht sehr scharf/kontrastreich) | Günstiger Konsumentenfilm: warm, weich, leicht ausgewaschene Blautöne, flacher als Gold. |
| **Kodachrome 64** | (Fuji X Weekly: meistgenutztes FXW-Rezept über Jahre; Kodak stellte den Film 2009 ein – Allgemeinwissen) | Diafilm: tiefe warme Rot/Gelb, leicht cyaniges Blau, hoher Kontrast, sehr scharf, feines Korn, „kontrollierte Brillanz“. Kodachrome 25: noch feiner und kontrastreicher. |
| **Ektachrome E100** | (Neuauflage 2018; FXW: wirkt ähnlich wie Reala Ace) | Neutraler, sauberer E-6-Look, eher kühl, farbgenau, feines Korn, mäßiger Kontrast. |
| **Kodacolor VR 200** | (FXW: Konsumentenfilm der Jahre 1982–1986, nicht Kodacolor VR Plus) | Weich, warm-gedämpft, pastellig, leicht verblasst. |
| **Tri-X 400** | „hochempfindlicher panchromatischer Film; diffuse rms-Körnigkeit **17** (fein); push-tauglich; Entwicklungsziel Kontrastindex 0,56“ | Sichtbares klassisches Korn, kräftiger Kontrast, tiefe Schwärzen, reiche Mitten, push-freundlich (ISO 1600+ typisch). |
| **T-Max 100 / 400** | – | Feinkorn (T-Grain), hohe Schärfe, weite Tonskala; T-Max 400 glatter und „sauberer“ als Tri-X. |
| **Vision3 250D** | (Kinonegativ, Tageslicht) | Geringer Kontrast, gedämpfte natürliche Farbe, große Belichtungsbreite, feines Korn. |
| **Vision3 500T / CineStill 800T** | Vision3 500T: Kunstlicht 3200 K, EI 500 (320 bei Tageslicht mit 85er Filter), Dye-Layering-Technology mit weniger Korn in den Schatten, **2 Blenden zusätzliche Lichterreserve** (H-1-5219) | CineStill 800T = 500T ohne Remjet: **rote Halation** um helle Lichter, kühl-türkise Töne bei Tageslicht, feines Korn; Vision3 500T ohne Halation, weiter Spielraum. |

---

## 5. Einschätzung (Teil C)

### 5.1 Was sich messen lässt und was nur nach Beschreibung geht

| Look / Parameter | Datenbasis | Einschätzung |
|---|---|---|
| **Provia** (Basis) | offizielle LUT, überall als Gegenstück | exakt messbar |
| **Velvia, Astia, Classic Chrome, Classic Neg., Eterna, Eterna Bleach Bypass, Pro Neg. Std, Reala Ace, Acros** | **offizielle LUTs** (Tonkurve + Farbe auf beliebigen Testfarben) **plus** 2–5 pixelgleiche Bildserien je Look | **exakt messbar**; in 1.2–1.3 liegen die Werte tabelliert vor. Vorbehalt: Videopfad |
| **Pro Neg. Hi** | 3 Bildserien (Kiechle, Peltier, Keith Wee), keine LUT | grob messbar: Chroma ≈ ×0,90–0,95, Schatten −2…−3,5 L\*, Lichter +0,5…+1 |
| **Nostalgic Neg.** | 2 Bildserien (Alik/Lightroom, Peltier-Raster), keine LUT, offizielle Beschreibung | grob messbar (Chroma ×0,89–0,94, Schatten +1,5…+3,5 L\*, wärmer); die **Bernstein-Schattenfarbe** bleibt eine Beschreibung → mit eigenem Vergleich nachbauen |
| **Acros/Monochrome + Ye/R/G, Sepia** | Kiechle-Serie (Capture One) + Acros-LUT | **messbar**: Kanalmischer-Gewichte, Tonkurven, Sepia-Tönung (1.5) |
| **Color Chrome Effect / FX Blue / Smooth Skin** | pixelgleiche Off/Strong-Paare (Fuji, Alik) | **messbar** (CCE: ΔL\* ≈ −2 für Nicht-Blau-Sättigung; FXB: ΔL\* −8…−12 im Blau; SSE: keine Farbwirkung) |
| **Grain Effect** | Ausschnitte, 100 %-Screenshot, Fuji-Beschreibung | **nur teilweise**: Korrelationslänge 1–1,5 px und Amplitude (Weak ≈ ⅓ Strong) grob, **Tonabhängigkeit und Größe bei 26/40 MP offen** |
| **Highlight/Shadow Tone, Color, Clarity, Sharpness, NR, WB-Shift** (Schrittgrößen) | nur Wertebereiche und qualitative Beschreibung | **nicht messbar** mit vorhandenen Daten; Schrittgrößen fehlen. Einzige Rückrechnung: Rezepte sind Mischungen dieser Regler, die man rekonstruieren kann, sobald die Regler kalibriert sind |
| **Kodak-/Rezepte** | Einstellungslisten (Abschnitt 4) | nachbaubar, **wenn** die Basissimulationen und Regler kalibriert sind; die Rezepte selbst sind Annäherungen an die echten Filme (Fuji X Weekly: „Ektar unmöglich“) |
| **Leica Core Looks** | identische Aufnahme in 5 Looks, 1920×1280 | gut messbar (Kontrast/Chroma, Abschnitt 3.2) |
| **Leica Cine/Pure (+ SL2-S Classic/Natural)** | **offizielle LUTs** | exakt messbar (relativ), Kurve/Farbe in 3.3 |
| **Leica Essential Looks (übrige 11) und Artist Looks** | Beschreibung + 64 Inset-Paare (662×439) bzw. nichts | **nur nach Beschreibung/Größenordnung** (±2 L\*, ±0,05 Chroma); keine Kurven |
| **Leica-Regler −2…+2, Intensität %** | Bereich bekannt, Schrittgröße nicht | wie Fuji-Regler: unkalibriert |

**Gesamturteil:** Für ~10 der 20 Fuji-Simulationen gibt es **Referenzdaten, die ein exaktes Nachbauen erlauben** (offizielle LUTs); für weitere 4–5 (Pro Neg. Hi, Nostalgic Neg., Acros-Filter, Sepia, Monochrome) reichen
pixelgleiche Paare für einen guten Näherungsnachbau. Die **Regler (Highlight/Shadow/Color/Clarity/Sharpness/WB-Shift) und das Korn** sind die größten Lücken; hier hilft nur eine Messreihe (Abschnitt 5.3).
Bei Leica ist die Datenlage **mittel**: exakt nur für Cine/Pure, brauchbar für die Core Looks, sonst Größenordnungen.

### 5.2 Konkrete Empfehlungen für den Nachbau

1. **Basis-Rendering klären.** Die Fuji-Simulationen sitzen auf Fujis eigenem Provia-Rendering. Messbar ist daher die **Transformation Provia → Simulation**; sie lässt sich auf Sony-Dateien übertragen, wenn man zuerst einen Provia-ähnlichen
   Ausgangslook für die a6000 festlegt. Das Provia-Rendering selbst lässt sich mit der Provia-LUT (18 % → 117, weicher Lichterauslauf) annähern. **[E]**
2. **Je Simulation eine Look-Parametrisierung ableiten** aus: (a) Tonkurve (Tabelle 1.2, Zwischenwerte interpolieren), (b) farbtonabhängige Chroma-/Farbton-/Helligkeits-Differenzen (Tabellen 1.3, bei Bedarf mit mehr Testfarben aus den LUTs),
   (c) bei Classic Neg. und Eterna zusätzlich die Grauachsen-/Schwarzpunktwerte. Die Original-LUTs würde ich **nicht ins Repo legen** (Lizenz nicht geprüft); eigene Fits aus den gemessenen Werten sind unkritischer **[?]**.
3. **Reihenfolge im Shader (Empfehlung [E]):** Weißabgleich/Shift → Filmsimulation (Farbe + Kurve) → Dynamic Range/Highlight/Shadow → Color (Sättigung) → Color Chrome/FX Blue → Clarity → Schärfen/NR → **Korn zuletzt auf Vollauflösung**.
4. **Korn:** Weißes, pixelbreites Rauschen mit 1–1,5 px Korrelation (Small ≈ 1 px, Large ≈ 1,5 px), Amplitude Weak ≈ ⅓ Strong, tonunabhängig im Codewert-Raum starten; bei Acros zusätzlich ISO-/helligkeitsabhängiges Eigenkorn. Beim Verkleinern nicht neu erzeugen. **[E]**
5. **Color Chrome Effect / FX Blue** als zwei einfache Operatoren (Abschnitt 2.2/2.3) einbauen: CCE = chromaabhängige Abdunklung gesättigter Nicht-Blau-Farben (Strong ≈ −2 L\*), FXB = selektive Abdunklung 200–300° (Strong ≈ −8…−12 L\*).
6. **Schwarzweiß:** Kanalmischer aus 1.5 vor der Tonkurve von Acros/Monochrome; Sepia als Tönungsrampe aus 1.5.
7. **Rezepte** (Abschnitt 4) erst nach der Kalibrierung der Regler einbauen; vorher nur als Notiz.
8. **Leica:** Core Looks aus Abschnitt 3.2 (Natural ≈ Chroma ×0,78 und flacher, Vivid ≈ ×1,16 und hellere Mitten, Mono HC = S-Kurve), Cine/Pure aus den LUTs (3.3), die restlichen Looks nur grob nach 3.2 nachbilden und als „Leica-inspiriert“ kennzeichnen.

### 5.3 Größte Lücken (nach Priorität) und wie man sie schließt

1. **Regler-Schrittgrößen (Highlight/Shadow, Color, Clarity, Sharpness, NR, WB-Shift)** – nicht dokumentiert, nicht messbar aus vorhandenen Bildern. *Lösung:* Eine Fuji-Kamera (oder X RAW Studio mit einer X-Trans-RAW) durchläuft einen **Graukeil
   plus ColorChecker** mit je einem Parameter variiert (Highlight/Shadow −2…+4, Color −4…+4, Clarity −5…+5, WB-Shift ±9) und speichert die JPEGs; Auswertung wie in 1.2/1.3 (ca. 40 Aufnahmen).
2. **Korn:** Tonabhängigkeit, genaue Größe bei 26/40 MP, alle sechs Kombinationen auf derselben Aufnahme. *Lösung:* dieselbe RAW eines **homogenen Graukeils** je Kombination in-camera konvertieren; Hochpass-Spektrum und σ je Helligkeit messen.
3. **Classic Neg.:** Quellen widersprechen sich bei der Mittenhelligkeit (X-Pro3-Paare dunkler, Peltier/LUT heller). *Lösung:* In-Kamera-Konvertierung derselben RAW (Provia/Classic Neg.) bei fester Belichtung.
4. **Nostalgic Neg. und Pro Neg. Hi:** keine LUT. *Lösung:* In-Kamera-Konvertierung der Messreihe aus 1; eventuell die HaldCLUTs aus dem pixls.us-Forum (X-Trans II, aus Fuji-Konverter-Exporten, enthalten auch Pro Neg. Hi/Std) prüfen – nicht heruntergeladen, Lizenz unbekannt.
5. **Standbild- gegenüber Videopfad:** vergleichen, ob die LUT-Differenzen (z. B. Velvia Schatten, Eterna Schwarzpunkt) auch im JPEG gelten. Bisheriger Hinweis: Die Kiechle-Standbilder bestätigen Richtung und Größenordnung (Abschnitt 1.5) **[M]**.
6. **WB-Preset-Temperaturen** der Fuji-Presets (Daylight, Fluorescent 1–3) – nicht dokumentiert; für Rezeptportierung nötig.
7. **Leica:** Kurven der übrigen Essential Looks, Schrittgrößen −2…+2 und Intensität. *Lösung:* SL3/Q3 mit Graukeil + ColorChecker; oder eine Messung der Looks in Leica FOTOS.
8. **Kodak-Originalfilme:** Es liegen **keine** heruntergeladenen Scans derselben Szene auf echten Kodak-Filmen vor (Abschnitt 6, nur Quellenhinweise).

---

## 6. Referenzbilder und weitere Quellen

Alle Bilder liegen unter `testbilder/referenz/<quelle>/` (gitignored); Herkunft, Kamera, Pixelgleichheit und Basisversion je Datei: **`testbilder/referenz/QUELLEN.md`**. Kurzüberblick:

| Look | Pixelgleiche Paare/Serien mit Provia-Basis (Anzahl Aufnahmen) | Quellen | LUT |
|---|---|---|---|
| Velvia | 3 | Kiechle (X-T30, 6240×4160), Peltier (2 Aufnahmen) | ja |
| ASTIA | 3 | Kiechle, Peltier, Keith Wee (X-H1) | ja |
| Classic Chrome | 5 | Kiechle, Peltier (2), Keith Wee, Alik Griffin | ja |
| Pro Neg. Hi | 3 | Kiechle, Peltier, Keith Wee | – |
| Pro Neg. Std | 2 | Kiechle, Peltier | ja |
| Classic Neg. | 4 sichere (+ 2 mit unsicherer Rollenzuordnung) | Peltier (2), Keith Wee X-Pro3 (2 sichere, 2 unsichere) | ja |
| Nostalgic Neg. | 2 (Peltier-Raster, Alik/Lightroom); dazu 8 Bilder mit Nostalgic-Neg.-**Rezepten** auf einer GFX-Aufnahme | Peltier, Alik, Fuji X Weekly | – |
| Reala Ace | 3 Aufnahmen (4 Paare) | Peltier, Alik Griffin (2 Szenen) | ja |
| Eterna | 3 | Kiechle, Peltier, Keith Wee | ja |
| Eterna Bleach Bypass | 1 | Peltier | ja |
| Acros (+Ye/R/G) | 1 Serie mit 4 Varianten (Zuordnung Ye/G korrigiert) | Kiechle | ja (nur Acros) |
| Monochrome (+Ye/R/G) | 1 Serie mit 4 Varianten | Kiechle | – |
| Sepia | 1 | Kiechle | – |
| Color Chrome Effect | 2 Paare (Fuji-Blume, Alik) | Fuji, Alik | – |
| Color Chrome FX Blue | 2 Paare (Fuji-Küste, Alik) | Fuji, Alik | – |
| Smooth Skin Effect | 1 Paar | Alik | – |
| **Grain Off/Weak/Strong × Small/Large** | **0 pixelgleiche Reihen**; Ausschnitte: X-T30 Off/Weak/Strong (getrennte Aufnahmen), X-T5/GFX Weak-Small/Strong-Large (Rezepte), Fuji mit/ohne, 100 %-Screenshot Acros Strong | Fuji X Weekly, Fuji, Kiechle | – |
| Rezepte (Kodachrome 64, Ektachrome, Ultramax, Gold, Portra 800 v3, Summer of '59) | 12 Bilder (2 Aufnahmen × 6), **ohne** Provia-Basis | Fuji X Weekly (GFX100S II) | – |
| **Leica Core Looks** (Standard/Natural/Vivid/Mono/Mono HC) | 1 Aufnahme, 4 Paare mit Standard-Basis, 1920×1280 | Leica | (Classic/Natural-Legacy-LUT) |
| **Leica Essential Looks** (13) | 64 Paare mit eingeblendetem Standard-Inset (662×439) | Leica | Cine, Pure |

**Nicht pixelgleich** (nur visuell nutzbar, in QUELLEN.md markiert): Shotkit (11 Simulationen), fotowissen.eu (16), Peltier Nostalgic-Neg.-Composite und Acros-Korn-Composite, X-T30-Kornausschnitte, Fuji-Korn-Beispiel (Korn verfälscht den Vergleich).

**Weitere Quellen (nicht heruntergeladen)**
- Echte Kodak-Filme: Analog.Cafe „Comparing All (8) ISO 800 Colour-Negative Films“ (Mai 2026, 58 Frames, drei Belichtungen, Farbkarte; Portra 800, CineStill 800T u. a.) <https://www.analog.cafe/r/comparing-all-8-iso-800-colour-negative-films-bgr6>;
  Analog.Cafe zu Vision3 250D <https://analog.cafe/r/kodak-vision-3-250d5207-film-review-ck26>; 35mmc „ENC-2 vs. C-41“ <https://www.35mmc.com/17/08/2023/my-first-time-using-kodak-motion-picture-film-enc-2-vs-c41/>; Emulsive „CineStill 800T vs. Portra 400“
  <https://emulsive.org/reviews/film-reviews/blind-film-review-02-cinestill-800t-vs-kodak-portra-400-in-120-format>; Shoot It With Film (Tri-X/HP5/T-Max) <https://shootitwithfilm.com/kodak-tri-x-ilford-hp5-kodak-tmax-comparisons/>.
- HaldCLUTs: RawTherapee „Film Simulation Collection“ (u. a. Kodak Portra 160/400/800, Kodachrome 25/200, Ektachrome, Tri-X; Qualität laut Forum nur „nach Geschmack“, nicht exakt) <https://rawpedia.rawtherapee.com/Film_Simulation>;
  Fuji-HaldCLUTs aus Fuji-Konverter-Exporten (X-Trans II) <https://discuss.pixls.us/t/fuji-film-simulations-for-rawtherapee/3247>.
- Kodak-Datenblätter: <https://www.kodakprofessional.com/sites/default/files/2025-07/e4046.pdf> (Ektar 100), `…/e4051.pdf` (Portra 160), `…/e4040.pdf` (Portra 800),
  <https://www.freestylephoto.com/static/pdf/product_pdf/kodak/e4050_Kodak_Portra_400.pdf> (Portra 400), <https://kodakprofessional.com/sites/default/files/wysiwyg/film/f4017_trix_320400.pdf> (Tri-X),
  <https://www.kodak.com/content/products-brochures/Film/VISION3-500T-Color-Negative-Film-7219-TECHNICAL-DATA.pdf> (Vision3 500T).
- Lightroom-/Capture-One-Nachbildungen der Leica Looks: Robin Schimko (Classic, Contemporary), Cobalt (12/2025) – laut Forum, nicht geprüft.

**Hinweis zu den Seiten, die beim Abruf auffielen:** `curl` gegen fujifilm-x.com liefert eine Cloudflare-Sperrseite; mit dem lokalen Headless-Chrome (`~/.local/bin/chrome-headless --dump-dom`) funktionieren Seiten und die REST-Schnittstelle. Kiechle hat Ye/G in den Beschriftungen laut Messung vertauscht.
