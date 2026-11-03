import donnees from '../../data/referentiel-maths.json';

/** Un attendu du référentiel FWB (mathématiques P1 à P6), produit par `scripts/build-referentiel.mjs`. */
export interface ReferentielEntry {
  code: string;
  annee: string;
  matiere: string;
  item_type: string;
  sous_point: string;
  sous_point_titre: string;
  item_contenu: string;
  texte: string;
}

export const REFERENTIEL: readonly ReferentielEntry[] = donnees as ReferentielEntry[];

export function referentielCodes(): ReadonlySet<string> {
  return new Set(REFERENTIEL.map((e) => e.code));
}
