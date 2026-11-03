import type { MechanicId } from '../engine/types.js';
import { REFERENTIEL, type ReferentielEntry } from '../data/referentiel.js';

export type Support = 'numerique' | 'physique';

export interface ProgrammeLink {
  code: string;
  /** Texte officiel de l'attendu, ou « Attendu introuvable ». */
  texte: string;
  /** Ce que le jeu travaille et ne travaille pas ; null = à compléter par l'enseignant. */
  phrase: string | null;
  /** Attendu travaillé en plus par le jeu physique, absent des cibles de l'activité. */
  extraEnClasse: boolean;
}

interface PhrasePilote {
  mechanic: MechanicId;
  codes: string[];
  numerique: string;
  physique: string;
  extraCodes?: string[];
  extraPhysique?: string;
}

const A1 = 'M.P4.1.1.i1.a1';
const A2 = 'M.P4.1.1.i1.a2';
const A3 = 'M.P4.1.1.i1.a3';
const PLACE_2D = 'M.P4.1.1.i2.a2';
const DEPLACE_3D = 'M.P4.1.1.i3.a1';

/**
 * Phrases écrites à l'avance pour les attendus du pilote (maths P4, sous-point 1.1) ; copie de l'avenant §12.
 * Aucune phrase n'existe pour les autres attendus : l'interface affiche alors « À compléter par l'enseignant ».
 */
export const PHRASES_PILOTE: readonly PhrasePilote[] = [
  {
    mechanic: 'trier',
    codes: [A1, A2, A3],
    numerique:
      'Les élèves rangent chaque mot dans sa famille de position. Le jeu fait reconnaître le vocabulaire de l\'attendu ; il ne montre pas si l\'élève sait l\'employer dans une phrase.',
    physique:
      'Les élèves rangent chaque mot dans sa famille de position. Le jeu fait manipuler le vocabulaire de l\'attendu ; il ne montre pas si l\'élève sait l\'employer dans une phrase.',
  },
  {
    mechanic: 'associer',
    codes: [A1, A2],
    numerique:
      'Les élèves relient des mots de position contraires (devant et derrière, à droite et à gauche). Le jeu travaille le sens de ces mots ; il ne travaille pas leur emploi en situation.',
    physique:
      'Les élèves relient des mots de position contraires (devant et derrière, à droite et à gauche). Le jeu travaille le sens de ces mots ; il ne travaille pas leur emploi en situation.',
  },
  {
    mechanic: 'ordre',
    codes: [A3],
    numerique:
      'Les élèves rangent les mots premier, deuxième, troisième, dernier dans l\'ordre. Le jeu travaille le vocabulaire ordinal ; il ne travaille pas avant et après.',
    physique:
      'Les élèves se rangent dans l\'ordre premier, deuxième, troisième, dernier. Le corps vit le vocabulaire ordinal ; le jeu ne travaille pas avant et après.',
  },
  {
    mechanic: 'placer',
    codes: [A1, PLACE_2D],
    numerique:
      'Les élèves placent un objet dessiné selon une consigne de position. Le jeu ne travaille pas les positions relatives, qui dépendent du point de vue, ni le placement dans l\'espace réel.',
    physique:
      'Les élèves placent un objet selon une consigne de position. En classe, ils déplacent un objet réel, ce que l\'écran ne permet pas. Le jeu ne travaille pas les positions relatives, qui dépendent du point de vue.',
    extraCodes: [DEPLACE_3D],
    extraPhysique:
      'En classe, l\'élève acteur déplace un objet doux en suivant une consigne orale lue à voix basse. L\'écran ne permet pas ce déplacement dans l\'espace réel.',
  },
];

const introuvable = (code: string): ProgrammeLink => ({
  code,
  texte: 'Attendu introuvable',
  phrase: null,
  extraEnClasse: false,
});

/**
 * Liens entre un jeu et les attendus visés par l'activité. Pour le jeu physique, ajoute les attendus
 * que seul le jeu en classe atteint (signalés `extraEnClasse`), s'ils ne sont pas déjà ciblés.
 */
export function programmeLinks(
  mechanic: MechanicId,
  support: Support,
  cibles: readonly string[],
  ref: readonly ReferentielEntry[] = REFERENTIEL,
): ProgrammeLink[] {
  const entry = PHRASES_PILOTE.find((p) => p.mechanic === mechanic);
  const texteOf = (code: string) => ref.find((e) => e.code === code)?.texte;

  const links: ProgrammeLink[] = cibles.map((code) => {
    const texte = texteOf(code);
    if (texte === undefined) return introuvable(code);
    const phrase = entry && entry.codes.includes(code) ? entry[support] : null;
    return { code, texte, phrase, extraEnClasse: false };
  });

  if (support === 'physique' && entry?.extraCodes && entry.extraPhysique) {
    for (const code of entry.extraCodes) {
      if (cibles.includes(code)) continue;
      const texte = texteOf(code);
      links.push(texte === undefined ? introuvable(code) : { code, texte, phrase: entry.extraPhysique, extraEnClasse: true });
    }
  }
  return links;
}
