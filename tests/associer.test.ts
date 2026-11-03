import { describe, it, expect } from 'vitest';
import { setupAssocier } from '../src/engine/associer.js';
import { makeRng } from '../src/engine/rng.js';
import { eauActivity, solveAll } from './fixtures.js';

describe('setupAssocier', () => {
  it('prépare un tour exclusif avec une option par élément et des libellés', () => {
    const s = setupAssocier(eauActivity(), 'standard', makeRng(1));
    expect(s.mechanic).toBe('associer');
    expect(s.exclusive).toBe(true);
    expect(s.elements).toHaveLength(4);
    expect(s.options).toHaveLength(4);
    expect(s.labels.a1).toBe('évaporation');
    expect(s.labels.b1).toBe('passage du liquide au gaz');
    const rightOf: Record<string, string> = { a1: 'b1', a2: 'b2', a3: 'b3', a4: 'b4' };
    for (const e of s.elements) expect(e.correct).toBe(rightOf[e.id]);
  });

  it('casse l’ordre d’écriture et l’alignement avec les options (50 graines)', () => {
    const authoring = ['a1', 'a2', 'a3', 'a4'];
    for (let seed = 0; seed < 50; seed++) {
      const s = setupAssocier(eauActivity(), 'standard', makeRng(seed));
      expect(s.elements.map((e) => e.id)).not.toEqual(authoring);
      s.elements.forEach((e, i) => expect(s.options[i]).not.toBe(e.correct));
    }
  });

  it('Défi ajoute des distracteurs et limite les essais sans indice', () => {
    const s = setupAssocier(eauActivity(), 'defi', makeRng(2), { maxItems: 3, distractors: 1 });
    expect(s.elements).toHaveLength(3);
    expect(s.options).toHaveLength(4);
    const distractors = s.options.filter((o) => !s.elements.some((e) => e.correct === o));
    expect(distractors).toHaveLength(1);
    expect(s.maxTries).toBe(3);
    expect(s.hintsLeft).toBe(0);
  });

  it('Soutien retient les paires faciles, Défi les difficiles (20 graines)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const soutien = setupAssocier(eauActivity(), 'soutien', makeRng(seed), { maxItems: 2 }).elements.map((e) => e.id);
      expect(soutien).toContain('a1');
      expect(soutien).not.toContain('a3');
      const defi = setupAssocier(eauActivity(), 'defi', makeRng(seed), { maxItems: 2, distractors: 0 }).elements.map((e) => e.id);
      expect(defi).toContain('a3');
      expect(defi).not.toContain('a1');
    }
  });

  it('se termine quand tout est bien associé', () => {
    const s = solveAll(setupAssocier(eauActivity(), 'standard', makeRng(5)));
    expect(s.done).toBe(true);
    expect(s.results).toHaveLength(4);
    expect(s.results.every((r) => r.firstTry)).toBe(true);
  });

  it('refuse de se préparer sans 2 paires', () => {
    const a = eauActivity();
    a.pairs = [{ leftId: 'a1', rightId: 'b1' }];
    expect(() => setupAssocier(a, 'standard', makeRng(1))).toThrow('Associer indisponible');
  });
});
