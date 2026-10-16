// Gemeinsamer Vertrag zwischen den Modulen. Jedes Modul besitzt seinen Ordner:
//   src/looks/   Film-Looks als 3D-LUT + .cube-Parser          (nur reine Funktionen)
//   src/io/      Dateien einlesen (JPEG/PNG/HEIC/ARW), Metadaten, JPEG-Ausgabe zusammensetzen
//   src/engine/  WebGL2-Pipeline: Vorschau und Export in voller Auflösung
//   src/ui/      React-Oberfläche, Zustand (zustand), Stapel, Teilen/Download
// Änderungen an dieser Datei nur abgestimmt – alle Module hängen daran.
//
// Einstiegspunkte (jeweils index.ts des Ordners):
//   looks:  LOOKS: FilmLook[]; parseCube(text, title?): Lut3D; identityLut(size): Lut3D
//           buildOfficialLuts(files: {name: string; data: Uint8Array}[], onProgress?): Promise<Map<string, Lut3D>>
//             (offizielle Fujifilm-F-Log2-LUTs, vom Nutzer selbst geladen → sRGB-LUTs „Provia-relativ“,
//              Schlüssel = FilmLook.officialKey; rechnet in einem Worker; nichts davon wird mitgeliefert)
//   io:     loadFile(file: File): Promise<SourceImage>          (JPEG/PNG/HEIC/ARW, ARW per src/io/raw)
//           encodeJpeg(rgba: Uint8Array, width, height, quality): Promise<Uint8Array>
//           withMetadata(jpeg: Uint8Array, meta: SourceMetadata, size: {width, height}): Uint8Array
//             (ersetzt APPn-Segmente des frisch kodierten JPEGs durch EXIF/ICC/XMP der Quelle,
//              setzt Orientation=1 und die Pixelmaße in EXIF/XMP)
//           isRawFile(file: File): boolean
//   engine: createEngine(canvas: HTMLCanvasElement): Engine     (nutzt encodeJpeg + withMetadata)

/** 3D-LUT wie im .cube-Format: `size`³ Einträge, je RGB 0..1, Rot läuft am schnellsten. */
export interface Lut3D {
  size: number;
  /** Länge size*size*size*3. Index (r + g*size + b*size*size)*3. */
  data: Float32Array;
  /** Anzeigename, z. B. aus TITLE einer .cube-Datei. */
  title?: string;
}

/** Stufen wie im Kameramenü: 0 = Aus, 1 = Schwach, 2 = Stark. */
export type Level = 0 | 1 | 2;

/**
 * Einstellbare Parameter. Aufbau und Wertebereiche wie die Bildeinstellungen einer
 * Fujifilm-Kamera, damit sich Fuji-Rezepte (z. B. Fuji X Weekly) 1:1 eintragen lassen;
 * dazu einige Extras, die keine Kamera hat. Alle Effekte sind auflösungsunabhängig
 * (relativ zur kürzeren Bildseite), damit Vorschau und Export gleich aussehen.
 */
export interface LookParams {
  /**
   * Stärke des Looks als Faktor s, 0..2 (UI: s · 50 %). 1 = Look bzw. Rezept wie definiert, 0 = Original,
   * 2 = doppelte Wirkung. s skaliert die LUT und die Abweichung der Look-Vorgaben (`lookDefaults`) von
   * DEFAULT_PARAMS; eigene Änderungen gegenüber den Look-Vorgaben wirken bei jeder Stärke voll
   * (siehe effectiveParams in src/engine/plan.ts).
   */
  strength: number;
  /** Belichtungskorrektur in Blendenstufen, -2..2 (vor der LUT, in linearem Licht). */
  exposure: number;

