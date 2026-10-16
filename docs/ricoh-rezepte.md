# Ricoh-GR-Rezepte (Ritchie’s Ricoh Recipes)

Stand **16.10.2026**. Recherche für Film Lab: Was bietet <https://ricohrecipes.com/> und was davon lässt sich für Film Lab nutzen?
Kennzeichnung wie in `kamera-looks-referenz.md`: **[B]** belegt durch die genannte Quelle, **[E]** Einschätzung, **[?]** offen.
Noch nichts davon ist in Film Lab eingebaut.

---

## 0. Kurzfassung

1. **77 Rezepte, davon 65 mit Werten öffentlich** auf der Website, 12 Bonus-Rezepte nur für zahlende Nutzer der App („Patron“,
   11,99 $/Jahr). Das deckt sich genau mit den Zahlen auf der App-Seite (65 + 12) **[B]**.
2. **Drei Kameragenerationen mit unverträglichen Einstellungen:** GR/GR II (20 öffentlich), GR III/IIIx (38 öffentlich + 7 Bonus), GR IV
   (7 öffentlich + 1 Bonus). Rezepte für GR/GR II passen nicht auf die GR III und umgekehrt **[B]**.
   GR-III-Rezepte laufen auf der GR IV, sehen dort aber anders aus (wärmer, etwas heller) **[B]**.
3. **Autor ist Ritchie Roesch**, derselbe wie bei Fuji X Weekly **[B]**. Aufbau und Stil der Rezepte entsprechen den Fuji-Rezepten, die
   Film Lab schon einliest.
4. **Basis jedes Rezepts ist ein Ricoh-„Effekt“** (Positive Film, Negative Film, Retro, Cross Process, Bleach Bypass, Cinema Y/G,
   SW-Varianten). Dafür gibt es **keine offiziellen LUTs und keine Messdaten**; anders als bei Fujifilm fehlt also die Grundlage für den
   Farbcharakter **[E]**.
5. **Viele Rezepte nennen echte Filme** (Ektachrome, Elite Chrome, Kodak Gold, UltraMax, ColorPlus, Royal Supra, Agfa Vista,
   Fujicolor C200, Ferrania Solaris, Tri-X, Agfa Scala) – nützlich als zweite Meinung zu den Kodak-Looks in Film Lab (Abschnitt 4).

## 1. Quelle und Umfang

- Website ist ein WordPress.com-Blog. Alle Seiten und Beiträge lassen sich ohne Anmeldung über die REST-Schnittstelle als JSON laden:
  `https://public-api.wordpress.com/wp/v2/sites/ricohrecipes.com/pages?per_page=100` (20 Seiten) und `…/posts?per_page=100`
  (25 Beiträge, 2021–2026). Die Werte in diesem Dokument stammen von dort (abgerufen 16.10.2026) **[B]**.
- Gliederung in „Collections“ zu je 5 Rezepten plus 1 Bonus (Starter: 7 + 1, Adventure: 3 ohne Bonus) **[B]**:
  - GR/GR II: Color City, Color Landscape, Lomo, Monochrome.
  - GR III/IIIx: Nature, Road Trip, Street, California Negative, Film, Analog, Adventure, B&W.
  - GR IV: Starter. Nicht für die GR IV Monochrome **[B]**.
- Die Sammlungen sind nach Motiv sortiert, nicht nach Filmtyp; der Autor betont, dass jedes Rezept überall einsetzbar ist **[B]**.
- **Rechte:** Die App-Nutzungsbedingungen verbieten Kopieren und Weiterverbreiten der App-Inhalte für kommerzielle Zwecke; für die
  Website gibt es keine Lizenz. Rezepte sind Einstellungslisten (Fakten) und stehen hier wie die Fuji-X-Weekly-Rezepte in
  `kamera-looks-referenz.md` mit Quelle; Beschreibungen in eigenen Worten. Rezeptnamen in der App nur mit Quellenangabe verwenden **[E]**.
  Patron-Rezepte sind nicht öffentlich und fehlen hier.

## 2. Ricoh-Bildeinstellungen

### 2.1 GR III / GR IIIx / GR IV

Alle Werte stehen in den Rezepten; Wertebereiche hier sind die in den 45 öffentlichen Rezepten beobachteten, nicht aus dem Handbuch **[B für die
Werte, ? für die Grenzen]**.

