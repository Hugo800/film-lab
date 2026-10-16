// Zahlen für die Anzeige: immer mit Vorzeichen, echtes Minuszeichen, deutsches Komma.
export function fmtSigned(v: number, decimals = 0): string {
  const n = Math.abs(v).toFixed(decimals).replace('.', ',');
  if (Number(n.replace(',', '.')) === 0) return '0';
  return `${v < 0 ? '−' : '+'}${n}`;
}

/** Ganze Prozent, ohne Vorzeichen (Stärke, Halation …). */
export const fmtPercent = (v: number) => `${Math.round(v * 100)} %`;
