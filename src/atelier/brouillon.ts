import type { Activity, Item } from '../engine/types.js';
import { availableMechanics, type MechanicAvailability } from '../engine/availability.js';
import { matieres } from '../data/catalogue.js';
import type { Brouillon, BrouillonLu, Famille, Ligne } from './types.js';
import { parseNombre, symboleJuste } from '../engine/nombres.js';

const estTexte = (x: unknown): x is string => typeof x === 'string';

/** Vrai si x a la forme d'un brouillon (types des champs, trois familles). Sert au stockage local et aux fichiers. */
export function formeBrouillonValide(x: unknown): x is BrouillonLu {
  if (typeof x !== 'object' || x === null) return false;
  const b = x as Record<string, unknown>;
  return (
    ['niveau', 'matiere', 'titre', 'contexte', 'paires', 'etapes'].every((k) => estTexte(b[k])) &&
    (b.comparaisons === undefined || estTexte(b.comparaisons)) &&
    (b.qcm === undefined || estTexte(b.qcm)) &&
    Array.isArray(b.cibles) &&
    b.cibles.every(estTexte) &&
    Array.isArray(b.familles) &&
    b.familles.length === 3 &&
    b.familles.every((f) => typeof f === 'object' && f !== null && estTexte((f as Record<string, unknown>).label) && estTexte((f as Record<string, unknown>).elements))
  );
}

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
    comparaisons: '',
    qcm: '',
  };
}

