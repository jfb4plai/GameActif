/**
 * Lit un nombre tapé par l'enseignant : entier, décimal (virgule ou point) ou fraction a/b.
 * Retourne null si le texte n'est pas un nombre (ou si le dénominateur est nul).
 */
export function parseNombre(texte: string): number | null {
  const t = texte.trim();
  if (/^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  const f = /^(-?\d+)\/(\d+)$/.exec(t);
  if (f) {
    const den = Number(f[2]);
    return den === 0 ? null : Number(f[1]) / den;
  }
  return null;
}

/** Symbole juste entre deux nombres ; deux fractions égales donnent le même nombre flottant (division arrondie au plus proche). */
export function symboleJuste(a: number, b: number): '>' | '<' | '=' {
  return a > b ? '>' : a < b ? '<' : '=';
}
