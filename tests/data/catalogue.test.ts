import { describe, it, expect } from 'vitest';
import { niveaux, matieres, competences, chercher } from '../../src/data/catalogue.js';

describe('niveaux et matières', () => {
  it('propose P1 à P6, dans l’ordre', () => {
    expect(niveaux()).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
  });

  it('propose les mathématiques pour un niveau présent dans les données', () => {
    expect(matieres('P4')).toEqual([{ id: 'mathematiques', label: 'Mathématiques' }]);
  });

  it('ne propose rien pour un niveau absent des données', () => {
    expect(matieres('S1')).toEqual([]);
    expect(matieres('')).toEqual([]);
  });
});

describe('competences', () => {
  it('groupe les attendus de P4 par sous-point, dans l’ordre du référentiel', () => {
    const groupes = competences('P4', 'mathematiques');
    expect(groupes).toHaveLength(11);
    expect(groupes[0].sousPoint).toBe('1.1');
    expect(groupes[0].titre).toContain('repérer');
    expect(groupes[0].attendus).toHaveLength(11);
    expect(groupes.reduce((n, g) => n + g.attendus.length, 0)).toBe(173);
  });

  it('ne mélange pas les niveaux', () => {
    for (const g of competences('P5', 'mathematiques')) {
      for (const a of g.attendus) expect(a.annee).toBe('P5');
    }
  });

  it('renvoie une liste vide pour un niveau ou une matière inconnus', () => {
    expect(competences('P9', 'mathematiques')).toEqual([]);
    expect(competences('P4', 'francais')).toEqual([]);
  });
});

describe('chercher', () => {
  const groupes = competences('P4', 'mathematiques');

  it('trouve un attendu sans tenir compte de la casse', () => {
    const r = chercher(groupes, 'POSITIONS relatives');
    expect(r.map((g) => g.sousPoint)).toEqual(['1.1']);
    expect(r[0].attendus.map((a) => a.code)).toContain('M.P4.1.1.i1.a2');
  });

  it('ignore les accents', () => {
    const r = chercher(groupes, 'deplacer');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].attendus.every((a) => /d[ée]placer/i.test(a.texte))).toBe(true);
  });

  it('renvoie une liste vide quand rien ne correspond, tous les groupes quand la recherche est vide', () => {
    expect(chercher(groupes, 'zzzz')).toEqual([]);
    expect(chercher(groupes, '   ')).toHaveLength(11);
  });

  it('retire les groupes devenus vides', () => {
    for (const g of chercher(groupes, 'positions relatives')) expect(g.attendus.length).toBeGreaterThan(0);
  });
});
