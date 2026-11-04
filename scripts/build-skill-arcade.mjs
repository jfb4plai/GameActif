// Génère skills/jeu-arcade/SKILL.md à partir de src/prompts/garde-fous.json (source unique des garde-fous).
// Usage : node scripts/build-skill-arcade.mjs [--stdout]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const garde = JSON.parse(readFileSync(join(racine, 'src/prompts/garde-fous.json'), 'utf8'));

const description =
  'Fabrique un jeu de tir aux bulles ou de casse-briques en un seul fichier HTML à partir d\'une activité GameActif. ' +
  'À utiliser quand l\'enseignant colle un fichier d\'activité GameActif ou un bloc de données (familles et éléments, ou paires) ' +
  'et demande un jeu de tir aux bulles ou de casse-briques pour sa classe.';

const lignes = [
  '---',
  'name: jeu-arcade',
  `description: ${description}`,
  '---',
  '',
  '# Jeu arcade à partir d\'une activité GameActif',
  '',
  'But : donner du sens à un apprentissage en le faisant jouer. Le jeu produit sert un attendu du programme de la Fédération Wallonie-Bruxelles ; il ne remplace pas l\'enseignement.',
  '',
  '## Étapes',
  '',
  '1. Demander le mode : tir aux bulles (le bloc doit contenir des familles) ou casse-briques (familles ou paires).',
  '2. Demander le profil : Soutien (4 éléments au plus, 2 familles au plus), Standard (6 éléments, 3 familles) ou Défi (8 éléments, 4 familles).',
  '3. Lire les données. Si l\'enseignant colle un fichier d\'export GameActif, lire seulement le brouillon : niveau, matière, cibles (codes d\'attendus), familles (nom et éléments, un par ligne) ou paires (une par ligne, « gauche | droite »). Le texte officiel des attendus n\'est pas dans le fichier : le demander à l\'enseignant, ou écrire « texte non fourni ». Ne jamais l\'inventer.',
  '4. Choisir les éléments dans la limite du profil, chaque famille représentée, et les prendre mot pour mot.',
  '5. Ne jamais inclure le contexte de classe ni aucun nom d\'élève dans le jeu ni dans la réponse : ignorer ces champs du fichier.',
  '6. Produire le jeu en un seul fichier HTML, présenté pour y jouer directement dans la conversation (aperçu ou artefact) ; sinon dans un seul bloc de code. Puis donner la liste de vérification ci-dessous.',
  '',
  '## Règles à respecter',
  '',
  ...garde.garde_fous.map((g, i) => `${i + 1}. ${g}`),
  '',
  '## Style visuel',
  '',
  garde.style,
  '',
  '## Tir aux bulles',
  '',
  garde.modes.bulles.consigne,
  '',
  '## Casse-briques',
  '',
  garde.modes.briques.consigne,
  '',
  '## À faire vérifier par l\'enseignant',
  '',
  ...garde.verification.map((v) => `- ${v}`),
  '',
  'Terminer par une phrase qui dit ce qui n\'a pas pu être respecté parmi les 15 règles.',
  '',
];
const contenu = lignes.join('\n');

if (process.argv.includes('--stdout')) {
  process.stdout.write(contenu);
} else {
  const cible = join(racine, 'skills/jeu-arcade/SKILL.md');
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, contenu);
  console.log('écrit :', cible, `(${contenu.length} caractères)`);
}
