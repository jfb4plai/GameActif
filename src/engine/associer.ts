import type { Activity, ProfileId } from './types.js';
import { PROFILES, type ProfileParams } from './profiles.js';
import { createRound, type RoundState } from './round.js';
import { arrangeAgainst, orderByProfile } from './select.js';
import { shuffleNoFixedPoint, type Rng } from './rng.js';
import { validPairs } from './availability.js';

/**
 * Associer : pour chaque élément de gauche, choisir son partenaire parmi les options de droite.
 * Les paires non retenues par le profil servent de distracteurs (leur partenaire de droite reste sans correspondant).
 */
export function setupAssocier(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  const params = { ...PROFILES[profile], ...overrides };
  const pairs = validPairs(activity);
  if (pairs.length < 2) throw new Error('Associer indisponible : il faut au moins 2 paires.');

  const difficulty = new Map(activity.items.map((i) => [i.id, i.difficulty] as const));
  const ordered = orderByProfile(pairs, (p) => difficulty.get(p.leftId) ?? 'moyen', profile, rng);
  const active = ordered.slice(0, params.maxItems);
  const distractors = ordered.slice(params.maxItems, params.maxItems + params.distractors);

  const activeSet = new Set(active);
  const authoringLefts = pairs.filter((p) => activeSet.has(p)).map((p) => p.leftId);
  const lefts = shuffleNoFixedPoint(authoringLefts, rng);

  const correctOf = new Map(active.map((p) => [p.leftId, p.rightId] as const));
  const rights = arrangeAgainst([...active, ...distractors].map((p) => p.rightId), lefts, correctOf, rng);

  const labels: Record<string, string> = {};
  for (const item of activity.items) labels[item.id] = item.text;

  return createRound({
    mechanic: 'associer',
    exclusive: true,
    elements: lefts.map((id) => ({ id, correct: correctOf.get(id) as string })),
    options: rights,
    labels,
    hintsLeft: params.hintsPerRound,
    maxTries: params.maxTries,
  });
}
