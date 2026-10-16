// Zahlen für die Anzeige: immer mit Vorzeichen, echtes Minuszeichen, deutsches Komma.
export function fmtSigned(v: number, decimals = 0): string {
  const n = Math.abs(v).toFixed(decimals).replace('.', ',');
  if (Number(n.replace(',', '.')) === 0) return '0';
  return `${v < 0 ? '−' : '+'}${n}`;
}

/** Ganze Prozent, ohne Vorzeichen (Stärke, Halation …). */
export const fmtPercent = (v: number) => `${Math.round(v * 100)} %`;

/** Belichtung in Drittelstufen wie an der Kamera: „0 EV“, „+1/3 EV“, „−1 2/3 EV“. */
export function fmtThirds(v: number): string {
  const t = Math.round(v * 3);
  if (t === 0) return '0 EV';
  const whole = Math.floor(Math.abs(t) / 3);
  const rest = Math.abs(t) % 3;
  const text = [whole > 0 ? String(whole) : '', rest > 0 ? `${rest}/3` : ''].filter(Boolean).join(' ');
  return `${t < 0 ? '−' : '+'}${text} EV`;
}
