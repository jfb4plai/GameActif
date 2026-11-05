import { describe, it, expect } from 'vitest';
import { createRound, step, progress, feedbackFor, type RoundSpec, type RoundState } from '../src/engine/round.js';

function spec(over: Partial<RoundSpec> = {}): RoundSpec {
  return {
    mechanic: 'trier',
    exclusive: false,
    elements: [
      { id: 'e1', correct: 'A' },
      { id: 'e2', correct: 'B' },
    ],
    options: ['A', 'B', 'C'],
    labels: {},
    hintsLeft: 2,
    maxTries: null,
    ...over,
  };
}

const el = (s: RoundState, id: string) => s.elements.find((e) => e.id === id)!;

describe('choix correct', () => {
  it('résout l’élément au premier essai', () => {
    const r = step(createRound(spec()), { type: 'choose', elementId: 'e1', optionId: 'A' });
    expect(r.feedback.kind).toBe('correct');
    expect(el(r.state, 'e1').resolvedWith).toBe('A');
    expect(r.state.results).toEqual([
      { elementId: 'e1', mechanic: 'trier', firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [] },
    ]);
    expect(r.state.done).toBe(false);
    expect(progress(r.state)).toEqual({ resolved: 1, total: 2 });
  });

  it('termine le tour quand tous les éléments sont résolus', () => {
    let s = createRound(spec());
    s = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    s = step(s, { type: 'choose', elementId: 'e2', optionId: 'B' }).state;
    expect(s.done).toBe(true);
    expect(progress(s)).toEqual({ resolved: 2, total: 2 });
  });
});

describe('choix erroné', () => {
  it('invite à réessayer sans résoudre, puis compte 2 essais', () => {
    let r = step(createRound(spec()), { type: 'choose', elementId: 'e1', optionId: 'C' });
    expect(r.feedback.kind).toBe('retry');
    expect(r.feedback.message).toBe('Pas tout à fait. Essaie encore.');
    expect(r.state.results).toEqual([]);
    expect(el(r.state, 'e1').wrong).toEqual(['C']);
    expect(el(r.state, 'e1').eliminated).toEqual(['C']);
    r = step(r.state, { type: 'choose', elementId: 'e1', optionId: 'A' });
    expect(r.state.results[0]).toMatchObject({ firstTry: false, tries: 2, wrongChoices: ['C'], revealed: false });
  });

  it('ignore le choix d’une option déjà écartée', () => {
    const first = step(createRound(spec()), { type: 'choose', elementId: 'e1', optionId: 'C' });
    const again = step(first.state, { type: 'choose', elementId: 'e1', optionId: 'C' });
    expect(again.feedback.kind).toBe('ignored');
    expect(again.state).toBe(first.state);
  });

  it('révèle la bonne réponse après maxTries erreurs', () => {
    let r = step(createRound(spec({ maxTries: 2 })), { type: 'choose', elementId: 'e1', optionId: 'C' });
    expect(r.feedback.kind).toBe('retry');
    r = step(r.state, { type: 'choose', elementId: 'e1', optionId: 'B' });
    expect(r.feedback.kind).toBe('reveal');
    expect(el(r.state, 'e1').resolvedWith).toBe('A');
    expect(r.state.results[0]).toMatchObject({
      firstTry: false,
      tries: 2,
      revealed: true,
      wrongChoices: ['C', 'B'],
    });
  });
});

describe('options exclusives (associer, ordre)', () => {
  it('une option déjà prise par un autre élément est ignorée', () => {
    let s = createRound(spec({ exclusive: true }));
    s = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    const r = step(s, { type: 'choose', elementId: 'e2', optionId: 'A' });
    expect(r.feedback.kind).toBe('ignored');
    expect(r.state).toBe(s);
  });

  it('non exclusif : deux éléments peuvent partager la même option', () => {
    let s = createRound(spec({ elements: [{ id: 'e1', correct: 'A' }, { id: 'e2', correct: 'A' }] }));
    s = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    const r = step(s, { type: 'choose', elementId: 'e2', optionId: 'A' });
    expect(r.feedback.kind).toBe('correct');
    expect(r.state.done).toBe(true);
  });
});

