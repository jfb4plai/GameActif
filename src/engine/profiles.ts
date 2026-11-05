import type { ProfileId } from './types.js';

export interface ProfileParams {
  /** Nombre maximal d'éléments joués dans un tour. */
  maxItems: number;
  /** Options sans partenaire ajoutées en Associer. */
  distractors: number;
  /** Nombre maximal de catégories affichées en Trier. */
  maxCategories: number;
  /** Indices disponibles par tour (un indice écarte une mauvaise option). */
  hintsPerRound: number;
  /** Essais ratés avant révélation de la bonne réponse ; null = illimité. */
  maxTries: number | null;
  /** Nombre de réponses affichées par question (QCM), bonne réponse comprise. */
  choices: number;
  readAloud: boolean;
  visualAids: boolean;
}

/** Valeurs par défaut, à ajuster après les premiers usages réels. */
export const PROFILES: Record<ProfileId, ProfileParams> = {
  soutien: {
    maxItems: 4,
    distractors: 0,
    maxCategories: 2,
    hintsPerRound: 8,
    maxTries: null,
    choices: 2,
    readAloud: true,
    visualAids: true,
  },
  standard: {
    maxItems: 6,
    distractors: 0,
    maxCategories: 3,
    hintsPerRound: 3,
    maxTries: null,
    choices: 3,
    readAloud: false,
    visualAids: false,
  },
  defi: {
    maxItems: 8,
    distractors: 2,
    maxCategories: 4,
    hintsPerRound: 0,
    maxTries: 3,
    choices: 4,
    readAloud: false,
    visualAids: false,
  },
};

export const PROFILE_LABELS: Record<ProfileId, string> = {
  soutien: 'Soutien',
  standard: 'Standard',
  defi: 'Défi',
};
