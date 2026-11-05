import type { Brouillon } from '../atelier/types.js';
import { brouillonVide, construireActivite, problemesBrouillon } from '../atelier/brouillon.js';
import { availableMechanics } from '../engine/availability.js';
import { niveaux, matieres } from '../data/catalogue.js';
import { REFERENTIEL } from '../data/referentiel.js';

export type Etape = 'niveau' | 'matiere' | 'competences' | 'elements' | 'jeux';
export const ETAPES: Etape[] = ['niveau', 'matiere', 'competences', 'elements', 'jeux'];

export interface EtatParcours {
  etape: Etape;
  brouillon: Brouillon;
}

export type Evenement =
  | { type: 'choisirNiveau'; niveau: string }
  | { type: 'choisirMatiere'; matiere: string }
  | { type: 'basculerCible'; code: string }
  | { type: 'modifier'; champ: Partial<Brouillon> }
  | { type: 'suivant' }
  | { type: 'precedent' }
  | { type: 'aller'; etape: Etape }
  | { type: 'charger'; brouillon: Brouillon }
  | { type: 'recommencer' };

const MAX_CIBLES = 3;

export function etatInitial(): EtatParcours {
  return { etape: 'niveau', brouillon: brouillonVide() };
}

/** Problèmes qui empêchent de passer à l'étape suivante ; liste vide : on peut avancer. */
export function problemesEtape(etat: EtatParcours): string[] {
  const b = etat.brouillon;
  switch (etat.etape) {
    case 'niveau':
      return b.niveau === '' ? ['Choisissez un niveau.'] : [];
    case 'matiere':
      return b.matiere === '' ? ['Choisissez une matière.'] : [];
    case 'competences':
      return b.cibles.length >= 1 && b.cibles.length <= MAX_CIBLES ? [] : ['Choisissez de 1 à 3 compétences.'];
    case 'elements': {
      const problemes = problemesBrouillon(b);
      if (problemes.length > 0) return problemes;
      const jeux = Object.values(availableMechanics(construireActivite(b)));
      return jeux.some((m) => m.available) ? [] : ['Il faut remplir au moins un jeu : des familles, des paires, des étapes, des comparaisons ou des questions.'];
    }
    case 'jeux':
      return [];
  }
}

const existe = (niveau: string, matiere: string, code: string) =>
  REFERENTIEL.some((e) => e.code === code && e.annee === niveau && e.matiere === matiere);

function avec(etat: EtatParcours, champ: Partial<Brouillon>): EtatParcours {
  return { ...etat, brouillon: { ...etat.brouillon, ...champ } };
}

export function reduire(etat: EtatParcours, ev: Evenement): EtatParcours {
  const b = etat.brouillon;
  switch (ev.type) {
    case 'choisirNiveau': {
      if (!niveaux().includes(ev.niveau) || ev.niveau === b.niveau) return etat;
      const matiere = matieres(ev.niveau).some((m) => m.id === b.matiere) ? b.matiere : '';
      const cibles = b.cibles.filter((c) => matiere !== '' && existe(ev.niveau, matiere, c));
      return avec(etat, { niveau: ev.niveau, matiere, cibles });
    }
    case 'choisirMatiere': {
      if (!matieres(b.niveau).some((m) => m.id === ev.matiere) || ev.matiere === b.matiere) return etat;
      return avec(etat, { matiere: ev.matiere, cibles: b.cibles.filter((c) => existe(b.niveau, ev.matiere, c)) });
    }
    case 'basculerCible': {
      if (b.cibles.includes(ev.code)) return avec(etat, { cibles: b.cibles.filter((c) => c !== ev.code) });
      if (!existe(b.niveau, b.matiere, ev.code) || b.cibles.length >= MAX_CIBLES) return etat;
      return avec(etat, { cibles: [...b.cibles, ev.code] });
    }
    case 'modifier':
      return avec(etat, ev.champ);
    case 'suivant': {
      const i = ETAPES.indexOf(etat.etape);
      if (problemesEtape(etat).length > 0 || i === ETAPES.length - 1) return etat;
      return { ...etat, etape: ETAPES[i + 1] };
    }
    case 'precedent': {
      const i = ETAPES.indexOf(etat.etape);
      return i === 0 ? etat : { ...etat, etape: ETAPES[i - 1] };
    }
    case 'aller': {
      const depuis = ETAPES.indexOf(etat.etape);
      const vers = ETAPES.indexOf(ev.etape);
      if (vers <= depuis) return vers === depuis ? etat : { ...etat, etape: ev.etape };
      const bloque = ETAPES.slice(depuis, vers).some((e) => problemesEtape({ ...etat, etape: e }).length > 0);
      return bloque ? etat : { ...etat, etape: ev.etape };
    }
    case 'charger':
      return { etape: 'elements', brouillon: ev.brouillon };
    case 'recommencer':
      return etatInitial();
  }
}
