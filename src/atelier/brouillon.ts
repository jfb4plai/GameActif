import type { Activity, Item } from '../engine/types.js';
import { availableMechanics, type MechanicAvailability } from '../engine/availability.js';
import { matieres } from '../data/catalogue.js';
import type { Brouillon, Famille, Ligne } from './types.js';

export function brouillonVide(): Brouillon {
  return {
    niveau: '',
    matiere: '',
    cibles: [],
    titre: '',
    contexte: '',
    familles: [
      { label: '', elements: '' },
      { label: '', elements: '' },
      { label: '', elements: '' },
    ],
    paires: '',
    etapes: '',
  };
}

/** « P1 » devient « 1re primaire », « P4 » devient « 4e primaire ». */
export function libelleNiveau(niveau: string): string {
  const n = Number(niveau.replace(/^P/, ''));
  if (!Number.isInteger(n) || n < 1) return niveau;
  return n === 1 ? '1re primaire' : `${n}e primaire`;
}

const compacter = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Une entrée par ligne non vide ; espaces de bord retirés, espaces multiples réduits à un seul. */
export function lignes(texte: string): string[] {
  return texte
    .split(/\r?\n/)
    .map(compacter)
    .filter((l) => l !== '');
}

/** Lit « gauche | droite » ligne par ligne ; le numéro de ligne compte aussi les lignes vides. */
export function analysePaires(texte: string): { paires: { gauche: string; droite: string }[]; erreurs: Ligne[] } {
  const paires: { gauche: string; droite: string }[] = [];
  const erreurs: Ligne[] = [];
  texte.split(/\r?\n/).forEach((brut, i) => {
    if (brut.trim() === '') return;
    const numero = i + 1;
    const parts = brut.split('|');
    if (parts.length === 1) {
      erreurs.push({ numero, message: 'Il manque le séparateur « | » entre les deux éléments.' });
    } else if (parts.length > 2) {
      erreurs.push({ numero, message: 'Il y a plusieurs séparateurs « | » sur cette ligne.' });
    } else {
      const gauche = compacter(parts[0]);
      const droite = compacter(parts[1]);
      if (gauche === '' || droite === '') erreurs.push({ numero, message: 'Il manque un élément d’un côté du séparateur.' });
      else paires.push({ gauche, droite });
    }
  });
  return { paires, erreurs };
}

const cle = (s: string) => s.toLowerCase();
const nomFamille = (f: Famille, i: number) => (f.label.trim() !== '' ? compacter(f.label) : `Famille ${i + 1}`);
const estVide = (f: Famille) => f.label.trim() === '' && lignes(f.elements).length === 0;

/** Problèmes de la saisie elle-même (doublons, paires mal écrites), sans les champs obligatoires. */
export function problemesSaisie(b: Brouillon): string[] {
  const problemes: string[] = [];
  const vu = new Map<string, { texte: string; famille: number }>();
  b.familles.forEach((f, i) => {
    if (estVide(f)) return;
    const elements = lignes(f.elements);
    if (f.label.trim() === '' && elements.length > 0) problemes.push(`La famille ${i + 1} a des éléments mais pas de nom.`);
    for (const texte of elements) {
      const avant = vu.get(cle(texte));
      if (!avant) vu.set(cle(texte), { texte, famille: i });
      else if (avant.famille === i) problemes.push(`Le mot « ${avant.texte} » est écrit deux fois dans la famille ${nomFamille(f, i)}.`);
      else problemes.push(`Le mot « ${avant.texte} » est dans deux familles : ${nomFamille(b.familles[avant.famille], avant.famille)} et ${nomFamille(f, i)}.`);
    }
  });

  const { paires, erreurs } = analysePaires(b.paires);
  for (const e of erreurs) problemes.push(`Paires, ligne ${e.numero} : ${e.message}`);
  const gauches = new Set<string>();
  for (const p of paires) {
    if (gauches.has(cle(p.gauche))) problemes.push(`Le mot « ${p.gauche} » est à gauche dans deux paires.`);
    gauches.add(cle(p.gauche));
  }
  return problemes;
}

/** Problèmes de cohérence du brouillon, en français. Liste vide : le brouillon peut devenir une activité. */
export function problemesBrouillon(b: Brouillon): string[] {
  const problemes: string[] = [];
  if (b.titre.trim() === '') problemes.push('Le titre est obligatoire.');
  if (b.contexte.trim() === '') problemes.push('Le contexte de classe est obligatoire.');
  if (b.cibles.length < 1 || b.cibles.length > 3) problemes.push('Il faut choisir de 1 à 3 compétences visées.');
  return [...problemes, ...problemesSaisie(b)];
}

function item(id: string, text: string): Item {
  return { id, text, difficulty: 'moyen', validated: true, origin: 'manuel', modified: false };
}

/**
 * Assemble les éléments saisis en activité, sans contrôler le brouillon : sert à connaître les jeux déjà
 * disponibles pendant la saisie. Une famille vide est ignorée ; les autres gardent leur numéro de position.
 */
function assembler(b: Brouillon): Activity {
  const items: Item[] = [];
  const categories: Activity['categories'] = [];
  const memberships: Activity['memberships'] = [];
  b.familles.forEach((f, i) => {
    const elements = lignes(f.elements);
    if (estVide(f) || elements.length === 0) return;
    const id = `f${i + 1}`;
    categories.push({ id, label: nomFamille(f, i) });
    elements.forEach((texte, j) => {
      items.push(item(`${id}e${j + 1}`, texte));
      memberships.push({ itemId: `${id}e${j + 1}`, categoryId: id });
    });
  });

  const pairs: Activity['pairs'] = [];
  analysePaires(b.paires).paires.forEach((p, k) => {
    items.push(item(`p${k + 1}g`, p.gauche), item(`p${k + 1}d`, p.droite));
    pairs.push({ leftId: `p${k + 1}g`, rightId: `p${k + 1}d` });
  });

  const ranks: Activity['ranks'] = [];
  lignes(b.etapes).forEach((texte, k) => {
    items.push(item(`s${k + 1}`, texte));
    ranks.push({ itemId: `s${k + 1}`, position: k + 1 });
  });

  const matiere = matieres(b.niveau).find((m) => m.id === b.matiere);
  return {
    id: 'atelier',
    title: compacter(b.titre),
    discipline: matiere?.label ?? b.matiere,
    year: libelleNiveau(b.niveau),
    context: b.contexte.trim(),
    cibles: [...b.cibles],
    items,
    categories,
    pairs,
    memberships,
    ranks,
  };
}

/** Jeux disponibles avec ce qui est déjà saisi, avec le message du moteur pour les autres. */
export function statutsJeux(b: Brouillon): Record<'trier' | 'associer' | 'ordre', MechanicAvailability> {
  const m = availableMechanics(assembler(b));
  return { trier: m.trier, associer: m.associer, ordre: m.ordre };
}

/**
 * Transforme le brouillon en activité du moteur. Les éléments tapés par l'enseignant sont validés
 * (il les a écrits). Lève une erreur si le brouillon a des problèmes.
 */
export function construireActivite(b: Brouillon): Activity {
  const problemes = problemesBrouillon(b);
  if (problemes.length > 0) throw new Error(problemes.join(' '));
  return assembler(b);
}
