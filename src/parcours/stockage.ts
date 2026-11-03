import { formeBrouillonValide } from '../atelier/brouillon.js';
import { ETAPES, etatInitial, type EtatParcours } from './etapes.js';

export interface Stockage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const CLE = 'gameactif.brouillon.v1';

/** Lit le brouillon enregistré ; tout ce qui n'a pas la bonne forme redonne l'état de départ. */
export function chargerBrouillon(s: Stockage | null): EtatParcours {
  if (!s) return etatInitial();
  try {
    const brut = s.getItem(CLE);
    if (brut === null) return etatInitial();
    const x = JSON.parse(brut) as Record<string, unknown> | null;
    if (!x || typeof x !== 'object' || x.v !== 1 || !ETAPES.includes(x.etape as never) || !formeBrouillonValide(x.brouillon)) {
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
