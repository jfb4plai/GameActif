import { describe, it, expect } from 'vitest';
import {
  analyseComparaisons,
  analyseQcm,
  avertissementsSaisie,
  brouillonVide,
  completerBrouillon,
  construireActivite,
  formeBrouillonValide,
  problemesSaisie,
  statutsJeux,
} from '../../src/atelier/brouillon.js';
import type { Brouillon } from '../../src/atelier/types.js';

function base(over: Partial<Brouillon> = {}): Brouillon {
  return {
    ...brouillonVide(),
    niveau: 'P4',
    matiere: 'mathematiques',
    cibles: ['M.P4.1.1.i1.a1'],
    titre: 'Plus grand, plus petit',
    contexte: '18 élèves de 4e primaire.',
    ...over,
  };
}

describe('anciens brouillons (Review Focus 1)', () => {
  it('formeBrouillonValide accepte un brouillon sans comparaisons ni qcm, refuse un mauvais type', () => {
    const { comparaisons: _c, qcm: _q, ...ancien } = base();
    expect(formeBrouillonValide(ancien)).toBe(true);
    expect(formeBrouillonValide({ ...ancien, comparaisons: 3 })).toBe(false);
    expect(formeBrouillonValide({ ...ancien, qcm: ['x'] })).toBe(false);
  });

  it('completerBrouillon ajoute des champs vides, sans toucher au reste', () => {
    const { comparaisons: _c, qcm: _q, ...ancien } = base();
    const b = completerBrouillon(ancien);
    expect(b.comparaisons).toBe('');
    expect(b.qcm).toBe('');
    expect(b.titre).toBe('Plus grand, plus petit');
  });

  it('un brouillon sans les nouveaux champs ne fait planter ni la saisie ni la construction', () => {
    const { comparaisons: _c, qcm: _q, ...ancien } = base();
    expect(() => problemesSaisie(ancien as Brouillon)).not.toThrow();
    expect(() => statutsJeux(ancien as Brouillon)).not.toThrow();
    expect(() => avertissementsSaisie(ancien as Brouillon)).not.toThrow();
  });
});

describe('analyseComparaisons (Review Focus 2)', () => {
  it('lit une comparaison par ligne', () => {
    const r = analyseComparaisons('12 | 8\n3,5 | 3/4\n\n 7|9 ');
    expect(r.erreurs).toEqual([]);
    expect(r.comparaisons).toEqual([
      { gauche: '12', droite: '8' },
      { gauche: '3,5', droite: '3/4' },
      { gauche: '7', droite: '9' },
    ]);
  });

  it('explique chaque ligne mal écrite, avec son numéro', () => {
    const r = analyseComparaisons('12\n12 | 8 | 3\n12 |\nabc | 2\n1/0 | 2\n3,5,2 | 1');
    expect(r.comparaisons).toEqual([]);
    expect(r.erreurs).toEqual([
      { numero: 1, message: 'Il manque le séparateur « | » entre les deux nombres.' },
      { numero: 2, message: 'Il y a plusieurs séparateurs « | » sur cette ligne.' },
      { numero: 3, message: 'Il manque un nombre d’un côté du séparateur.' },
      { numero: 4, message: '« abc » n’est pas un nombre : écrivez 12, 3,5 ou 3/4.' },
      { numero: 5, message: '« 1/0 » n’est pas un nombre : écrivez 12, 3,5 ou 3/4.' },
      { numero: 6, message: '« 3,5,2 » n’est pas un nombre : écrivez 12, 3,5 ou 3/4.' },
    ]);
  });
});

describe('analyseQcm', () => {
  it('lit question, bonne réponse et fausses réponses', () => {
    const r = analyseQcm('Quel symbole veut dire « plus grand que » ? | > | < | =\nCombien font 2 + 2 ? | 4 | 5');
    expect(r.erreurs).toEqual([]);
    expect(r.questions).toEqual([
      { question: 'Quel symbole veut dire « plus grand que » ?', bonne: '>', fausses: ['<', '='] },
      { question: 'Combien font 2 + 2 ?', bonne: '4', fausses: ['5'] },
    ]);
  });

  it('explique chaque ligne mal écrite', () => {
    const r = analyseQcm('Seule question\nQ ? | oui\nQ ? | a | b | c | d | e\nQ ? | a | | b\nQ ? | a | A');
    expect(r.questions).toEqual([]);
    expect(r.erreurs.map((e) => e.numero)).toEqual([1, 2, 3, 4, 5]);
    expect(r.erreurs[0].message).toBe('Il faut la question, la bonne réponse et au moins une fausse réponse, séparées par « | ».');
    expect(r.erreurs[2].message).toBe('Il y a plus de trois fausses réponses : gardez-en trois au maximum.');
    expect(r.erreurs[3].message).toBe('Il manque un texte entre deux séparateurs « | ».');
    expect(r.erreurs[4].message).toBe('Deux réponses sont identiques.');
  });
});

