import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { canPublish } from '../src/engine/validation.js';
import { eauActivity } from './fixtures.js';

interface Entree {
  code: string;
  annee: string;
  texte: string;
}
const entrees: Entree[] = JSON.parse(readFileSync(new URL('../data/referentiel-maths.json', import.meta.url), 'utf-8'));
const codes = new Set(entrees.map((e) => e.code));

describe('jeu de données du référentiel (maths P3-P4)', () => {
  it('compte 150 attendus en P3 et 173 en P4, codes uniques', () => {
    expect(entrees.filter((e) => e.annee === 'P3')).toHaveLength(150);
    expect(entrees.filter((e) => e.annee === 'P4')).toHaveLength(173);
    expect(codes.size).toBe(entrees.length);
  });

  it('contient les trois attendus du pilote (P4, sous-point 1.1, vocabulaire de position)', () => {
    for (const code of ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3']) expect(codes.has(code)).toBe(true);
    expect(entrees.find((e) => e.code === 'M.P4.1.1.i1.a2')?.texte).toContain('positions relatives');
  });

  it('une activité visant les attendus du pilote est publiable avec le vrai jeu de données', () => {
    const a = eauActivity();
    a.cibles = ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3'];
    expect(canPublish(a, codes)).toEqual({ ok: true, reasons: [] });
  });
});
