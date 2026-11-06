import type { StockageLocal } from '../compte/invitation.js';

/** Classe associée à cet appareil : le code de classe (donné par l'enseignant) et le nombre de codes élèves. */
export interface ClasseAppareil {
  code: string;
  nbCodes: number;
}

const CLE = 'gameactif.classe.v1';
/** Forme d'un code de classe : 8 caractères sans I, L, O, 0 ni 1 (voir `game_create_class`). */
export const FORME_CODE_CLASSE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/;

function valide(c: unknown): c is ClasseAppareil {
  if (typeof c !== 'object' || c === null) return false;
  const o = c as { code?: unknown; nbCodes?: unknown };
  return typeof o.code === 'string' && FORME_CODE_CLASSE.test(o.code) && typeof o.nbCodes === 'number' && Number.isInteger(o.nbCodes) && o.nbCodes >= 1 && o.nbCodes <= 40;
}

/** Relit la classe de l'appareil. Stockage absent, refusé ou contenu inattendu : null. */
export function lireClasse(s: StockageLocal | null): ClasseAppareil | null {
  if (!s) return null;
  try {
    const brut = s.getItem(CLE);
    if (brut === null) return null;
    const c: unknown = JSON.parse(brut);
    return valide(c) ? { code: c.code, nbCodes: c.nbCodes } : null;
  } catch {
    return null;
  }
}

/** Garde le code de classe et le nombre de codes, rien d'autre. Un stockage absent ou qui refuse est ignoré. */
export function enregistrerClasse(s: StockageLocal | null, c: ClasseAppareil): void {
  if (!s) return;
  try {
    s.setItem(CLE, JSON.stringify({ code: c.code, nbCodes: c.nbCodes }));
  } catch {
    // Stockage plein ou interdit : l'appareil n'est pas associé, rien d'autre ne change.
  }
}

export function oublierClasse(s: StockageLocal | null): void {
  if (!s) return;
  try {
    s.removeItem(CLE);
  } catch {
    // Rien à faire : au pire, la classe reste associée.
  }
}
