import { describe, it, expect } from 'vitest';
import { createRound, type ElementResult } from '../../src/engine/round.js';
import { construirePayload } from '../../src/suivi/payload.js';

function tour() {
  return createRound({
    mechanic: 'trier',
    exclusive: false,
    elements: [
      { id: 'e1', correct: 'devant' },
      { id: 'e2', correct: 'derriere' },
    ],
    options: ['devant', 'derriere', 'entre'],
    labels: { devant: 'devant', derriere: 'derrière', entre: 'entre', e1: 'Le chat est ___ la boîte', e2: 'Le chien est ___ la porte' },
    hintsLeft: 1,
    maxTries: null,
  });
}

const resultats: ElementResult[] = [
  { elementId: 'e1', mechanic: 'trier', firstTry: false, tries: 2, hintUsed: false, revealed: false, wrongChoices: ['derriere'] },
  { elementId: 'e2', mechanic: 'trier', firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [] },
];

const ctx = () => ({
  sessionId: '11111111-1111-4111-8111-111111111111',
  round: tour(),
  results: resultats,
  profile: 'standard' as const,
  cibles: ['M.P4.1.1.i1.a1'],
  maintenant: new Date('2026-11-12T10:00:00.000Z'),
});

describe('construirePayload', () => {
  it('ajoute la bonne réponse de chaque élément aux résultats', () => {
    const p = construirePayload(ctx());
    expect(p.results[0].correct).toBe('devant');
    expect(p.results[1].correct).toBe('derriere');
    expect(p.results[0].wrongChoices).toEqual(['derriere']);
  });

  it('ne garde que les étiquettes des identifiants cités (bonnes réponses et mauvais choix)', () => {
    const p = construirePayload(ctx());
    expect(p.labels).toEqual({ devant: 'devant', derriere: 'derrière' });
  });

  it('date la séance à l’instant donné et compte les éléments du tour', () => {
    const p = construirePayload(ctx());
    expect(p.endedAt).toBe('2026-11-12T10:00:00.000Z');
    expect(p.totalElements).toBe(2);
    expect(p.mechanic).toBe('trier');
    expect(p.profile).toBe('standard');
    expect(p.cibles).toEqual(['M.P4.1.1.i1.a1']);
    expect(p.sessionId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('ne produit aucun champ d’identité, de temps de réponse ni de texte libre', () => {
    const json = JSON.stringify(construirePayload(ctx()));
    expect(json).not.toMatch(/prenom|nom|name|duree|duration|temps/i);
    expect(Object.keys(construirePayload(ctx())).sort()).toEqual(
      ['cibles', 'endedAt', 'labels', 'mechanic', 'profile', 'results', 'sessionId', 'totalElements'],
    );
  });

  it('plafonne à 10 les mauvais choix d’un élément sans changer le nombre d’essais (la base refuserait toute la séance)', () => {
    const beaucoup: ElementResult[] = [{ elementId: 'e1', mechanic: 'trier', firstTry: false, tries: 13, hintUsed: false, revealed: false, wrongChoices: Array.from({ length: 12 }, () => 'derriere') }];
    const p = construirePayload({ ...ctx(), results: beaucoup });
    expect(p.results[0].wrongChoices).toHaveLength(10);
    expect(p.results[0].tries).toBe(13);
  });

  it('plafonne à 50 les résultats et le nombre d’éléments', () => {
    const elements = Array.from({ length: 60 }, (_, i) => ({ id: `e${i}`, correct: 'devant' }));
    const round = createRound({ mechanic: 'trier', exclusive: false, elements, options: ['devant'], labels: { devant: 'devant' }, hintsLeft: 0, maxTries: null });
    const res: ElementResult[] = elements.map((e) => ({ elementId: e.id, mechanic: 'trier', firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [] }));
    const p = construirePayload({ ...ctx(), round, results: res });
    expect(p.results).toHaveLength(50);
    expect(p.totalElements).toBe(50);
  });

  it('tronque à 80 caractères une étiquette plus longue', () => {
    const round = tour();
    round.labels.devant = 'd'.repeat(120);
    const p = construirePayload({ ...ctx(), round });
    expect(p.labels.devant).toHaveLength(80);
  });

  it('ignore un résultat dont l’élément n’est pas dans le tour plutôt que d’inventer une bonne réponse', () => {
    const p = construirePayload({ ...ctx(), results: [...resultats, { elementId: 'inconnu', mechanic: 'trier', firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [] }] });
    expect(p.results.map((r) => r.elementId)).toEqual(['e1', 'e2']);
  });
});
