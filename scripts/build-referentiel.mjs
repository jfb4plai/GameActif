// Génère le jeu de données des attendus (maths P3 et P4) à partir de referentiels-fwb/.
// Usage : node scripts/build-referentiel.mjs
// Sorties : data/referentiel-maths-p3-p4.json et previsualisation/referentiel-data.js (chargeable en file://).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = join(racine, '..', 'referentiels-fwb', 'maths');
// Comptes relevés par script le 2026-11-03 ; le build échoue si l'extraction change sans mise à jour ici.
const ATTENDUS_ATTENDUS = { P3: 150, P4: 173 };

const entrees = [];
for (const annee of ['P3', 'P4']) {
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

writeFileSync(join(racine, 'data', 'referentiel-maths-p3-p4.json'), JSON.stringify(entrees, null, 1), 'utf-8');
writeFileSync(
  join(racine, 'previsualisation', 'referentiel-data.js'),
  `window.REFERENTIEL = ${JSON.stringify(entrees)};\n`,
  'utf-8',
);
console.log(`OK : ${entrees.length} attendus, ${codes.size} codes uniques.`);