/** Ajoute des champs vides aux brouillons enregistrés avant les gabarits Comparer et QCM. */
export function completerBrouillon(b: BrouillonLu): Brouillon {
  return { ...b, comparaisons: b.comparaisons ?? '', qcm: b.qcm ?? '' };
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

const MSG_NOMBRE = (t: string) => `« ${t} » n’est pas un nombre : écrivez 12, 3,5 ou 3/4.`;

/** Lit « gauche | droite » (deux nombres) ligne par ligne ; le numéro de ligne compte aussi les lignes vides. */
export function analyseComparaisons(texte: string): { comparaisons: { gauche: string; droite: string }[]; erreurs: Ligne[] } {
  const comparaisons: { gauche: string; droite: string }[] = [];
  const erreurs: Ligne[] = [];
  texte.split(/\r?\n/).forEach((brut, i) => {
    if (brut.trim() === '') return;
    const numero = i + 1;
    const parts = brut.split('|');
    if (parts.length === 1) {
      erreurs.push({ numero, message: 'Il manque le séparateur « | » entre les deux nombres.' });
    } else if (parts.length > 2) {
      erreurs.push({ numero, message: 'Il y a plusieurs séparateurs « | » sur cette ligne.' });
    } else {
      const gauche = compacter(parts[0]);
      const droite = compacter(parts[1]);
      if (gauche === '' || droite === '') erreurs.push({ numero, message: 'Il manque un nombre d’un côté du séparateur.' });
      else if (parseNombre(gauche) === null) erreurs.push({ numero, message: MSG_NOMBRE(gauche) });
      else if (parseNombre(droite) === null) erreurs.push({ numero, message: MSG_NOMBRE(droite) });
      else comparaisons.push({ gauche, droite });
    }
  });
  return { comparaisons, erreurs };
}

/** Lit « question | bonne réponse | fausse 1 | … » (1 à 3 fausses) ligne par ligne. */
export function analyseQcm(texte: string): { questions: { question: string; bonne: string; fausses: string[] }[]; erreurs: Ligne[] } {
  const questions: { question: string; bonne: string; fausses: string[] }[] = [];
  const erreurs: Ligne[] = [];
  texte.split(/\r?\n/).forEach((brut, i) => {
    if (brut.trim() === '') return;
    const numero = i + 1;
    const parts = brut.split('|').map(compacter);
    if (parts.length < 3) {
      erreurs.push({ numero, message: 'Il faut la question, la bonne réponse et au moins une fausse réponse, séparées par « | ».' });
    } else if (parts.length > 5) {
      erreurs.push({ numero, message: 'Il y a plus de trois fausses réponses : gardez-en trois au maximum.' });
    } else if (parts.some((p) => p === '')) {
      erreurs.push({ numero, message: 'Il manque un texte entre deux séparateurs « | ».' });
    } else if (new Set(parts.slice(1).map((r) => r.toLowerCase())).size !== parts.length - 1) {
      erreurs.push({ numero, message: 'Deux réponses sont identiques.' });
    } else {
      questions.push({ question: parts[0], bonne: parts[1], fausses: parts.slice(2) });
    }
  });
  return { questions, erreurs };
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

  // Deux familles au même nom sont indiscernables pour l'élève : l'une accepterait un mot que l'autre refuse.
  const noms = new Map<string, { nom: string; numero: number }>();
  b.familles.forEach((f, i) => {
    if (f.label.trim() === '') return;
    const nom = compacter(f.label);
    const avant = noms.get(cle(nom));
    if (!avant) noms.set(cle(nom), { nom, numero: i + 1 });
    else {
      problemes.push(
        `Deux familles portent le même nom : « ${avant.nom} » (familles ${avant.numero} et ${i + 1}). Donnez-leur des noms différents ou regroupez leurs éléments dans une seule famille.`,
      );
    }
  });

  const { paires, erreurs } = analysePaires(b.paires);
  for (const e of erreurs) problemes.push(`Paires, ligne ${e.numero} : ${e.message}`);
  const gauches = new Set<string>();
  const droites = new Set<string>();
  for (const p of paires) {
    if (gauches.has(cle(p.gauche))) problemes.push(`Le mot « ${p.gauche} » est à gauche dans deux paires.`);
    if (droites.has(cle(p.droite))) problemes.push(`Le mot « ${p.droite} » est à droite dans deux paires.`);
    gauches.add(cle(p.gauche));
    droites.add(cle(p.droite));
  }

  const comp = analyseComparaisons(b.comparaisons ?? '');
  for (const e of comp.erreurs) problemes.push(`Comparaisons, ligne ${e.numero} : ${e.message}`);
  const vues = new Set<string>();
  for (const c of comp.comparaisons) {
    const k = `${cle(c.gauche)}|${cle(c.droite)}`;
    if (vues.has(k)) problemes.push(`La comparaison « ${c.gauche} | ${c.droite} » est écrite deux fois.`);
    vues.add(k);
  }

  const qcm = analyseQcm(b.qcm ?? '');
  for (const e of qcm.erreurs) problemes.push(`QCM, ligne ${e.numero} : ${e.message}`);
  const questionsVues = new Map<string, string>();
  for (const q of qcm.questions) {
    const avant = questionsVues.get(cle(q.question));
    if (avant !== undefined) problemes.push(`La question « ${avant} » est écrite deux fois.`);
    else questionsVues.set(cle(q.question), q.question);
  }
  return problemes;
}

/** Avertissements qui n'empêchent pas de continuer : une saisie qui rendrait le jeu trop facile à deviner. */
export function avertissementsSaisie(b: Brouillon): string[] {
  const valides = analyseComparaisons(b.comparaisons ?? '').comparaisons;
  if (valides.length < 3) return [];
  const symboles = new Set(
    valides
      .map((c) => symboleJuste(parseNombre(c.gauche) as number, parseNombre(c.droite) as number))
      .filter((sym) => sym !== '='),
  );
  return symboles.size === 1
    ? ['Toutes vos comparaisons donnent le même symbole : l’élève pourrait répondre sans comparer.']
    : [];
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

  const comparisons: NonNullable<Activity['comparisons']> = analyseComparaisons(b.comparaisons ?? '').comparaisons.map(
    (c, k) => ({ id: `c${k + 1}`, left: c.gauche, right: c.droite }),
  );
  const questions: NonNullable<Activity['questions']> = [];
  analyseQcm(b.qcm ?? '').questions.forEach((q, k) => {
    const id = `q${k + 1}`;
    items.push(item(id, q.question), item(`${id}r0`, q.bonne));
    q.fausses.forEach((texte, j) => items.push(item(`${id}r${j + 1}`, texte)));
    questions.push({ itemId: id, correctId: `${id}r0`, distractorIds: q.fausses.map((_, j) => `${id}r${j + 1}`) });
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
    comparisons,
    questions,
  };
}

/** Jeux disponibles avec ce qui est déjà saisi, avec le message du moteur pour les autres. */
export function statutsJeux(
  b: Brouillon,
): Record<'trier' | 'associer' | 'memo' | 'ordre' | 'comparer' | 'qcm', MechanicAvailability> {
  const m = availableMechanics(assembler(b));
  return { trier: m.trier, associer: m.associer, memo: m.memo, ordre: m.ordre, comparer: m.comparer, qcm: m.qcm };
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
