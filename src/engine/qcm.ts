import type { Activity, ProfileId } from './types.js';
import { PROFILES, type ProfileParams } from './profiles.js';
import { createRound, type RoundState } from './round.js';
import { orderByProfile } from './select.js';
import { shuffle, type Rng } from './rng.js';
import { validQuestions } from './availability.js';

/**
 * QCM libre : pour chaque question, choisir la bonne réponse parmi quelques propositions.
 * Le profil fixe le nombre de réponses affichées ; les fausses retenues sont tirées dans celles saisies,
 * et la place de la bonne réponse est tirée au hasard (jamais l'ordre de saisie).
 */
export function setupQcm(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  const params = { ...PROFILES[profile], ...overrides };
  const valid = validQuestions(activity);
  if (valid.length < 3) throw new Error('QCM indisponible : il faut au moins 3 questions valides.');

  const difficulty = new Map(activity.items.map((i) => [i.id, i.difficulty] as const));
  const retained = orderByProfile(valid, (q) => difficulty.get(q.itemId) ?? 'moyen', profile, rng).slice(0, params.maxItems);

  const elements = retained.map((q) => ({
    id: q.itemId,
    correct: q.correctId,
    choices: shuffle([q.correctId, ...shuffle(q.distractorIds, rng).slice(0, Math.max(1, params.choices - 1))], rng),
  }));
  const options = [...new Set(elements.flatMap((e) => e.choices))];

  const labels: Record<string, string> = {};
  for (const item of activity.items) labels[item.id] = item.text;

  return createRound({
    mechanic: 'qcm',
    exclusive: false,
    elements,
    options,
    labels,
    hintsLeft: params.hintsPerRound,
    maxTries: params.maxTries,
  });
}
