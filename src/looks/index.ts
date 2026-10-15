// Platzhalter – wird vom Looks-Modul ersetzt.
import type { FilmLook, Lut3D } from '../types';

export const LOOKS: FilmLook[] = [];

export function identityLut(size: number): Lut3D {
  const data = new Float32Array(size * size * size * 3);
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const i = (r + g * size + b * size * size) * 3;
        data[i] = r / (size - 1);
        data[i + 1] = g / (size - 1);
        data[i + 2] = b / (size - 1);
      }
  return { size, data };
}

export function parseCube(_text: string, _title?: string): Lut3D {
  throw new Error('parseCube: noch nicht implementiert');
}
