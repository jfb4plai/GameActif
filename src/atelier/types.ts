/** Une famille de Trier : un nom et ses éléments, un par ligne. */
export interface Famille {
  label: string;
  elements: string;
}

/** Ce que l'enseignant a saisi dans le parcours. Le texte brut est conservé tel quel jusqu'à la construction. */
export interface Brouillon {
  niveau: string;
  matiere: string;
  /** Codes d'attendus visés (1 à 3). */
  cibles: string[];
  titre: string;
  /** Contexte de classe, obligatoire. Aucun nom d'élève. */
  contexte: string;
  familles: Famille[];
  /** Une paire par ligne : « gauche | droite ». */
  paires: string;
  /** Une étape par ligne, dans l'ordre. */
  etapes: string;
  /** Une comparaison par ligne : « gauche | droite » (deux nombres) ; le symbole juste est calculé. */
  comparaisons: string;
  /** Une question par ligne : « question | bonne réponse | fausse 1 | fausse 2 | fausse 3 ». */
  qcm: string;
}

/** Brouillon tel qu'il peut être relu d'un ancien stockage ou fichier : sans les champs ajoutés plus tard. */
export type BrouillonLu = Omit<Brouillon, 'comparaisons' | 'qcm'> & Partial<Pick<Brouillon, 'comparaisons' | 'qcm'>>;

export interface Ligne {
  numero: number;
  message: string;
}
