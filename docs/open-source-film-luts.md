# Bestehende Nachbauten und Datenquellen für Fuji- und Leica-Looks

Stand 16.10.2026. Recherche und Messungen zu: Was gibt es schon, unter welchen Bedingungen, und was taugt es als
Messlatte für die eigenen Looks von Film Lab. Die Charakteristik der Looks und die Vergleichsbilder stehen in
`docs/kamera-looks-referenz.md` (parallele Arbeit, hier nicht wiederholt).

Kennzeichnung: **belegt** = in einer Primärquelle gelesen (URL genannt) oder selbst gemessen,
**vermutet** = Schlussfolgerung ohne Beleg. Das ist keine Rechtsberatung; bei Lizenzfragen gilt der Wortlaut der Quelle.

## 1. Ergebnis in Kürze

| Frage | Antwort |
|---|---|
| a) Was darf in die öffentliche App? | Nur Eigenes, plus **CC BY-SA 4.0**-Material mit Namensnennung (RawTherapee-HaldCLUTs; das sind aber analoge Filmstocks, keine Kamera-Simulationen). **Nicht:** Fujifilm-, Leica-, Sowerby-, bastibe-, abpy-LUTs und alles, was daraus abgeleitet ist. Formeln und Primärvalenzen der Log-Kurven (F-Log2, L-Log) dürfen als eigener Code hinein. |
| b) Was nur als Messreferenz? | Offizielle Fujifilm-LUTs (lokal, persönlicher Gebrauch), offizielle Leica-Video-LUTs, abpys LUTs (CC BY-NC-SA, nur lesen). Gemessen wird in der JPEG-Domäne gegen die aus den offiziellen LUTs abgeleiteten „Provia → X“-Würfel (Abschnitt 6). Messzahlen dürfen veröffentlicht werden, die Würfel und die Fremdbilder nicht (**vermutet**). |
| c) Modus „offizielle Fujifilm-LUT selbst laden“? | **Ja, als optionaler Expertenmodus**, aber nicht als „JPEG → F-Log2 → LUT“. Gemessen: die naive Kette macht Bilder dunkler, mit abgesoffenen Schatten, und liegt in 5 von 6 Paaren **weiter** vom Zielbild entfernt als gar nichts zu tun. Mit „Provia-relativer“ Kette (JPEG als Provia-Ausgang behandeln, numerisch zurück nach F-Log2, Ziel-LUT) sinkt ΔE2000 auf 0,4 bis 2,0 (Mittel der 6 Paare 1,5). Belegt nur für Fuji-JPEGs als Eingang. |

**Top 3**

1. **Offizielle Fujifilm-F-Log2-LUTs** (GFX ETERNA 55, Version 1.10, 10 Simulationen, 33er- und 65er-Würfel). Lizenz: keine eigene, allgemeine Fujifilm-Bedingung (nur „personal, noncommercial“, Abwandlung verboten). Empfehlung: lokale Messreferenz und Nutzer-Ladeweg, **nicht mitliefern**.
2. **abpy/FujifilmCameraProfiles** (584 Sterne, aktiv bis 04/2026). **CC BY-NC-SA 4.0**, enthält zusätzlich Pro Neg. Hi und Nostalgic Neg. sowie „Provia → Classic Neg/Nostalgic Neg/Bleach Bypass“ für fertige JPEGs. Empfehlung: Messreferenz, nicht mitliefern (NC, SA, Herkunftskette über Adobe unklar). Rückfrage beim Autor wäre der einzige Weg zu einer Mitliefer-Erlaubnis.
3. **RawTherapee Film Simulation Collection** (HaldCLUT, sRGB, **CC BY-SA 4.0**). Einzige klar erlaubende Lizenz, enthält aber nur analoge Fuji-Stocks (Provia 100F, Velvia 50, Astia 100F, Reala 100, 400H, Neopan Acros 100 …). Empfehlung: darf mit Namensnennung und Share-Alike für die konvertierten Würfel mitgeliefert werden, ersetzt aber keine Kamera-Simulation.

## 2. Offizielle Fujifilm-Dateien

**Fundort** (belegt): https://www.fujifilm-x.com/support/download/lut/ (aus `curl` Cloudflare-403, mit WebFetch lesbar; die Dateien selbst
liegen offen unter `dl.fujifilm-x.com`). Technische Daten: https://www.fujifilm-x.com/support/download/technical-data/.

| Paket | URL | Inhalt (belegt, entpackt und gelesen) |
|---|---|---|
| GFX ETERNA 55 v1.10 (16.04.2026, 45 MB) | https://dl.fujifilm-x.com/support/lut/gfx-eterna-55-3d-lut-v110.zip | Je **F-Log, F-Log2, F-Log2C** 33er- und 65er-Würfel. F-Log2 und F-Log2C: PROVIA, Velvia, ASTIA, CLASSIC-CHROME, REALA-ACE, PRO-Neg.Std, CLASSIC-Neg., ETERNA, ETERNA-BB, ACROS + WDR-709 + neutral. F-Log (alt): nur ETERNA, ETERNA-BB, WDR, neutral |
| X-T5 v1.00 (2,3 MB) u. a. Kamera-Pakete | https://dl.fujifilm-x.com/lut/x-t5-3d-lut-v100.zip | nur ETERNA, ETERNA-BB, WDR, neutral. Ältere Kamera-Pakete sind demnach **nicht** der Satz mit allen Simulationen |

