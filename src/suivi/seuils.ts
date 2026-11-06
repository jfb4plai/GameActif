import type { StockageLocal } from '../compte/invitation.js';
import { SEUILS_ETATS_DEFAUT, type SeuilsEtats } from './agregats.js';

const cle = (classId: string) => `gameactif.seuils.v1.${classId}`;

const entierEntre = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

function valides(s: unknown): s is SeuilsEtats {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  return typeof o.reussite === 'number' && o.reussite >= 0.5 && o.reussite <= 1 && entierEntre(o.jeuxDifferents, 1, 7) && entierEntre(o.jours, 1, 10) && entierEntre(o.erreurRepetee, 2, 7);
}

/** Seuils d'une classe, enregistrés dans le navigateur de l'enseignant. Absents ou invalides : valeurs de départ. */
export function lireSeuils(s: StockageLocal | null, classId: string): SeuilsEtats {
  if (!s) return { ...SEUILS_ETATS_DEFAUT };
  try {
    const brut = s.getItem(cle(classId));
    if (brut === null) return { ...SEUILS_ETATS_DEFAUT };
    const v: unknown = JSON.parse(brut);
    return valides(v) ? { reussite: v.reussite, jeuxDifferents: v.jeuxDifferents, jours: v.jours, erreurRepetee: v.erreurRepetee } : { ...SEUILS_ETATS_DEFAUT };
  } catch {
    return { ...SEUILS_ETATS_DEFAUT };
  }
}

export function ecrireSeuils(s: StockageLocal | null, classId: string, seuils: SeuilsEtats): void {
  if (!s) return;
  try {
    s.setItem(cle(classId), JSON.stringify(seuils));
  } catch {
    // Stockage plein ou interdit : les seuils ne sont pas conservés, rien d'autre ne change.
  }
}
