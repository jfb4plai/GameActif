import { completerBrouillon, formeBrouillonValide } from '../atelier/brouillon.js';
import type { Brouillon } from '../atelier/types.js';
import type { StockageLocal } from '../compte/invitation.js';
import type { ProfileId } from '../engine/types.js';
import { FORME_CODE_CLASSE } from '../suivi/classeAppareil.js';
import { FORME_CODE_ACTIVITE } from './lien.js';

/** Sous-ensemble de supabase-js utilisé ici : permet d'injecter un client factice dans les tests. */
export interface ClientPartage {
  rpc(nom: 'game_get_shared_activity' | 'game_profile_for', args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export type Mode = 'meme' | 'groupes' | 'par-code';

const MODES: readonly string[] = ['meme', 'groupes', 'par-code'];
const PROFILS: readonly string[] = ['soutien', 'standard', 'defi'];
const FORME_CODE_ELEVE = /^E[0-9]{2}$/;
const cle = (code: string) => `gameactif.partage.v1.${code}`;

/** Activité telle que la renvoie la base : le contexte est déjà remplacé par le texte fixe. */
export interface ActivitePartagee {
  code: string;
  titre: string;
  brouillon: Brouillon;
  mode: Mode;
  profilDefaut: ProfileId;
  classCode: string;
  nbCodes: number;
}

export type Chargement = { etat: 'ok'; activite: ActivitePartagee; depuisCache: boolean } | { etat: 'retiree' } | { etat: 'echec' };

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Réponse de la base (ou cache) vers une activité ; null si la forme est inattendue. */
function lire(code: string, x: unknown): ActivitePartagee | null {
  if (!estObjet(x) || typeof x.titre !== 'string' || !formeBrouillonValide(x.brouillon)) return null;
  if (typeof x.mode !== 'string' || !MODES.includes(x.mode)) return null;
  if (typeof x.profilDefaut !== 'string' || !PROFILS.includes(x.profilDefaut)) return null;
  if (typeof x.classCode !== 'string' || !FORME_CODE_CLASSE.test(x.classCode)) return null;
  if (typeof x.nbCodes !== 'number' || !Number.isInteger(x.nbCodes) || x.nbCodes < 1 || x.nbCodes > 40) return null;
  return {
    code,
    titre: x.titre,
    brouillon: completerBrouillon(x.brouillon),
    mode: x.mode as Mode,
    profilDefaut: x.profilDefaut as ProfileId,
    classCode: x.classCode,
    nbCodes: x.nbCodes,
  };
}

/** Relit la dernière copie locale d'une activité. Stockage absent, refusé ou contenu inattendu : null. */
export function lireCache(s: StockageLocal | null, code: string): ActivitePartagee | null {
  if (!s) return null;
  try {
    const brut = s.getItem(cle(code));
    return brut === null ? null : lire(code, JSON.parse(brut));
  } catch {
    return null;
  }
}

/** Garde une copie locale : on peut rouvrir le lien sans réseau. Un stockage absent ou qui refuse est ignoré. */
export function ecrireCache(s: StockageLocal | null, a: ActivitePartagee): void {
  if (!s) return;
  try {
    s.setItem(cle(a.code), JSON.stringify({ titre: a.titre, brouillon: a.brouillon, mode: a.mode, profilDefaut: a.profilDefaut, classCode: a.classCode, nbCodes: a.nbCodes }));
  } catch {
    // Stockage plein ou interdit : pas de copie locale, rien d'autre ne change.
  }
}

function effacerCache(s: StockageLocal | null, code: string): void {
  if (!s) return;
  try {
    s.removeItem(cle(code));
  } catch {
    // Rien à faire : au pire, une copie périmée reste sur l'appareil.
  }
}

/**
 * Charge l'activité d'un lien. « retiree » : la base ne la connaît plus (la copie locale est effacée). Réseau ou réponse
 * inutilisable : la copie locale s'il y en a une, sinon « echec ». Ne lève jamais.
 */
export async function chargerActivite(client: ClientPartage, stockage: StockageLocal | null, code: string): Promise<Chargement> {
  if (!FORME_CODE_ACTIVITE.test(code)) return { etat: 'retiree' };
  try {
    const r = await client.rpc('game_get_shared_activity', { p_code: code });
    if (!r.error) {
      if (r.data === null) {
        effacerCache(stockage, code);
        return { etat: 'retiree' };
      }
      const activite = lire(code, r.data);
      if (activite) {
        ecrireCache(stockage, activite);
        return { etat: 'ok', activite, depuisCache: false };
      }
    }
  } catch {
    // Réseau indisponible : on essaie la copie locale.
  }
  const copie = lireCache(stockage, code);
  return copie ? { etat: 'ok', activite: copie, depuisCache: true } : { etat: 'echec' };
}

/** Profil du code élève (mode « par code »). null : réponse inattendue, erreur, réseau indisponible ou codes mal formés. */
export async function profilPourCode(client: ClientPartage, classCode: string, studentCode: string): Promise<ProfileId | null> {
  if (!FORME_CODE_CLASSE.test(classCode) || !FORME_CODE_ELEVE.test(studentCode)) return null;
  try {
    const r = await client.rpc('game_profile_for', { p_class_code: classCode, p_student_code: studentCode });
    if (r.error) return null;
    return typeof r.data === 'string' && PROFILS.includes(r.data) ? (r.data as ProfileId) : null;
  } catch {
    return null;
  }
}
