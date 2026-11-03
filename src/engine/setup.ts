import type { Activity, MechanicId, ProfileId } from './types.js';
import type { ProfileParams } from './profiles.js';
import type { RoundState } from './round.js';
import type { Rng } from './rng.js';
import { setupAssocier } from './associer.js';
import { setupTrier } from './trier.js';
import { setupOrdre } from './ordre.js';
import { setupPlacer } from './placer.js';

/** Prépare un tour pour la mécanique demandée. Vérifier `availableMechanics` avant : lève une erreur sinon. */
export function setupRound(
  activity: Activity,
  mechanic: MechanicId,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  switch (mechanic) {
    case 'associer':
      return setupAssocier(activity, profile, rng, overrides);
    case 'trier':
      return setupTrier(activity, profile, rng, overrides);
    case 'ordre':
      return setupOrdre(activity, profile, rng, overrides);
    case 'placer':
      return setupPlacer(activity, profile, rng, overrides);
  }
}
