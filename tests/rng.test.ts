import { describe, it, expect } from 'vitest';
import { makeRng, shuffle, shuffleNoFixedPoint } from '../src/engine/rng.js';

describe('makeRng', () => {
  it('est déterministe pour une même graine', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('reste dans [0, 1[', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('donne des suites différentes pour des graines différentes', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
});

describe('shuffle', () => {
  it('renvoie une permutation sans modifier l’entrée', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const out = shuffle(input, makeRng(3));
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('shuffleNoFixedPoint', () => {
  it('ne laisse aucun élément à sa position d’origine (n de 2 à 8, 100 graines)', () => {
    for (let n = 2; n <= 8; n++) {
      const arr = Array.from({ length: n }, (_, i) => `x${i}`);
      for (let seed = 0; seed < 100; seed++) {
        const out = shuffleNoFixedPoint(arr, makeRng(seed));
        expect([...out].sort()).toEqual([...arr].sort());
        expect(out.every((v, i) => v !== arr[i])).toBe(true);
      }
    }
  });

  it('gère les tableaux de 0 ou 1 élément', () => {
    expect(shuffleNoFixedPoint([], makeRng(1))).toEqual([]);
    expect(shuffleNoFixedPoint(['a'], makeRng(1))).toEqual(['a']);
  });
});
