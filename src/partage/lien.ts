/** Groupe d'un lien du mode « un lien par groupe » : 1, 2 ou 3 (une couleur neutre chacun, voir niveaux.ts). */
export type Groupe = 1 | 2 | 3;

/** Forme d'un code d'activité : 8 caractères sans I, L, O, 0 ni 1 (voir `game_publish_activity`). */
export const FORME_CODE_ACTIVITE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/;

/** Lien court d'une activité partagée, avec le groupe quand il y en a un. */
export function lienActivite(origine: string, code: string, groupe?: Groupe): string {
  const base = `${origine.replace(/\/+$/, '')}/?activite=${code}`;
  return groupe === undefined ? base : `${base}&g=${groupe}`;
}

/**
 * Lit le code d'activité (et le groupe) dans l'adresse et rend l'adresse sans ces paramètres, pour qu'ils ne restent pas
 * affichés. null si le paramètre est absent ou n'a pas la forme d'un code. Un groupe invalide retombe sur le groupe 2.
 */
export function lireLienActivite(url: URL): { code: string; groupe: Groupe | null; urlNettoyee: string } | null {
  const params = new URLSearchParams(url.search);
  const code = params.get('activite');
  if (code === null || !FORME_CODE_ACTIVITE.test(code)) return null;
  const g = params.get('g');
  const groupe: Groupe | null = g === null ? null : g === '1' || g === '2' || g === '3' ? (Number(g) as Groupe) : 2;
  params.delete('activite');
  params.delete('g');
  const recherche = params.toString();
  return { code, groupe, urlNettoyee: `${url.pathname}${recherche === '' ? '' : `?${recherche}`}${url.hash}` };
}