| Ricoh-Einstellung | Beobachtet | Wirkung (Einschätzung) | Nächste Film-Lab-Einstellung **[E]** |
|---|---|---|---|
| Image Control / Effekt | Standard, Vivid, Positive Film, Negative Film (GR III ab Firmware-Update Jan. 2023), Retro, Cross Process, Bleach Bypass, Hard Monotone, Hi-Contrast B&W, BW Monotone; GR IV zusätzlich Cinema (Yellow), Cinema (Green) | Grundlook (Farbe + Kurve) | Look (LUT) – fehlt für Ricoh |
| Saturation | −4 … +4 | Sättigung | `color` (−4 … +4) |
| Hue | −4 … +4 | Farbton global drehen | keine; bräuchte globalen Hue-Shift |
| High/Low Key | −4 … +4 | Helligkeit der Mitteltöne | `exposure` oder Kurve |
| Contrast | −4 … +4 | Gesamtkontrast | keine eigene; über Lichter/Schatten-Ton annähern |
| Contrast (Highlight) | −4 … +4 | Kontrast der Lichter (+ = härter) | `highlightTone` (−2 … +4) – Vorzeichen gleich, Skala anders |
| Contrast (Shadow) | −4 … +4 | Kontrast der Schatten (+ = härter/dunkler) | `shadowTone` (−2 … +4) – Skala anders |
| Sharpness | −4 … +2 | Schärfe | `sharpness` |
| Shading | −1 … +2 | Randabdunklung (−) bzw. -aufhellung (+) | `vignette` (nur abdunkeln) |
| Clarity | −4 … +4 | lokaler Kontrast | `clarity` (−5 … +5) |
| Toning | bei Retro, Cinema, SW: Off, +1 … +4 | Tönung | `monoWarmCool`/`monoMagentaGreen` (nur SW) |
| Filter Effect | Off, 2, 3 (SW) | Farbfilter, Zuordnung der Nummern unklar **[?]** | SW-Look mit Filter |
| Color (Cross Process) | Y, Blue | Grundfarbe der Crossentwicklung | – |
| Grain Effect (GR III, nur SW) | 1 … 3 | Korn | `grainEffect` |
| Grain Size/Intensity (GR IV) | je 1 … 3; auch für Positive/Negative Film und Cinema | Korn | `grainEffect` + `grainSize` |
| Highlight Correction | immer On (2× Auto) | Lichterschutz | grob `dynamicRange` 200 |
| Shadow Correction | Off, Low, Medium, High, Auto | hebt Schatten an | keine; `shadowTone` negativ |
| WB | Auto, Daylight, Cloudy, Shade, Fluor. D/N/W, Incandescent, CT 2500 … 10000 K | Weißabgleich | `wbKelvin` |
| WB Compensation | A/B 0 … 14, G/M 0 … 14 | Feinabstimmung: A = Amber, B = Blau, G = Grün, M = Magenta | `wbShiftB` (−9 … +9) für A/B; **G/M fehlt in Film Lab** |

Immer gleich in allen Rezepten: Peripheral Illumination Correction On, High-ISO-NR Off, ISO Auto bis 6400 **[B]**.

### 2.2 GR / GR II

Andere Skala: Effekt plus **Vividness, Contrast, Sharpness 1 … 9** (5 = neutral **[E]**), Vignetting (Off/Weak/Medium),
Dynamic Range Compensation (Off/Weak/Medium/Strong), Noise Reduction Off, ISO bis 3200 (SW bis 6400). Effekte: Positive Film, Retro,
Cross Process (Farbe Yellow), Bleach Bypass (Hue Warm/Cool), High Key, Black & White, Hi-Contrast B&W, B&W (TE) mit Toning Sepia/Blue,
oder Effekt Off mit Image Settings Standard **[B]**. Monochrome Slide hat „Contrast −2“ – bei Hi-Contrast B&W gilt wohl eine andere
Skala **[?]**.

## 3. Rezepte

Spalten wörtlich aus der Website, nur gekürzt: **Key** = High/Low Key, **Lichter/Schatten** = Contrast (Highlight/Shadow),
**Schatten-Korr.** = Shadow Correction, **WB, Komp.** = Weißabgleich (Fluor. D/N/W = Leuchtstoff Daylight Color/Daylight White/Cool White,
Zahl = Kelvin) und WB Compensation, **Belichtung** = „typische“ Belichtungskorrektur in EV. *Kursiv* = Bonus-Rezept, Werte nur in der App.

### 3.1 GR III / GR IIIx

