import type { Activity, MechanicId, ProfileId } from './types.js';
import type { ProfileParams } from './profiles.js';
import type { RoundState } from './round.js';
import type { Rng } from './rng.js';
import { setupTrier } from './trier.js';
import { setupAssocier } from './associer.js';
import { setupMemo } from './memo.js';
import { setupOrdre } from './ordre.js';
import { setupComparer } from './comparer.js';
import { setupQcm } from './qcm.js';
import { setupPlacer } from './placer.js';

export interface MecaniqueDef {
  id: MechanicId;
  /** Nom affiché à l'enseignant. */
  label: string;
  /** Saisie possible dans l'atelier (faux pour Placer, qui passe par une scène). */
  atelier: boolean;
  setup: (activity: Activity, profile: ProfileId, rng: Rng, overrides?: Partial<ProfileParams>) => RoundState;
}

/**
 * Liste unique des mécaniques, dans l'ordre d'affichage. Ajouter une mécanique = un module `setupX` + une ligne ici
 * (plus son entrée dans `availableMechanics`, `PHYSICAL_TEMPLATES` et un plateau dans `ui/plateaux.tsx`).
 */
export const MECANIQUES: readonly MecaniqueDef[] = [
  { id: 'trier', label: 'Trier', atelier: true, setup: setupTrier },
  { id: 'associer', label: 'Associer', atelier: true, setup: setupAssocier },
  { id: 'memo', label: 'Mémo', atelier: true, setup: setupMemo },
  { id: 'ordre', label: 'Remettre en ordre', atelier: true, setup: setupOrdre },
  { id: 'comparer', label: 'Comparer', atelier: true, setup: setupComparer },
  { id: 'qcm', label: 'QCM libre', atelier: true, setup: setupQcm },
  { id: 'placer', label: 'Placer dans une scène', atelier: false, setup: setupPlacer },
];

/**
 * Ordre d'affichage selon le niveau (libellé « 3e primaire ») : de la 1re à la 3e, Associer passe en tête ; ensuite,
 * ou si le niveau n'est pas reconnu, l'ordre de MECANIQUES est conservé. Choix de l'enseignant, sans source scientifique.
 */
export function ordreAffichage(annee: string): readonly MecaniqueDef[] {
  const n = Number(/^(\d)(?:re|e) primaire$/.exec(annee)?.[1]);
  if (!(n >= 1 && n <= 3)) return MECANIQUES;
  const associer = MECANIQUES.find((m) => m.id === 'associer');
  return associer ? [associer, ...MECANIQUES.filter((m) => m !== associer)] : MECANIQUES;
}

export function mecanique(id: MechanicId): MecaniqueDef {
  const m = MECANIQUES.find((x) => x.id === id);
  if (!m) throw new Error(`Mécanique inconnue : ${id}`);
  return m;
}
