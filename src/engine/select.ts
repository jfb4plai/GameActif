import type { Difficulty, ProfileId } from './types.js';
import { shuffle, type Rng } from './rng.js';

const RANK_SOUTIEN: Record<Difficulty, number> = { facile: 0, moyen: 1, difficile: 2 };
const RANK_DEFI: Record<Difficulty, number> = { difficile: 0, moyen: 1, facile: 2 };

/**
 * Ordonne des entrées selon la préférence du profil : faciles d'abord en Soutien,
 * difficiles d'abord en Défi, ordre aléatoire en Standard. À difficulté égale,
 * l'ordre est aléatoire (mélange préalable puis tri stable).
 */
export function orderByProfile<T>(
  entries: readonly T[],
  difficultyOf: (entry: T) => Difficulty,
  profile: ProfileId,
  rng: Rng,
): T[] {
  const mixed = shuffle(entries, rng);
  if (profile === 'standard') return mixed;
  const rank = profile === 'soutien' ? RANK_SOUTIEN : RANK_DEFI;
  return mixed.sort((a, b) => rank[difficultyOf(a)] - rank[difficultyOf(b)]);
}

/**
 * Mélange des options en évitant qu'une option se retrouve à la même position
 * que l'élément auquel elle répond (indice de surface par alignement).
 */
export function arrangeAgainst(
  options: readonly string[],
  anchors: readonly string[],
  correctOf: ReadonlyMap<string, string>,
  rng: Rng,
): string[] {
  const aligned = (arr: readonly string[]) =>
    anchors.some((anchor, i) => i < arr.length && arr[i] === correctOf.get(anchor));
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = shuffle(options, rng);
    if (!aligned(candidate)) return candidate;
  }
  // Repli : rotations successives d'un mélange jusqu'à trouver un arrangement sans alignement.
  let rotated = shuffle(options, rng);
  for (let k = 0; k < rotated.length; k++) {
    if (!aligned(rotated)) return rotated;
    rotated = rotated.slice(1).concat(rotated[0]);
  }
  return rotated;
}
