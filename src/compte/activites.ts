import { formeBrouillonValide } from '../atelier/brouillon.js';
import type { Brouillon, BrouillonLu } from '../atelier/types.js';

export interface ActiviteEnregistree {
  id: string;
  titre: string;
  niveau: string;
  matiere: string;
  /** Date ISO de la dernière modification. */
  misAJour: string;
  brouillon: Brouillon;
}

export interface ActivitesStore {
  lister(): Promise<ActiviteEnregistree[]>;
  /** Sans identifiant : crée ; avec identifiant : met à jour la même activité. */
  enregistrer(b: Brouillon, id?: string): Promise<ActiviteEnregistree>;
  supprimer(id: string): Promise<void>;
}

export type CodeErreurStockage = 'reseau' | 'acces' | 'inconnue';

const MESSAGES: Record<CodeErreurStockage, string> = {
  reseau: 'L’enregistrement n’a pas abouti. Votre saisie est conservée : réessayez.',
  acces: 'Votre session a expiré. Reconnectez-vous.',
  inconnue: 'L’opération n’a pas abouti. Votre saisie est conservée : réessayez.',
};

/** Erreur du magasin : le message est toujours en français et sans détail technique. */
export class ErreurStockage extends Error {
  readonly code: CodeErreurStockage;
  constructor(code: CodeErreurStockage) {
    super(MESSAGES[code]);
    this.name = 'ErreurStockage';
    this.code = code;
  }
}

function classer(e: unknown): ErreurStockage {
  const message = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code === '42501' || code === 'PGRST301' || /jwt/i.test(message)) return new ErreurStockage('acces');
  if (e instanceof TypeError || /fetch|network|timeout|failed to/i.test(message)) return new ErreurStockage('reseau');
  return new ErreurStockage('inconnue');
}

/** Copie explicite des seuls champs d'un brouillon : rien d'autre (identité, e-mail) ne peut être enregistré. */
function copie(b: BrouillonLu): Brouillon {
  return {
    niveau: b.niveau,
    matiere: b.matiere,
    cibles: [...b.cibles],
    titre: b.titre,
    contexte: b.contexte,
    familles: b.familles.map((f) => ({ label: f.label, elements: f.elements })),
    paires: b.paires,
    etapes: b.etapes,
    comparaisons: b.comparaisons ?? '',
    qcm: b.qcm ?? '',
  };
}

const titreDe = (b: Brouillon) => (b.titre.trim() === '' ? 'Activité sans titre' : b.titre.trim());

// ---------------------------------------------------------------------------------------------------------------
// Version Supabase
// ---------------------------------------------------------------------------------------------------------------

interface Ligne {
  id: string;
  titre: string;
  niveau: string;
  matiere: string;
  brouillon: unknown;
  updated_at: string;
}
interface Resultat<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}
/** Sous-ensemble de l'API Supabase utilisé ici : permet d'injecter une base factice dans les tests. */
export interface ClientActivites {
  from(table: 'game_activities'): {
    select(colonnes: string): { order(colonne: string, options: { ascending: boolean }): PromiseLike<Resultat<Ligne[]>> };
    insert(ligne: Record<string, unknown>): { select(): { single(): PromiseLike<Resultat<Ligne>> } };
    update(ligne: Record<string, unknown>): { eq(colonne: string, valeur: string): { select(): { single(): PromiseLike<Resultat<Ligne>> } } };
    delete(): { eq(colonne: string, valeur: string): PromiseLike<Resultat<null>> };
  };
}

function versActivite(l: Ligne): ActiviteEnregistree | null {
  if (!formeBrouillonValide(l.brouillon)) return null;
  return { id: l.id, titre: l.titre, niveau: l.niveau, matiere: l.matiere, misAJour: l.updated_at, brouillon: copie(l.brouillon) };
}

/**
 * Magasin dans la table `game_activities`. L'identité (`userId`) vient de la session ; la base la contrôle aussi
 * (règle par ligne). Une panne ne change rien : l'erreur est classée et remontée en français.
 */
export function magasinSupabase(client: ClientActivites, userId: string): ActivitesStore {
  async function appel<T>(f: () => PromiseLike<Resultat<T>>): Promise<T> {
    let r: Resultat<T>;
    try {
      r = await f();
    } catch (e) {
      throw classer(e);
    }
    if (r.error) throw classer(r.error);
    return r.data as T;
  }

  return {
    async lister() {
      const lignes = await appel(() => client.from('game_activities').select('id, titre, niveau, matiere, brouillon, updated_at').order('updated_at', { ascending: false }));
      return (lignes ?? []).map(versActivite).filter((a): a is ActiviteEnregistree => a !== null);
    },
    async enregistrer(b, id) {
      const base = { titre: titreDe(b), niveau: b.niveau, matiere: b.matiere, brouillon: copie(b), format_version: 1 };
      const ligne = await appel(() =>
        id === undefined
          ? client.from('game_activities').insert({ ...base, user_id: userId }).select().single()
          : client.from('game_activities').update(base).eq('id', id).select().single(),
      );
      const activite = versActivite(ligne);
      if (!activite) throw new ErreurStockage('inconnue');
      return activite;
    },
    async supprimer(id) {
      await appel(() => client.from('game_activities').delete().eq('id', id));
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Version en mémoire (tests et usage sans compte)
// ---------------------------------------------------------------------------------------------------------------

export function magasinMemoire(): ActivitesStore {
  const lignes = new Map<string, ActiviteEnregistree>();
  let compteur = 0;
  const maintenant = () => new Date(1_700_000_000_000 + ++compteur * 1000).toISOString();
  return {
    async lister() {
      return [...lignes.values()].sort((a, b) => (a.misAJour < b.misAJour ? 1 : -1));
    },
    async enregistrer(b, id) {
      const cle = id ?? `m${++compteur}`;
      const activite: ActiviteEnregistree = { id: cle, titre: titreDe(b), niveau: b.niveau, matiere: b.matiere, misAJour: maintenant(), brouillon: copie(b) };
      lignes.set(cle, activite);
      return activite;
    },
    async supprimer(id) {
      lignes.delete(id);
    },
  };
}
