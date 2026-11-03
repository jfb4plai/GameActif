import { describe, it, expect } from 'vitest';
import { PROFILES } from '../src/engine/profiles.js';
import { orderByProfile, arrangeAgainst } from '../src/engine/select.js';
import { makeRng } from '../src/engine/rng.js';
import type { Difficulty } from '../src/engine/types.js';

interface E {
  id: string;
  d: Difficulty;
}
const entries: E[] = [
  { id: '1', d: 'difficile' },
  { id: '2', d: 'facile' },
  { id: '3', d: 'moyen' },
  { id: '4', d: 'facile' },
];

describe('PROFILES', () => {
  it('Soutien est le plus aidé, Défi limite les essais et supprime les indices', () => {
    expect(PROFILES.soutien.hintsPerRound).toBeGreaterThan(PROFILES.standard.hintsPerRound);
    expect(PROFILES.standard.hintsPerRound).toBeGreaterThan(PROFILES.defi.hintsPerRound);
    expect(PROFILES.soutien.maxItems).toBeLessThan(PROFILES.defi.maxItems);
    expect(PROFILES.soutien.maxTries).toBeNull();
    expect(PROFILES.defi.maxTries).toBe(3);
    expect(PROFILES.soutien.readAloud).toBe(true);
  });
});

describe('orderByProfile', () => {
  it('Soutien place les éléments faciles en premier', () => {
    const out = orderByProfile(entries, (e) => e.d, 'soutien', makeRng(1));
    expect(out.map((e) => e.d)).toEqual(['facile', 'facile', 'moyen', 'difficile']);
  });

  it('Défi place les éléments difficiles en premier', () => {
    const out = orderByProfile(entries, (e) => e.d, 'defi', makeRng(1));
    expect(out.map((e) => e.d)).toEqual(['difficile', 'moyen', 'facile', 'facile']);
  });

  it('Standard garde tous les éléments (permutation)', () => {
    const out = orderByProfile(entries, (e) => e.d, 'standard', makeRng(1));
    expect(out.map((e) => e.id).sort()).toEqual(['1', '2', '3', '4']);
  });
});

describe('arrangeAgainst', () => {
  it('ne place jamais une option en face de son élément (100 graines)', () => {
    const anchors = ['a1', 'a2', 'a3', 'a4'];
    const correctOf = new Map([
      ['a1', 'b1'],
      ['a2', 'b2'],
      ['a3', 'b3'],
      ['a4', 'b4'],
    ]);
    for (let seed = 0; seed < 100; seed++) {
      const out = arrangeAgainst(['b1', 'b2', 'b3', 'b4'], anchors, correctOf, makeRng(seed));
      expect([...out].sort()).toEqual(['b1', 'b2', 'b3', 'b4']);
      anchors.forEach((a, i) => expect(out[i]).not.toBe(correctOf.get(a)));
    }
  });
});
