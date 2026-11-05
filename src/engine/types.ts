export type Difficulty = 'facile' | 'moyen' | 'difficile';
export type ProfileId = 'soutien' | 'standard' | 'defi';
export type MechanicId = 'associer' | 'trier' | 'ordre' | 'placer' | 'comparer' | 'memo' | 'qcm';

export interface Item {
  id: string;
  text: string;
  imageUrl?: string;
  difficulty: Difficulty;
  /** Validé explicitement par l'enseignant (split 80/20). */
  validated: boolean;
  origin: 'ia' | 'manuel';
  /** Retouché par l'enseignant depuis la proposition de l'IA. */
  modified: boolean;
}

export interface Category {
  id: string;
  label: string;
  /** Zone d'une scène (mécanique « placer ») ; une zone n'est jamais une famille de Trier. */
  zone?: boolean;
}

/** Appariement élément ↔ élément (mécanique Associer). */
export interface Pair {
  leftId: string;
  rightId: string;
}

/** Appartenance élément → catégorie (mécanique Trier). */
export interface Membership {
  itemId: string;
  categoryId: string;
}

/** Rang élément → position, de 1 à n (mécanique Remettre en ordre). */
export interface Rank {
  itemId: string;
  position: number;
}

/** Comparaison de deux nombres tapés par l'enseignant (mécanique Comparer) ; le symbole juste est calculé. */
export interface Comparison {
  id: string;
  left: string;
  right: string;
}

/** Question à choix (mécanique QCM) : l'item question, sa bonne réponse et ses fausses réponses (1 à 3). */
export interface Question {
  itemId: string;
  correctId: string;
  distractorIds: string[];
}

export interface Activity {
  id: string;
  title: string;
  discipline: string;
  year: string;
  /** Contexte de classe : obligatoire pour publier. */
  context: string;
  /** Codes d'attendus du référentiel FWB visés (1 à 3), forme `M.P4.1.1.i1.a1`. Obligatoires pour publier. */
  cibles: string[];
  /**
   * Scène choisie pour la mécanique « placer » (bibliothèque fixe PLAI). Les zones de la scène sont des
   * catégories, chaque consigne est un élément classé dans la zone attendue (memberships).
   */
  sceneId?: string;
  items: Item[];
  categories: Category[];
  pairs: Pair[];
  memberships: Membership[];
  ranks: Rank[];
  /** Mécanique Comparer ; absent = aucune. */
  comparisons?: Comparison[];
  /** Mécanique QCM ; absent = aucune. */
  questions?: Question[];
}
