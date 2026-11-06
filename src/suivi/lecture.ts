import { ErreurStockage, classer } from '../compte/activites.js';
import type { MechanicId, ProfileId } from '../engine/types.js';
import type { ResultatManuel } from './agregats.js';
import type { ResultatEnvoye, SessionEnregistree } from './types.js';

export interface ClasseLue {
  id: string;
  label: string;
  nbCodes: number;
  classCode: string;
  /** Date (AAAA-MM-JJ) à laquelle les résultats de la classe sont supprimés. */
  purgeLe: string;
  /** Faux quand la classe n'est lue que parce que son propriétaire y a invité ce compte. */
  proprietaire: boolean;
}

export interface Observation {
  id: string;
  studentCode: string | null;
  texte: string;
  visibleInvites: boolean;
  creeLe: string;
}

export interface Invite {
  id: string;
  expireLe: string;
  revoqueLe: string | null;
}

export interface SuiviStore {
  classes(): Promise<ClasseLue[]>;
  sessions(classId: string): Promise<SessionEnregistree[]>;
  manuels(classId: string): Promise<ResultatManuel[]>;
  observations(classId: string): Promise<Observation[]>;
  invites(classId: string): Promise<Invite[]>;
  creerClasse(label: string, nbCodes: number): Promise<ClasseLue>;
  supprimerClasse(classId: string): Promise<void>;
  saisirManuel(classId: string, r: Omit<ResultatManuel, 'date'>): Promise<void>;
  enregistrerObservation(classId: string, o: { studentCode: string | null; texte: string; visibleInvites: boolean }): Promise<Observation>;
  /** Code d'invitation, rendu une seule fois. */
  inviter(classId: string): Promise<string>;
  rejoindre(code: string): Promise<'ok' | 'deja' | 'invalide'>;
  revoquer(guestId: string): Promise<void>;
}

// ---------------------------------------------------------------------------------------------------------------
// Version Supabase
// ---------------------------------------------------------------------------------------------------------------

export interface Resultat<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/** Sous-ensemble de l'API Supabase utilisé ici : permet d'injecter une base factice dans les tests. */
export interface Constructeur extends PromiseLike<Resultat<unknown>> {
  select(colonnes?: string): Constructeur;
  insert(ligne: Record<string, unknown>): Constructeur;
  delete(): Constructeur;
  eq(colonne: string, valeur: string): Constructeur;
  order(colonne: string, options?: { ascending: boolean }): Constructeur;
  range(de: number, a: number): Constructeur;
  single(): Constructeur;
}
export interface ClientLecture {
  from(table: 'game_classes' | 'game_sessions' | 'game_manual_results' | 'game_observations' | 'game_class_guests'): Constructeur;
  rpc(nom: 'game_create_class' | 'game_create_guest_invitation' | 'game_redeem_guest_invitation' | 'game_revoke_guest', args: Record<string, unknown>): PromiseLike<Resultat<unknown>>;
}

const MECANIQUES: readonly string[] = ['associer', 'trier', 'ordre', 'placer', 'comparer', 'memo', 'qcm'];
const PROFILS: readonly string[] = ['soutien', 'standard', 'defi'];
const PAGE = 1000;

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const estTexte = (x: unknown): x is string => typeof x === 'string';

function estResultat(r: unknown): r is ResultatEnvoye {
  return (
    estObjet(r) &&
    estTexte(r.elementId) &&
    estTexte(r.correct) &&
    estTexte(r.mechanic) &&
    typeof r.firstTry === 'boolean' &&
    typeof r.hintUsed === 'boolean' &&
    typeof r.revealed === 'boolean' &&
    typeof r.tries === 'number' &&
    Array.isArray(r.wrongChoices) &&
    r.wrongChoices.every(estTexte)
  );
}

/** Ligne de game_sessions vers une séance ; null si la forme est inattendue (la ligne est alors ignorée). */
function versSession(l: unknown): SessionEnregistree | null {
  if (!estObjet(l)) return null;
  if (!estTexte(l.id) || !estTexte(l.student_code) || !estTexte(l.ended_at)) return null;
  if (!estTexte(l.mechanic) || !MECANIQUES.includes(l.mechanic)) return null;
  if (!estTexte(l.profile) || !PROFILS.includes(l.profile)) return null;
  if (!Array.isArray(l.cibles) || !l.cibles.every(estTexte)) return null;
  if (typeof l.total_elements !== 'number') return null;
  if (!estObjet(l.labels) || !Object.values(l.labels).every(estTexte)) return null;
  if (!Array.isArray(l.results) || !l.results.every(estResultat)) return null;
  return {
    sessionId: l.id,
    studentCode: l.student_code,
    mechanic: l.mechanic as MechanicId,
    profile: l.profile as ProfileId,
    cibles: [...l.cibles],
    totalElements: l.total_elements,
    endedAt: l.ended_at,
    labels: { ...(l.labels as Record<string, string>) },
    results: l.results.map((r) => ({ ...r, wrongChoices: [...r.wrongChoices] })),
    origine: 'ecran',
  };
}