| Rezept | Sammlung | Effekt | Sät. | Farbton | Key | Kontr. | Lichter | Schatten | Schärfe | Shading | Klarheit | Toning / Filter / Farbe | Korn | Schatten-Korr. | WB, Komp. | Belichtung | Charakter (laut Autor) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|
| **Kodak Slide** | Nature | Vivid | +4 | −2 | +1 | +4 | −4 | −4 | +1 | 0 | +2 | – | – | Low | Shade, B:7 G:2 | 0 … +2/3 | Nach Ektachrome 100SW und 100GX |
| **Analog Film** | Nature | Positive Film | +4 | −4 | +2 | +4 | −4 | +4 | 0 | 0 | −2 | – | – | Off | 6300K, A:1 G:6 | −1/3 … +1/3 | Allgemeiner Farbfilm |
| **Retro Print** | Nature | Retro | +4 | +1 | +1 | +4 | −3 | +4 | 0 | 0 | +2 | Toning +3 | – | Medium | Fluor. W, A:12 G:10 | −1/3 … +1/3 | Negativ auf Kodak-Papier vergrößert |
| **Summer Green** | Nature | Cross Process | −1 | +4 | −1 | −4 | −4 | +4 | −1 | 0 | −1 | Farbe Y | – | Low | Fluor. N, B:6 G:5 | +1/3 … +1 | Warmer Stich, kühle Grüntöne |
| **Elite Chrome** | Nature | Standard | +4 | −1 | +1 | +2 | −4 | −4 | +1 | 0 | +2 | – | – | Low | Auto, A:12 G:3 | 0 … +2/3 | Günstiger Kodak-Diafilm (Elite Chrome) |
| *Pro Print* | Nature | nur App (Patron) | | | | | | | | | | | | | | | Abzüge von Fujicolor Pro 160S u. ä. niedrigempfindlichen Negativfilmen |
| **Americana Color** | Road Trip | Positive Film | +2 | +2 | +1 | +4 | −3 | +4 | +1 | +1 | +2 | – | – | Low | 5250K, A:10 G:5 | −1/3 … +1/3 | Kodak-Look der amerikanischen New Color Photography |
| **Vibrant Negative** | Road Trip | Positive Film | +4 | +4 | +2 | −2 | +3 | −4 | 0 | 0 | +2 | – | – | Medium | Fluor. N, A:11 G:9 | 0 … +2/3 | Bunt, nach Saul Leiter |
| **Aged Print** | Road Trip | Retro | +2 | 0 | −2 | +2 | +2 | +4 | −1 | −1 | −2 | Toning +1 | – | High | Cloudy, A:4 M:6 | +1/3 … +2/3 | Gealterter Farbabzug |
| **Warm Negative** | Road Trip | Positive Film | +1 | +4 | +1 | −1 | −4 | −3 | +1 | 0 | −1 | – | – | High | Daylight, A:14 M:5 | 0 … +2/3 | Crossentwickelter Diafilm |
| **KodaKolor** | Road Trip | Standard | −4 | +4 | +1 | +4 | −4 | +3 | +1 | +2 | +2 | – | – | Medium | Shade, B:6 G:2 | 0 … +2/3 | Nostalgisches Kodak-Negativ |
| *Teal Fade* | Road Trip | nur App (Patron) | | | | | | | | | | | | | | | Verblasst mit Petrolstich |
| **Kodak Chrome** | Street | Positive Film | +3 | −1 | −2 | −2 | +2 | −4 | +1 | 0 | +2 | – | – | Low | Daylight, A:10 G:4 | +1/3 … +1 | Klassischer Kodak-Diafilm |
| **Color Film** | Street | Standard | +1 | +1 | +1 | +1 | +2 | −4 | +1 | 0 | −1 | – | – | Medium | Auto, A:9 G:2 | 0 … +2/3 | Allgemeiner Farbfilm |
| **Royal Supra** | Street | Positive Film | +2 | −4 | +1 | +4 | −4 | −3 | +1 | 0 | +4 | – | – | High | Shade, B:6 G:4 | 0 … +2/3 | Wie Kodak Royal Supra / Royal Gold |
| **Natural Negative** | Street | Positive Film | −2 | +2 | −1 | −2 | +3 | −4 | +1 | −1 | +2 | – | – | Low | Daylight, A:8 G:2 | +1/3 … +1 | Zurückhaltend, natürliche Negativfarben |
| **Xpro Teal** | Street | Cross Process | +2 | −2 | −2 | −4 | −4 | −4 | −1 | 0 | −2 | Farbe Blue | – | Medium | 5500K, A:5 G:1 | 0 … +2/3 | Crossentwicklung, Blau kippt nach Petrol |
| *Color Slide* | Street | nur App (Patron) | | | | | | | | | | | | | | | Farbdia |
| **Vibrant Analog** | California Negative | Positive Film | +4 | +3 | +1 | +2 | −3 | +4 | −1 | 0 | +3 | – | – | High | Daylight, A:14 G:5 | −1/3 … +1/3 | Anklänge an Ektar, Ektachrome E100VS und E100SW |
| **Vibrant Teal** | California Negative | Vivid | +3 | −4 | +2 | +2 | −3 | +4 | 0 | 0 | +2 | – | – | High | 5200K, A:0 G:4 | 0 … +1/3 | Hell und bunt, Blau Richtung Petrol |
| **Vintage Print** | California Negative | Retro | +4 | 0 | +4 | 0 | −4 | +4 | −4 | 0 | −4 | Toning +4 | – | Low | Fluor. D, B:2 G:10 | −2/3 … 0 | Falsch gelagerter, verfärbter Farbabzug |
| **Chrome Slide** | California Negative | Positive Film | +3 | +3 | +1 | +1 | −2 | +4 | 0 | 0 | +1 | – | – | Auto | Cloudy, B:8 G:8 | 0 … +1/3 | Wie Kodak Elite Chrome und Ektachrome |
| **Aged & Faded** | California Negative | Bleach Bypass | +4 | −2 | −4 | −2 | +3 | +2 | −2 | −1 | −4 | – | – | Medium | Shade, B:10 G:12 | +1/3 … +1 | Düsterer Vintage-/Lomo-Look |
| *Cross Process* | California Negative | nur App (Patron) | | | | | | | | | | | | | | | Diafilm (Velvia 50, E100VS) in C-41 entwickelt |
| **Classic Emulsion** | Film | Negative Film | +1 | −3 | +1 | +2 | −3 | +1 | −1 | 0 | −2 | – | – | High | Daylight, B:5 G:12 | −1/3 … +1/3 | Farbnegativ wie Agfa Vista oder Fujicolor C200 |
| **Positive Emulsion** | Film | Positive Film | +2 | −3 | +3 | −1 | −4 | +4 | −1 | 0 | −2 | – | – | Low | Auto, A:9 G:1 | −2/3 … 0 | Dia, Anklänge an Kodak Elite Chrome |
| **Kodak Print** | Film | Negative Film | +2 | −1 | +2 | +3 | −4 | +4 | −2 | 0 | −3 | – | – | Medium | Fluor. D, B:4 G:1 | −2/3 … 0 | Kodak-Film auf Kodak-Papier, retro |
| **Film Look** | Film | Negative Film | +2 | −1 | +1 | +1 | −4 | +4 | 0 | 0 | −2 | – | – | Medium | Daylight, A:8 G:2 | −1/3 … +1/3 | Farbnegativ, vor allem Kodak |
| **Vintage Film** | Film | Negative Film | −1 | −4 | +4 | −3 | −4 | −4 | −2 | 0 | −1 | – | – | Auto | Shade, A:6 G:2 | +2/3 … 0 | Retro, warmer Stich |
| *Nostalgic Print* | Film | nur App (Patron) | | | | | | | | | | | | | | | Abzug von einfachem Farbnegativfilm |
| **Positive Film** | Analog | Positive Film | +3 | +3 | +2 | +4 | −2 | +4 | 0 | 0 | 0 | – | – | Medium | Auto, A:7 G:3 | −2/3 … 0 | Ektachrome E100GX, E100VS, E100SW |
| **Reggie’s Color Negative** | Analog | Negative Film | +2 | 0 | 0 | +3 | −4 | −1 | +1 | 0 | 0 | – | – | Medium | Auto, A:6 G:0 | −1/3 … +1/3 | Farbnegativ-Look von Reggie Ballesteros |
| **EktaColor** | Analog | Negative Film | +4 | +1 | +2 | +3 | −4 | −3 | −1 | 0 | −1 | – | – | Medium | Fluor. N, A:14 G:8 | −1/3 … +1/3 | Nach Kodak Ektachrome E100 |
| **Vibrant Nostalgia** | Analog | Positive Film | +3 | −3 | +3 | −2 | −4 | +4 | −1 | 0 | −1 | – | – | Low | 6900K, B:6 G:6 | −2/3 … 0 | Kräftiger Kodak-Film der 70er/80er |
| **B&W Film** | Analog | Hard Monotone | – | – | +1 | +4 | +2 | +3 | 0 | 0 | −2 | – | Stufe 2 | Low | Cloudy, A:10 G:10 | −1/3 … +1/3 | Harter, körniger SW-Film mit Rotfilter |
| *Kodak Summer* | Analog | nur App (Patron) | | | | | | | | | | | | | | | ColorPlus 200 / Gold 200, etwa eine Blende überbelichtet |
| **Kodamax** | Adventure | Positive Film | +4 | −2 | 0 | +3 | 0 | −2 | 0 | 0 | +1 | – | – | Medium | Auto, A:1 G:10 | +1/3 … +2/3 | Vor allem UltraMax 400, leicht unterbelichtet und im Scan aufgehellt |
| **1986 Negative** | Adventure | Negative Film | +4 | −2 | −1 | +2 | +2 | −3 | −1 | 0 | −2 | – | – | Auto | 6700K, B:10 G:8 | 0 … +1/3 | Vintage, aber kräftig; vor allem Kodak Gold 200 (seit 1986) |
| **Ferrania Solaris** | Adventure | Standard | +2 | +2 | +2 | +3 | −3 | 0 | −2 | 0 | +1 | – | – | Low | Daylight, A:5 M:1 | 0 … +1/3 | Ferrania Solaris der 80er/90er (auch als 3M, Scotch, Imation verkauft) |
| **B&W Negative +Red Filter** | B&W | Hard Monotone | – | – | +1 | +2 | +4 | −4 | +2 | −1 | −2 | – | Stufe 2 | Medium | Fluor. D, B:2 M:14 | −2/3 … +1/3 | SW-Negativ mit Rotfilter |
| **Dramatic Monochrome** | B&W | Hi-Contrast B&W | – | – | −1 | +3 | −3 | −3 | 0 | 0 | +1 | Filter 2 | Stufe 3 | Low | 10000K, A:0 M:14 | −1/3 … +1/3 | Hartes SW, helle Lichter, tiefe Schatten |
| **Monochrome Film** | B&W | BW Monotone | – | – | +3 | +4 | −4 | −4 | +1 | −1 | +2 | Filter 2 | Stufe 1 | Low | Auto, A:0 M:0 | +1/3 … +2/3 | Klassischer SW-Abzug, guter Kontrast |
| **Moody Monochrome** | B&W | BW Monotone | – | – | +2 | +4 | −2 | +2 | −1 | 0 | +4 | Filter 3 | Stufe 3 | High | 2500K, B:14 M:0 | +1/3 … +1 | Dramatisches SW, starker Kontrast |
| **Black & White Negative** | B&W | Hi-Contrast B&W | – | – | +1 | −2 | −4 | 0 | −1 | −1 | +2 | – | Stufe 2 | Low | Fluor. N, A:14 G:14 | 0 … +2/3 | Hartes SW wie ein ISO-400-Film |
| *Sepia Print* | B&W | nur App (Patron) | | | | | | | | | | | | | | | SW-Abzug im Sepia-Bad |

