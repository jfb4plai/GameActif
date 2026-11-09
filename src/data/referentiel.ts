import maths from '../../data/referentiel-maths.json';
import francais from '../../data/referentiel-francais.json';

/** Un attendu du référentiel FWB (mathématiques et français, P1 à P6), produit par `scripts/build-referentiel.mjs`. */
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

/** Mathématiques d'abord, puis français (rubriques) : l'ordre est celui des matières proposées au parcours. */
export const REFERENTIEL: readonly ReferentielEntry[] = [...(maths as ReferentielEntry[]), ...(francais as ReferentielEntry[])];

export function referentielCodes(): ReadonlySet<string> {
  return new Set(REFERENTIEL.map((e) => e.code));
}
