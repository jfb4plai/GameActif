import type { Activity, Comparison, MechanicId, Membership, Pair, Question } from './types.js';
import { parseNombre } from './nombres.js';

export interface MechanicAvailability {
  available: boolean;
  /** Message affichable à l'enseignant quand la mécanique n'est pas disponible. */
  missing: string | null;
}

/** Paires dont les deux éléments existent et sont distincts. */
export function validPairs(activity: Activity): Pair[] {
  const ids = new Set(activity.items.map((i) => i.id));
  return activity.pairs.filter((p) => ids.has(p.leftId) && ids.has(p.rightId) && p.leftId !== p.rightId);
}

/** Questions dont l'item, la bonne réponse et 1 à 3 fausses réponses distinctes existent. */
export function validQuestions(activity: Activity): Question[] {
  const ids = new Set(activity.items.map((i) => i.id));
  return (activity.questions ?? []).filter(
    (q) =>
      ids.has(q.itemId) &&
      ids.has(q.correctId) &&
      q.distractorIds.length >= 1 &&
      q.distractorIds.length <= 3 &&
      q.distractorIds.every((d) => ids.has(d) && d !== q.correctId),
  );
}

/** Comparaisons dont les deux nombres sont lisibles. */
export function validComparisons(activity: Activity): Comparison[] {
  return (activity.comparisons ?? []).filter((c) => parseNombre(c.left) !== null && parseNombre(c.right) !== null);
}

/**
 * Classements valides ; un élément classé deux fois garde sa première catégorie.
 * `zone` choisit le type de catégorie : familles de Trier (faux, par défaut) ou zones d'une scène (vrai).
 */
export function validMemberships(activity: Activity, zone = false): Membership[] {
  const items = new Set(activity.items.map((i) => i.id));
  const cats = new Set(activity.categories.filter((c) => !!c.zone === zone).map((c) => c.id));
  const seen = new Set<string>();
  const out: Membership[] = [];
  for (const m of activity.memberships) {
    if (!items.has(m.itemId) || !cats.has(m.categoryId) || seen.has(m.itemId)) continue;
    seen.add(m.itemId);
    out.push(m);
  }
  return out;
}

/** Éléments ordonnés par position, ou null si les positions ne forment pas 1..n (n >= 3). */
export function rankedItemIds(activity: Activity): string[] | null {
  const items = new Set(activity.items.map((i) => i.id));
  const ranks = activity.ranks.filter((r) => items.has(r.itemId)).sort((a, b) => a.position - b.position);
  if (ranks.length < 3) return null;
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i].position !== i + 1) return null;
  }
  const ids = ranks.map((r) => r.itemId);
  return new Set(ids).size === ids.length ? ids : null;
}

export function availableMechanics(activity: Activity): Record<MechanicId, MechanicAvailability> {
  const memberships = validMemberships(activity);
  const filledCategories = new Set(memberships.map((m) => m.categoryId));

  let trier: MechanicAvailability = { available: true, missing: null };
  if (filledCategories.size < 2) {
    trier = { available: false, missing: 'Il faut au moins 2 catégories contenant chacune un élément.' };
  } else if (memberships.length < 3) {
    trier = { available: false, missing: 'Il faut au moins 3 éléments classés.' };
  }

  const placements = validMemberships(activity, true);
  const filledZones = new Set(placements.map((m) => m.categoryId));
  let placer: MechanicAvailability = { available: true, missing: null };
  if (!activity.sceneId) {
    placer = { available: false, missing: 'Il faut choisir une scène.' };
  } else if (filledZones.size < 2) {
    placer = { available: false, missing: 'Il faut au moins 2 zones contenant chacune une consigne.' };
  } else if (placements.length < 3) {
    placer = { available: false, missing: 'Il faut au moins 3 consignes.' };
  }

  return {
    associer:
      validPairs(activity).length >= 2
        ? { available: true, missing: null }
        : { available: false, missing: 'Il faut au moins 2 paires.' },
    trier,
    memo:
      validPairs(activity).length >= 2
        ? { available: true, missing: null }
        : { available: false, missing: 'Il faut au moins 2 paires.' },
    comparer:
      validComparisons(activity).length >= 3
        ? { available: true, missing: null }
        : { available: false, missing: 'Il faut au moins 3 comparaisons valides.' },
    qcm:
      validQuestions(activity).length >= 3
        ? { available: true, missing: null }
        : { available: false, missing: 'Il faut au moins 3 questions avec une bonne réponse et une fausse réponse.' },
    ordre:
      rankedItemIds(activity) !== null
        ? { available: true, missing: null }
        : { available: false, missing: 'Il faut au moins 3 éléments avec des positions 1, 2, 3…' },
    placer,
  };
}
