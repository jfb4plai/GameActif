import { describe, it, expect } from 'vitest';
import { setupQcm } from '../src/engine/qcm.js';
import { availableMechanics } from '../src/engine/availability.js';
import { step } from '../src/engine/round.js';
import { makeRng } from '../src/engine/rng.js';
import { qcmActivity } from './fixtures.js';

const quatre = { maxItems: 4 };

describe('setupQcm', () => {
  it('le nombre de réponses suit le profil', () => {
    for (const [profil, n] of [['soutien', 2], ['standard', 3], ['defi', 4]] as const) {
      const s = setupQcm(qcmActivity(), profil, makeRng(1), { ...quatre });
      const sur4 = s.elements.filter((e) => e.id !== 'q5');
      expect(sur4.length).toBeGreaterThan(0);
      for (const e of sur4) expect(e.choices).toHaveLength(n);
    }
  });

  it('la bonne réponse est dans les choix, qui sont des réponses de la question (50 graines)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = setupQcm(qcmActivity(), 'defi', makeRng(seed), { maxItems: 5 });
      for (const e of s.elements) {
        expect(e.choices).toContain(e.correct);
        for (const c of e.choices as string[]) expect(c.startsWith(`${e.id}r`)).toBe(true);
      }
    }
  });

  it('la bonne réponse n’est pas toujours en première position', () => {
    const positions = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      const s = setupQcm(qcmActivity(), 'standard', makeRng(seed), { maxItems: 5 });
      const q1 = s.elements.find((e) => e.id === 'q1');
      if (q1) positions.add((q1.choices as string[]).indexOf(q1.correct));
    }
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  it('options est l’union des choix, sans doublon', () => {
    const s = setupQcm(qcmActivity(), 'standard', makeRng(2));
    const union = new Set(s.elements.flatMap((e) => e.choices as string[]));
    expect(new Set(s.options)).toEqual(union);
    expect(s.options).toHaveLength(union.size);
    expect(s.mechanic).toBe('qcm');
    expect(s.exclusive).toBe(false);
  });

  it('une seule fausse saisie en Défi donne 2 choix, sans erreur (Review Focus 5)', () => {
    const act = qcmActivity();
    act.questions = (act.questions ?? []).filter((q) => q.itemId === 'q5');
    const q5 = act.questions[0];
    act.questions = [q5, { ...q5, itemId: 'q5' }, { ...q5, itemId: 'q5' }];
    const s = setupQcm(act, 'defi', makeRng(1), { maxItems: 1 });
    expect(s.elements).toHaveLength(1);
    expect(s.elements[0].choices).toHaveLength(2);
  });

  it('choisir une réponse d’une autre question est ignoré', () => {
    const s = setupQcm(qcmActivity(), 'standard', makeRng(1));
    const [a, b] = s.elements;
    const r = step(s, { type: 'choose', elementId: a.id, optionId: b.correct });
    expect(r.feedback.kind).toBe('ignored');
  });

  it('l’indice écarte une fausse réponse de la même question, jamais la bonne', () => {
    const s = setupQcm(qcmActivity(), 'standard', makeRng(1));
    const e = s.elements[0];
    const r = step(s, { type: 'hint', elementId: e.id });
    const el = r.state.elements[0];
    expect(el.eliminated).toHaveLength(1);
    expect(el.eliminated[0]).not.toBe(e.correct);
    expect(e.choices).toContain(el.eliminated[0]);
  });

  it('lève une erreur sous 3 questions valides', () => {
    const act = qcmActivity();
    act.questions = (act.questions ?? []).slice(0, 2);
    expect(() => setupQcm(act, 'standard', makeRng(1))).toThrow(/3 questions/);
  });
});

describe('disponibilité de QCM', () => {
  const msg = 'Il faut au moins 3 questions avec une bonne réponse et une fausse réponse.';
  it('indisponible sous 3 questions valides, disponible à 3', () => {
    const act = qcmActivity();
    act.questions = (act.questions ?? []).slice(0, 2);
    expect(availableMechanics(act).qcm).toEqual({ available: false, missing: msg });
    expect(availableMechanics(qcmActivity()).qcm.available).toBe(true);
  });

  it('écarte une question à 4 fausses, sans fausse ou dont un item manque', () => {
    const act = qcmActivity();
    act.questions = [
      { itemId: 'q1', correctId: 'q1r0', distractorIds: ['q1r1', 'q1r2', 'q1r3', 'q5r1'] },
      { itemId: 'q2', correctId: 'q2r0', distractorIds: [] },
      { itemId: 'q3', correctId: 'inconnu', distractorIds: ['q3r1'] },
      { itemId: 'q4', correctId: 'q4r0', distractorIds: ['q4r1'] },
    ];
    expect(availableMechanics(act).qcm.available).toBe(false);
  });
});