### 3.2 GR IV (Starter Collection, 10.06.2026)

| Rezept | Sammlung | Effekt | Sät. | Farbton | Key | Kontr. | Lichter | Schatten | Schärfe | Shading | Klarheit | Toning / Filter / Farbe | Korn | Schatten-Korr. | WB, Komp. | Belichtung | Charakter (laut Autor) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|
| **Travelog** | Starter | Positive Film | +4 | −1 | +3 | 0 | −3 | +1 | −1 | 0 | −2 | – | Größe/Stärke 2/2 | Medium | Cloudy, G:8 B:9 | −1/3 … +1/3 | Kräftig und warm, Kodak-artig; Reise/Straße bei Sonne |
| **EktaSlide** | Starter | Positive Film | +2 | +2 | +2 | +4 | −4 | 0 | +1 | 0 | +1 | – | Größe/Stärke 1/1 | High | Auto (Weiß-Prio.), G:6 A:8 | 0 … +2/3 | Klassischer Ektachrome-Dia, vielseitig |
| **Pro Color** | Starter | Negative Film | +4 | −2 | +3 | +3 | −2 | +4 | −1 | 0 | −1 | – | Größe/Stärke 2/1 | High | Daylight, G:5 A:10 | −1/3 … +1/3 | Kodak Pro Image 100, neues Kodacolor 100/200 |
| **Lomo Color** | Starter | Cinema (Yellow) | +4 | +3 | +4 | +3 | −4 | +4 | −2 | −1 | −2 | Toning 3 | Größe/Stärke 1/3 | Medium | Shade, M:4 B:10 | −2/3 … −1/3 | Lomografie, nach Holga- und Diana-Bildern |
| **Expired Negative** | Starter | Cinema (Green) | −1 | −1 | −3 | −3 | +4 | +4 | −2 | −1 | −3 | Toning 3 | Größe/Stärke 3/3 | Medium | 9700K, G:4 B:14 | +2/3 … +1 | Abgelaufener oder falsch behandelter Film |
| **Panchromatic 400 +Red** | Starter | Hard Monotone | – | – | +1 | +1 | −2 | +4 | +1 | 0 | 0 | – | Größe/Stärke 2/2 | Auto | 7000K, M:2 B:10 | 0 … +2/3 | Allgemeiner ISO-400-SW-Film mit Rotfilter |
| **Pushed B&W** | Starter | Hi-Contrast B&W | – | – | 0 | −2 | −2 | +2 | +1 | 0 | +1 | Filter 2 | Größe/Stärke 2/3 | Medium | Cloudy, G:14 B:5 | 0 … +1/3 | Tri-X 400 mit Rotfilter, zwei Blenden gepusht |
| *Classic Color* | Starter | nur App (Patron) | | | | | | | | | | | | | | | Familienabzüge der 80er/90er |