describe('indices', () => {
  it('écarte la première mauvaise option et consomme un indice', () => {
    const r = step(createRound(spec()), { type: 'hint', elementId: 'e1' });
    expect(r.feedback.kind).toBe('hint');
    expect(el(r.state, 'e1').eliminated).toEqual(['B']);
    expect(el(r.state, 'e1').hintUsed).toBe(true);
    expect(r.state.hintsLeft).toBe(1);
    const blocked = step(r.state, { type: 'choose', elementId: 'e1', optionId: 'B' });
    expect(blocked.feedback.kind).toBe('ignored');
    const solved = step(r.state, { type: 'choose', elementId: 'e1', optionId: 'A' });
    expect(solved.state.results[0]).toMatchObject({ firstTry: true, tries: 1, hintUsed: true });
  });

  it('ne propose pas d’indice quand il n’en reste plus', () => {
    const s = createRound(spec({ hintsLeft: 0 }));
    const r = step(s, { type: 'hint', elementId: 'e1' });
    expect(r.feedback.kind).toBe('no-hint');
    expect(r.state).toBe(s);
  });

  it('ne propose pas d’indice quand toutes les mauvaises options sont déjà écartées', () => {
    const s = createRound(spec({ options: ['A'] }));
    expect(step(s, { type: 'hint', elementId: 'e1' }).feedback.kind).toBe('no-hint');
  });

  it('en mode exclusif, n’écarte pas une option déjà prise par un autre élément', () => {
    let s = createRound(spec({ exclusive: true }));
    s = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    const r = step(s, { type: 'hint', elementId: 'e2' });
    expect(el(r.state, 'e2').eliminated).toEqual(['C']);
  });
});

describe('actions invalides', () => {
  it('ignore un élément inconnu ou déjà résolu', () => {
    const s = createRound(spec());
    expect(step(s, { type: 'choose', elementId: 'zz', optionId: 'A' }).feedback.kind).toBe('ignored');
    const solved = step(s, { type: 'choose', elementId: 'e1', optionId: 'A' }).state;
    expect(step(solved, { type: 'choose', elementId: 'e1', optionId: 'B' }).feedback.kind).toBe('ignored');
  });

  it('ignore une option qui n’existe pas dans le tour', () => {
    const s = createRound(spec());
    expect(step(s, { type: 'choose', elementId: 'e1', optionId: 'Z' }).feedback.kind).toBe('ignored');
  });
});

describe('choices, deck et feedbackFor', () => {
  const qcm = () =>
    createRound({
      mechanic: 'qcm',
      exclusive: false,
      elements: [{ id: 'q1', correct: 'a', choices: ['a', 'b'] }],
      options: ['a', 'c', 'b'],
      labels: {},
      hintsLeft: 1,
      maxTries: null,
    });

  it('refuse une option hors des choix de l’élément', () => {
    const s = qcm();
    const r = step(s, { type: 'choose', elementId: 'q1', optionId: 'c' });
    expect(r.feedback.kind).toBe('ignored');
    expect(r.state).toBe(s);
  });

  it('l’indice n’écarte qu’une option des choix', () => {
    const r = step(qcm(), { type: 'hint', elementId: 'q1' });
    expect(r.state.elements[0].eliminated).toEqual(['b']);
  });

  it('un élément sans choices accepte toutes les options', () => {
    const s = createRound(spec());
    expect(step(s, { type: 'choose', elementId: 'e1', optionId: 'C' }).feedback.kind).toBe('retry');
  });

  it('feedbackFor retrouve le texte de retour', () => {
    expect(feedbackFor('retry').message).toBe('Pas tout à fait. Essaie encore.');
  });

  it('createRound recopie deck quand il est fourni et le laisse absent sinon', () => {
    expect(createRound({ ...spec(), deck: ['x', 'y'] }).deck).toEqual(['x', 'y']);
    expect(createRound(spec()).deck).toBeUndefined();
  });
});
