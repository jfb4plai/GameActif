import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  HUB_INDICATOR_LABELS,
  elementStats,
  sessionSignals,
  suggestLevel,
  summarizeSession,
  type SessionResults,
} from '../src/engine/signals.js';
import type { ElementResult } from '../src/engine/round.js';
import type { ProfileId } from '../src/engine/types.js';

function res(elementId: string, over: Partial<ElementResult> = {}): ElementResult {
  return {
    elementId,
    mechanic: 'trier',
    firstTry: true,
    tries: 1,
    hintUsed: false,
    revealed: false,
    wrongChoices: [],
    ...over,
  };
}

function sess(
  code: string,
  endedAt: string,
  results: ElementResult[],
  profile: ProfileId = 'standard',
  totalElements = results.length,
): SessionResults {
  return { sessionId: `${code}-${endedAt}`, studentCode: code, profile, totalElements, endedAt, results };
}

const good = (id: string) => res(id);
const bad = (id: string) => res(id, { firstTry: false, tries: 2, wrongChoices: ['X'] });

describe('sessionSignals', () => {
  it('calcule R1, E et I', () => {
    const s = sessionSignals([good('a'), bad('b'), res('c', { hintUsed: true, tries: 3, firstTry: false }), good('d')]);
    expect(s.r1).toBe(0.5);
    expect(s.e).toBe((1 + 2 + 3 + 1) / 4);
    expect(s.i).toBe(0.25);
  });

  it('renvoie des zéros pour une session vide', () => {
    expect(sessionSignals([])).toEqual({ r1: 0, e: 0, i: 0 });
  });
});

describe('suggestLevel', () => {
  const weak = (day: string) => sess('s1', day, [good('a'), bad('b'), bad('c'), bad('d')]);
  const strong = (day: string) => sess('s1', day, [good('a'), good('b'), good('c'), good('d')]);
  const middle = (day: string) => sess('s1', day, [good('a'), good('b'), good('c'), bad('d')]);

  it('ne propose rien avec moins de 2 sessions comptées', () => {
    const r = suggestLevel([weak('2026-10-01')]);
    expect(r.label).toBeNull();
    expect(r.counted).toBe(1);
  });

  it('propose d’alléger quand R1 est sous 50 % dans les 2 dernières sessions', () => {
    const r = suggestLevel([weak('2026-10-01'), weak('2026-10-02')]);
    expect(r.label).toBe('alleger');
    expect(r.applicable).toBe(true);
    expect(r.signals).toHaveLength(2);
  });

  it('propose de relever quand R1 ≥ 90 %, indices ≤ 10 % et essais ≤ 1,1', () => {
    const r = suggestLevel([strong('2026-10-01'), strong('2026-10-02')]);
    expect(r.label).toBe('relever');
    expect(r.applicable).toBe(true);
  });

  it('juge adapté dans les autres cas', () => {
    expect(suggestLevel([middle('2026-10-01'), middle('2026-10-02')]).label).toBe('adapte');
  });

  it('refuse de relever si un indice a été utilisé', () => {
    const withHint = sess('s1', '2026-10-02', [res('a', { hintUsed: true }), good('b'), good('c'), good('d')]);
    expect(suggestLevel([strong('2026-10-01'), withHint]).label).toBe('adapte');
  });

  it('ignore les sessions où moins de 50 % des éléments ont été joués', () => {
    const abandoned = sess('s1', '2026-10-03', [bad('a')], 'standard', 10);
    const r = suggestLevel([weak('2026-10-01'), abandoned]);
    expect(r.counted).toBe(1);
    expect(r.label).toBeNull();
  });

  it('ne retient que les 2 sessions les plus récentes', () => {
    const r = suggestLevel([weak('2026-09-28'), strong('2026-10-01'), strong('2026-10-02')]);
    expect(r.label).toBe('relever');
  });

  it('marque la suggestion non applicable aux profils extrêmes', () => {
    const soutienWeak = (day: string) => sess('s1', day, [good('a'), bad('b'), bad('c'), bad('d')], 'soutien');
    expect(suggestLevel([soutienWeak('2026-10-01'), soutienWeak('2026-10-02')]).applicable).toBe(false);
    const defiStrong = (day: string) => sess('s1', day, [good('a'), good('b'), good('c'), good('d')], 'defi');
    expect(suggestLevel([defiStrong('2026-10-01'), defiStrong('2026-10-02')]).applicable).toBe(false);
  });
});

