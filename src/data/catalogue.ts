import { REFERENTIEL, type ReferentielEntry } from './referentiel.js';

export interface Matiere {
  id: string;
  label: string;
}

export interface GroupeCompetences {
  sousPoint: string;
  titre: string;
  attendus: ReferentielEntry[];
}

const LIBELLES_MATIERES: Record<string, string> = { mathematiques: 'Mathématiques' };

/** Niveaux présents dans les données, de P1 à P6. */
export function niveaux(): string[] {
  return [...new Set(REFERENTIEL.map((e) => e.annee))].sort();
}

export function matieres(niveau: string): Matiere[] {
  const ids = [...new Set(REFERENTIEL.filter((e) => e.annee === niveau).map((e) => e.matiere))];
  return ids.map((id) => ({ id, label: LIBELLES_MATIERES[id] ?? id }));
}

/** Attendus d'un niveau et d'une matière, groupés par sous-point dans l'ordre du référentiel. */
export function competences(niveau: string, matiere: string): GroupeCompetences[] {
  const groupes = new Map<string, GroupeCompetences>();
  for (const e of REFERENTIEL) {
    if (e.annee !== niveau || e.matiere !== matiere) continue;
    let g = groupes.get(e.sous_point);
    if (!g) {
      g = { sousPoint: e.sous_point, titre: e.sous_point_titre, attendus: [] };
      groupes.set(e.sous_point, g);
    }
    g.attendus.push(e);
  }
  return [...groupes.values()];
}

const simplifier = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Filtre les attendus sur leur texte officiel, sans tenir compte de la casse ni des accents. */
export function chercher(groupes: GroupeCompetences[], texte: string): GroupeCompetences[] {
  const q = simplifier(texte.trim());
  if (q === '') return groupes;
  return groupes
    .map((g) => ({ ...g, attendus: g.attendus.filter((a) => simplifier(a.texte).includes(q)) }))
    .filter((g) => g.attendus.length > 0);
}