  // --- Fujifilm-Bildeinstellungen ---
  /**
   * Weißabgleich wie im Rezept: 0 = „Auto“ (Foto bleibt, wie es ist), sonst Kelvin 2500..10000.
   * Das Foto gilt als bei Tageslicht (5500 K) neutral abgeglichen; 6500 K wärmt also wie in der Kamera.
   * Vor der LUT.
   */
  wbKelvin: number;
  /** Weißabgleich-Verschiebung Rot (+) ↔ Cyan (−), -9..9, ganzzahlig. Vor der LUT. */
  wbShiftR: number;
  /** Weißabgleich-Verschiebung Blau (+) ↔ Gelb (−), -9..9, ganzzahlig. Vor der LUT. */
  wbShiftB: number;
  /** Dynamikbereich wie DR100/DR200/DR400: schützt Lichter (Kamera: unterbelichten + Kurve anheben). */
  dynamicRange: 100 | 200 | 400;
  /** Lichter-Ton, -2..4 in 0,5-Schritten (+ = härtere/hellere Lichter, − = weichere). */
  highlightTone: number;
  /** Schatten-Ton, -2..4 in 0,5-Schritten (+ = dunklere/härtere Schatten, − = weichere). */
  shadowTone: number;
  /** Farbe (Sättigung), -4..4, ganzzahlig. Bei SW-Looks ohne Wirkung. */
  color: number;
  /** Schärfe, -4..4, ganzzahlig. */
  sharpness: number;
  /** Klarheit (lokaler Mitteltonkontrast), -5..5, ganzzahlig. */
  clarity: number;
  /** Grain Effect: Aus/Schwach/Stark. */
  grainEffect: Level;
  /** Korngröße wie in der Kamera. */
  grainSize: 'klein' | 'gross';
  /** Color Chrome Effect: vertieft stark gesättigte Farben. */
  colorChrome: Level;
  /** Color Chrome FX Blau: dasselbe nur für Blautöne. */
  colorChromeBlue: Level;
  /** Monochrom-Tönung warm (+) ↔ kalt (−), -18..18. Nur bei SW-Looks. */
  monoWarmCool: number;
  /** Monochrom-Tönung Magenta (+) ↔ Grün (−), -18..18. Nur bei SW-Looks. */
  monoMagentaGreen: number;

  // --- Extras (keine Kamera-Einstellung) ---
  /** Halation (rötliches Leuchten um Lichter, z. B. CineStill), 0..1. */
  halation: number;
  /** Vignette 0..1. */
  vignette: number;
  /** Light-Leak-Stärke 0..1. */
  leak: number;
  /** Zufallssamen für Light Leaks (ganzzahlig). „Neu würfeln“ ändert nur diesen Wert. */
  leakSeed: number;

  /**
   * Vorgaben des aktiven Looks (FilmLook.defaults), nur für die Engine: Daran misst sie, welcher Teil der
   * Werte zum Look gehört und mit `strength` skaliert. Die UI setzt das Feld beim Rendern, gespeichert wird
   * es nicht. Fehlt es, skaliert die Stärke nur die LUT (alle Werte gelten als eigene Änderungen).
   */
  lookDefaults?: Partial<LookParams>;
}

/** Gruppen in der Look-Auswahl. 'kodak' = Kodak-Filme als Fuji-Rezepte. */
export type LookCategory = 'fujifilm' | 'leica' | 'kodak' | 'eigene';

/** Ein Look: Farbcharakter als LUT plus Voreinstellungen der Bildeinstellungen. */
export interface FilmLook {
  id: string;
  /** Anzeigename wie in der Kamera bzw. wie der Film, z. B. „Classic Chrome“, „Leica Chrome“, „Portra 400“. */
  name: string;
  /** Kurze Beschreibung auf Deutsch, 1 Satz. Bei Rezepten mit Quelle (z. B. „Rezept: Fuji X Weekly“). */
  description: string;
  category: LookCategory;
  /** SW-Look: Farbe/Color Chrome ohne Wirkung, Monochrom-Tönung sichtbar. */
  monochrome?: boolean;
  /**
   * Rezept auf Basis eines anderen Looks (id). Dann liefert buildLut() die LUT der Basis,
   * und der Unterschied steckt in defaults. Die UI nutzt die Basis auch, um ggf. die
   * Fujifilm-Original-LUT einzusetzen.
   */
  baseLookId?: string;
  /**
   * Schlüssel der offiziellen Fujifilm-LUT (Dateiname ohne Endung im Paket, z. B. „FLog2_to_CLASSIC_CHROME“),
   * falls es für diese Simulation eine gibt. Siehe buildOfficialLuts in src/looks.
   */
  officialKey?: string;
  /** Deterministisch. Ergebnis darf vom Aufrufer zwischengespeichert werden. */
  buildLut(): Lut3D;
  /** Voreinstellungen beim Wählen des Looks (fehlende Felder = DEFAULT_PARAMS). */
  defaults: Partial<LookParams>;
}