describe('elementStats', () => {
  const students = (n: number) => Array.from({ length: n }, (_, i) => `s${i + 1}`);

  it('signale « peu de données » sous 5 élèves, sans libellé ni confusions', () => {
    const sessions = students(4).map((c) => sess(c, '2026-10-01', [bad('e1')]));
    const [stat] = elementStats(sessions);
    expect(stat.students).toBe(4);
    expect(stat.rate).toBe(1);
    expect(stat.flag).toBe('peu-de-donnees');
    expect(stat.confusions).toEqual([]);
  });

  it('classe prioritaire à partir de 60 % d’échecs, à signaler à partir de 40 %, sinon ok', () => {
    const make = (fails: number) =>
      students(5).map((c, i) => sess(c, '2026-10-01', [i < fails ? bad('e1') : good('e1')]));
    expect(elementStats(make(5))[0].flag).toBe('prioritaire');
    expect(elementStats(make(3))[0].flag).toBe('prioritaire');
    expect(elementStats(make(2))[0].flag).toBe('signaler');
    expect(elementStats(make(1))[0].flag).toBe('ok');
  });

  it('retient une confusion à partir de 3 élèves, une fois par élève', () => {
    const sessions = [
      ...students(3).map((c) => sess(c, '2026-10-01', [res('e1', { firstTry: false, tries: 3, wrongChoices: ['X', 'X'] })])),
      sess('s4', '2026-10-01', [res('e1', { firstTry: false, tries: 2, wrongChoices: ['Y'] })]),
      sess('s5', '2026-10-01', [good('e1')]),
    ];
    const [stat] = elementStats(sessions);
    expect(stat.confusions).toEqual([{ optionId: 'X', count: 3 }]);
  });

  it('ne garde que le résultat le plus récent de chaque élève', () => {
    const sessions = [
      ...students(5).map((c) => sess(c, '2026-10-01', [bad('e1')])),
      ...students(5).map((c) => sess(c, '2026-10-02', [good('e1')])),
    ];
    const [stat] = elementStats(sessions);
    expect(stat.students).toBe(5);
    expect(stat.rate).toBe(0);
    expect(stat.flag).toBe('ok');
  });

  it('trie du plus raté au moins raté', () => {
    const sessions = students(5).map((c) => sess(c, '2026-10-01', [good('easy'), bad('hard')]));
    expect(elementStats(sessions).map((s) => s.elementId)).toEqual(['hard', 'easy']);
  });
});

describe('indicateurs du hub', () => {
  it('compte les éléments réussis et repris', () => {
    const summary = summarizeSession([
      good('a'),
      bad('b'),
      res('c', { revealed: true, firstTry: false, tries: 3 }),
    ]);
    expect(summary).toEqual({ reussis: 2, repris: 2 });
  });

  it('utilise exactement les libellés déclarés au hub', () => {
    expect(HUB_INDICATOR_LABELS).toEqual({ reussis: 'éléments réussis', repris: 'éléments repris' });
  });
});

describe('seuils par défaut', () => {
  it('correspondent à la spec section 8', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      minPlayedShare: 0.5,
      windowSessions: 2,
      allegerR1: 0.5,
      relever: { r1: 0.9, i: 0.1, e: 1.1 },
      elementFlag: 0.4,
      elementPriority: 0.6,
      confusionMin: 3,
      minStudents: 5,
    });
  });
});
