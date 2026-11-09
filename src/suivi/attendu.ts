/** Forme d'un code d'attendu : M. (mathématiques) ou F. (français), puis P1 à P6 et des segments alphanumériques. */
const FORME_ATTENDU = /^[MF]\.P[1-6](\.[A-Za-z0-9]+)+$/;

export function estCodeAttendu(code: string): boolean {
  return FORME_ATTENDU.test(code);
}