### 3.3 GR / GR II

| Rezept | Sammlung | Effekt | Farbton / Tönung | Vividness | Kontr. | Schärfe | Vignette | DR-Komp. | WB, Komp. | ISO bis | Belichtung | Charakter (laut Autor) |
|---|---|---|---|---:|---:|---:|---|---|---|---|---|---|
| **Color Chrome** | Color City | Positive Film | – | 1 | 9 | 3 | Off | Strong | Outdoors, A:3 G:5 | 3200 | 0 … +1/3 | Diafilm-Look, nahe Kodak Elite Chrome / Ektachrome 100G; für Sonne |
| **XPRO Gold** | Color City | Cross Process | Yellow | 3 | 7 | 2 | Off | Strong | Cloudy, B:4 G:2 | 3200 | 0 … +1/3 | Crossentwicklung, warmer Stich |
| **Vintage Warm** | Color City | Bleach Bypass | Warm | 9 | 2 | 1 | Off | Medium | 4700K, A:3 M:2 | 3200 | −1/3 … +1/3 | Vintage-Negativ, viel Kontrast, weiche warme Farben |
| **Retro Blue** | Color City | Retro | – | 3 | 8 | 1 | Weak | Strong | Outdoors, B:2 G:8 | 3200 | 0 … +2/3 | Vintage, weiche kühle Farben, leicht verblasst |
| **Vivid Slide** | Color City | Positive Film | – | 9 | 3 | 2 | Off | Weak | Auto, B:1 G:3 | 3200 | 0 … +2/3 | Kräftiger Dia, Anklänge an Provia 100F, Velvia 100, Ektachrome 100GX/100VS |
| *Color Negative* | Color City | nur App (Patron) | | | | | | | | | | Farbnegativ, weicher Kontrast, natürliche Farben, leicht warm |
| **Vibrant Transparency** | Color Landscape | Positive Film | – | 9 | 7 | 6 | Off | Strong | Outdoors, A:2 G:3 | 3200 | 0 … +1/3 | Wie Velvia oder Ektachrome 100VS |
| **Vintage Fade** | Color Landscape | Cross Process | Yellow | 3 | 7 | 2 | Off | Strong | Cloudy, B:4 G:2 | 3200 | 0 … +1/3 | Crossentwicklung, warmer Stich (Werte identisch mit XPRO Gold) |
| **Classic Analog** | Color Landscape | Aus (Image Settings: Standard) | – | 9 | 3 | 5 | Weak | Weak | Cloudy, B:2 G:5 | 3200 | 0 … +2/3 | Vintage, helle Farben, leicht kühl/grün; Fuji- und Agfa-Anklänge |
| **Negative Film** | Color Landscape | Positive Film | – | 5 | 6 | 3 | Off | Medium | Daylight Fluorescent, B:4 G:2 | 3200 | 0 … +2/3 | Warmes Negativ, ähnlich Kodak Gold |
| **Color Reversal** | Color Landscape | Positive Film | – | 7 | 6 | 4 | Off | Strong | Outdoors, A:6 G:2 | 3200 | 0 … +2/3 | Dia, ähnlich Ektachrome |
| *Nostalgic Film* | Color Landscape | nur App (Patron) | | | | | | | | | | Nostalgisch mit Split-Toning |
| **Vintage Teal** | Lomo | Bleach Bypass | Cool | 9 | 9 | 2 | Medium | Medium | Shade, A:7 G:6 | 3200 | −1/3 … +1/3 | Lomo-Look, kräftiges Petrol |
| **Retro Nostalgia** | Lomo | Retro | – | 8 | 2 | 2 | Weak | Medium | 6600K, A:3 G:4 | 3200 | 0 … +2/3 | Crossentwicklung, warmer Stich |
| **Moonlit Day** | Lomo | Positive Film | – | 6 | 4 | 4 | Weak | Medium | Incandescent 2, B:1 M:7 | 3200 | +1/3 … +2/3 | Lo-Fi, tiefe Blautöne, macht Tag zur blauen Stunde |
| **Vintage Xpro** | Lomo | Cross Process | Yellow | 7 | 7 | 2 | Weak | Weak | Outdoors, B:2 G:5 | 3200 | 0 … +2/3 | Crossentwickelter Diafilm |
| **Bright Summer** | Lomo | High Key | – | 9 | – | – | – | Off | 7800K, A:6 G:3 | 3200 | −2/3 … +2/3 | Hell und warm |
| *Expired Film* | Lomo | nur App (Patron) | | | | | | | | | | Abgelaufener oder falsch gelagerter Film |
| **Monochrome Slide** | Monochrome | Hi-Contrast B&W | – | – | −2 | 6 | Off | Weak | 10000K, A:8 G:0 | 6400 | −1/3 … +2/3 | SW-Dia mit viel Kontrast, wie Agfa Scala |
| **Pulled Monochrome Red** | Monochrome | Black & White | – | – | 4 | 7 | Off | Medium | 2500K, B:8 G:0 | 6400 | +1/3 … +1 | Weich, wie unterentwickelter SW-Negativfilm mit Rotfilter |
| **B&W Print** | Monochrome | B&W (TE) | Sepia | 1 | 9 | 4 | Off | Weak | Incandescent 2, B:8 M:8 | 6400 | +1/3 … +1 | SW-Abzug mit Split-Filter und kurzem Sepia-Bad |
| **Monochrome Negative** | Monochrome | Black & White | – | – | 9 | 4 | Off | Off | Cloudy, A:0 M:8 | 6400 | −1/3 … +1/3 | Klassischer kontrastreicher SW-Negativfilm |
| **Cyanotype** | Monochrome | B&W (TE) | Blue | 9 | 9 | 2 | Off | Off | Incandescent 2, B:8 M:8 | 6400 | +1/3 … +2/3 | Wie Cyanotypie |
| *Dramatic B&W* | Monochrome | nur App (Patron) | | | | | | | | | | Dramatisches, hartes SW |

