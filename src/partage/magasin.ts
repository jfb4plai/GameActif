import type { Brouillon } from '../atelier/types.js';
import { ErreurStockage, classer } from '../compte/activites.js';
import type { ProfileId } from '../engine/types.js';
import type { Resultat } from '../suivi/lecture.js';
import type { Mode } from './lecture.js';

export interface Publication {
  code: string;
  titre: string;
  mode: Mode;
  profilDefaut: ProfileId;
  /** Date ISO de la dernière mise à jour. */
  majLe: string;
}

export interface PartageStore {
  /** Publie (sans code) ou republie (avec le code d'une activité de la classe). Renvoie le code. */
  publier(classId: string, b: Brouillon, mode: Mode, profil: ProfileId, code?: string): Promise<string>;
  retirer(code: string): Promise<void>;
  publications(classId: string): Promise<Publication[]>;
  profils(classId: string): Promise<Record<string, ProfileId>>;
  definirProfil(classId: string, studentCode: string, profil: ProfileId): Promise<void>;
  retirerProfil(classId: string, studentCode: string): Promise<void>;
}

/** Refus que l'enseignant peut comprendre et corriger (plafond d'activités) : le message est affiché tel quel. */
export class ErreurPartage extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurPartage';
  }
}

const MESSAGE_PLAFOND = 'Vingt activités partagées au plus par classe : retirez-en une avant d’en proposer une nouvelle.';
const MODES: readonly string[] = ['meme', 'groupes', 'par-code'];
const PROFILS: readonly string[] = ['soutien', 'standard', 'defi'];
const FORME_CODE_ELEVE = /^E[0-9]{2}$/;
const CONTEXTE_FIXE = 'Activité partagée à la classe';

// ---------------------------------------------------------------------------------------------------------------
// Version Supabase
// ---------------------------------------------------------------------------------------------------------------

/** Sous-ensemble de l'API Supabase utilisé ici : permet d'injecter une base factice dans les tests. */
export interface RequetePartage extends PromiseLike<Resultat<unknown>> {
  select(colonnes?: string): RequetePartage;
  insert(ligne: Record<string, unknown>): RequetePartage;
  update(ligne: Record<string, unknown>): RequetePartage;
  delete(): RequetePartage;
  eq(colonne: string, valeur: string): RequetePartage;
  order(colonne: string, options?: { ascending: boolean }): RequetePartage;
}
export interface ClientPartageEcriture {
  from(table: 'game_shared_activities' | 'game_class_profiles'): RequetePartage;
  rpc(nom: 'game_publish_activity' | 'game_unpublish_activity', args: Record<string, unknown>): PromiseLike<Resultat<unknown>>;
}

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Magasin lié aux tables `game_shared_activities` et `game_class_profiles`. Une panne est classée et remontée en français. */
export function magasinPartageSupabase(client: ClientPartageEcriture): PartageStore {
  async function appel<T>(f: () => PromiseLike<Resultat<T>>): Promise<T | null> {
    let r: Resultat<T>;
    try {
      r = await f();
    } catch (e) {
      throw classer(e);
    }
    if (r.error) {
      if (/Vingt activités partagées/.test(r.error.message)) throw new ErreurPartage(MESSAGE_PLAFOND);
      throw classer(r.error);
    }
    return r.data;
  }

  return {
    async publier(classId, b, mode, profil, code) {
      const r = await appel(() => client.rpc('game_publish_activity', { p_class_id: classId, p_code: code ?? null, p_brouillon: b, p_mode: mode, p_profil: profil }));
      if (typeof r !== 'string') throw new ErreurStockage('inconnue');
      return r;
    },
    async retirer(code) {
      await appel(() => client.rpc('game_unpublish_activity', { p_code: code }));
    },
    async publications(classId) {
      const l = await appel(() => client.from('game_shared_activities').select('code, titre, mode, profil_defaut, updated_at').eq('class_id', classId).order('updated_at', { ascending: false }));
      const sortie: Publication[] = [];
      for (const x of Array.isArray(l) ? l : []) {
        if (estObjet(x) && typeof x.code === 'string' && typeof x.titre === 'string' && typeof x.mode === 'string' && MODES.includes(x.mode) && typeof x.profil_defaut === 'string' && PROFILS.includes(x.profil_defaut) && typeof x.updated_at === 'string') {
          sortie.push({ code: x.code, titre: x.titre, mode: x.mode as Mode, profilDefaut: x.profil_defaut as ProfileId, majLe: x.updated_at });
        }
      }
      return sortie;
    },
    async profils(classId) {
      const l = await appel(() => client.from('game_class_profiles').select('student_code, profile').eq('class_id', classId));
      const sortie: Record<string, ProfileId> = {};
      for (const x of Array.isArray(l) ? l : []) {
        if (estObjet(x) && typeof x.student_code === 'string' && FORME_CODE_ELEVE.test(x.student_code) && typeof x.profile === 'string' && PROFILS.includes(x.profile)) {
          sortie[x.student_code] = x.profile as ProfileId;
        }
      }
      return sortie;
    },
    async definirProfil(classId, studentCode, profil) {
      const touchees = await appel(() => client.from('game_class_profiles').update({ profile: profil }).eq('class_id', classId).eq('student_code', studentCode).select('student_code'));
      if (Array.isArray(touchees) && touchees.length > 0) return;
      await appel(() => client.from('game_class_profiles').insert({ class_id: classId, student_code: studentCode, profile: profil }));
    },
    async retirerProfil(classId, studentCode) {
      await appel(() => client.from('game_class_profiles').delete().eq('class_id', classId).eq('student_code', studentCode));
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Version en mémoire (tests d'écran et usage sans compte)
// ---------------------------------------------------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const tirage = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export function magasinPartageMemoire(): PartageStore {
  const publications = new Map<string, Array<Publication & { brouillon: Brouillon }>>();
  const profils = new Map<string, Record<string, ProfileId>>();
  let compteur = 0;
  const maintenant = () => new Date(1_700_000_000_000 + ++compteur * 1000).toISOString();

  return {
    async publier(classId, b, mode, profil, code) {
      const liste = publications.get(classId) ?? [];
      const brouillon = { ...b, contexte: CONTEXTE_FIXE };
      if (code !== undefined) {
        const i = liste.findIndex((p) => p.code === code);
        if (i < 0) throw new ErreurStockage('inconnue');
        liste[i] = { code, titre: b.titre, mode, profilDefaut: profil, majLe: maintenant(), brouillon };
        publications.set(classId, liste);
        return code;
      }
      if (liste.length >= 20) throw new ErreurPartage(MESSAGE_PLAFOND);
      const nouveau = tirage(8);
      publications.set(classId, [...liste, { code: nouveau, titre: b.titre, mode, profilDefaut: profil, majLe: maintenant(), brouillon }]);
      return nouveau;
    },
    async retirer(code) {
      for (const [classId, liste] of publications) publications.set(classId, liste.filter((p) => p.code !== code));
    },
    async publications(classId) {
      return (publications.get(classId) ?? []).map(({ brouillon: _brouillon, ...p }) => p);
    },
    async profils(classId) {
      return { ...(profils.get(classId) ?? {}) };
    },
    async definirProfil(classId, studentCode, profil) {
      profils.set(classId, { ...(profils.get(classId) ?? {}), [studentCode]: profil });
    },
    async retirerProfil(classId, studentCode) {
      const { [studentCode]: _retire, ...reste } = profils.get(classId) ?? {};
      profils.set(classId, reste);
    },
  };
}
