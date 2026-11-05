import type { Brouillon } from './types.js';
import { completerBrouillon, formeBrouillonValide } from './brouillon.js';
import { matieres, niveaux } from '../data/catalogue.js';
import { REFERENTIEL } from '../data/referentiel.js';

export const FORMAT = 'gameactif-activite';
/** Version 2 : ajoute comparaisons et qcm. Les fichiers de version 1 restent lisibles (champs vides). */
export const VERSION_FICHIER = 2;
export const TAILLE_MAX_OCTETS = 200_000;
const CHAMP_MAX = 20_000;

export type Lecture = { ok: true; brouillon: Brouillon; avertissements: string[] } | { ok: false; message: string };

const refus = (message: string): Lecture => ({ ok: false, message });

/** Nom du fichier téléchargé : `gameactif-<titre-simplifié>-AAAA-MM-JJ.json`. */
export function nomDeFichier(b: Brouillon, date: Date): string {
  const titre = b.titre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  const jour = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  return `gameactif-${titre === '' ? 'activite' : titre}-${jour}.json`;
}

/**
 * Fichier d'échange : le brouillon, versionné. Aucune identité (ni compte, ni e-mail) : le même contenu
 * pourra être rangé tel quel dans une base plus tard.
 */
export function exporterActivite(b: Brouillon, maintenant: Date): { nom: string; contenu: string } {
  const objet = { format: FORMAT, version: VERSION_FICHIER, exporteLe: maintenant.toISOString(), brouillon: b };
  return { nom: nomDeFichier(b, maintenant), contenu: JSON.stringify(objet, null, 2) };
}

const dejaConnu = (niveau: string, matiere: string, code: string) =>
  REFERENTIEL.some((e) => e.code === code && e.annee === niveau && e.matiere === matiere);

/**
 * Lit un fichier reçu. Le contenu n'est pas fiable (il peut venir d'un collègue ou d'un autre outil) :
 * taille limitée avant analyse, forme vérifiée, clés inconnues ignorées, textes jamais interprétés.
 */
export function lireActivite(texte: string): Lecture {
  if (texte.trim() === '') return refus('Le fichier est vide.');
  if (new TextEncoder().encode(texte).length > TAILLE_MAX_OCTETS) return refus('Ce fichier est trop gros pour être une activité GameActif.');

  let objet: unknown;
  try {
    objet = JSON.parse(texte);
  } catch {
    return refus('Ce fichier n’est pas une activité GameActif : il n’est pas lisible.');
  }
  if (typeof objet !== 'object' || objet === null || Array.isArray(objet) || (objet as Record<string, unknown>).format !== FORMAT) {
    return refus('Ce fichier n’est pas une activité GameActif.');
  }
  const o = objet as Record<string, unknown>;
  if (typeof o.version !== 'number' || !Number.isInteger(o.version) || o.version < 1) return refus('Ce fichier est abîmé : l’activité n’a pas pu être relue.');
  if (o.version > VERSION_FICHIER) {
    return refus('Ce fichier vient d’une version plus récente de GameActif. Mettez l’application à jour ou demandez un nouvel envoi.');
  }
  if (!formeBrouillonValide(o.brouillon)) return refus('Ce fichier est abîmé : l’activité n’a pas pu être relue.');

  const b = o.brouillon;
  if (!niveaux().includes(b.niveau) || !matieres(b.niveau).some((m) => m.id === b.matiere)) {
    return refus('Ce niveau ou cette matière n’existe pas encore dans GameActif.');
  }
  const textes = [b.titre, b.contexte, b.paires, b.etapes, b.comparaisons ?? '', b.qcm ?? '', ...b.familles.flatMap((f) => [f.label, f.elements])];
  if (textes.some((t) => t.length > CHAMP_MAX)) return refus('Ce fichier est trop gros pour être une activité GameActif.');

  const cibles = [...new Set(b.cibles)].filter((c) => dejaConnu(b.niveau, b.matiere, c));
  const retirees = b.cibles.length - cibles.length;
  return {
    ok: true,
    brouillon: completerBrouillon({
      niveau: b.niveau,
      matiere: b.matiere,
      cibles,
      titre: b.titre,
      contexte: b.contexte,
      familles: b.familles.map((f) => ({ label: f.label, elements: f.elements })),
      paires: b.paires,
      etapes: b.etapes,
      comparaisons: b.comparaisons,
      qcm: b.qcm,
    }),
    avertissements: retirees > 0 ? [`${retirees} compétence(s) du fichier n’existent plus dans le programme chargé et ont été retirées.`] : [],
  };
}
