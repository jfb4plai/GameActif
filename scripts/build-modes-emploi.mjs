// Génère les modes d'emploi HTML (enseignant et élève) à partir des textes d'aide affichés dans l'application.
// Source unique : src/aide/textes.json. Usage :
//   node scripts/build-modes-emploi.mjs                      écrit docs/modes-emploi/gameactif-enseignant.html et -eleve.html
//   node scripts/build-modes-emploi.mjs --stdout enseignant  imprime la page (ou « eleve »), n'écrit rien
// Pages autonomes : aucune ressource externe, aucun script, polices du système (DM Sans si installée, sinon Arial).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const textes = JSON.parse(readFileSync(join(racine, 'src', 'aide', 'textes.json'), 'utf-8'));
const CONTACT = 'jeanfrancois.beguin@ens.ecl.be';

/** Titre d'écran de chaque aide (l'ordre est celui du parcours). */
const ECRANS = [
  ['parcours-niveau', 'Parcours, étape 1 : Niveau'],
  ['parcours-matiere', 'Parcours, étape 2 : Matière'],
  ['parcours-competences', 'Parcours, étape 3 : Compétences visées'],
  ['parcours-elements', 'Parcours, étape 4 : Vos éléments'],
  ['parcours-jeux', 'Parcours, étape 5 : Vos jeux'],
  ['proposer', 'Proposer à la classe'],
  ['classes', 'Mes classes'],
  ['tableau', 'Le tableau de bord'],
  ['niveaux', 'Niveaux par code'],
  ['eleve', 'Jouer avec GameActif'],
];

const echapper = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
:root { --teal: #0f6e56; --orange: #f97316; --texte: #1f2933; --fond: #faf9f7; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--fond); color: var(--texte); font: 1rem/1.6 "DM Sans", Arial, sans-serif; }
header { background: var(--teal); color: #fff; padding: 20px 24px; }
header h1 { margin: 0; font: 1.75rem/1.2 "DM Serif Display", Georgia, serif; }
header p { margin: 6px 0 0; }
main { max-width: 48rem; margin: 0 auto; padding: 16px 24px 40px; }
section { background: #fff; border: 2px solid var(--teal); border-radius: 8px; padding: 4px 20px 12px; margin: 20px 0; }
h2 { color: var(--teal); font: 1.35rem/1.3 "DM Serif Display", Georgia, serif; }
ul { padding-left: 1.2em; }
li { margin: 6px 0; }
.limite { border-left: 6px solid var(--orange); padding: 6px 12px; background: #fff7ed; }
.eleve main { font-size: 1.25rem; }
footer { max-width: 48rem; margin: 0 auto; padding: 0 24px 32px; }
a { color: var(--teal); }
`;

function page(public_) {
  const eleve = public_ === 'eleve';
  const lignes = ECRANS.filter(([id]) => textes[id].public === public_);
  const titre = eleve ? 'GameActif : mode d’emploi pour les élèves' : 'GameActif : mode d’emploi pour l’enseignant';
  const intro = eleve
    ? 'Quelques gestes pour jouer.'
    : 'Ce mode d’emploi reprend l’aide repliable de chaque écran de GameActif : à quoi il sert, quoi faire, et ce qu’il ne fait pas.';
  const sections = lignes
    .map(([id, nom]) => {
      const a = textes[id];
      const puces = a.puces.map((p) => `      <li>${echapper(p)}</li>`).join('\n');
      const limite = a.limite ? `\n    <p class="limite"><strong>Limite :</strong> ${echapper(a.limite)}</p>` : '';
      return `  <section id="${id}">\n    <h2>${echapper(nom)}</h2>\n    <ul>\n${puces}\n    </ul>${limite}\n  </section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titre)}</title>
<style>${STYLE}</style>
</head>
<body class="${public_}">
<header>
  <h1>${echapper(titre)}</h1>
  <p>${echapper(intro)}</p>
</header>
<main>
${sections}
</main>
<footer>
  <p>Une question, une erreur dans ce mode d’emploi : ${CONTACT}</p>
</footer>
</body>
</html>
`;
}

const args = process.argv.slice(2);
const i = args.indexOf('--stdout');
if (i >= 0) {
  const quoi = args[i + 1];
  if (quoi !== 'enseignant' && quoi !== 'eleve') {
    console.error('Usage : --stdout enseignant|eleve');
    process.exit(1);
  }
  process.stdout.write(page(quoi));
} else {
  const dossier = join(racine, 'docs', 'modes-emploi');
  mkdirSync(dossier, { recursive: true });
  for (const p of ['enseignant', 'eleve']) writeFileSync(join(dossier, `gameactif-${p}.html`), page(p));
  console.log('Modes d’emploi écrits dans docs/modes-emploi/');
}
