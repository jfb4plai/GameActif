import type { Activity, ProfileId } from './types.js';
import type { ProfileParams } from './profiles.js';
import type { RoundState } from './round.js';
import type { Rng } from './rng.js';
import { setupTrier } from './trier.js';

/**
 * Placer dans une scène : chaque consigne désigne une zone de la scène (« Pose le chat sous la table »).
 * Au niveau du moteur c'est un choix de zone, comme Trier : on réutilise sa mise en place (consignes limitées
 * par le profil, ordre d'écriture cassé). Différences : les zones sont dessinées dans la scène, donc elles
 * restent toutes affichées (le profil ne limite que les consignes) et gardent l'ordre de la scène.
 * Le glisser du chat vers une zone (coordonnées) relève du rendu, pas du moteur.
 */
export function setupPlacer(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  if (!activity.sceneId) throw new Error('Placer indisponible : il faut choisir une scène.');

  let base: RoundState;
  try {
    base = setupTrier(activity, profile, rng, { maxCategories: Number.MAX_SAFE_INTEGER, ...overrides });
  } catch {
    throw new Error('Placer indisponible : il faut au moins 2 zones contenant chacune une consigne.');
  }

  const used = new Set(base.options);
  return {
    ...base,
    mechanic: 'placer',
    sceneId: activity.sceneId,
    options: activity.categories.map((c) => c.id).filter((id) => used.has(id)),
  };
}
