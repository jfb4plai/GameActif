/** Message affiché pour tout code refusé : inconnu, expiré, épuisé ou révoqué ne sont pas distingués. */
export const MESSAGE_INVITATION_INVALIDE = 'Ce lien d’invitation n’est plus valable. Demandez-en un nouveau.';

const CLE = 'gameactif.invitation';
const FORME = /^[A-Za-z0-9_-]{32}$/;

/** Forme attendue d'un code (32 caractères). Sert à refuser tôt une saisie absurde, jamais à décider de sa validité. */
export function codePlausible(code: string): boolean {
  return FORME.test(code);
}

/** Lit le code dans l'adresse (`?invitation=`) et rend l'adresse sans ce paramètre, pour qu'il ne reste pas affiché. */
export function lireCodeDansAdresse(url: URL): { code: string | null; urlNettoyee: string } {
  const params = new URLSearchParams(url.search);
  const code = params.get('invitation');
  params.delete('invitation');
  const recherche = params.toString();
  return { code, urlNettoyee: `${url.pathname}${recherche === '' ? '' : `?${recherche}`}${url.hash}` };
}

export interface StockageLocal {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Garde le code le temps de la confirmation par courriel. Un stockage absent ou qui refuse est ignoré. */
export function conserverCode(s: StockageLocal | null, code: string): void {
  if (!s || !codePlausible(code)) return;
  try {
    s.setItem(CLE, code);
  } catch {
    // stockage plein ou bloqué : le code reste dans l'adresse tant que la page n'est pas rechargée
  }
}

export function codeConserve(s: StockageLocal | null): string | null {
  if (!s) return null;
  try {
    const v = s.getItem(CLE);
    return v !== null && codePlausible(v) ? v : null;
  } catch {
    return null;
  }
}

export function oublierCode(s: StockageLocal | null): void {
  if (!s) return;
  try {
    s.removeItem(CLE);
  } catch {
    // rien à faire
  }
}

export type ResultatInvitation = 'ok' | 'deja' | 'invalide' | 'reseau';

type Rpc = (nom: string, args: { code: string }) => PromiseLike<{ data: unknown; error: unknown }>;

/**
 * Utilise le code côté serveur. Seules les réponses « ok » et « deja » ouvrent l'accès ; toute autre réponse,
 * même inattendue, est « invalide ». Une panne d'appel est « reseau » (le code est alors conservé par l'appelant).
 * Le code n'est jamais écrit dans la console.
 */
export async function utiliserInvitation(rpc: Rpc, code: string): Promise<ResultatInvitation> {
  if (!codePlausible(code)) return 'invalide';
  let reponse: { data: unknown; error: unknown };
  try {
    reponse = await rpc('game_redeem_invitation', { code });
  } catch {
    return 'reseau';
  }
  if (reponse.error) return 'reseau';
  return reponse.data === 'ok' || reponse.data === 'deja' ? reponse.data : 'invalide';
}