Auffällig: **XPRO Gold** (Color City) und **Vintage Fade** (Color Landscape) haben auf der Website exakt dieselben Werte –
Absicht oder Kopierfehler **[?]**.

## 4. Filmbezüge (laut Autor)

Für den Abgleich mit Film-Lab-Looks, die denselben Film nachbilden. Nur Rezepte mit ausdrücklich genanntem Film.

| Film | Ricoh-Rezepte | In Film Lab als Fuji-Rezept |
|---|---|---|
| Kodak Ektachrome (E100, 100G/GX/VS/SW) | EktaColor, Positive Film, Kodak Slide, Vibrant Analog, Color Reversal, Chrome Slide, EktaSlide (GR IV), Color Chrome, Vivid Slide, Vibrant Transparency | Ektachrome E100 |
| Kodak Elite Chrome | Elite Chrome, Positive Emulsion, Chrome Slide, Color Chrome | – |
| Kodak Gold 200 | 1986 Negative, Negative Film, Kodak Summer (+1 EV) | Gold 200 |
| Kodak ColorPlus 200 | Kodak Summer (+1 EV) | ColorPlus 200 |
| Kodak UltraMax 400 | Kodamax (leicht unterbelichtet) | UltraMax 400 |
| Kodak Ektar 100 | Vibrant Analog | Ektar 100 |
| Kodak Royal Supra / Royal Gold | Royal Supra | – |
| Kodak Pro Image 100, Kodacolor 100/200 | Pro Color (GR IV) | – |
| Fujicolor Pro 160S | Pro Print (nur App) | – |
| Agfa Vista, Fujicolor C200 | Classic Emulsion | – |
| Velvia 50/100, Provia 100F | Vibrant Transparency, Vivid Slide, Cross Process (nur App, in C-41 entwickelt) | als Fuji-Simulation |
| Ferrania Solaris (80er/90er) | Ferrania Solaris | – |
| Kodak Tri-X 400 | Pushed B&W (GR IV, 2 Blenden gepusht, Rotfilter) | Tri-X 400 |
| Agfa Scala (SW-Dia) | Monochrome Slide (GR/GR II) | – |

