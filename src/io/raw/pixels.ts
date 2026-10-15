// Pixelarbeit der RAW-Dekodierung: aktive Bildfläche bestimmen und RGB → RGBA mit Beschnitt.

export interface Area {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** libraw meldet „kein Versatz“ als 65535. */
const UNSET = 65535;

/**
 * libraw liefert bei Sony die volle Sensorfläche (a6000: 6024×4024), die Kamera-JPEGs sind aber
 * 6000×4000. raw_inset_crops[0] nennt die Sollgröße, bei der a6000 ohne Versatz; dann mittig
 * beschneiden (an der a6000 per Profilvergleich mit der eingebetteten Kamera-Vorschau bestätigt: 12/12).
 */
export function activeArea(
  insetCrop: { cleft: number; ctop: number; cwidth: number; cheight: number } | undefined,
  width: number,
  height: number,
): Area {
  const full: Area = { left: 0, top: 0, width, height };
  if (!insetCrop || !(insetCrop.cwidth > 0) || !(insetCrop.cheight > 0)) return full;

  // Die Maße gelten in Sensor-Ausrichtung; nach einer 90°-Drehung stehen sie vertauscht.
  const rotated = insetCrop.cwidth >= insetCrop.cheight !== width >= height;
  const w = rotated ? insetCrop.cheight : insetCrop.cwidth;
  const h = rotated ? insetCrop.cwidth : insetCrop.cheight;
  if (w > width || h > height) return full;

  const hasOffset = !rotated && insetCrop.cleft !== UNSET && insetCrop.ctop !== UNSET;
  const left = hasOffset ? insetCrop.cleft : Math.floor((width - w) / 2);
  const top = hasOffset ? insetCrop.ctop : Math.floor((height - h) / 2);
  if (left + w > width || top + h > height) return full;
  return { left, top, width: w, height: h };
}

/** Schneidet `area` aus dem RGB-Bild (Zeilenbreite srcWidth) und hängt Alpha 255 an. */
export function rgbToRgba(rgb: Uint8Array, srcWidth: number, area: Area): Uint8Array {
  const rgba = new Uint8Array(area.width * area.height * 4);
  let d = 0;
  for (let y = 0; y < area.height; y++) {
    let s = ((area.top + y) * srcWidth + area.left) * 3;
    for (let x = 0; x < area.width; x++, s += 3, d += 4) {
      rgba[d] = rgb[s];
      rgba[d + 1] = rgb[s + 1];
      rgba[d + 2] = rgb[s + 2];
      rgba[d + 3] = 255;
    }
  }
  return rgba;
}
