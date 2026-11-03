import type { Activity, Item } from '../engine/types.js';

function mot(id: string, text: string): Item {
  return { id, text, difficulty: 'moyen', validated: false, origin: 'manuel', modified: false };
}

/**
 * Activité d'exemple : maths P4, sous-point 1.1 (vocabulaire de position). Les mots viennent mot pour mot des
 * attendus du référentiel. Exemple non relu par un enseignant : aucun élément n'est validé.
 */
export function activitePilote(): Activity {
  return {
    id: 'pilote-p4-1-1',
    title: 'Les positions dans l’espace',
    discipline: 'Mathématiques',
    year: '4e primaire',
    context: 'Exemple non relu : à adapter à votre classe avant de le proposer aux élèves.',
    cibles: ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3', 'M.P4.1.1.i2.a2'],
    sceneId: 'chat-table-boite-arbres',
    items: [
      mot('a-int', 'à l\'intérieur'),
      mot('a-ext', 'à l\'extérieur'),
      mot('a-ent', 'entre'),
      mot('r-dev', 'devant'),
      mot('r-der', 'derrière'),
      mot('r-gau', 'à gauche'),
      mot('r-dro', 'à droite'),
      mot('r-dss', 'au-dessus'),
      mot('r-dsb', 'en dessous'),
      mot('o-1', 'premier'),
      mot('o-2', 'deuxième'),
      mot('o-3', 'troisième'),
      mot('o-4', 'dernier'),
      mot('k1', 'Pose le chat sur la table.'),
      mot('k2', 'Pose le chat sous la table.'),
      mot('k3', 'Pose le chat dans la boîte.'),
      mot('k4', 'Pose le chat entre les deux arbres.'),
    ],
    categories: [
      { id: 'c-abs', label: 'Position absolue' },
      { id: 'c-rel', label: 'Position relative (liée au regard)' },
      { id: 'c-ord', label: 'Position ordinale (rang)' },
      { id: 'z-sur', label: 'sur la table', zone: true },
      { id: 'z-sous', label: 'sous la table', zone: true },
      { id: 'z-dans', label: 'dans la boîte', zone: true },
      { id: 'z-entre', label: 'entre les deux arbres', zone: true },
    ],
    pairs: [
      { leftId: 'a-int', rightId: 'a-ext' },
      { leftId: 'r-dev', rightId: 'r-der' },
      { leftId: 'r-gau', rightId: 'r-dro' },
      { leftId: 'r-dss', rightId: 'r-dsb' },
    ],
    memberships: [
      { itemId: 'a-int', categoryId: 'c-abs' },
      { itemId: 'a-ext', categoryId: 'c-abs' },
      { itemId: 'a-ent', categoryId: 'c-abs' },
      { itemId: 'r-dev', categoryId: 'c-rel' },
      { itemId: 'r-der', categoryId: 'c-rel' },
      { itemId: 'r-gau', categoryId: 'c-rel' },
      { itemId: 'o-1', categoryId: 'c-ord' },
      { itemId: 'o-2', categoryId: 'c-ord' },
      { itemId: 'o-4', categoryId: 'c-ord' },
      { itemId: 'k1', categoryId: 'z-sur' },
      { itemId: 'k2', categoryId: 'z-sous' },
      { itemId: 'k3', categoryId: 'z-dans' },
      { itemId: 'k4', categoryId: 'z-entre' },
    ],
    ranks: [
      { itemId: 'o-1', position: 1 },
      { itemId: 'o-2', position: 2 },
      { itemId: 'o-3', position: 3 },
      { itemId: 'o-4', position: 4 },
    ],
  };
}