Weitere Pakete: X-Pro3, X100VI, GFX100 II usw. (25 Kameras auf der Seite, belegt per WebFetch 16.10.2026); nicht alle geprüft.

**Format** (belegt): `.cube`, `LUT_3D_SIZE 33` bzw. 65, Eingang 0..1, R läuft am schnellsten. Kopfzeilen z. B. `#Gamma:F-Log2 to PROVIA`,
`#Gamut:F-Gamut to ITU-R BT.709`. Dateigröße ca. 970 KB je 33er-Würfel (Text).

**Eingang und Ausgang** (belegt, Whitepaper v1.01 Seite 9 bis 13, Overview-PDFs):

- Eingang: F-Log2 (Gamut „F-Gamut“) bzw. F-Log2C (Gamut „F-Gamut C“). F-Log2 und F-Log2C haben **dieselbe Kurve**.
- Ausgang: BT.709-Primärvalenzen. Whitepaper empfiehlt für die Ansicht „Color Space Rec.709, Color Temperature D65, Gamma 2.2“.
  Gemessen (Abschnitt 6): 18 % Grau landet bei 0,457 bis 0,468, das passt zu einer Anzeigekurve um Gamma 2,2.
  Die Messung gegen die Bildpaare (Abschnitt 6.2) ändert sich zwischen Gamma 2,2, sRGB-Kurve und Gamma 2,4 praktisch nicht (Mittel ΔE2000 1,54 / 1,50 / 1,53).
- Die LUTs sind laut Overview „preset for tone and color reproduction in the primary color correction for a movie production“. Sie sind **für Video** gedacht (belegt).
- Von der Wunschliste **nicht** dabei: PRO Neg. Hi, Nostalgic Neg., Monochrom, Sepia, Acros mit Filter. (Alle Angaben belegt.)

**Formeln** (belegt aus den Data Sheets F-Log Ver.1.1 und 1.2, F-Log2 Ver.1.0 und 1.1, F-Log2C Ver.1.0 sowie Whitepaper Seite 11; die Konstanten sind in allen Versionen gleich;
gleiche Zahlen im ACES-IDT `FUJIFILM_IDT_F-Log2_Ver.1.10.ctl`; `colour-science` implementiert dieselben Kurven, Konstanten dort nicht verglichen; meine Implementierung
stimmt mit den veröffentlichten Referenzpunkten 95/400/570 bzw. 95/470/705 (10 Bit) überein):

```
Szenenreflexion in -> Codewert out (0..1)
F-Log2 / F-Log2C:  a=5.555556 b=0.064829 c=0.245281 d=0.384316 e=8.799461 f=0.092864 cut1=0.000889 cut2=0.100686685370811
F-Log:             a=0.555556 b=0.009468 c=0.344676 d=0.790453 e=8.735631 f=0.092864 cut1=0.00089  cut2=0.100537775223865
  in >= cut1:  out = c*log10(a*in + b) + d
  in <  cut1:  out = e*in + f
Umkehr:        in >= cut2:  refl = (10^((in-d)/c) - b) / a      sonst: refl = (in - f) / e
Bezugspunkte F-Log2: 0 % -> 10-Bit 95, 18 % -> 400, 90 % -> 570.   F-Log: 95 / 470 / 705.
```

Primärvalenzen (xy, Weißpunkt D65 = 0,3127 / 0,3290): **F-Gamut** (für F-Log und F-Log2) = BT.2020 (0,708 / 0,292, 0,170 / 0,797, 0,131 / 0,046).
**F-Gamut C** (für F-Log2C): R 0,7347 / 0,2653, G 0,0263 / 0,9737, B 0,1173 / −0,0224. Aus den Primärvalenzen gerechnet (beide D65, keine
Adaption nötig), linear BT.709 → F-Gamut: `[0.627404 0.329283 0.043313; 0.069097 0.919540 0.011362; 0.016391 0.088013 0.895595]`;
BT.709 → F-Gamut C: `[0.517069 0.412935 0.069996; 0.088617 0.809263 0.102120; 0.017750 0.109448 0.872802]`.
Für den Eingang einer Ladefunktion ist **F-Log2 mit F-Gamut** die einfachere Wahl (Standardmatrix, bekannte Primärvalenzen).

**Nutzungsbedingungen** (belegt, 16.10.2026):

- Auf der Download-Seite, in den ZIPs, in den Overview-PDFs und in den IDT-/CTL-Dateien steht **kein Lizenztext**. Die Seitenfußzeile verlinkt
  https://www.fujifilm.com/terms_of_use/ (leitet um auf https://global.fujifilm.com/en/terms).
- Dort: Nutzer dürfen Inhalte der Website „download … for personal, noncommercial purposes“. „Users are prohibited from modifying or altering
  … content downloaded or printed out from the Website“ (außer ausdrücklich erlaubt oder mit Genehmigung). Alle Inhalte seien Eigentum von Fujifilm
  oder Dritten.
