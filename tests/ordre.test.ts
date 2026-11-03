import { describe, it, expect } from 'vitest';
import { setupOrdre } from '../src/engine/ordre.js';
import { makeRng } from '../src/engine/rng.js';
import { eauActivity, solveAll } from './fixtures.js';

describe('setupOrdre', () => {
  it('prépare un tour exclusif où chaque étape a sa position', () => {
    const s = setupOrdre(eauActivity(), 'standard', makeRng(1));
    expect(s.mechanic).toBe('ordre');
    expect(s.exclusive).toBe(true);
    expect(s.elements).toHaveLength(5);
    expect(s.options).toEqual(['pos-1', 'pos-2', 'pos-3', 'pos-4', 'pos-5']);
    expect(s.elements.find((e) => e.id === 'o3')?.correct).toBe('pos-3');
    expect(s.labels['pos-3']).toBe('3');
    expect(s.labels.o3).toBe('La vapeur forme des nuages');
  });

  it('casse l’ordre d’écriture : les étapes ne sont jamais affichées dans le bon ordre (50 graines)', () => {
    const authoring = ['o1', 'o2', 'o3', 'o4', 'o5'];
    for (let seed = 0; seed < 50; seed++) {
      const ids = setupOrdre(eauActivity(), 'standard', makeRng(seed)).elements.map((e) => e.id);
      expect(ids).not.toEqual(authoring);
      ids.forEach((id, i) => expect(id).not.toBe(authoring[i]));
    }
  });

  it('Soutien : fenêtre de 4 étapes consécutives, positions renumérotées de 1 à 4 (30 graines)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = setupOrdre(eauActivity(), 'soutien', makeRng(seed));
      expect(s.elements).toHaveLength(4);
      expect(s.options).toEqual(['pos-1', 'pos-2', 'pos-3', 'pos-4']);
      const numbers = s.elements.map((e) => Number(e.id.slice(1))).sort((a, b) => a - b);
      numbers.forEach((n, i) => {
        if (i > 0) expect(n).toBe(numbers[i - 1] + 1);
      });
      const first = s.elements.find((e) => Number(e.id.slice(1)) === numbers[0]);
      expect(first?.correct).toBe('pos-1');
    }
  });

  it('se termine quand tout est bien rangé', () => {
    const s = solveAll(setupOrdre(eauActivity(), 'standard', makeRng(5)));
    expect(s.done).toBe(true);
    expect(s.results.every((r) => r.firstTry)).toBe(true);
  });

  it('refuse de se préparer quand les positions ne forment pas 1, 2, 3…', () => {
    const a = eauActivity();
    a.ranks = [
      { itemId: 'o1', position: 1 },
      { itemId: 'o2', position: 2 },
      { itemId: 'o4', position: 4 },
    ];
    expect(() => setupOrdre(a, 'standard', makeRng(1))).toThrow('Ordre indisponible');
  });
});
