/** `<Original>_filmlab.jpg`; bei gleichen Namen (zwei Mal IMG_1.jpg) wird -2, -3 … angehängt. */
export function exportNames(originals: string[]): string[] {
  const used = new Set<string>();
  return originals.map((orig) => {
    const base = orig.replace(/\.[^./\\]+$/, '') || 'foto';
    let name = `${base}_filmlab.jpg`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}_filmlab-${n}.jpg`;
    used.add(name.toLowerCase());
    return name;
  });
}
