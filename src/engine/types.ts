export type Difficulty = 'facile' | 'moyen' | 'difficile';
export type ProfileId = 'soutien' | 'standard' | 'defi';
export type MechanicId = 'associer' | 'trier' | 'ordre';

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

export interface Activity {
  id: string;
  title: string;
  discipline: string;
  year: string;
  /** Contexte de classe : obligatoire pour publier. */
  context: string;
  /** Codes d'attendus du référentiel FWB visés (1 à 3), forme `M.P4.1.1.i1.a1`. Obligatoires pour publier. */
  cibles: string[];
  items: Item[];
  categories: Category[];
  pairs: Pair[];
  memberships: Membership[];
  ranks: Rank[];
}
