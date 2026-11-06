import textes from './textes.json';

export type AideId =
  | 'parcours-niveau'
  | 'parcours-matiere'
  | 'parcours-competences'
  | 'parcours-elements'
  | 'parcours-jeux'
  | 'proposer'
  | 'classes'
  | 'tableau'
  | 'niveaux'
  | 'eleve';

export interface Aide {
  public: 'enseignant' | 'eleve';
  /** Cinq au plus, courtes : l'aide ne doit jamais devenir un mur de texte. */
  puces: string[];
  /** Ce que l'écran ne fait pas (aides pour l'enseignant). */
  limite?: string;
  /** Chemins du dépôt où se vérifie chaque affirmation ; un test impose qu'ils existent. */
  sources: string[];
}

export const TITRE_AIDE = 'Comment utiliser cet écran';

/** Textes d'aide de chaque écran. Source unique : `textes.json` (affiché par `AideEcran`, repris par les modes d'emploi). */
export const AIDES = textes as Record<AideId, Aide>;
