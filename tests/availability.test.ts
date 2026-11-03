import { describe, it, expect } from 'vitest';
import { availableMechanics, validPairs, validMemberships, rankedItemIds } from '../src/engine/availability.js';
import { eauActivity } from './fixtures.js';

describe('availableMechanics', () => {
  it('les trois mécaniques sont disponibles pour l’activité complète', () => {
    const m = availableMechanics(eauActivity());
    expect(m.associer).toEqual({ available: true, missing: null });
    expect(m.trier).toEqual({ available: true, missing: null });
    expect(m.ordre).toEqual({ available: true, missing: null });
  });

  it('Associer demande au moins 2 paires', () => {
    const a = eauActivity();
    a.pairs = [{ leftId: 'a1', rightId: 'b1' }];
    expect(availableMechanics(a).associer).toEqual({ available: false, missing: 'Il faut au moins 2 paires.' });
  });

  it('Trier demande 2 catégories remplies et 3 éléments classés', () => {
    const a = eauActivity();
    a.memberships = a.memberships.filter((m) => m.categoryId === 'c1');
    expect(availableMechanics(a).trier).toEqual({
      available: false,
      missing: 'Il faut au moins 2 catégories contenant chacune un élément.',
    });
    const b = eauActivity();
    b.memberships = [
      { itemId: 't1', categoryId: 'c1' },
      { itemId: 't4', categoryId: 'c2' },
    ];
    expect(availableMechanics(b).trier).toEqual({
      available: false,
      missing: 'Il faut au moins 3 éléments classés.',
    });
  });

  it('Ordre demande 3 éléments avec des positions 1, 2, 3…', () => {
    const a = eauActivity();
    a.ranks = [
      { itemId: 'o1', position: 1 },
      { itemId: 'o2', position: 2 },
      { itemId: 'o4', position: 4 },
    ];
    expect(availableMechanics(a).ordre).toEqual({
      available: false,
      missing: 'Il faut au moins 3 éléments avec des positions 1, 2, 3…',
    });
  });
});

describe('relations valides', () => {
  it('ignore les paires dont un élément est inconnu ou identique', () => {
    const a = eauActivity();
    a.pairs.push({ leftId: 'zz', rightId: 'b1' }, { leftId: 'a1', rightId: 'a1' });
    expect(validPairs(a)).toHaveLength(4);
  });

  it('un élément classé deux fois garde sa première catégorie', () => {
    const a = eauActivity();
    a.memberships.push({ itemId: 't1', categoryId: 'c2' });
    const m = validMemberships(a).filter((x) => x.itemId === 't1');
    expect(m).toEqual([{ itemId: 't1', categoryId: 'c1' }]);
  });

  it('rankedItemIds renvoie les éléments dans l’ordre des positions', () => {
    const a = eauActivity();
    a.ranks = [...a.ranks].reverse();
    expect(rankedItemIds(a)).toEqual(['o1', 'o2', 'o3', 'o4', 'o5']);
  });
});
