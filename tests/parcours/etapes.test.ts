import { describe, it, expect } from 'vitest';
import { ETAPES, etatInitial, reduire, problemesEtape, type EtatParcours } from '../../src/parcours/etapes.js';
import { brouillonVide } from '../../src/atelier/brouillon.js';

function a(etat: EtatParcours, ...evs: Parameters<typeof reduire>[1][]): EtatParcours {
  return evs.reduce((e, ev) => reduire(e, ev), etat);
}

function pretPourElements(): EtatParcours {
  return a(
    etatInitial(),
    { type: 'choisirNiveau', niveau: 'P4' },
    { type: 'suivant' },
    { type: 'choisirMatiere', matiere: 'mathematiques' },
    { type: 'suivant' },
    { type: 'basculerCible', code: 'M.P4.1.1.i1.a1' },
    { type: 'suivant' },
  );
}

const valide = {
  titre: 'Les positions',
  contexte: '18 élèves de 4e primaire.',
  familles: [
    { label: 'Absolue', elements: 'entre\nà l’intérieur' },
    { label: 'Relative', elements: 'devant\nà gauche' },
    { label: '', elements: '' },
  ],
};

describe('parcours, étapes', () => {
  it('commence à l’étape niveau et les étapes sont dans l’ordre prévu', () => {
    expect(etatInitial().etape).toBe('niveau');
    expect(ETAPES).toEqual(['niveau', 'matiere', 'competences', 'elements', 'jeux']);
  });

  it('suivant sans niveau reste à l’étape et dit pourquoi', () => {
    const e = a(etatInitial(), { type: 'suivant' });
    expect(e.etape).toBe('niveau');
    expect(problemesEtape(e)).toEqual(['Choisissez un niveau.']);
  });

  it('choisir P4 puis suivant mène à la matière', () => {
    const e = a(etatInitial(), { type: 'choisirNiveau', niveau: 'P4' }, { type: 'suivant' });
    expect(e.etape).toBe('matiere');
    expect(e.brouillon.niveau).toBe('P4');
  });

  it('refuse un niveau ou une matière absents des données', () => {
    expect(a(etatInitial(), { type: 'choisirNiveau', niveau: 'S1' }).brouillon.niveau).toBe('');
    const e = a(etatInitial(), { type: 'choisirNiveau', niveau: 'P4' }, { type: 'choisirMatiere', matiere: 'histoire' });
    expect(e.brouillon.matiere).toBe('');
  });

  it('en français : un attendu F. est accepté, un attendu de maths est refusé, et changer de matière retire les cibles de l’autre', () => {
    let e = a(etatInitial(), { type: 'choisirNiveau', niveau: 'P3' }, { type: 'suivant' }, { type: 'choisirMatiere', matiere: 'francais' }, { type: 'suivant' });
    e = a(e, { type: 'basculerCible', code: 'F.P3.r1.i1.a1' });
    expect(e.brouillon.cibles).toEqual(['F.P3.r1.i1.a1']);
    expect(a(e, { type: 'basculerCible', code: 'M.P3.1.1.i1.a1' }).brouillon.cibles).toEqual(['F.P3.r1.i1.a1']);
    expect(a(e, { type: 'choisirMatiere', matiere: 'mathematiques' }).brouillon.cibles).toEqual([]);
  });

  it('à l’étape compétences, exige de 1 à 3 attendus et refuse le quatrième', () => {
    let e = a(etatInitial(), { type: 'choisirNiveau', niveau: 'P4' }, { type: 'suivant' }, { type: 'choisirMatiere', matiere: 'mathematiques' }, { type: 'suivant' });
    expect(e.etape).toBe('competences');
    expect(a(e, { type: 'suivant' }).etape).toBe('competences');
    expect(problemesEtape(e)).toEqual(['Choisissez de 1 à 3 compétences.']);
    for (const c of ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3']) e = a(e, { type: 'basculerCible', code: c });
    const quatre = a(e, { type: 'basculerCible', code: 'M.P4.1.1.i2.a1' });
    expect(quatre).toBe(e);
    expect(quatre.brouillon.cibles).toHaveLength(3);
    expect(a(e, { type: 'basculerCible', code: 'M.P4.1.1.i1.a2' }).brouillon.cibles).toEqual(['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a3']);
  });

  it('refuse un code qui n’existe pas pour ce niveau', () => {
    const e = a(etatInitial(), { type: 'choisirNiveau', niveau: 'P4' }, { type: 'suivant' }, { type: 'choisirMatiere', matiere: 'mathematiques' }, { type: 'suivant' });
    expect(a(e, { type: 'basculerCible', code: 'M.P3.1.1.i1.a1' }).brouillon.cibles).toEqual([]);
    expect(a(e, { type: 'basculerCible', code: 'M.P9.9.9.i9.a9' }).brouillon.cibles).toEqual([]);
  });

  it('changer de niveau retire les compétences d’un autre niveau (Review Focus 3)', () => {
    let e = pretPourElements();
    expect(e.brouillon.cibles).toEqual(['M.P4.1.1.i1.a1']);
    e = a(e, { type: 'choisirNiveau', niveau: 'P5' });
    expect(e.brouillon.niveau).toBe('P5');
    expect(e.brouillon.cibles).toEqual([]);
    expect(e.brouillon.cibles.some((c) => c.startsWith('M.P4.'))).toBe(false);
  });

  it('rechoisir le même niveau ne change rien', () => {
    const e = pretPourElements();
    expect(a(e, { type: 'choisirNiveau', niveau: 'P4' })).toBe(e);
  });

  it('à l’étape éléments, exige titre et contexte, pas de jeu rempli (le mode Libre part des compétences)', () => {
    let e = pretPourElements();
    expect(e.etape).toBe('elements');
    expect(problemesEtape(e)).toContain('Le titre est obligatoire.');
    expect(a(e, { type: 'suivant' }).etape).toBe('elements');
    e = a(e, { type: 'modifier', champ: { titre: valide.titre, contexte: valide.contexte } });
    expect(problemesEtape(e)).toEqual([]);
    expect(problemesEtape(e).join(' ')).not.toContain('au moins un jeu');
    expect(a(e, { type: 'suivant' }).etape).toBe('jeux');
  });

  it('trois lignes de QCM suffisent pour passer aux jeux', () => {
    let e = pretPourElements();
    e = a(e, { type: 'modifier', champ: { titre: valide.titre, contexte: valide.contexte, qcm: 'A ? | a | b\nB ? | a | b\nC ? | a | b' } });
    expect(problemesEtape(e)).toEqual([]);
    expect(a(e, { type: 'suivant' }).etape).toBe('jeux');
  });

  it('un brouillon incohérent (mot dans deux familles) bloque le passage aux jeux', () => {
    let e = pretPourElements();
    e = a(e, { type: 'modifier', champ: { ...valide, familles: [{ label: 'A', elements: 'entre\nx' }, { label: 'B', elements: 'entre\ny' }, { label: '', elements: '' }] } });
    expect(problemesEtape(e).some((p) => p.includes('« entre » est dans deux familles'))).toBe(true);
    expect(a(e, { type: 'suivant' }).etape).toBe('elements');
  });

  it('précédent revient d’une étape sans rien effacer', () => {
    const e = a(pretPourElements(), { type: 'modifier', champ: { titre: 'Mon titre' } });
    const retour = a(e, { type: 'precedent' });
    expect(retour.etape).toBe('competences');
    expect(retour.brouillon.titre).toBe('Mon titre');
    expect(retour.brouillon.cibles).toEqual(['M.P4.1.1.i1.a1']);
    expect(a(etatInitial(), { type: 'precedent' }).etape).toBe('niveau');
  });

  it('aller en arrière est libre, aller en avant exige des étapes valides', () => {
    const e = pretPourElements();
    expect(a(e, { type: 'aller', etape: 'niveau' }).etape).toBe('niveau');
    const debut = a(etatInitial(), { type: 'choisirNiveau', niveau: 'P4' });
    expect(a(debut, { type: 'aller', etape: 'competences' }).etape).toBe('niveau');
    expect(a(debut, { type: 'aller', etape: 'matiere' }).etape).toBe('matiere');
  });

  it('recommencer rend un brouillon vide à l’étape niveau', () => {
    const e = a(pretPourElements(), { type: 'recommencer' });
    expect(e).toEqual({ etape: 'niveau', brouillon: brouillonVide() });
  });

  it('deux familles au même nom bloquent le passage aux jeux', () => {
    let e = pretPourElements();
    const familles = [
      { label: 'Position absolue', elements: 'entre\nsur' },
      { label: 'Position absolue', elements: 'sous\ndans' },
      { label: '', elements: '' },
    ];
    e = a(e, { type: 'modifier', champ: { ...valide, familles } });
    expect(problemesEtape(e).some((p) => p.startsWith('Deux familles portent le même nom'))).toBe(true);
    expect(a(e, { type: 'suivant' }).etape).toBe('elements');
  });

  it('charger remplace le brouillon et place l’étape sur les éléments', () => {
    const importe = { ...brouillonVide(), niveau: 'P5', matiere: 'mathematiques', cibles: ['M.P5.2.4.i1.a4'], titre: 'Importée' };
    const e = a(etatInitial(), { type: 'charger', brouillon: importe });
    expect(e.etape).toBe('elements');
    expect(e.brouillon).toEqual(importe);
  });

  it('un brouillon chargé reste modifiable', () => {
    const importe = { ...brouillonVide(), niveau: 'P5', matiere: 'mathematiques', cibles: ['M.P5.2.4.i1.a4'], titre: 'Importée' };
    const e = a(etatInitial(), { type: 'charger', brouillon: importe }, { type: 'modifier', champ: { titre: 'Retouchée' } });
    expect(e.brouillon.titre).toBe('Retouchée');
    expect(a(e, { type: 'precedent' }).etape).toBe('competences');
  });
});
