import { ETAPES, etatInitial, type EtatParcours } from './etapes.js';

export interface Stockage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const CLE = 'gameactif.brouillon.v1';

const estTexte = (x: unknown): x is string => typeof x === 'string';

function brouillonValide(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false;
  const b = x as Record<string, unknown>;
  return (
    ['niveau', 'matiere', 'titre', 'contexte', 'paires', 'etapes'].every((k) => estTexte(b[k])) &&
    Array.isArray(b.cibles) &&
    b.cibles.every(estTexte) &&
    Array.isArray(b.familles) &&
    b.familles.length === 3 &&
    b.familles.every((f) => typeof f === 'object' && f !== null && estTexte((f as Record<string, unknown>).label) && estTexte((f as Record<string, unknown>).elements))
  );
}

/** Lit le brouillon enregistré ; tout ce qui n'a pas la bonne forme redonne l'état de départ. */
export function chargerBrouillon(s: Stockage | null): EtatParcours {
  if (!s) return etatInitial();
  try {
    const brut = s.getItem(CLE);
    if (brut === null) return etatInitial();
    const x = JSON.parse(brut) as Record<string, unknown> | null;
    if (!x || typeof x !== 'object' || x.v !== 1 || !ETAPES.includes(x.etape as never) || !brouillonValide(x.brouillon)) {
      return etatInitial();
    }
    return { etape: x.etape as EtatParcours['etape'], brouillon: x.brouillon as EtatParcours['brouillon'] };
  } catch {
    return etatInitial();
  }
}

/** Enregistre le brouillon dans le navigateur ; l'étape des jeux n'est jamais conservée. Une écriture refusée est ignorée. */
export function sauverBrouillon(s: Stockage | null, etat: EtatParcours): void {
  if (!s) return;
  try {
    const etape = etat.etape === 'jeux' ? 'elements' : etat.etape;
    s.setItem(CLE, JSON.stringify({ v: 1, etape, brouillon: etat.brouillon }));
  } catch {
    // stockage plein, bloqué ou navigation privée : le parcours continue sans sauvegarde
  }
}
