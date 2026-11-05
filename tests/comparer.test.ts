import { describe, it, expect } from 'vitest';
import { setupComparer, splitComparaison, COMPARE_GAP } from '../src/engine/comparer.js';
import { availableMechanics } from '../src/engine/availability.js';
import { makeRng } from '../src/engine/rng.js';
import { comparerActivity, solveAll } from './fixtures.js';

describe('setupComparer', () => {
  it('calcule le symbole juste', () => {
    const s = setupComparer(comparerActivity(), 'standard', makeRng(1));
    const attendu: Record<string, string> = { c1: '>', c2: '=', c3: '<', c4: '<', c5: '>' };
    expect(s.elements).toHaveLength(5);
    for (const e of s.elements) expect(e.correct).toBe(attendu[e.id]);
  });

  it('propose les trois symboles, non exclusifs', () => {
    const s = setupComparer(comparerActivity(), 'standard', makeRng(1));
    expect(s.options).toEqual(['>', '<', '=']);
    expect(s.exclusive).toBe(false);
    expect(s.mechanic).toBe('comparer');
    expect(s.labels['>']).toBe('>');
  });

  it('le libellé d’une comparaison contient l’écart', () => {
    const s = setupComparer(comparerActivity(), 'standard', makeRng(1));
    expect(s.labels.c1).toBe(`12${COMPARE_GAP}8`);
    expect(splitComparaison('12 ▢ 8')).toEqual(['12', '8']);
  });

  it('le profil limite le nombre de comparaisons', () => {
    expect(setupComparer(comparerActivity(), 'soutien', makeRng(1)).elements).toHaveLength(4);
    expect(setupComparer(comparerActivity(), 'standard', makeRng(1)).elements).toHaveLength(5);
    const defi = setupComparer(comparerActivity(), 'defi', makeRng(1));
    expect(defi.elements).toHaveLength(5);
    expect(defi.hintsLeft).toBe(0);
    expect(defi.maxTries).toBe(3);
  });

  it('même graine, même tour', () => {
    const a = setupComparer(comparerActivity(), 'standard', makeRng(7));
    const b = setupComparer(comparerActivity(), 'standard', makeRng(7));
    expect(a.elements.map((e) => e.id)).toEqual(b.elements.map((e) => e.id));
  });

  it('ignore une ligne illisible (Review Focus 2)', () => {
    const act = comparerActivity();
    act.comparisons = [...(act.comparisons ?? []), { id: 'c6', left: 'abc', right: '2' }, { id: 'c7', left: '1/0', right: '2' }];
    const ids = setupComparer(act, 'defi', makeRng(1), { maxItems: 10 }).elements.map((e) => e.id);
    expect(ids).not.toContain('c6');
    expect(ids).not.toContain('c7');
    expect(ids).toHaveLength(5);
  });

  it('0,5 et 1/2 valent « = » (Review Focus 3)', () => {
    const act = comparerActivity();
    act.comparisons = [
      { id: 'c1', left: '0,5', right: '1/2' },
      { id: 'c2', left: '2/6', right: '1/3' },
      { id: 'c3', left: '1', right: '2' },
    ];
    const s = setupComparer(act, 'standard', makeRng(1));
    expect(Object.fromEntries(s.elements.map((e) => [e.id, e.correct]))).toEqual({ c1: '=', c2: '=', c3: '<' });
  });

  it('un tour se joue jusqu’au bout', () => {
    expect(solveAll(setupComparer(comparerActivity(), 'standard', makeRng(3))).done).toBe(true);
  });

  it('lève une erreur sous 3 comparaisons valides', () => {
    const act = comparerActivity();
    act.comparisons = (act.comparisons ?? []).slice(0, 2);
    expect(() => setupComparer(act, 'standard', makeRng(1))).toThrow(/3 comparaisons/);
  });
});

describe('disponibilité de Comparer', () => {
  it('indisponible sous 3 comparaisons valides, disponible à 3', () => {
    const act = comparerActivity();
    act.comparisons = [{ id: 'c1', left: '1', right: '2' }, { id: 'c2', left: '3', right: '4' }, { id: 'c3', left: 'x', right: '4' }];
    const m = availableMechanics(act).comparer;
    expect(m.available).toBe(false);
    expect(m.missing).toBe('Il faut au moins 3 comparaisons valides.');
    act.comparisons[2] = { id: 'c3', left: '5', right: '4' };
    expect(availableMechanics(act).comparer.available).toBe(true);
  });
});
