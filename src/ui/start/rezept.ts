// Rezepttext für das Beispiel auf der Startseite – die Werte von „Portra 400“ (src/looks/kodak.ts) im Format von
// Fuji X Weekly. rezept.test.ts prüft, dass der Rezept-Parser daraus genau diese Einstellungen macht.
export const BEISPIEL_LOOK = 'kodak-portra-400';

export const BEISPIEL_REZEPT = `Kodak Portra 400 v2
Film Simulation: Classic Chrome
Dynamic Range: DR400
Grain Effect: Strong, Small
Color Chrome Effect: Strong
Color Chrome FX Blue: Off
White Balance: 5200K, +1 Red & -6 Blue
Highlight: 0
Shadow: -2
Color: +2
Sharpness: -2
Clarity: -2
High ISO NR: -4
Exposure Compensation: +1/3 to +1`;

/** Zeilen des Rezepts nach dem, was sie bewirken (Startseite); je Gruppe in der Reihenfolge dieser Liste. */
export const REZEPT_GRUPPEN: { name: string; wirkung: string; zeilen: string[] }[] = [
  { name: 'Grundlook', wirkung: 'Filmsimulation', zeilen: ['Film Simulation'] },
  { name: 'Tonwerte', wirkung: 'Kontrast, Lichter, Schatten', zeilen: ['Dynamic Range', 'Highlight', 'Shadow', 'Exposure Compensation'] },
  { name: 'Farbe', wirkung: 'Stimmung und Sättigung', zeilen: ['White Balance', 'Color', 'Color Chrome Effect', 'Color Chrome FX Blue'] },
  { name: 'Struktur', wirkung: 'Korn und Schärfe', zeilen: ['Grain Effect', 'Sharpness', 'Clarity', 'High ISO NR'] },
];
