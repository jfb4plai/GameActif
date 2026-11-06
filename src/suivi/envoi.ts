import { FORME_CODE_CLASSE, type ClasseAppareil } from './classeAppareil.js';
import type { SessionPayload } from './types.js';

/** Sous-ensemble de supabase-js utilisé ici : permet d'injecter un client factice dans les tests. */
export interface ClientSuivi {
  rpc(
    nom: 'game_class_info' | 'game_record_session',
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export type ResultatEnvoi = 'ok' | 'invalide' | 'limite' | 'echec';

/** Messages affichés à l'élève ou à l'enseignant : en français, sans détail technique. */
export const MESSAGES_ENVOI: Record<ResultatEnvoi, string> = {
  ok: 'Résultat enregistré.',
  invalide: 'Le résultat de ce tour n’a pas été enregistré : le code de classe, le code élève ou le contenu du tour n’a pas été accepté. Prévenez votre enseignant.',
  limite: 'Trop de résultats arrivent en même temps. Le résultat de ce tour n’a pas été enregistré.',
  echec: 'Le résultat de ce tour n’a pas été enregistré. Le jeu reste jouable.',
};

/**
 * Envoie la séance à la base. Ne lève jamais : toute panne devient « echec ». Seuls le code de classe, le code élève
 * et la séance partent ; il n'y a pas de file d'attente, un tour dont l'envoi échoue est perdu.
 */
export async function envoyerSession(client: ClientSuivi, classCode: string, studentCode: string, payload: SessionPayload): Promise<ResultatEnvoi> {
  try {
    const r = await client.rpc('game_record_session', { p_class_code: classCode, p_student_code: studentCode, p_payload: payload });
    if (r.error) return 'echec';
    return r.data === 'ok' || r.data === 'invalide' || r.data === 'limite' ? r.data : 'echec';
  } catch {
    return 'echec';
  }
}

/** Nombre de codes d'une classe, ou null (code inconnu, expiré, mal formé, réseau indisponible). */
export async function chercherClasse(client: ClientSuivi, classCode: string): Promise<ClasseAppareil | null> {
  if (!FORME_CODE_CLASSE.test(classCode)) return null;
  try {
    const r = await client.rpc('game_class_info', { p_class_code: classCode });
    if (r.error) return null;
    const n = r.data;
    return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 40 ? { code: classCode, nbCodes: n } : null;
  } catch {
    return null;
  }
}