- Folgerung (vermutet, nicht geprüft durch Rechtsberatung): Mitliefern in einer öffentlichen App, Veröffentlichen **abgeleiteter** LUTs und gewerbliche
  Nutzung sind nicht erlaubt. Lokale Nutzung durch die Person, die die Datei selbst bei Fujifilm lädt, ist gedeckt. Die Kurvenformeln und Primärvalenzen
  sind veröffentlichte Spezifikation und in vielen offenen Bibliotheken enthalten; sie selbst nachzuprogrammieren ist unkritisch (vermutet).
- Marken: „Fujifilm“, „Provia“, „Velvia“, „Astia“ u. a. sind geschützte Namen. Für ein öffentliches Produkt neutral benennen („Chrome-Look“ o. ä.) oder klar als
  Bezug kennzeichnen (vermutet).

## 3. Leica

- **Log-Kurve** (belegt, Leica L-Log Reference Manual V1.9, Juni 2026, https://leica-camera.com/sites/default/files/pm-37826-L-Log_Reference_Manual_V1.9.pdf):
  `L-Log(x) = 8*x + 0.09` für x ≤ 0,006, sonst `0.27*log10(1.3*x + 0.0115) + 0.6` (x = lineare Szenenreflexion). Umkehr: `(y − 0.09)/8` für y ≤ 0,138,
  sonst `(10^((y − 0.6)/0.27) − 0.0115)/1.3`. 18 % Grau = 10-Bit 445 (IRE 44), 90 % = 634. Gamut für alle aktuellen Kameras **BT.2020** (D65),
  nur SL Typ 601 BT.709. Das Handbuch nennt LUTs „designed for L-Log“ und empfiehlt, auf Grau (44 % IRE) zu belichten.
- **Offizielle LUTs** (belegt, von der SL3-Download-Seite): `Leica Pure` und `Leica Cine` (`Rec2020_LLog_to_Rec709_Gamma24`, 65³, plus „Viewing LUT“ 33³) sowie
  „Leica Look Up Tables (Legacy)“ für die **SL2-S**: „Classic“ („Film V6.3“) und „Natural“ („Modern V6.2“), je Rec709 und Rec2020, 33³, Ausgang „Gamma 2.4“.
  Alles **Video-LUTs**.
- **Die Foto-„Leica Looks“** (Classic, Contemporary, Eternal, Selenium, Sepia, Blue, Chrome) werden laut Leica nur über die FOTOS-App in die Kamera geladen
  (belegt per Suchtreffer der Leica-Seiten; Foren dazu waren per WebFetch nicht abrufbar, 403). **Keine offizielle .cube-Datei gefunden.** Dass die Foto-Looks
  mit den SL2-S-Video-LUTs gleichen Namens identisch sind, ist **nicht belegt**.
- **Gemessen** (Neutralachse, Anzeigekurve „Gamma 2.4“): Pure bringt 18 % auf 0,434, Cine auf 0,43, SL2-S Classic auf 0,37, Natural auf 0,39; die
  Highlight-Schulter ist bei allen lang (90 % → 0,73 bis 0,81).
- **Bedingungen** (belegt, https://leica-camera.com/en-int/legal-notices ): „All texts, pictures, graphics … are subject to copyright … They may not be used without
  the prior written consent of Leica Camera AG.“ Keine Lizenz für die LUTs. → wie Fujifilm: lokal ja, mitliefern nein (vermutet).
- Community: ein Forenbeitrag nennt kostenlose Lightroom-Profile für „Classic“ und „Contemporary“ von Robin Schimko; Lizenz unbekannt, Quelle nur als Suchtreffer
  (nicht geprüft). Nachbauten der übrigen Looks nicht gefunden (GitHub-Suche „leica look/lut“: nur `timlawrenz/leica-look`, das ist ein Lens-Rendering-Experiment ohne Farbe).

## 4. Open-Source- und Community-Funde

Bewertung: **mitliefern** = Lizenz erlaubt es; **Messreferenz** = nur lokal lesen. Alle Sternezahlen und Zeiten per `gh api` am 16.10.2026.

| Fund | Lizenz | Format, Eingangsannahme | Inhalt, Ruf, Aktualität | Bewertung |
|---|---|---|---|---|
| **RawTherapee Film Simulation Collection** https://rawtherapee.com/shared/HaldCLUT.zip (421 MB) | **CC BY-SA 4.0** (README.txt in der ZIP, belegt) | HaldCLUT Level 12 (1728² PNG), **sRGB rein/raus**, 8 Bit (README, belegt) | Stand 2015-09-20, Credits Pat David, Pavlov Dmitry, Michael Ezra. 311 Dateien; Fuji: **analoge Stocks** (Provia 100F/400F/400X, Velvia 50/100, Astia 100F, Superia 100–1600, Reala 100, 400H, 160C, 800Z, FP-100c, Neopan Acros 100, FP-3000b). **Keine** Kamera-Filmsimulationen | **mitliefern** (Attribution + Share-Alike für konvertierte Würfel; Konvertierung nicht durchgeführt) |
| **G'MIC Color Presets** https://gmic.eu/color_presets/ | Software CeCILL; Daten je Autor ohne eigene Angabe (belegt: Seite nennt nur CeCILL und „fair use“ für Markennamen) | HaldCLUT-PNG, 1100+ Presets, darunter dieselben Pat-David-Filme und Sowerbys Fuji-XTrans-III-Satz | Aktiv gepflegt | Messreferenz; Lizenz je Datei ungeklärt |
| **abpy/FujifilmCameraProfiles** https://github.com/abpy/FujifilmCameraProfiles | **CC BY-NC-SA 4.0** (README, belegt; Forenantwort nennt sie „free culture license“, was für NC-SA nicht zutrifft) | `.cube` (`LUT_3D_SIZE 32`), HaldCLUT-PNG (Level 6), `.dcp`-Tabellen. Eingang: **lineares Bild ohne Tonkurve**, sRGB-kodiert (README), also **nicht für fertige JPEGs**. Ausnahme: „Provia → Classic Neg/Nostalgic Neg/Bleach Bypass“ gedacht für JPEGs | 584 Sterne, seit 02/2018, Update 22.11.2025 („improved luts“, Reala Ace neu), Push 27.04.2026. Enthält: Provia, Velvia, Astia, Classic Chrome, Pro Neg Std, **Pro Neg Hi**, Eterna, Reala Ace, Classic Neg, **Nostalgic Neg**, Bleach Bypass. Erzeugt aus Farbmustern von Adobe-Camera-Raw-Exporten, also „Fuji → Adobe → abpy“ (Forenbeitrag des Autors, belegt) | **Messreferenz.** Mitliefern scheitert an NC (App mit Werbung/Spenden problematisch), SA (alle abgeleiteten LUTs) und der Adobe-Herkunft |
| `TingfengLuo/Camera-Profile-for-Fujifilm-Film-Simulation` (279 Sterne), `Sen-platotech/…-auto` | keine Lizenzdatei; nutzt die LUTs von abpy (belegt: README) | Adobe-Creative-Profiles (.xmp) | aktiv 09/2026 | nichts Eigenes |
| **Stuart Sowerby, „Fuji XTrans II/III HaldCLUT“** https://blog.sowerby.me/fuji-film-simulation-profiles/ | **keine genannt** (Forum, belegt: „no license has been stated“) | HaldCLUT, aus Exporten des Fuji-RAW-Konverters; Eingang: Neutral-RAW in RawTherapee (kein DCP, Auto-Levels aus) | Autor: „almost indistinguishable from the OOC JPG“; Hinweis, dass Fuji Simulationen zwischen Generationen leicht ändert; ein X-T100-Nutzer meldet Abweichung. Provia, Astia, Velvia, Classic Chrome, Pro Neg Std/Hi, Acros (kein Classic Neg) | Messreferenz nur nach eigener Entscheidung (nicht heruntergeladen). Nicht mitliefern |
| `bastibe/Fujifilm-Auto-Settings-for-Darktable` + `bastibe/LUT-Maker` | keine | PNG-LUTs („Fuji XTrans V8“), aus Paaren neutral/mit-Look-JPEG erzeugt; 113 Sterne, Push 07/2022 | veraltet | nichts mitliefern; **die Methode (LUT aus Bildpaaren) ist die brauchbare Idee** |
| `cedeber/hald-clut` (320 Sterne), `alexanderawerin/PhotoChrome`, `MatthewGreenberg/fujilab` | als GPL-3.0 etikettiert (cedeber, PhotoChrome); fujilab ohne Lizenz | sammeln RawTherapee, PictureFX, Sowerby u. a. | die GPL-Etikette gilt nicht für das Fremdmaterial darin; fujilab nutzt Sowerbys Pack | nicht verwenden |
| `sadziu/Fuji-Recipe-Converter` | **MIT** | rein parametrisch (Tonkurve, HSL, Grading), Rezept → `.cube`/`.xmp` | 22 Sterne, 10/2026. Selbst: „hand-tuned approximations“, „not yet verified“ gegen Kamera-JPEGs | Idee/Parameterstruktur ablesbar, Zahlen nicht als Wahrheit nehmen |
| `t3mujin/t3mujinpack` | MIT | darktable-Styles (Lab-Tonkurven), analoge Stocks inkl. Velvia, Neopan | 1071 Sterne, Push 04/2025 | nur Anregung, kein LUT-Format |
| `andreavolpato/spektrafilm` (+ Portierungen, z. B. DICHROIC im Browser auf WebGPU) | Code **GPL-3.0**, JSON-Profile **CC BY-SA 4.0**, mitgelieferte LUTs eigene Lizenz „commercial use, free share, no resale“ (README, belegt) | spektrales Negativ-/Positiv-Modell aus Herstellerdatenblättern, mit Körnungsmodell | 1009 Sterne, Push 07/2026. Analoge Stocks (u. a. Fuji Pro 400H, C200), **keine** Kamera-Simulationen | für analoge Stocks und Korn zu studieren; Code nicht einbinden (GPL) |
| `filmulator-gui` | „other“ laut GitHub, nicht geprüft | simuliert Filmentwicklung | | für Fuji-Simulationen ohne Nutzen |
| Fuji-X-Weekly-Rezepte als Datensatz (`gosku/open-fuji-recipe` Spezifikation, `plamf/fuji-x-weekly-simulation-profiles` GPL-3.0, `matthieurobin/open-fuji-recipes` ohne Lizenz) | gemischt | Kameraeinstellungen (Simulation, Korn, Color Chrome, WB-Shift, Highlight/Shadow) als JSON bzw. FP1 | beschreiben Einstellungen einer Fuji-Kamera, keine Pixeltransformation | als Parameterkatalog brauchbar, für Sony-JPEGs nur zusätzlich zu einer Basis-Simulation |
| `pyrocat101/Fujifilm-LUTs` | keine | aus den **offiziellen** F-Log2C-LUTs in ACES/ProPhoto/Apple Log umgerechnet | 21 Sterne | Abgeleitetes von Fujifilm-Daten: nicht verwenden. Das README beschreibt die Umrechnungskette sauber (nützlich zur Gegenprüfung meiner Kette) |

**Nicht gefunden** (GitHub- und Websuche, 16.10.2026): Projekte mit offener Lizenz, die „Color Chrome Effect“, „Color Chrome FX Blue“ oder Fujis Korn-Roughness/-Size anhand von
Kameravergleichen nachbilden. Fujis eigene Beschreibung nennt nur Stufen (Weak/Strong, Small/Large), keinen Algorithmus (belegt, Suchtreffer fujifilm-x.com).

## 5. Körnung und Color Chrome: was es offen gibt

- **Korn physikalisch:** Newson/Faraj/Galerne/Delon, „Realistic Film Grain Rendering“ (IPOL 2017, Quellcode GPL-3.0-or-later, belegt per IPOL-Seite): Monte-Carlo-Modell mit
  Silberhalogenid-Körnern, auflösungsunabhängig. Der Algorithmus ist veröffentlicht und lässt sich selbst implementieren; den GPL-Code einzubinden würde die App unter GPL stellen.
  Eine Variante `kjerk/silvergrain` ist AGPL-3.0. Für Video: AV1 Film Grain Synthesis (Spezifikation `AOMediaCodec/afgs1-spec`; autoregressives Modell mit Intensitätskurve; Lizenz der Referenzimplementierungen nicht geprüft).
- **Korn in den Fuji-Nachbauten:** `fujilab` (keine Lizenz, nur gelesen): einfacher Wertrauschen-Shader, einfarbig, in Schatten stärker, Zellgröße als „Size“.
  `PhotoChrome` (GPL-3.0): gleichverteiltes Pixelrauschen, bei „Size“ bilinear vergrößert; für unsere Zwecke zu simpel.
- **Color Chrome in den Nachbauten:** `fujilab` (nur gelesen, Wirkung der Rechnung nicht im Detail geprüft): Stärke nach Sättigung, auf Farbtöne unter 200° begrenzt, in Lichtern ausgeblendet; FX Blue getrennt.
  Fujifilm beschreibt den Effekt als „deeper colors and a wider range of tones“; ein Nachbau ist **nirgends gegen Kameraausgaben gemessen** (vermutet).

## 6. Messungen

Alles lokal reproduzierbar mit den Skripten in `testbilder/luts/messung/` (Node 22). Eingaben: die offiziellen LUTs, abpys LUTs und die vom anderen Agenten gesammelten
Bildpaare `testbilder/referenz/peltier/paare/<sim>/{provia,sim}.png` (laut Dateinamen Provia gegen Zielsimulation derselben Szene, vermutlich Kamera-JPEGs der X-Serie; Kameramodell, Herkunft und ob wirklich Kamera-JPEGs: nicht geprüft).
ΔE2000 jeweils im Mittel über Bilder, die vorher um Faktor 4 verkleinert wurden (Korn und Schärfung fallen heraus). Kleine Stichprobe: ein Bild je Simulation,
das Ergebnis ist **richtungsweisend, kein Gütesiegel**.

### 6.1 Tonkurven der offiziellen LUTs (gemessen)

Neutralachse, Ausgangswert (Mittel RGB, Anzeigekodierung der LUT) in Abhängigkeit der Szenenreflexion:

| Reflexion | 0,02 | 0,05 | 0,09 | **0,18** | 0,36 | 0,72 | **0,90** | 1,0 | 2,0 |
|---|---|---|---|---|---|---|---|---|---|
| WDR-709 (neutral) | 0,089 | 0,186 | 0,273 | 0,408 | 0,557 | 0,684 | 0,719 | 0,735 | 0,829 |
| PROVIA | 0,068 | 0,166 | 0,282 | 0,457 | 0,636 | 0,788 | 0,815 | 0,827 | 0,885 |
| Velvia | 0,023 | 0,124 | 0,270 | 0,463 | 0,624 | 0,772 | 0,808 | 0,822 | 0,895 |
| CLASSIC-CHROME | 0,040 | 0,132 | 0,260 | 0,459 | 0,655 | 0,802 | 0,828 | 0,839 | 0,893 |
| CLASSIC-Neg. | 0,060 | 0,141 | 0,242 | 0,460 | 0,712 | 0,860 | 0,885 | 0,895 | 0,938 |
| ETERNA | 0,112 | 0,201 | 0,294 | 0,458 | 0,635 | 0,769 | 0,796 | 0,808 | 0,870 |

- Das neutrale „FLog2-709“ ist die Identität in Codewerten (nur Gamut-Matrix). „WDR-709“ stimmt bei 18 % mit der Rec.709-Übertragungsfunktion überein (0,408 gegen 0,409).
- Die Simulationen setzen 18 % Grau auf 0,46 (Anzeigegamma 2,2/sRGB) und rollen die Lichter **sehr lang** ab: PROVIA erreicht 90 % Ausgang erst bei +3,8 Blenden,
  99 % bei +6,1 Blenden über 18 % Grau (F-Log2-Code 1,0 entspricht Reflexion 58, +8,3 Blenden). Ein JPEG-Weiß (255) als „Reflexion 1,0“ gelesen ergibt bei PROVIA nur 0,83 (sRGB-kodiert rund 213 von 255).
  Das erklärt, warum die naive Kette zu dunkel ausfällt. (Leica Pure und Cine verhalten sich ähnlich, siehe Abschnitt 3.)

### 6.2 Kette JPEG → LUT gegen die Zielbilder der Paare (gemessen)

Eingang ist jeweils das **Provia**-Bild des Paars, Referenz das Bild der Zielsimulation:

| Paar | nichts tun (Provia gegen Ziel) | **naiv** (sRGB → linear → F-Gamut → F-Log2 → LUT) | **Provia-relativ** (offizielle LUTs) | abpy „Provia → X“ |
|---|---|---|---|---|
| Astia | 2,63 | 6,07 | **1,75** | |
| Velvia | 3,74 | 4,54 | **1,64** | |
| Classic Chrome | 3,95 | 5,20 | **1,55** | |
| Classic Neg. | 5,75 | 4,24 | **2,01** | 1,56 |
| Pro Neg. Std | 0,56 | 1,44 | **0,43** | |
| Eterna Bleach Bypass | 4,53 | 4,89 | **1,90** | 1,73 |

- **Naiv**: in 5 von 6 Paaren schlechter als nichts tun, Helligkeit systematisch zu niedrig (ΔL −1 bis −6). Ein Belichtungsfaktor (0,35 bis 2,8) hilft kaum (bestes Mittel 1,37 bis 6,07).
- **Provia-relativ**: das JPEG gilt als Ausgang der PROVIA-LUT; per numerischer Umkehr (Newton mit Rückverfolgung, 33³ in 0,6 s, 65³ in 3,9 s) wird der F-Log2-Wert gesucht,
  dort die Ziel-LUT ausgewertet. Bei einem Beispielbild (Classic Chrome) bleibt bei ca. 2 % der Pixel (stark gesättigte Blautöne außerhalb des Bereichs der PROVIA-LUT) ein Restfehler.
- Sichtprüfung der Kontaktbögen (nur im Arbeitsordner): Spalte „Provia-relativ“ ist vom Zielbild der Paare kaum zu unterscheiden, „naiv“ ist erkennbar dunkler, mit abgesoffenen Schatten.
- Die Kette ist **unempfindlich gegen die angenommene Anzeigekurve** (Gamma 2,2 / sRGB / 2,4: Mittel 1,54 / 1,50 / 1,53), weil Ein- und Ausgang dieselbe Annahme nutzen.

### 6.3 Gegenprüfung zweier unabhängiger Quellen (gemessen)

„Provia → Classic Neg“ und „Provia → Bleach Bypass“ aus **offiziellen LUTs** (Provia-relativ) gegen abpys „Provia to …“-LUTs (aus Adobe-Exporten), angewendet auf 4 Sony-a6000-JPEGs und 4 Fuji-JPEGs:
ΔE2000 im Mittel 0,7 bis 1,4 (Classic Neg.) bzw. 0,5 bis 0,9 (Bleach Bypass). Zwei Wege mit unterschiedlicher Herkunft liefern also fast dieselbe Transformation. Das
stärkt die Wahl dieser JPEG-Domänen-Würfel als Messlatte, ohne dass sie „die Wahrheit der Kamera“ sind (näher an der Kamera sind die Bildpaare in 6.2, sofern es Kamera-JPEGs sind).

### 6.4 Einfluss einer anderen Grundkurve (gemessen)

Wird das Provia-JPEG vor der Kette gestört (Simulation einer anderen Kamera), steigt der Fehler gegen die echte Simulation stark: **±0,5 EV** Belichtung: ΔE2000 etwa 6 bis 9;
**±15 %** Kontrast um 18 % Grau: etwa 2 bis 5,5. Die Kette bleibt in diesen Fällen etwa gleich schlecht oder knapp besser als nichts tun. Ohne Belichtungsabgleich gibt es keinen
brauchbaren Look aus F-Log2-LUTs. Ein JPEG der Sony a6000 ist weder ein Provia-JPEG noch gemessen; wie weit die Provia-Annahme dort trägt, ist **offen** (vermutet: 3 bis 5 ΔE2000).

### 6.5 Fehler durch Einbacken in einen 33³-Würfel (gemessen)

Die ganze Kette in einen **sRGB-rein/sRGB-raus**-Würfel zu rechnen (das Format, das Film Lab schon kennt) kostet im Mittel höchstens ΔE2000 0,22 bei 33³ und 0,14 bei 65³ gegenüber der
exakten Pixelkette. Der Würfel ist also für diesen Zweck ausreichend. Die abgeleiteten Würfel liegen unter `testbilder/luts/abgeleitet-lokal/` (nur lokal, nicht veröffentlichen).

## 7. Empfehlung

### a) Was darf in die öffentliche App

1. **Eigene Looks** (parametrische LUTs) bleiben der Hauptweg. Sie dürfen anhand von Messungen abgestimmt werden; veröffentlicht werden nur die eigenen Parameter und die eigene Erzeugung, nicht fremde Würfel (vermutet unkritisch).
2. **RawTherapee-HaldCLUTs (CC BY-SA 4.0)** für analoge Stock-Looks (Fuji Provia 100F, Velvia 50, Astia 100F, Reala 100, 400H, Neopan Acros 100; ebenso Kodak, Ilford, Polaroid), konvertiert zu 33³-Würfeln.
   Auflagen: Namensnennung (Pat David, Pavlov Dmitry, Michael Ezra, Quelle, Lizenz, Hinweis auf die Umrechnung), Würfel unter CC BY-SA 4.0 weitergeben. CC BY-SA 4.0 betrifft die Daten, nicht den App-Code.
   Die Autoren-Herkunft (wie die Fuji-Würfel entstanden) ist **nicht geprüft**. Es sind **keine** Nachbildungen der Kamera-Simulationen; als Namen nicht „Provia“ verwenden, wenn Kamera-Looks versprochen werden.
3. **Log-Kurven und Primärvalenzen** (F-Log/F-Log2, F-Gamut, L-Log, BT.2020) als eigener Code.
4. **Nicht mitliefern:** Fujifilm-LUTs, Leica-LUTs, Sowerby, bastibe, abpy (NC-SA, Adobe-Herkunft), pyrocat101, cedeber/PhotoChrome/fujilab-Dateien, sowie alles, was ich abgeleitet habe.
   Falls abpys Pro Neg. Hi und Nostalgic Neg. gebraucht werden: beim Autor (Forum pixls.us „Aaron_b“, GitHub `abpy`) um eine freiere Lizenz bitten.

### b) Nur als Messreferenz

| Look | Referenzquelle (lokal) | Maß |
|---|---|---|
| Provia, Velvia, Astia, Classic Chrome, Reala Ace, Pro Neg. Std, Classic Neg., Eterna, Eterna BB, Acros | offizielle F-Log2-LUTs, per Provia-relativer Kette in die JPEG-Domäne (`abgeleitet-lokal/provia-zu-*.cube`) | ΔE2000 auf Gitter und Bildern; gegen die Bildpaare gilt etwa 1,5 bis 2 als „so nah wie die Kette kommt“ |
| Classic Neg., Nostalgic Neg., Bleach Bypass | abpy `provia-conversion/` (direkt auf JPEGs anwendbar) | ΔE2000 |
| Pro Neg. Hi | nur abpy (`cube-srgb` braucht lineare Eingabe, nicht direkt anwendbar) und echte Kamerabilder | Sicht + ΔE auf Paaren |
| Monochrom, Sepia, Acros-Filter | keine offizielle Datei; Kamerabilder (anderer Agent) | |
| Leica Classic/Natural/Pure/Cine | offizielle Video-LUTs (L-Log, BT.2020 → Rec.709, Gamma 2,4) | **keine** Messlatte für die Foto-Leica-Looks, nur für Tonkurve und Farbgrad der Video-Looks |
| Leica Contemporary, Eternal, Selenium, Sepia, Blue, Chrome | nur echte Kamera-JPEGs | |

Zu Grunde liegen sollte weiter echtes **Bildmaterial** (Paare), nicht LUT-Zahlen allein: Die LUTs bilden den Video-Look, nicht Korn, Color Chrome, Dynamikbereich oder Tonwertkorrektur der Fotos.

### c) Modus „offizielle Fujifilm-LUT selbst laden“

**Lohnt sich**, mit klarer Beschriftung („Näherung der Kamera-Simulation aus Fujifilms Video-LUT“). Gründe: legal sauber (die Datei lädt der Nutzer bei Fujifilm, die App rechnet lokal, nichts wird weitergegeben),
technisch gut machbar (`.cube`-Import ist da, `fflate` ist schon Abhängigkeit), Ergebnis vermutlich näher an der Kamera als eine Eigenbau-Kurve mit vertretbarem Aufwand (vermutet; die Messung in 6.2 stützt das nur für Fuji-Eingangsbilder).

**Technisch sauber?** Die Umrechnung selbst ja: sRGB-Kurve → linear → Matrix BT.709 → F-Gamut (Abschnitt 2) → F-Log2 → LUT → Anzeigekurve (2,2) → sRGB ist mathematisch korrekt und vollständig belegt.
Sie ist aber **fachlich falsch für JPEGs**, weil F-Log2 eine szenenbezogene Kodierung ist (18 % = 0,391), ein JPEG dagegen die Tonkurve, Lichterkompression und Sättigung der Kamera schon trägt. Folge: doppelte Tonkurve, dunkler, abgesoffene Schatten (Abschnitt 6.2).

**Empfohlene Umsetzung:**

1. Nutzer wählt das offizielle ZIP „GFX ETERNA 55“ (oder einzelne `FLog2_to_*.cube` plus `FLog2_to_PROVIA`). Die App zieht nur die `33Grid/F-Log2/`-Dateien heraus.
2. **JPEG-Pfad: Provia-relativ.** In einem Worker wird einmal je Auswahl ein sRGB-Würfel gerechnet (Newton-Umkehr der PROVIA-LUT, Ziel-LUT, 33³, rund eine Sekunde; Würfel zwischenspeichern). Nutzt dasselbe `Lut3D`-Format wie bisher, **kein Shader-Umbau**.
   Fehlt die PROVIA-Datei, nur den naiven Pfad mit Belichtungsregler anbieten und als „ungenau“ markieren.
3. **Belichtungsregler** (±EV) zwingend: ±0,5 EV kostet 6 bis 9 ΔE (Abschnitt 6.4).
4. **RAW-Pfad (ARW)** wäre der saubere Weg (linear → Kamera-WB → sRGB linear → Belichtung auf 18 % Grau ausrichten → F-Gamut → F-Log2 → LUT). **Nicht gemessen**; Ergebnis dürfte dem **Video**-Look entsprechen (lange Lichterschulter, sehr
   weich), nicht dem Foto-JPEG (vermutet). Messvorschlag: CC0-RAFs mit eingebettetem Kamera-JPEG von https://raw.pixls.us/ (Fujifilm, X-Trans) entwickeln und gegen das eingebettete JPEG messen, mit einem einzigen angepassten Belichtungsfaktor je Bild.
5. **Grenzen offen benennen:** kein Korn, kein Color Chrome/FX Blue, kein Dynamikbereich-Modus, keine Tonwert-/Farbeinstellung der Kamera; Video-LUT in Version 1.0/1.10; Fujifilm ändert Simulationen zwischen Sensorgenerationen leicht (Aussage von Sowerby, nicht nachgemessen).
6. Fehlend im offiziellen Satz: Pro Neg. Hi, Nostalgic Neg., Monochrom, Sepia, Acros-Filter. Diese bleiben Eigenbau.

**Erwartete Nähe:** mit dem **Provia-Bild eines Fuji** als Eingang ΔE2000 im Mittel 1,5 (0,4 bis 2,0) gegen das Bild der Zielsimulation (gemessen, 6 Paare). Mit **Sony-a6000-JPEG** als Eingang nicht messbar, weil kein Paar „a6000-JPEG ↔ Fuji-JPEG derselben Szene“ vorliegt; Erwartung 3 bis 5 (vermutet),
da die Grundkurve der Sony nicht der Provia entspricht. Eine echte Nachmessung bräuchte dieselbe Szene mit Sony und Fuji.

## 8. Offene Punkte

- RAW-Ground-Truth (Abschnitt 7c, Punkt 4) nicht gemessen.
- Pro Neg. Hi und Nostalgic Neg. haben keine offizielle Quelle; abpy ist die einzige LUT-Quelle, mit NC-SA.
- Rechtsfragen (Ableitung aus Fujifilm-LUTs, Markennamen, Lizenzkette Adobe → abpy) sind nur als Lesart festgehalten, nicht juristisch geprüft.
- Die Bildpaare des anderen Agenten sind Webbilder unbekannter Herkunft; nur interne Messung, nicht weitergeben.

## 9. Quellen

- Fujifilm: https://www.fujifilm-x.com/support/download/lut/ · https://www.fujifilm-x.com/support/download/technical-data/ · https://dl.fujifilm-x.com/support/lut/GFX_ETERNA_WhitePaper_260206_v101.pdf ·
  https://dl.fujifilm-x.com/technical-data/F-Log2_DataSheet_E_Ver.1.1.pdf · https://dl.fujifilm-x.com/technical-data/F-Log_DataSheet_E_Ver.1.2.pdf · https://dl.fujifilm-x.com/technical-data/F-Log2C_DataSheet_E_Ver.1.0.pdf · https://dl.fujifilm-x.com/support/lut/FUJIFILM_IDT_F-Log2_Ver.1.10.ctl.zip · https://global.fujifilm.com/en/terms
- Leica: https://leica-camera.com/en-int/photography/cameras/sl/sl3-reporter/downloads · https://leica-camera.com/sites/default/files/pm-37826-L-Log_Reference_Manual_V1.9.pdf · https://leica-camera.com/en-int/legal-notices · https://leica-camera.com/en-US/photography/leica-apps/leica-fotos
- Community: https://github.com/abpy/FujifilmCameraProfiles · https://discuss.pixls.us/t/fujifilm-film-simulation-profiles-for-adobe-and-other-raw-processors/38197 · https://discuss.pixls.us/t/fujifilm-film-simulation-lut-in-art/55019 ·
  https://discuss.pixls.us/t/new-fujifilm-xtrans-film-simulations/6333 · https://blog.sowerby.me/fuji-film-simulation-profiles/ · https://rawtherapee.com/shared/HaldCLUT.zip · https://gmic.eu/color_presets/ ·
  https://github.com/pyrocat101/Fujifilm-LUTs · https://github.com/sadziu/Fuji-Recipe-Converter · https://github.com/MatthewGreenberg/fujilab · https://github.com/alexanderawerin/PhotoChrome · https://github.com/cedeber/hald-clut ·
  https://github.com/andreavolpato/spektrafilm · https://www.ipol.im/pub/art/2017/192/ · https://github.com/t3mujin/t3mujinpack
- Lokale Aufstellung der Dateien: `testbilder/luts/QUELLEN.md` (gitignoriert).
