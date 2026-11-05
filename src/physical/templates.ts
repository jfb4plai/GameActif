import type { MechanicId } from '../engine/types.js';
import type { CalmGuards, PhysicalTemplate } from './types.js';

const CHECK = 'Vérifier avec le corrigé de la fiche, une fois le jeu terminé et jamais pendant un déplacement.';
const STOP = 'Main levée : tout le monde se fige et se tait.';

function calm(over: Partial<CalmGuards> & Pick<CalmGuards, 'safeMaterial'>): CalmGuards {
  return {
    noRunning: true,
    noTimer: true,
    noCompetition: true,
    maxGroupsMoving: 1,
    voice: 'chuchote',
    stopSignal: STOP,
    pathMarked: true,
    ...over,
  };
}

export const PHYSICAL_TEMPLATES: Record<MechanicId, PhysicalTemplate> = {
  trier: {
    mechanic: 'trier',
    title: 'Les boîtes aux lettres',
    moves: ['manipulation', 'deplacement'],
    durationMin: 15,
    teamSize: { min: 3, max: 4 },
    material: [
      { name: 'Cartes-mots', count: (c) => c.elements, note: 'Une par élément, à imprimer depuis la fiche.' },
      { name: 'Boîtes ou enveloppes', count: (c) => c.stations, note: 'Une par catégorie, en carton.' },
      { name: 'Étiquettes de catégorie', count: (c) => c.stations },
      { name: 'Ruban de masquage', count: () => 1, note: 'Pour tracer le chemin de marche au sol.' },
      { name: 'Cartons verts « prêt »', count: (c) => c.teams, note: 'Un par équipe.' },
    ],
    setup: [
      'Poser les boîtes sur des tables, aux coins de la classe, une par catégorie.',
      'Coller une étiquette de catégorie sur chaque boîte.',
      'Tracer au sol un chemin de marche entre les équipes et les boîtes.',
      'Donner à chaque équipe ses cartes, face cachée.',
    ],
    play: [
      'Une seule équipe se déplace à la fois : les autres restent assises.',
      'Un élève retourne une carte et la lit à voix basse.',
      'L’équipe choisit la boîte à voix basse.',
      'Un élève marche jusqu’à la boîte et glisse la carte dedans.',
      'Quand toutes les cartes sont rangées, ouvrir chaque boîte et lire les cartes à voix basse.',
      'Comparer avec le corrigé de la fiche.',
    ],
    calm: calm({ safeMaterial: 'Cartes et boîtes en carton : aucune petite pièce, rien qui roule, rien qui se lance.' }),
    differentiation: {
      soutien: 'Prendre le tour Soutien : peu de cartes et 2 catégories. Un camarade lit les cartes à voix basse. La boîte attendue peut être montrée.',
      standard: 'Prendre le tour Standard de la fiche.',
      defi: 'Prendre le tour Défi : toutes les cartes et toutes les catégories, sans montrer la boîte attendue.',
    },
    check: CHECK,
  },
  associer: {
    mechanic: 'associer',
    title: 'Les paires à pincer',
    moves: ['manipulation', 'deplacement'],
    durationMin: 15,
    teamSize: { min: 2, max: 4 },
    material: [
      { name: 'Cartes de gauche', count: (c) => c.elements, note: 'Accrochées à une ficelle tendue ou posées en colonne sur un bureau.' },
      { name: 'Cartes de droite', count: (c) => c.stations, note: 'Dans une pochette par équipe.' },
      { name: 'Pinces à linge', count: (c) => c.elements, note: 'Une par paire à former.' },
      { name: 'Ficelle ou bureau-poste', count: () => 1 },
      { name: 'Cartons verts « prêt »', count: (c) => c.teams, note: 'Un par équipe.' },
    ],
    setup: [
      'Accrocher les cartes de gauche à une ficelle tendue, ou les poser en colonne sur un bureau.',
      'Tracer au sol un chemin de marche jusqu’au poste.',
      'Donner à chaque équipe sa pochette de cartes de droite.',
    ],
    play: [
      'Une seule équipe se rend au poste à la fois : les autres restent assises.',
      'Un élève tire une carte de droite et la lit à voix basse.',
      'L’équipe choisit à voix basse la carte de gauche qui lui correspond.',
      'Un élève marche jusqu’au poste et pince la carte de droite à côté de sa partenaire.',
      'Quand toutes les paires sont pincées, lire chaque paire à voix basse.',
      'Comparer avec le corrigé de la fiche.',
    ],
    calm: calm({ safeMaterial: 'Pinces à linge en bois ou en plastique tendre, comptées avant et après le jeu ; aucune pince ne quitte le poste.' }),
    differentiation: {
      soutien: 'Prendre le tour Soutien : peu de paires. Jouer sur table, sans déplacement, avec un camarade qui lit les cartes à voix basse.',
      standard: 'Prendre le tour Standard de la fiche.',
      defi: 'Prendre le tour Défi : toutes les paires, avec des cartes de droite sans partenaire.',
    },
    check: CHECK,
  },
  ordre: {
    mechanic: 'ordre',
    title: 'La chaîne silencieuse',
    moves: ['manipulation', 'deplacement'],
    durationMin: 10,
    teamSize: { min: 4, max: 5 },
    material: [
      { name: 'Cartes-étapes', count: (c) => c.elements, note: 'Une par élève de l’équipe, à imprimer depuis la fiche.' },
      { name: 'Ruban de masquage', count: (c) => c.teams, note: 'Une ligne au sol par équipe.' },
      { name: 'Cartons verts « prêt »', count: (c) => c.teams, note: 'Un par équipe.' },
    ],
    setup: [
      'Coller au sol une ligne de ruban par équipe, dans un coin dégagé.',
      'Donner à chaque élève de l’équipe une carte-étape, face cachée.',
    ],
    play: [
      'Une seule équipe se place sur sa ligne à la fois : les autres restent assises.',
      'Chaque élève retourne sa carte et la garde contre lui.',
      'Se placer sur la ligne dans le bon ordre, sans parler : gestes seulement.',
      'Quand l’équipe est prête, lever le carton vert.',
      'Lire les cartes à voix basse, du premier au dernier.',
      'Comparer avec le corrigé de la fiche.',
    ],
    calm: calm({ voice: 'silence', safeMaterial: 'Cartes en papier épais : rien d’autre n’est manipulé.' }),
    differentiation: {
      soutien: 'Prendre le tour Soutien : quatre étapes consécutives. L’enseignant peut montrer la première carte.',
      standard: 'Prendre le tour Standard de la fiche.',
      defi: 'Prendre le tour Défi : le tour le plus long.',
    },
    check: CHECK,
  },
  comparer: {
    mechanic: 'comparer',
    title: 'Les cartons-symboles',
    moves: ['manipulation'],
    durationMin: 10,
    teamSize: { min: 2, max: 4 },
    material: [
      { name: 'Cartes-nombres', count: (c) => c.elements * 2, note: 'Deux par comparaison, à imprimer depuis la fiche.' },
      { name: 'Cartons-symboles', count: (c) => c.teams * 3, note: 'Trois par équipe : plus grand que, plus petit que, égal à.' },
      { name: 'Cartons verts « prêt »', count: (c) => c.teams, note: 'Un par équipe.' },
    ],
    setup: [
      'Donner à chaque équipe ses cartes-nombres, par deux, face cachée.',
      'Donner à chaque équipe ses trois cartons-symboles.',
      'Laisser un espace entre les deux cartes-nombres de chaque paire.',
    ],
    play: [
      'Un élève de l’équipe retourne les deux cartes-nombres d’une paire et les lit à voix basse.',
      'L’équipe choisit à voix basse le carton-symbole qui convient.',
      'Un élève pose le carton dans l’espace entre les deux nombres.',
      'Quand toutes les paires sont complétées, lire chaque comparaison à voix basse.',
      'Comparer avec le corrigé de la fiche.',
    ],
    calm: calm({ pathMarked: false, safeMaterial: 'Cartes et cartons en papier épais : rien d’autre n’est manipulé.' }),
    differentiation: {
      soutien: 'Prendre le tour Soutien : peu de paires. Un camarade lit les nombres à voix basse.',
      standard: 'Prendre le tour Standard de la fiche.',
      defi: 'Prendre le tour Défi : toutes les paires, sans aide.',
    },
    check: CHECK,
  },
  memo: {
    mechanic: 'memo',
    title: 'Les cartes qui se retrouvent',
    moves: ['manipulation'],
    durationMin: 15,
    teamSize: { min: 2, max: 4 },
    material: [
      { name: 'Cartes du mémo', count: (c) => c.elements * 2, note: 'Deux par paire, à imprimer depuis la fiche.' },
      { name: 'Cartons verts « prêt »', count: (c) => c.teams, note: 'Un par équipe.' },
    ],
    setup: [
      'Poser les cartes du mémo face cachée sur la table de l’équipe, en rangées.',
      'Garder l’ordre de la fiche pour la mise en place.',
    ],
    play: [
      'À tour de rôle, un élève retourne deux cartes et les lit à voix basse.',
      'Si les deux cartes forment une paire, l’équipe les garde.',
      'Sinon, remettre les deux cartes face cachée, au même endroit.',
      'Continuer jusqu’à ce que toutes les paires soient trouvées.',
      'Comparer avec le corrigé de la fiche.',
    ],
    calm: calm({ pathMarked: false, safeMaterial: 'Cartes en papier épais : rien d’autre n’est manipulé.' }),
    differentiation: {
      soutien: 'Prendre le tour Soutien : peu de paires. Un camarade peut montrer une carte de la paire.',
      standard: 'Prendre le tour Standard de la fiche.',
      defi: 'Prendre le tour Défi : toutes les paires, sans aide.',
    },
    check: CHECK,
  },
  qcm: {
    mechanic: 'qcm',
    title: 'Les cartons A, B, C',
    moves: ['manipulation'],
    durationMin: 10,
    teamSize: { min: 2, max: 4 },
    material: [
      { name: 'Cartes-questions', count: (c) => c.elements, note: 'Une par question, avec ses réponses lettrées.' },
      { name: 'Cartons de lettres', count: (c) => c.teams * 4, note: 'A, B, C et D, par équipe.' },
      { name: 'Cartons verts « prêt »', count: (c) => c.teams, note: 'Un par équipe.' },
    ],
    setup: [
      'Donner à chaque équipe ses cartes-questions, face cachée.',
      'Donner à chaque équipe ses cartons de lettres.',
    ],
    play: [
      'Un élève retourne une carte-question et la lit à voix basse, avec ses réponses.',
      'L’équipe choisit à voix basse une réponse.',
      'Un élève lève le carton de la lettre choisie.',
      'Passer à la carte suivante.',
      'Quand toutes les questions sont faites, comparer avec le corrigé de la fiche.',
    ],
    calm: calm({ pathMarked: false, safeMaterial: 'Cartes et cartons en papier épais : rien d’autre n’est manipulé.' }),
    differentiation: {
      soutien: 'Prendre le tour Soutien : peu de questions, deux réponses chacune. Un camarade lit à voix basse.',
      standard: 'Prendre le tour Standard de la fiche.',
      defi: 'Prendre le tour Défi : toutes les questions, quatre réponses.',
    },
    check: CHECK,
  },
  placer: {
    mechanic: 'placer',
    title: 'Place-le dans la classe',
    moves: ['manipulation', 'deplacement'],
    durationMin: 15,
    teamSize: { min: 3, max: 4 },
    material: [
      { name: 'Cartes-consignes', count: (c) => c.elements, note: 'Une par consigne, à imprimer depuis la fiche.' },
      { name: 'Objets doux', count: (c) => c.teams, note: 'Une peluche, un foulard ou un gobelet en carton par équipe.' },
      { name: 'Repères de la classe', count: (c) => c.stations, note: 'Meubles déjà présents : table, chaise, boîte.' },
      { name: 'Cartons vert et orange', count: (c) => c.teams, note: 'Pour valider ou reprendre.' },
    ],
    setup: [
      'Repérer dans la classe les meubles utilisés par les consignes et les dégager.',
      'Tracer au sol un chemin de marche autour de la zone de jeu.',
      'Donner à chaque équipe ses cartes-consignes, face cachée, et un objet doux.',
    ],
    play: [
      'Une seule équipe est dans la zone de jeu à la fois : les autres restent assises.',
      'Un élève retourne une consigne et la lit à voix basse à l’élève acteur.',
      'L’acteur marche et place l’objet doux selon la consigne.',
      'L’équipe lève le carton vert si c’est juste, le carton orange pour reprendre.',
      'L’élève acteur change à chaque consigne.',
      'Comparer avec le corrigé de la fiche.',
    ],
    calm: calm({ safeMaterial: 'Objets doux seulement : peluche, foulard, gobelet en carton. Aucun objet qui roule, se lance ou se casse.' }),
    differentiation: {
      soutien: 'Prendre le tour Soutien : peu de consignes. Un camarade lit la consigne à voix basse. La zone attendue peut être montrée du doigt.',
      standard: 'Prendre le tour Standard de la fiche.',
      defi: 'Prendre le tour Défi : toutes les consignes, sans montrer la zone.',
    },
    check: CHECK,
  },
};