export const DEFAULT_PARAMS: LookParams = {
  strength: 1,
  exposure: 0,
  wbKelvin: 0,
  wbShiftR: 0,
  wbShiftB: 0,
  dynamicRange: 100,
  highlightTone: 0,
  shadowTone: 0,
  color: 0,
  sharpness: 0,
  clarity: 0,
  grainEffect: 0,
  grainSize: 'klein',
  colorChrome: 0,
  colorChromeBlue: 0,
  monoWarmCool: 0,
  monoMagentaGreen: 0,
  halation: 0,
  vignette: 0,
  leak: 0,
  leakSeed: 1,
};

/** Farbraum, in dem die Pixelwerte der Quelle kodiert sind. */
export type SourceColorSpace = 'srgb' | 'display-p3';

/**
 * Metadaten, die beim Export wieder ins JPEG kommen. Rohbytes der Segmente
 * inklusive Kennung („Exif\0\0“, „ICC_PROFILE\0…“, „http://ns.adobe.com/xap/1.0/\0“),
 * aber OHNE Marker (FFE1/FFE2) und OHNE Längenfeld.
 */
export interface SourceMetadata {
  exif?: Uint8Array;
  /** ICC-Profil, ggf. auf mehrere APP2-Segmente verteilt (Reihenfolge beibehalten). */
  icc?: Uint8Array[];
  xmp?: Uint8Array;
}

/** Eine geladene, bereits richtig gedrehte Quelle (EXIF-Orientierung ist angewendet). */
export interface SourceImage {
  id: string;
  fileName: string;
  width: number;
  height: number;
  colorSpace: SourceColorSpace;
  /**
   * Pixel ohne Farbraumumrechnung durch den Browser (Werte wie in der Datei kodiert).
   * Entweder ein ImageBitmap (JPEG/PNG/HEIC) oder RGBA8-Pixel (RAW-Dekodierung).
   */
  pixels: ImageBitmap | { data: Uint8Array; width: number; height: number };
  meta: SourceMetadata;
  /** War die Quelle ein RAW (z. B. .ARW)? */
  isRaw: boolean;
}

export interface RenderOptions {
  /** Original statt Bearbeitung zeigen (Gedrückthalten). */
  showOriginal?: boolean;
  /** Vorher/Nachher-Teilung: 0..1 Anteil von links, der das Original zeigt. undefined = aus. */
  split?: number;
}

export interface ExportOptions {
  /** JPEG-Qualität 0..100, Vorgabe 92. */
  quality?: number;
  /** Längste Kante begrenzen (Pixel). undefined = volle Auflösung. */
  maxEdge?: number;
  /** Fortschritt 0..1. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** WebGL2-Pipeline. Eine Instanz pro Vorschau-Canvas. */
export interface Engine {
  /** Lädt die Quelle in die GPU (verkleinerte Vorschau + Vollbild bei Bedarf). */
  setSource(src: SourceImage): void;
  /** Aktive LUT; null = keine (nur Effekte). */
  setLut(lut: Lut3D | null): void;
  /** Zeichnet die Vorschau in den Canvas (passt sich der Canvas-Größe an). */
  render(params: LookParams, opts?: RenderOptions): void;
  /** Bearbeitet die Quelle in voller Auflösung und liefert ein JPEG inkl. Metadaten. */
  exportJpeg(src: SourceImage, lut: Lut3D | null, params: LookParams, opts?: ExportOptions): Promise<Blob>;
  /** Kleine Vorschau (z. B. für Look-Kacheln), als ImageBitmap. */
  renderThumbnail(lut: Lut3D | null, params: LookParams, maxEdge: number): Promise<ImageBitmap>;
  /**
   * Ausschnitt `rect` (Quellpixel, halboffen) wie im Export gerechnet, auf outW×outH skaliert (z. B. 100 %-Lupe).
   * Wirft, wenn der Ausschnitt samt Filterrand größer als eine Exportkachel ist; Abbruch per `signal` (AbortError).
   */
  renderRegion(
    src: SourceImage,
    lut: Lut3D | null,
    params: LookParams,
    rect: { x0: number; y0: number; x1: number; y1: number },
    outW: number,
    outH: number,
    opts?: { showOriginal?: boolean; signal?: AbortSignal },
  ): Promise<ImageBitmap>;
  dispose(): void;
}
