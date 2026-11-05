import type { Activity, Difficulty, Item } from '../src/engine/types.js';
import { step, type RoundState } from '../src/engine/round.js';

function item(id: string, text: string, difficulty: Difficulty = 'moyen'): Item {
  return { id, text, difficulty, validated: true, origin: 'manuel', modified: false };
}

/** Activité d'exemple FWB (sciences, cycle et états de l'eau) avec les trois types de relations. */
export function eauActivity(): Activity {
  return {
    id: 'act-eau',
    title: 'L’eau dans la nature',
    discipline: 'Sciences',
    year: '2e primaire',
    context: 'Classe de 12 élèves, vocabulaire très simple, beaucoup de lecture à voix haute.',
    /** Code factice : l'exemple n'est pas rattaché à un attendu réel du jeu de données. */
    cibles: ['TEST.eau.1'],
    items: [
      item('a1', 'évaporation', 'facile'),
      item('b1', 'passage du liquide au gaz'),
      item('a2', 'condensation'),
      item('b2', 'passage du gaz au liquide'),
      item('a3', 'solidification', 'difficile'),
      item('b3', 'passage du liquide au solide'),
      item('a4', 'fusion'),
      item('b4', 'passage du solide au liquide'),
      item('t1', 'glace', 'facile'),
      item('t2', 'neige', 'facile'),
      item('t3', 'grêle', 'difficile'),
      item('t4', 'pluie', 'facile'),
      item('t5', 'rivière'),
      item('t6', 'rosée'),
      item('t7', 'vapeur d’eau'),
      item('o1', 'L’eau des océans chauffe'),
      item('o2', 'L’eau s’évapore'),
      item('o3', 'La vapeur forme des nuages'),
      item('o4', 'La pluie tombe'),
      item('o5', 'L’eau s’infiltre dans le sol'),
    ],
    categories: [
      { id: 'c1', label: 'Eau solide' },
      { id: 'c2', label: 'Eau liquide' },
      { id: 'c3', label: 'Eau gazeuse' },
    ],
    pairs: [
      { leftId: 'a1', rightId: 'b1' },
      { leftId: 'a2', rightId: 'b2' },
      { leftId: 'a3', rightId: 'b3' },
      { leftId: 'a4', rightId: 'b4' },
    ],
    memberships: [
      { itemId: 't1', categoryId: 'c1' },
      { itemId: 't2', categoryId: 'c1' },
      { itemId: 't3', categoryId: 'c1' },
      { itemId: 't4', categoryId: 'c2' },
      { itemId: 't5', categoryId: 'c2' },
      { itemId: 't6', categoryId: 'c2' },
      { itemId: 't7', categoryId: 'c3' },
    ],
    ranks: [
      { itemId: 'o1', position: 1 },
      { itemId: 'o2', position: 2 },
      { itemId: 'o3', position: 3 },
      { itemId: 'o4', position: 4 },
      { itemId: 'o5', position: 5 },
    ],
  };
}

/**
 * Activité « Place le chat » (mécanique placer) : les consignes sont des éléments, les zones de la scène
 * sont des catégories. Les libellés de zone sont des noms neutres de la scène, pas la consigne.
 */
export function sceneActivity(): Activity {
  return {
    id: 'act-scene',
    title: 'Place le chat',
    discipline: 'Mathématiques',
    year: '4e primaire',
    context: 'Classe de 18 élèves, vocabulaire de position travaillé la semaine passée.',
    cibles: ['TEST.scene.1'],
    sceneId: 'chat-table-boite-arbres',
    items: [
      item('k1', 'Pose le chat sur la table.'),
      item('k2', 'Pose le chat sous la table.'),
      item('k3', 'Pose le chat dans la boîte.'),
      item('k4', 'Pose le chat entre les deux arbres.'),
    ],
    categories: [
      { id: 'z-sur', label: 'sur la table', zone: true },
      { id: 'z-sous', label: 'sous la table', zone: true },
      { id: 'z-dans', label: 'dans la boîte', zone: true },
      { id: 'z-entre', label: 'entre les deux arbres', zone: true },
    ],
    pairs: [],
    memberships: [
      { itemId: 'k1', categoryId: 'z-sur' },
      { itemId: 'k2', categoryId: 'z-sous' },
      { itemId: 'k3', categoryId: 'z-dans' },
      { itemId: 'k4', categoryId: 'z-entre' },
    ],
    ranks: [],
  };
}

