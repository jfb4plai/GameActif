import type { StockageLocal } from '../compte/invitation.js';

/** Correspondance code élève vers prénom. Elle ne quitte jamais le navigateur de l'enseignant. */
export type Roster = Record<string, string>;

const CODE = /^E[0-9]{2}$/;
const TAILLE_MAX = 20_000;
const PRENOM_MAX = 40;
const FORMAT = 'gameactif-roster';

const cle = (classId: string) => `gameactif.roster.v1.${classId}`;

/** Minuscules, sans accents : « Léa », « LEA » et « léa » se comparent égaux. */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formeValide(r: unknown): r is Roster {
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return false;
  return Object.entries(r).every(([code, prenom]) => CODE.test(code) && typeof prenom === 'string' && prenom.length >= 1 && prenom.length <= PRENOM_MAX);
}

/** Relit la liste d'une classe. Stockage absent, refusé ou contenu inattendu : liste vide. */
export function lireRoster(s: StockageLocal | null, classId: string): Roster {
  if (!s) return {};
  try {
    const brut = s.getItem(cle(classId));
    if (brut === null || brut.length > TAILLE_MAX) return {};
    const r: unknown = JSON.parse(brut);
    return formeValide(r) ? r : {};
  } catch {
    return {};
  }
}

/** Écrit la liste d'une classe. Un stockage absent ou qui refuse est ignoré. */
export function ecrireRoster(s: StockageLocal | null, classId: string, r: Roster): void {
  if (!s) return;
  try {
    s.setItem(cle(classId), JSON.stringify(r));
  } catch {
    // Stockage plein ou interdit : la liste n'est pas conservée, rien d'autre ne change.
  }
}

/** Fichier d'export de la liste (à garder par l'enseignant où il veut). */
export function exporterRoster(r: Roster, libelleClasse: string): string {
  return JSON.stringify({ format: FORMAT, version: 1, classe: libelleClasse, prenoms: r }, null, 2);
}

/** Relit un fichier d'export. null si la forme est invalide, la taille excessive ou un code hors `E01` à `E99`. */
export function importerRoster(texte: string): Roster | null {
  if (texte.length > TAILLE_MAX) return null;
  try {
    const d: unknown = JSON.parse(texte);
    if (typeof d !== 'object' || d === null) return null;
    const o = d as { format?: unknown; version?: unknown; prenoms?: unknown };
    if (o.format !== FORMAT || o.version !== 1) return null;
    return formeValide(o.prenoms) ? { ...o.prenoms } : null;
  } catch {
    return null;
  }
}

/** Le prénom du code s'il est connu, sinon le code. Sert à l'affichage seulement. */
export function afficher(code: string, r: Roster): string {
  return r[code] ?? code;
}

/**
 * Premier prénom de la liste présent dans le texte (mot entier, sans tenir compte de la casse ni des accents).
 * Garde-fou avant l'envoi d'une observation : la comparaison reste dans le navigateur.
 * Limite : un prénom absent de la liste n'est pas détecté. Les prénoms de moins de deux lettres sont ignorés.
 */
export function contientPrenom(texte: string, r: Roster): string | null {
  const t = normaliser(texte);
  for (const prenom of Object.values(r)) {
    const p = normaliser(prenom);
    if (p.length < 2) continue;
    if (new RegExp(`(?<![\\p{L}-])${echapper(p)}(?![\\p{L}-])`, 'u').test(t)) return prenom;
  }
  return null;
}
