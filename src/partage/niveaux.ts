import type { ProfileId } from '../engine/types.js';
import type { Groupe } from './lien.js';

/**
 * Noms montrés à l'élève : neutres, ils ne disent pas le niveau. Provisoires : JF les fixe avec l'équipe.
 * Le nom « Soutien » ne s'affiche jamais chez l'élève (voir `PROFILE_LABELS` pour la vue enseignant).
 */
export const NOMS_NEUTRES: Record<ProfileId, string> = {
  soutien: 'Pas à pas',
  standard: 'Équilibre',
  defi: 'Défi',
};

/** Couleur neutre de chaque groupe du mode « un lien par groupe ». Provisoire : JF les fixe. */
export const COULEURS_GROUPES: Record<Groupe, string> = {
  1: 'vert',
  2: 'bleu',
  3: 'orange',
};

const ORDRE: ProfileId[] = ['soutien', 'standard', 'defi'];

/** Profil du groupe : 1 soutien, 2 standard, 3 défi ; sans groupe, standard. */
export function profilDuGroupe(g: Groupe | null): ProfileId {
  return g === 1 ? 'soutien' : g === 3 ? 'defi' : 'standard';
}

/** Le niveau juste au-dessus, ou null au plus haut. L'élève ne descend jamais. */
export function niveauAuDessus(p: ProfileId): ProfileId | null {
  return ORDRE[ORDRE.indexOf(p) + 1] ?? null;
}

/** Vrai quand le niveau joué est plus haut que le niveau attribué par l'enseignant (dépassement volontaire). */
export function estAuDessus(joue: ProfileId, attribue: ProfileId): boolean {
  return ORDRE.indexOf(joue) > ORDRE.indexOf(attribue);
}
