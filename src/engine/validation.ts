import type { Activity, Item } from './types.js';
import { availableMechanics } from './availability.js';

/** Problèmes de structure (références cassées, doublons). Liste vide = structure saine. */
export function validateActivity(activity: Activity): string[] {
  const issues: string[] = [];

  const seen = new Set<string>();
  for (const id of [...activity.items.map((i) => i.id), ...activity.categories.map((c) => c.id)]) {
    if (seen.has(id)) issues.push(`Identifiant en double : ${id}`);
    seen.add(id);
  }

  const itemIds = new Set(activity.items.map((i) => i.id));
  const catIds = new Set(activity.categories.map((c) => c.id));

  for (const p of activity.pairs) {
    if (!itemIds.has(p.leftId) || !itemIds.has(p.rightId)) {
      issues.push(`Paire avec un élément inconnu : ${p.leftId} / ${p.rightId}`);
    } else if (p.leftId === p.rightId) {
      issues.push(`Paire d’un élément avec lui-même : ${p.leftId}`);
    }
  }

  const classed = new Set<string>();
  for (const m of activity.memberships) {
    if (!itemIds.has(m.itemId)) issues.push(`Classement d’un élément inconnu : ${m.itemId}`);
    else if (!catIds.has(m.categoryId)) issues.push(`Catégorie inconnue : ${m.categoryId}`);
    else if (classed.has(m.itemId)) issues.push(`Élément classé dans deux catégories : ${m.itemId}`);
    else classed.add(m.itemId);
  }

  const ranked = new Set<string>();
  const positions = new Set<number>();
  for (const r of activity.ranks) {
    if (!itemIds.has(r.itemId)) issues.push(`Rang d’un élément inconnu : ${r.itemId}`);
    else if (ranked.has(r.itemId)) issues.push(`Élément classé deux fois dans l’ordre : ${r.itemId}`);
    else ranked.add(r.itemId);
    if (positions.has(r.position)) issues.push(`Position en double : ${r.position}`);
    positions.add(r.position);
  }

  return issues;
}

/** Règles de publication du split 80/20 : contexte, validation de chaque élément, structure saine. */
export function canPublish(activity: Activity): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (activity.context.trim() === '') reasons.push('Le contexte de classe est obligatoire.');
  const pending = activity.items.filter((i) => !i.validated).length;
  if (pending > 0) reasons.push(`${pending} élément(s) pas encore validé(s).`);
  reasons.push(...validateActivity(activity));
  if (!Object.values(availableMechanics(activity)).some((m) => m.available)) {
    reasons.push('Aucune mécanique disponible : complétez au moins une relation.');
  }
  return { ok: reasons.length === 0, reasons };
}

/** Miroir pour l'enseignant : parmi les éléments proposés par l'IA, combien ont été retouchés. */
export function editStats(items: readonly Item[]): { total: number; modified: number; unchanged: number } {
  const proposed = items.filter((i) => i.origin === 'ia');
  const modified = proposed.filter((i) => i.modified).length;
  return { total: proposed.length, modified, unchanged: proposed.length - modified };
}
