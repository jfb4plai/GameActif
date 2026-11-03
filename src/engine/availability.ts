import type { Activity, MechanicId, Membership, Pair } from './types.js';

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

/** Classements valides ; un élément classé deux fois garde sa première catégorie. */
export function validMemberships(activity: Activity): Membership[] {
  const items = new Set(activity.items.map((i) => i.id));
  const cats = new Set(activity.categories.map((c) => c.id));
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

  return {
    associer:
      validPairs(activity).length >= 2
        ? { available: true, missing: null }
        : { available: false, missing: 'Il faut au moins 2 paires.' },
    trier,
    ordre:
      rankedItemIds(activity) !== null
        ? { available: true, missing: null }
        : { available: false, missing: 'Il faut au moins 3 éléments avec des positions 1, 2, 3…' },
  };
}
