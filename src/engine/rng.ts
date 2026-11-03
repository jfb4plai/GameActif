export type Rng = () => number;

/** Générateur mulberry32 : déterministe pour une graine donnée, valeurs dans [0, 1[. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange de Fisher-Yates ; ne modifie pas l'entrée. */
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Mélange sans point fixe : aucun élément ne reste à sa position d'origine (si n >= 2).
 * Sert à casser l'ordre d'écriture de l'enseignant, qui peut trahir la réponse.
 * Les éléments doivent être distincts entre eux.
 */
export function shuffleNoFixedPoint<T>(arr: readonly T[], rng: Rng): T[] {
  if (arr.length < 2) return arr.slice();
  for (let attempt = 0; attempt < 50; attempt++) {
    const out = shuffle(arr, rng);
    if (out.every((v, i) => v !== arr[i])) return out;
  }
  // Repli : rotation d'un cran, sans point fixe quand les éléments sont distincts.
  return arr.slice(1).concat(arr[0]);
}
