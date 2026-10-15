// Gemeinsamer Vertrag zwischen den Modulen. Jedes Modul besitzt seinen Ordner:
//   src/looks/   Film-Looks als 3D-LUT + .cube-Parser          (nur reine Funktionen)
//   src/io/      Dateien einlesen (JPEG/PNG/HEIC/ARW), Metadaten, JPEG-Ausgabe zusammensetzen
//   src/engine/  WebGL2-Pipeline: Vorschau und Export in voller Auflösung
//   src/ui/      React-Oberfläche, Zustand (zustand), Stapel, Teilen/Download
// Änderungen an dieser Datei nur abgestimmt – alle Module hängen daran.
//
// Einstiegspunkte (jeweils index.ts des Ordners):
//   looks:  LOOKS: FilmLook[]; parseCube(text, title?): Lut3D; identityLut(size): Lut3D
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

/**
 * Einstellbare Parameter. Alle Effekte sind auflösungsunabhängig definiert
 * (relativ zur kürzeren Bildseite), damit Vorschau und Export gleich aussehen.
 */
export interface LookParams {
  /** Mischung Original ↔ LUT, 0..1. */
  strength: number;
  /** Belichtung in Blendenstufen, -2..2 (vor der LUT, in linearem Licht). */
  exposure: number;
  /** Farbtemperatur, -1 (kühl) .. 1 (warm). 0 = neutral. Vor der LUT. */
  temperature: number;
  /** Tönung, -1 (grün) .. 1 (magenta). 0 = neutral. Vor der LUT. */
  tint: number;
  /** Kornstärke 0..1. */
  grain: number;
  /** Korngröße 0.5..3 (1 = Kleinbild-ISO-400-artig bei 24 MP). */
  grainSize: number;
  /** Halation (rötliches Leuchten um Lichter), 0..1. */
  halation: number;
  /** Vignette 0..1. */
  vignette: number;
  /** Light-Leak-Stärke 0..1. */
  leak: number;
  /** Zufallssamen für Light Leaks (ganzzahlig). „Neu würfeln“ ändert nur diesen Wert. */
  leakSeed: number;
}

export type LookCategory = 'farbe' | 'diafilm' | 'kino' | 'schwarzweiss' | 'eigene';

/** Ein Film-Look: Farbcharakter als LUT plus Voreinstellungen der Effekte. */
export interface FilmLook {
  id: string;
  /** Anzeigename, z. B. „Portra 400“-artig, aber eigener Name (keine Markennamen als Produktbehauptung). */
  name: string;
  /** Kurze Beschreibung auf Deutsch, 1 Satz. */
  description: string;
  category: LookCategory;
  /** Deterministisch. Ergebnis darf vom Aufrufer zwischengespeichert werden. */
  buildLut(): Lut3D;
  /** Voreinstellungen beim Wählen des Looks (fehlende Felder = DEFAULT_PARAMS). */
  defaults: Partial<LookParams>;
}

export const DEFAULT_PARAMS: LookParams = {
  strength: 1,
  exposure: 0,
  temperature: 0,
  tint: 0,
  grain: 0,
  grainSize: 1,
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
  dispose(): void;
}
