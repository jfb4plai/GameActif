import type { ElementResult } from '../engine/round.js';
import type { MechanicId, ProfileId } from '../engine/types.js';
import type { SessionResults } from '../engine/signals.js';

/** Résultat d'un élément tel qu'il est envoyé : le résultat du moteur plus la bonne réponse (pour nommer l'erreur). */
export interface ResultatEnvoye extends ElementResult {
  correct: string;
}

/**
 * Séance envoyée à la base. Aucun champ d'identité, aucun temps de réponse, aucun texte libre de l'élève :
 * les étiquettes viennent de la consigne de l'enseignant.
 */
export interface SessionPayload {
  sessionId: string;
  mechanic: MechanicId;
  profile: ProfileId;
  cibles: string[];
  totalElements: number;
  /** Date ISO de fin du tour. */
  endedAt: string;
  /** Étiquette affichable de chaque identifiant cité dans `results` (bonnes réponses et mauvais choix). */
  labels: Record<string, string>;
  results: ResultatEnvoye[];
  /** Tour joué au niveau au-dessus du profil attribué (dépassement volontaire). */
  above: boolean;
}

/** Séance relue côté enseignant : les signaux du moteur (`SessionResults`) plus l'attendu, la mécanique et les étiquettes. */
export interface SessionEnregistree extends SessionResults {
  cibles: string[];
  mechanic: MechanicId;
  labels: Record<string, string>;
  results: ResultatEnvoye[];
  origine: 'ecran';
  /** Tour joué au niveau au-dessus du profil attribué (dépassement volontaire). */
  above: boolean;
}