/** Vérifie les contraintes demandées par JF. Liste vide : le modèle est conforme. */
export function templateProblems(t: PhysicalTemplate): string[] {
  const problems: string[] = [];
  if (t.moves.length === 0) problems.push('Il faut au moins une manipulation ou un déplacement.');
  if (t.calm.maxGroupsMoving !== 1) problems.push('Un seul groupe doit se déplacer à la fois.');
  if (t.calm.stopSignal.trim() === '') problems.push('Il faut un signal d’arrêt.');
  if (t.calm.safeMaterial.trim() === '') problems.push('Il faut préciser le matériel sûr.');
  if (t.calm.voice !== 'chuchote' && t.calm.voice !== 'silence') problems.push('La voix doit être chuchotée ou silencieuse.');
  if (!t.calm.noRunning) problems.push('La course doit être interdite.');
  if (!t.calm.noTimer) problems.push('Aucun chronomètre.');
  if (!t.calm.noCompetition) problems.push('Aucune compétition entre équipes.');
  if (t.moves.includes('deplacement') && !t.calm.pathMarked) problems.push('Un déplacement exige un chemin balisé.');
  if (t.material.length === 0) problems.push('Le matériel doit être listé.');
  if (t.setup.length === 0 || t.play.length === 0) problems.push('La mise en place et le déroulement sont obligatoires.');
  return problems;
}
