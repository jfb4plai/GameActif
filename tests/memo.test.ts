import { describe, it, expect } from 'vitest';
import { setupMemo, attemptMatch, hintMemo, partnerOf } from '../src/engine/memo.js';
import { availableMechanics } from '../src/engine/availability.js';
import { makeRng } from '../src/engine/rng.js';
import { eauActivity } from './fixtures.js';

const tour = (seed = 1, profil: 'soutien' | 'standard' | 'defi' = 'standard') => setupMemo(eauActivity(), profil, makeRng(seed));

describe('setupMemo', () => {
  it('le deck contient chaque carte une seule fois', () => {
    const s = tour();
    expect(s.mechanic).toBe('memo');
    expect(s.exclusive).toBe(true);
    expect(s.maxTries).toBeNull();
    expect(s.deck).toHaveLength(2 * s.elements.length);
    expect(new Set(s.deck).size).toBe(s.deck?.length);
    for (const e of s.elements) expect(s.deck).toContain(e.id);
    for (const o of s.options) expect(s.deck).toContain(o);
  });

  it('profil Défi avec 3 paires : 6 cartes, aucune carte orpheline (Review Focus 4)', () => {
    const act = eauActivity();
    act.pairs = act.pairs.slice(0, 3);
    const s = setupMemo(act, 'defi', makeRng(1), { maxItems: 8 });
    expect(s.deck).toHaveLength(6);
    expect(s.options).toHaveLength(s.elements.length);
  });

  it('même graine, même deck', () => {
    expect(tour(7).deck).toEqual(tour(7).deck);
  });

  it('lève une erreur sous 2 paires', () => {
    const act = eauActivity();
    act.pairs = act.pairs.slice(0, 1);
    expect(() => setupMemo(act, 'standard', makeRng(1))).toThrow(/2 paires/);
  });
});

describe('attemptMatch', () => {
  it('une bonne paire se résout, dans les deux sens', () => {
    const r = attemptMatch(tour(), 'a1', 'b1');
    expect(r.feedback.kind).toBe('correct');
    expect(r.state.results).toHaveLength(1);
    expect(r.state.results[0].firstTry).toBe(true);
    const r2 = attemptMatch(tour(), 'b1', 'a1');
    expect(r2.feedback.kind).toBe('correct');
    expect(r2.state.results[0].elementId).toBe('a1');
  });

  it('une erreur est attribuée à la paire de la première carte', () => {
    const miss = attemptMatch(tour(), 'a1', 'b2');
    expect(miss.feedback.kind).toBe('retry');
    expect(miss.state.results).toHaveLength(0);
    expect(miss.state.elements.find((e) => e.id === 'a1')?.wrong).toEqual(['b2']);
    expect(miss.state.elements.find((e) => e.id === 'a2')?.wrong).toEqual([]);
    const ok = attemptMatch(miss.state, 'a1', 'b1');
    expect(ok.state.results[0].firstTry).toBe(false);
    expect(ok.state.results[0].tries).toBe(2);
  });

  it('deux cartes du même côté ne forment pas une paire', () => {
    const r = attemptMatch(tour(), 'a1', 'a2');
    expect(r.feedback.kind).toBe('retry');
    expect(r.state.elements.find((e) => e.id === 'a1')?.wrong).toEqual(['a2']);
  });

  it('une carte déjà trouvée, la même carte deux fois ou une carte inconnue est ignorée', () => {
    const s = tour();
    const done = attemptMatch(s, 'a1', 'b1').state;
    for (const [x, y] of [['a1', 'b2'], ['b1', 'a2'], ['a2', 'a2'], ['a2', 'zzz']] as const) {
      const r = attemptMatch(done, x, y);
      expect(r.feedback.kind).toBe('ignored');
      expect(r.state).toBe(done);
    }
  });

  it('le tour se termine quand toutes les paires sont trouvées', () => {
    let s = tour();
    for (const e of s.elements) s = attemptMatch(s, e.id, e.correct).state;
    expect(s.done).toBe(true);
    expect(s.results).toHaveLength(s.elements.length);
  });
});

describe('indice du Mémo', () => {
  it('donne la carte partenaire, consomme un indice et le note', () => {
    const s = tour();
    const r = hintMemo(s, 'a1');
    expect(r.partnerId).toBe('b1');
    expect(r.state.hintsLeft).toBe(s.hintsLeft - 1);
    expect(r.state.elements.find((e) => e.id === 'a1')?.hintUsed).toBe(true);
  });

  it('en Défi (aucun indice) retourne null sans changer l’état', () => {
    const s = tour(1, 'defi');
    const r = hintMemo(s, 'a1');
    expect(r.partnerId).toBeNull();
    expect(r.state).toBe(s);
  });

  it('partnerOf relie une carte de gauche à sa droite et inversement', () => {
    const s = tour();
    expect(partnerOf(s, 'a1')).toBe('b1');
    expect(partnerOf(s, 'b1')).toBe('a1');
    expect(partnerOf(s, 'zzz')).toBeNull();
  });
});

describe('disponibilité de Mémo', () => {
  it('suit la règle des paires d’Associer', () => {
    expect(availableMechanics(eauActivity()).memo).toEqual({ available: true, missing: null });
    const act = eauActivity();
    act.pairs = act.pairs.slice(0, 1);
    expect(availableMechanics(act).memo).toEqual({ available: false, missing: 'Il faut au moins 2 paires.' });
  });
});
