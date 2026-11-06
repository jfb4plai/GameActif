// Étude du référentiel de français (lecture seule) : compte les attendus par année pour estimer l'adaptateur.
// Usage : node scripts/etude-referentiel-francais.mjs [dossier-referentiels] [--json]
// Le dossier contient `francais/P1.json` à `francais/P6.json` (par défaut : ../referentiels-fwb).
// Ne modifie, ne crée et ne supprime aucun fichier.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ANNEES = /^P[1-6]\.json$/;

const attendusDe = (liste) => liste.reduce((n, x) => n + (Array.isArray(x?.attendus) ? x.attendus.length : 0), 0);

/**
 * Compte les attendus : `attendusParAnnee` = attendus des items des rubriques ; `attendusCompetencesParAnnee` = attendus
 * des compétences de réception et de production (autre couche du même fichier). Un fichier dont la forme n'est pas celle
 * attendue (ou qui n'est pas du JSON) est listé dans `illisibles`, jamais deviné.
 */
export function compterFrancais(racine) {
  const dossier = join(racine, 'francais');
  if (!existsSync(dossier)) throw new Error(`Dossier introuvable : ${dossier}`);
  const sortie = { fichiers: 0, attendusParAnnee: {}, attendusCompetencesParAnnee: {}, illisibles: [] };
  for (const nom of readdirSync(dossier).filter((f) => ANNEES.test(f)).sort()) {
    const annee = nom.replace('.json', '');
    let d;
    try {
      d = JSON.parse(readFileSync(join(dossier, nom), 'utf-8'));
    } catch {
      sortie.illisibles.push(nom);
      continue;
    }
    if (!Array.isArray(d?.rubriques) || typeof d?.competences_reception !== 'object' || typeof d?.competences_production !== 'object') {
      sortie.illisibles.push(nom);
      continue;
    }
    sortie.fichiers += 1;
    sortie.attendusParAnnee[annee] = d.rubriques.reduce((n, r) => n + attendusDe(Array.isArray(r?.items) ? r.items : []), 0);
    sortie.attendusCompetencesParAnnee[annee] = [...Object.values(d.competences_reception), ...Object.values(d.competences_production)].reduce(
      (n, liste) => n + attendusDe(Array.isArray(liste) ? liste : []),
      0,
    );
  }
  return sortie;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const racine = args.find((a) => !a.startsWith('--')) ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'referentiels-fwb');
  try {
    const r = compterFrancais(racine);
    if (json) {
      console.log(JSON.stringify(r));
    } else {
      console.log('Année  Attendus (rubriques)  Attendus (compétences)');
      for (const a of Object.keys(r.attendusParAnnee)) console.log(`${a}     ${String(r.attendusParAnnee[a]).padEnd(21)} ${r.attendusCompetencesParAnnee[a]}`);
      console.log(`Fichiers lus : ${r.fichiers}`);
      if (r.illisibles.length > 0) console.log(`Fichiers illisibles : ${r.illisibles.join(', ')}`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
