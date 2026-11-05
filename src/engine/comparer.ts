import type { Activity, ProfileId } from './types.js';
import { PROFILES, type ProfileParams } from './profiles.js';
import { createRound, type RoundState } from './round.js';
import { orderByProfile } from './select.js';
import type { Rng } from './rng.js';
import { validComparisons } from './availability.js';
import { parseNombre, symboleJuste } from './nombres.js';

/** Espace affiché entre les deux nombres : l'élève y place le symbole. */
export const COMPARE_GAP = ' ▢ ';

/** Les trois symboles proposés, dans l'ordre fixe d'affichage. `nom` est lu aux lecteurs d'écran. */
export const SYMBOLES = [
  { id: '>', signe: '>', nom: 'plus grand que' },
  { id: '<', signe: '<', nom: 'plus petit que' },
  { id: '=', signe: '=', nom: 'égal à' },
] as const;

/** Sépare le libellé d'une comparaison en ses deux nombres. */
export function splitComparaison(label: string): [string, string] {
  const i = label.indexOf(COMPARE_GAP);
  if (i < 0) return [label, ''];
  return [label.slice(0, i), label.slice(i + COMPARE_GAP.length)];
}

/**
 * Comparer : pour chaque paire de nombres, choisir le symbole. Le symbole juste est calculé ici,
 * jamais saisi : l'enseignant ne peut pas fabriquer une réponse fausse.
 */
export function setupComparer(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  const params = { ...PROFILES[profile], ...overrides };
  const valid = validComparisons(activity);
  if (valid.length < 3) throw new Error('Comparer indisponible : il faut au moins 3 comparaisons valides.');

  const retained = orderByProfile(valid, () => 'moyen', profile, rng).slice(0, params.maxItems);
  const labels: Record<string, string> = {};
  for (const s of SYMBOLES) labels[s.id] = s.signe;
  for (const c of retained) labels[c.id] = `${c.left}${COMPARE_GAP}${c.right}`;

  return createRound({
    mechanic: 'comparer',
    exclusive: false,
    elements: retained.map((c) => ({
      id: c.id,
      correct: symboleJuste(parseNombre(c.left) as number, parseNombre(c.right) as number),
    })),
    options: SYMBOLES.map((s) => s.id),
    labels,
    hintsLeft: params.hintsPerRound,
    maxTries: params.maxTries,
  });
}
