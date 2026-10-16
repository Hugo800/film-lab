// Welche Knöpfe die Fertig-Ansicht des Exports zeigt. Rein, damit sich jede Geräteart ohne Browser prüfen lässt.
export interface ExportDevice {
  ios: boolean;
  /** Touch ist das Haupteingabegerät (Handy, Tablet). */
  touch: boolean;
  /** navigator.canShare akzeptiert die fertigen Dateien. */
  canShare: boolean;
}

export type ExportAction = 'sichern' | 'teilen' | 'herunterladen';

export interface ExportButtons {
  primary: ExportAction;
  /** Nur wo Teilen und Herunterladen wirklich Verschiedenes tun (Android). */
  secondary?: ExportAction;
  /** Hinweis unter dem Ergebnis: iOS legt Bilder erst über das Teilen-Menü in Fotos ab. */
  hint?: string;
}

export function exportButtons({ ios, touch, canShare }: ExportDevice): ExportButtons {
  // iOS behandelt einen Download wie Teilen; ein zweiter Knopf führte zum selben Ergebnis.
  if (ios && canShare) return { primary: 'sichern', hint: 'Im Teilen-Menü „Bild sichern“ wählen.' };
  if (touch && canShare) return { primary: 'teilen', secondary: 'herunterladen' };
  return { primary: 'herunterladen' };
}

export function exportActionLabel(action: ExportAction, count: number): string {
  if (action === 'sichern') return 'In Fotos sichern';
  if (action === 'teilen') return 'Teilen';
  return count > 1 ? 'ZIP herunterladen' : 'Herunterladen';
}