function versClasse(l: unknown, userId: string): ClasseLue | null {
  if (!estObjet(l) || !estTexte(l.id) || !estTexte(l.label) || typeof l.nb_codes !== 'number' || !estTexte(l.class_code) || !estTexte(l.purge_on)) return null;
  return { id: l.id, label: l.label, nbCodes: l.nb_codes, classCode: l.class_code, purgeLe: l.purge_on, proprietaire: l.user_id === userId };
}

function versObservation(l: unknown): Observation | null {
  if (!estObjet(l) || !estTexte(l.id) || !estTexte(l.texte) || !estTexte(l.created_at) || typeof l.visible_invites !== 'boolean') return null;
  if (l.student_code !== null && !estTexte(l.student_code)) return null;
  return { id: l.id, studentCode: l.student_code, texte: l.texte, visibleInvites: l.visible_invites, creeLe: l.created_at };
}

/**
 * Magasin lié aux tables `game_*`. L'identité vient de la session ; la base contrôle aussi tout (règles par ligne).
 * Une panne ne change rien : l'erreur est classée et remontée en français.
 */
export function magasinSuiviSupabase(client: ClientLecture, userId: string): SuiviStore {
  async function appel<T>(f: () => PromiseLike<Resultat<T>>): Promise<T | null> {
    let r: Resultat<T>;
    try {
      r = await f();
    } catch (e) {
      throw classer(e);
    }
    if (r.error) throw classer(r.error);
    return r.data;
  }

  /** Toutes les lignes d'une classe, page par page : une classe active dépasse vite les 1000 lignes d'une réponse. */
  async function toutes(table: 'game_sessions' | 'game_manual_results' | 'game_observations' | 'game_class_guests', colonnes: string, classId: string, tri: string): Promise<unknown[]> {
    const lignes: unknown[] = [];
    for (let de = 0; ; de += PAGE) {
      const page = await appel(() => client.from(table).select(colonnes).eq('class_id', classId).order(tri, { ascending: true }).range(de, de + PAGE - 1));
      const l = Array.isArray(page) ? page : [];
      lignes.push(...l);
      if (l.length < PAGE) return lignes;
    }
  }

  async function classes(): Promise<ClasseLue[]> {
    const l = await appel(() => client.from('game_classes').select('id, user_id, label, nb_codes, class_code, purge_on').order('created_at', { ascending: false }));
    return (Array.isArray(l) ? l : []).map((x) => versClasse(x, userId)).filter((c): c is ClasseLue => c !== null);
  }

  return {
    classes,
    async sessions(classId) {
      const l = await toutes('game_sessions', 'id, student_code, mechanic, profile, cibles, total_elements, ended_at, labels, results', classId, 'ended_at');
      return l.map(versSession).filter((s): s is SessionEnregistree => s !== null);
    },
    async manuels(classId) {
      const l = await toutes('game_manual_results', 'student_code, cible, resultat, created_at', classId, 'created_at');
      const sortie: ResultatManuel[] = [];
      for (const x of l) {
        if (estObjet(x) && estTexte(x.student_code) && estTexte(x.cible) && estTexte(x.created_at) && (x.resultat === 'reussi' || x.resultat === 'partiel' || x.resultat === 'a_reprendre')) {
          sortie.push({ studentCode: x.student_code, cible: x.cible, resultat: x.resultat, date: x.created_at });
        }
      }
      return sortie;
    },
    async observations(classId) {
      const l = await toutes('game_observations', 'id, student_code, texte, visible_invites, created_at', classId, 'created_at');
      return l.map(versObservation).filter((o): o is Observation => o !== null);
    },
    async invites(classId) {
      const l = await toutes('game_class_guests', 'id, expires_at, revoked_at', classId, 'created_at');
      const sortie: Invite[] = [];
      for (const x of l) {
        if (estObjet(x) && estTexte(x.id) && estTexte(x.expires_at)) sortie.push({ id: x.id, expireLe: x.expires_at, revoqueLe: estTexte(x.revoked_at) ? x.revoked_at : null });
      }
      return sortie;
    },
    async creerClasse(label, nbCodes) {
      const r = await appel(() => client.rpc('game_create_class', { p_label: label, p_nb_codes: nbCodes }));
      const id = Array.isArray(r) && estObjet(r[0]) && estTexte(r[0].id) ? r[0].id : null;
      if (id === null) throw new ErreurStockage('inconnue');
      const creee = (await classes()).find((c) => c.id === id);
      if (!creee) throw new ErreurStockage('inconnue');
      return creee;
    },
    async supprimerClasse(classId) {
      await appel(() => client.from('game_classes').delete().eq('id', classId));
    },
    async saisirManuel(classId, r) {
      await appel(() => client.from('game_manual_results').insert({ class_id: classId, student_code: r.studentCode, cible: r.cible, resultat: r.resultat }));
    },
    async enregistrerObservation(classId, o) {
      const l = await appel(() =>
        client
          .from('game_observations')
          .insert({ class_id: classId, student_code: o.studentCode, texte: o.texte, visible_invites: o.visibleInvites })
          .select('id, student_code, texte, visible_invites, created_at')
          .single(),
      );
      const obs = versObservation(l);
      if (!obs) throw new ErreurStockage('inconnue');
      return obs;
    },
    async inviter(classId) {
      const code = await appel(() => client.rpc('game_create_guest_invitation', { p_class_id: classId }));
      if (!estTexte(code)) throw new ErreurStockage('inconnue');
      return code;
    },
    async rejoindre(code) {
      const r = await appel(() => client.rpc('game_redeem_guest_invitation', { p_code: code }));
      if (r === 'ok' || r === 'deja' || r === 'invalide') return r;
      throw new ErreurStockage('inconnue');
    },
    async revoquer(guestId) {
      await appel(() => client.rpc('game_revoke_guest', { p_guest_id: guestId }));
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Version en mémoire (tests d'écran et usage sans compte)
// ---------------------------------------------------------------------------------------------------------------

export interface DonneesMemoire {
  classes?: ClasseLue[];
  sessions?: Record<string, SessionEnregistree[]>;
  manuels?: Record<string, ResultatManuel[]>;
  observations?: Record<string, Observation[]>;
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const tirage = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export function magasinSuiviMemoire(init: DonneesMemoire = {}): SuiviStore {
  let classes = [...(init.classes ?? [])];
  const sessions = new Map(Object.entries(init.sessions ?? {}));
  const manuels = new Map(Object.entries(init.manuels ?? {}));
  const observations = new Map(Object.entries(init.observations ?? {}));
  const invites = new Map<string, Invite[]>();
  const codesEmis = new Set<string>();
  let compteur = 0;
  const maintenant = () => new Date(1_700_000_000_000 + ++compteur * 1000).toISOString();

  return {
    async classes() {
      return [...classes];
    },
    async sessions(classId) {
      return [...(sessions.get(classId) ?? [])];
    },
    async manuels(classId) {
      return [...(manuels.get(classId) ?? [])];
    },
    async observations(classId) {
      return [...(observations.get(classId) ?? [])];
    },
    async invites(classId) {
      return [...(invites.get(classId) ?? [])];
    },
    async creerClasse(label, nbCodes) {
      const c: ClasseLue = { id: `m${++compteur}`, label: label.trim(), nbCodes, classCode: tirage(8), purgeLe: '2027-08-30', proprietaire: true };
      classes = [c, ...classes];
      return c;
    },
    async supprimerClasse(classId) {
      classes = classes.filter((c) => c.id !== classId);
      sessions.delete(classId);
      manuels.delete(classId);
      observations.delete(classId);
      invites.delete(classId);
    },
    async saisirManuel(classId, r) {
      manuels.set(classId, [...(manuels.get(classId) ?? []), { ...r, date: maintenant() }]);
    },
    async enregistrerObservation(classId, o) {
      const obs: Observation = { id: `o${++compteur}`, studentCode: o.studentCode, texte: o.texte, visibleInvites: o.visibleInvites, creeLe: maintenant() };
      observations.set(classId, [...(observations.get(classId) ?? []), obs]);
      return obs;
    },
    async inviter(classId) {
      const code = tirage(32);
      codesEmis.add(code);
      invites.set(classId, [...(invites.get(classId) ?? []), { id: `g${++compteur}`, expireLe: '2026-12-31T00:00:00Z', revoqueLe: null }]);
      return code;
    },
    async rejoindre(code) {
      if (!codesEmis.has(code)) return 'invalide';
      codesEmis.delete(code);
      return 'ok';
    },
    async revoquer(guestId) {
      for (const [classId, liste] of invites) {
        invites.set(classId, liste.map((g) => (g.id === guestId ? { ...g, revoqueLe: maintenant() } : g)));
      }
    },
  };
}
