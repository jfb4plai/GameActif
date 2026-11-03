import { describe, it, expect } from 'vitest';
import { setupTrier } from '../src/engine/trier.js';
import { makeRng } from '../src/engine/rng.js';
import { eauActivity, solveAll } from './fixtures.js';

const categoryOf: Record<string, string> = {
  t1: 'c1', t2: 'c1', t3: 'c1', t4: 'c2', t5: 'c2', t6: 'c2', t7: 'c3',
};

describe('setupTrier', () => {
  it('prépare un tour non exclusif où chaque élément connaît sa catégorie', () => {
    const s = setupTrier(eauActivity(), 'standard', makeRng(1));
    expect(s.mechanic).toBe('trier');
    expect(s.exclusive).toBe(false);
    expect(s.elements).toHaveLength(6);
    expect(s.options).toHaveLength(3);
    for (const e of s.elements) expect(e.correct).toBe(categoryOf[e.id]);
    expect(s.labels.c1).toBe('Eau solide');
    expect(s.labels.t1).toBe('glace');
  });

  it('Soutien : 2 catégories, 4 éléments, chaque catégorie reçoit au moins un élément (30 graines)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = setupTrier(eauActivity(), 'soutien', makeRng(seed));
      expect(s.elements).toHaveLength(4);
      expect(new Set(s.options)).toEqual(new Set(['c1', 'c2']));
      expect(new Set(s.elements.map((e) => e.correct))).toEqual(new Set(['c1', 'c2']));
    }
  });

  it('Défi : toutes les catégories et tous les éléments classés', () => {
    const s = setupTrier(eauActivity(), 'defi', makeRng(3));
    expect(s.elements).toHaveLength(7);
    expect(s.options).toHaveLength(3);
    expect(s.maxTries).toBe(3);
  });

  it('casse l’ordre d’écriture, qui regroupe les éléments par catégorie (50 graines)', () => {
    const activity = eauActivity();
    for (let seed = 0; seed < 50; seed++) {
      const s = setupTrier(activity, 'standard', makeRng(seed));
      const ids = s.elements.map((e) => e.id);
      const authoring = activity.items.map((i) => i.id).filter((id) => ids.includes(id));
      expect(ids).not.toEqual(authoring);
      ids.forEach((id, i) => expect(id).not.toBe(authoring[i]));
    }
  });

  it('se termine quand tout est bien classé', () => {
    const s = solveAll(setupTrier(eauActivity(), 'standard', makeRng(5)));
    expect(s.done).toBe(true);
    expect(s.results.every((r) => r.firstTry)).toBe(true);
  });

  it('refuse de se préparer avec une seule catégorie utilisable', () => {
    const a = eauActivity();
    a.memberships = a.memberships.filter((m) => m.categoryId === 'c1');
    expect(() => setupTrier(a, 'standard', makeRng(1))).toThrow('Trier indisponible');
  });
});