/** Activité qui propose Trier (familles de l'eau) ET Placer (zones de la scène) : les deux ne doivent pas se mélanger. */
export function mixedActivity(): Activity {
  const e = eauActivity();
  const s = sceneActivity();
  return {
    ...e,
    sceneId: s.sceneId,
    items: [...e.items, ...s.items],
    categories: [...e.categories, ...s.categories],
    memberships: [...e.memberships, ...s.memberships],
  };
}

/** Joue un tour en choisissant la bonne option pour chaque élément. */
export function solveAll(state: RoundState): RoundState {
  let s = state;
  for (const el of state.elements) {
    s = step(s, { type: 'choose', elementId: el.id, optionId: el.correct }).state;
  }
  return s;
}

/** Activité de comparaisons de nombres (entiers, décimaux, fractions). */
export function comparerActivity(): Activity {
  return {
    id: 'act-comparer',
    title: 'Plus grand, plus petit',
    discipline: 'Mathématiques',
    year: '4e primaire',
    context: 'Classe de 18 élèves, comparaison de nombres travaillée cette semaine.',
    cibles: ['TEST.comparer.1'],
    items: [],
    categories: [],
    pairs: [],
    memberships: [],
    ranks: [],
    comparisons: [
      { id: 'c1', left: '12', right: '8' },
      { id: 'c2', left: '3,5', right: '3,50' },
      { id: 'c3', left: '1/2', right: '3/4' },
      { id: 'c4', left: '7', right: '9' },
      { id: 'c5', left: '10', right: '2' },
    ],
  };
}

const SYMB = ['>', '<', '=', '≠'];

/** Activité de QCM : q1 à q4 ont 3 fausses réponses, q5 une seule. */
export function qcmActivity(): Activity {
  const items: Item[] = [];
  const questions: NonNullable<Activity['questions']> = [];
  for (let k = 1; k <= 5; k++) {
    items.push(item(`q${k}`, `Question ${k} sur les symboles ?`));
    const fausses = k === 5 ? 1 : 3;
    items.push(item(`q${k}r0`, `Bonne réponse ${k}`));
    const distractorIds: string[] = [];
    for (let j = 1; j <= fausses; j++) {
      items.push(item(`q${k}r${j}`, `${SYMB[j]} fausse ${k}.${j}`));
      distractorIds.push(`q${k}r${j}`);
    }
    questions.push({ itemId: `q${k}`, correctId: `q${k}r0`, distractorIds });
  }
  return {
    id: 'act-qcm',
    title: 'Les symboles',
    discipline: 'Mathématiques',
    year: '4e primaire',
    context: 'Classe de 18 élèves, symboles de comparaison.',
    cibles: ['TEST.qcm.1'],
    items,
    categories: [],
    pairs: [],
    memberships: [],
    ranks: [],
    questions,
  };
}

/** Toutes les relations réunies : eau (trier, associer, ordre), scène (placer), comparaisons, QCM. */
export function toutesActivity(): Activity {
  const e = eauActivity();
  const s = sceneActivity();
  const c = comparerActivity();
  const q = qcmActivity();
  return {
    ...e,
    sceneId: s.sceneId,
    items: [...e.items, ...s.items, ...q.items],
    categories: [...e.categories, ...s.categories],
    memberships: [...e.memberships, ...s.memberships],
    comparisons: c.comparisons,
    questions: q.questions,
  };
}
