import type { Activity, MechanicId, ProfileId } from './types.js';
import type { ProfileParams } from './profiles.js';
import type { RoundState } from './round.js';
import type { Rng } from './rng.js';
import { mecanique } from './mecaniques.js';

/** Prépare un tour pour la mécanique demandée. Vérifier `availableMechanics` avant : lève une erreur sinon. */
export function setupRound(
  activity: Activity,
  mechanic: MechanicId,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  return mecanique(mechanic).setup(activity, profile, rng, overrides);
}
