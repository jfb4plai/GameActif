// Génère les jeux de données des attendus (maths et français, P1 à P6) à partir de referentiels-fwb/.
// Usage : node scripts/build-referentiel.mjs
// Sorties : data/referentiel-maths.json, previsualisation/referentiel-data.js (maths, chargeable en file://)
// et data/referentiel-francais.json (rubriques ; codes F.P#.r#.i#.a# fabriqués par rang, la source n'en a pas).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = join(racine, '..', 'referentiels-fwb', 'maths');
// Comptes relevés par script le 2026-11-03 ; le build échoue si l'extraction change sans mise à jour ici.
const ATTENDUS_ATTENDUS = { P1: 73, P2: 122, P3: 150, P4: 173, P5: 176, P6: 167 };

const entrees = [];
for (const annee of Object.keys(ATTENDUS_ATTENDUS)) {
  const fichier = `maths/${annee}.json`;
  const d = JSON.parse(readFileSync(join(sources, `${annee}.json`), 'utf-8'));
  let n = 0;
  for (const champ of d.champs) {
    for (const sp of champ.sous_points) {
      sp.items.forEach((item, i) => {
        item.attendus.forEach((texte, a) => {
          entrees.push({
            code: `M.${annee}.${sp.code}.i${i + 1}.a${a + 1}`,
            annee,
            matiere: 'mathematiques',
            champ: champ.champ,
            champ_titre: champ.titre,
            sous_point: sp.code,
            sous_point_titre: sp.titre,
            item_type: item.type,
            item_contenu: item.contenu,
            texte,
            version_source: `${fichier} (extraction relue le 2026-11-03)`,
          });
          n += 1;
        });
      });
    }
  }
  if (n !== ATTENDUS_ATTENDUS[annee]) {
    throw new Error(`${annee} : ${n} attendus trouvés, ${ATTENDUS_ATTENDUS[annee]} attendus. Mettre à jour la version.`);
  }
}

const codes = new Set(entrees.map((e) => e.code));
if (codes.size !== entrees.length) throw new Error('Codes d\'attendus en double');

writeFileSync(join(racine, 'data', 'referentiel-maths.json'), JSON.stringify(entrees, null, 1), 'utf-8');
writeFileSync(
  join(racine, 'previsualisation', 'referentiel-data.js'),
  `window.REFERENTIEL = ${JSON.stringify(entrees)};\n`,
  'utf-8',
);
console.log(`OK : ${entrees.length} attendus, ${codes.size} codes uniques.`);

// Français : attendus des rubriques (les compétences, plus larges, ne sont pas chargées).
// Comptes relevés par scripts/etude-referentiel-francais.mjs le 2026-11-09 ; le build échoue si l'extraction change.
const ATTENDUS_FRANCAIS = { P1: 116, P2: 131, P3: 168, P4: 191, P5: 212, P6: 210 };
const francais = [];
for (const annee of Object.keys(ATTENDUS_FRANCAIS)) {
  const fichier = `francais/${annee}.json`;
  const d = JSON.parse(readFileSync(join(racine, '..', 'referentiels-fwb', 'francais', `${annee}.json`), 'utf-8'));
  let n = 0;
  d.rubriques.forEach((rub, r) => {
    const titre = rub.sous_rubrique ? `${rub.rubrique} : ${rub.sous_rubrique}` : rub.rubrique;
    rub.items.forEach((item, i) => {
      item.attendus.forEach((texte, a) => {
        francais.push({
          code: `F.${annee}.r${r + 1}.i${i + 1}.a${a + 1}`,
          annee,
          matiere: 'francais',
          champ: 'rubrique',
          champ_titre: rub.rubrique,
          sous_point: `r${r + 1}`,
          sous_point_titre: titre,
          item_type: item.type,
          item_contenu: item.contenu,
          texte,
          version_source: `${fichier} (rubriques)`,
        });
        n += 1;
      });
    });
  });
  if (n !== ATTENDUS_FRANCAIS[annee]) {
    throw new Error(`Français ${annee} : ${n} attendus trouvés, ${ATTENDUS_FRANCAIS[annee]} attendus. Mettre à jour la version.`);
  }
}
const codesFr = new Set(francais.map((e) => e.code));
if (codesFr.size !== francais.length) throw new Error('Codes d’attendus du français en double');
writeFileSync(join(racine, 'data', 'referentiel-francais.json'), JSON.stringify(francais, null, 1), 'utf-8');
console.log(`OK : ${francais.length} attendus de français, ${codesFr.size} codes uniques.`);