## 5. Einschätzung für Film Lab [E]

- **Als Rezept-Import nur halb brauchbar.** Die Einstellungen (Sättigung, Lichter/Schatten, Klarheit, Korn, WB) lassen sich grob
  übertragen, aber der Kern – der Ricoh-Effekt – hat kein Gegenstück. Ein Rezept wie „Positive Film + Sättigung +4“ setzt den Charakter
  von Positive Film voraus, den Film Lab nicht kennt.
- **Ricoh-Effekte selbst nachbauen** wäre der eigentliche Schritt: zuerst Positive Film und Negative Film (zusammen 23 der 45
  öffentlichen GR-III/IV-Rezepte). Dafür bräuchte es pixelgleiche Bildpaare Standard ↔ Effekt aus einer GR III oder GR IV (eigene Kamera,
  RAW in der Kamera mehrfach entwickeln) – dieselbe Methode wie bei den Fuji-LUTs. Ohne solche Paare bliebe nur Nachbau nach Augenmaß.
- **Fehlende Stellgrößen in Film Lab** für Ricoh-Rezepte: globaler Farbton (Hue), Grün/Magenta-Weißabgleich (WB Compensation G/M bis 14),
  getrennter Gesamtkontrast, Schattenaufhellung (Shadow Correction) und Randaufhellung (Shading +).