describe('problemesSaisie, nouveaux champs', () => {
  it('signale les lignes illisibles avec leur section', () => {
    const p = problemesSaisie(base({ comparaisons: '12\n7 | 9', qcm: 'Q ? | oui' }));
    expect(p).toContain('Comparaisons, ligne 1 : Il manque le séparateur « | » entre les deux nombres.');
    expect(p.some((x) => x.startsWith('QCM, ligne 1 : '))).toBe(true);
  });

  it('signale une comparaison ou une question écrite deux fois', () => {
    const p = problemesSaisie(base({ comparaisons: '12 | 8\n12 | 8', qcm: 'Q ? | a | b\nq ? | c | d' }));
    expect(p).toContain('La comparaison « 12 | 8 » est écrite deux fois.');
    expect(p).toContain('La question « Q ? » est écrite deux fois.');
  });
});

describe('avertissementsSaisie', () => {
  it('signale trois comparaisons ou plus qui donnent toutes le même symbole', () => {
    expect(avertissementsSaisie(base({ comparaisons: '5 | 3\n9 | 1\n8 | 2' }))).toEqual([
      'Toutes vos comparaisons donnent le même symbole : l’élève pourrait répondre sans comparer.',
    ]);
    expect(avertissementsSaisie(base({ comparaisons: '5 | 3\n9 | 1\n4 | 4' }))).toHaveLength(1);
  });

  it('se tait avec un mélange de symboles ou moins de trois lignes', () => {
    expect(avertissementsSaisie(base({ comparaisons: '5 | 3\n1 | 9\n8 | 2' }))).toEqual([]);
    expect(avertissementsSaisie(base({ comparaisons: '5 | 3\n9 | 1' }))).toEqual([]);
    expect(avertissementsSaisie(base())).toEqual([]);
  });
});

describe('construireActivite, nouveaux champs', () => {
  it('produit comparisons et questions aux identifiants prévus', () => {
    const a = construireActivite(base({ comparaisons: '12 | 8\n3,5 | 3/4', qcm: 'Q ? | bonne | f1 | f2' }));
    expect(a.comparisons).toEqual([
      { id: 'c1', left: '12', right: '8' },
      { id: 'c2', left: '3,5', right: '3/4' },
    ]);
    expect(a.questions).toEqual([{ itemId: 'q1', correctId: 'q1r0', distractorIds: ['q1r1', 'q1r2'] }]);
    const texte = (id: string) => a.items.find((i) => i.id === id)?.text;
    expect(texte('q1')).toBe('Q ?');
    expect(texte('q1r0')).toBe('bonne');
    expect(texte('q1r2')).toBe('f2');
    expect(a.items.find((i) => i.id === 'q1r1')).toMatchObject({ validated: true, origin: 'manuel' });
  });

  it('refuse un brouillon dont la saisie a des problèmes', () => {
    expect(() => construireActivite(base({ comparaisons: 'abc | 2' }))).toThrow(/pas un nombre/);
  });
});

describe('statutsJeux', () => {
  it('donne six jeux ; Mémo suit Associer ; Comparer et QCM veulent 3 lignes', () => {
    const vide = statutsJeux(base());
    expect(Object.keys(vide).sort()).toEqual(['associer', 'comparer', 'memo', 'ordre', 'qcm', 'trier']);
    expect(vide.comparer.available).toBe(false);
    expect(vide.qcm.available).toBe(false);
    const rempli = statutsJeux(
      base({
        paires: 'plus grand que | >\nplus petit que | <',
        comparaisons: '5 | 3\n1 | 9\n8 | 2',
        qcm: 'A ? | a | b\nB ? | a | b\nC ? | a | b',
      }),
    );
    expect(rempli.memo.available).toBe(true);
    expect(rempli.associer.available).toBe(true);
    expect(rempli.comparer.available).toBe(true);
    expect(rempli.qcm.available).toBe(true);
  });
});
