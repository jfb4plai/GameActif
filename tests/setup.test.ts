import { describe, it, expect } from 'vitest';
import { setupRound } from '../src/engine/setup.js';
import { makeRng } from '../src/engine/rng.js';
import { eauActivity } from './fixtures.js';

describe('setupRound', () => {
  it('aiguille vers la bonne mécanique', () => {
    const a = eauActivity();
    expect(setupRound(a, 'associer', 'standard', makeRng(1)).mechanic).toBe('associer');
    expect(setupRound(a, 'trier', 'standard', makeRng(1)).mechanic).toBe('trier');
    expect(setupRound(a, 'ordre', 'standard', makeRng(1)).mechanic).toBe('ordre');
  });

  it('est déterministe pour une même graine', () => {
    const a = eauActivity();
    expect(setupRound(a, 'trier', 'standard', makeRng(9))).toEqual(setupRound(a, 'trier', 'standard', makeRng(9)));
  });
});
