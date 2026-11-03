import type { Activity, ProfileId } from './types.js';
import { PROFILES, type ProfileParams } from './profiles.js';
import { createRound, type RoundState } from './round.js';
import { orderByProfile } from './select.js';
import { shuffle, shuffleNoFixedPoint, type Rng } from './rng.js';
import { validMemberships } from './availability.js';

/**
 * Trier : pour chaque élément, choisir sa catégorie.
 * Le profil limite le nombre de catégories et d'éléments ; la sélection se fait en tourniquet
 * entre catégories pour que chacune reçoive au moins un élément.
 */
export function setupTrier(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  const params = { ...PROFILES[profile], ...overrides };
  const difficulty = new Map(activity.items.map((i) => [i.id, i.difficulty] as const));

  const byCategory = new Map<string, string[]>();
  for (const m of validMemberships(activity)) {
    const list = byCategory.get(m.categoryId) ?? [];
    list.push(m.itemId);
    byCategory.set(m.categoryId, list);
  }

  const shown = activity.categories.filter((c) => byCategory.has(c.id)).slice(0, params.maxCategories);
  if (shown.length < 2) throw new Error('Trier indisponible : il faut au moins 2 catégories contenant un élément.');

  const groups = shown.map((c) => ({
    categoryId: c.id,
    ids: orderByProfile(byCategory.get(c.id) as string[], (id) => difficulty.get(id) ?? 'moyen', profile, rng),
  }));

  const picked = new Map<string, string>();
  for (let round = 0; picked.size < params.maxItems; round++) {
    let added = false;
    for (const g of groups) {
      if (picked.size >= params.maxItems) break;
      const id = g.ids[round];
      if (id !== undefined) {
        picked.set(id, g.categoryId);
        added = true;
      }
    }
    if (!added) break;
  }

  const usedCategories = shown.filter((c) => [...picked.values()].includes(c.id));
  if (usedCategories.length < 2) throw new Error('Trier indisponible : il faut au moins 2 catégories contenant un élément.');

  const authoring = activity.items.map((i) => i.id).filter((id) => picked.has(id));
  const elements = shuffleNoFixedPoint(authoring, rng);

  const labels: Record<string, string> = {};
  for (const item of activity.items) labels[item.id] = item.text;
  for (const c of activity.categories) labels[c.id] = c.label;

  return createRound({
    mechanic: 'trier',
    exclusive: false,
    elements: elements.map((id) => ({ id, correct: picked.get(id) as string })),
    options: shuffle(usedCategories.map((c) => c.id), rng),
    labels,
    hintsLeft: params.hintsPerRound,
    maxTries: params.maxTries,
  });
}