- **Skalen sind nicht gleich**: Ricoh WB Compensation reicht bis 14 Stufen, Fuji WB-Shift bis 9; Ricoh-Kontrast ±4 je Bereich,
  Fuji-Lichter/Schatten −2 … +4. Ohne Messung ist jede Umrechnung geraten.
- **Sinnvoll ohne Messung**: die Filmbezüge (Abschnitt 4) als Plausibilitätsprüfung der Kodak-Looks – etwa „Kodak Summer“ (+1 EV,
  ColorPlus/Gold) oder „Kodamax“ (UltraMax, unterbelichtet und aufgehellt) als Hinweise, wie der Autor die Filme sieht.

## 6. Offene Punkte

- Offizielle Wertebereiche und Bedeutung von Filter Effect 1 … 3 aus dem Ricoh-Handbuch (GR III, GR IV) bestätigen.
- Ricoh-Beschreibung der Effekte (Positive Film, Negative Film, Cinema Y/G) auf ricoh-imaging.com suchen.
- Gibt es unabhängige Nachbauten der Ricoh-Effekte als LUT (z. B. für Lightroom) mit klarer Lizenz? Nicht gesucht.

## 7. Quellen

- Ritchie’s Ricoh Recipes, Startseite und Rezeptseiten: <https://ricohrecipes.com/>, <https://ricohrecipes.com/ricoh-gr-iii-recipes/>,
  <https://ricohrecipes.com/ricoh-gr-iv-recipes/>, <https://ricohrecipes.com/ricoh-gr-gr-ii-recipes/>
- App und Nutzungsbedingungen: <https://ricohrecipes.com/ricoh-recipes-app/>
- Was sind Rezepte, RAW und Kompatibilität: <https://ricohrecipes.com/2021/08/29/what-are-jpeg-recipes-why-should-i-use-them/>
- Negative Film per Firmware für GR III/IIIx: <https://ricohrecipes.com/2023/01/28/update-your-ricoh-gr-iii-and-gr-iiix-to-get-negative-film/>
- GR III vs. GR IV mit gleichem Rezept: <https://ricohrecipes.com/2025/10/24/my-ricoh-gr-iv-arrived-first-recipe-test/>
- GR-IV-Rezepte: <https://ricohrecipes.com/2026/06/10/introducing-recipes-for-the-ricoh-gr-iv/>
- Pentax-Kompatibilität (Leserbericht, WB-Kompensation dort nur ±7): <https://ricohrecipes.com/2021/09/05/are-ricoh-recipes-compatible-with-pentax-dslrs/>
