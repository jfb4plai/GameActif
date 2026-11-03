import type { Activity, ProfileId } from './types.js';
import { PROFILES, type ProfileParams } from './profiles.js';
import { createRound, type RoundState } from './round.js';
import { shuffleNoFixedPoint, type Rng } from './rng.js';
import { rankedItemIds } from './availability.js';

/**
 * Remettre en ordre : placer chaque étape dans sa position (cases numérotées).
 * Le profil limite la longueur : on joue une fenêtre d'étapes consécutives, renumérotée à partir de 1.
 * Les identifiants de position sont préfixés (`pos-1`…) pour ne jamais entrer en collision avec des identifiants d'éléments.
 */
export function setupOrdre(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  const params = { ...PROFILES[profile], ...overrides };
  const ids = rankedItemIds(activity);
  if (!ids) throw new Error('Ordre indisponible : il faut au moins 3 éléments avec des positions 1, 2, 3…');

  const size = Math.min(params.maxItems, ids.length);
  const start = Math.floor(rng() * (ids.length - size + 1));
  const windowIds = ids.slice(start, start + size);
  const positions = windowIds.map((_, k) => `pos-${k + 1}`);
  const correctOf = new Map(windowIds.map((id, k) => [id, positions[k]] as const));

  const labels: Record<string, string> = {};
  for (const item of activity.items) labels[item.id] = item.text;
  positions.forEach((p, k) => {
    labels[p] = String(k + 1);
  });

  return createRound({
    mechanic: 'ordre',
    exclusive: true,
    elements: shuffleNoFixedPoint(windowIds, rng).map((id) => ({ id, correct: correctOf.get(id) as string })),
    options: positions,
    labels,
    hintsLeft: params.hintsPerRound,
    maxTries: params.maxTries,
  });
}
