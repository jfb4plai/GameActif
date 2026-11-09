import { describe, it, expect } from 'vitest';
import donnees from '../../data/referentiel-francais.json';

interface Entree {
  code: string;
  annee: string;
  matiere: string;
  texte: string;
}
const entrees = donnees as Entree[];

describe('référentiel de français (données générées)', () => {
  it('compte les attendus des rubriques par année', () => {
    const parAnnee: Record<string, number> = {};
    for (const e of entrees) parAnnee[e.annee] = (parAnnee[e.annee] ?? 0) + 1;
    expect(parAnnee).toEqual({ P1: 116, P2: 131, P3: 168, P4: 191, P5: 212, P6: 210 });
    expect(entrees).toHaveLength(1028);
  });

  it('a des codes uniques de la forme F.P#.r#.i#.a# et la matière « francais »', () => {
    expect(new Set(entrees.map((e) => e.code)).size).toBe(entrees.length);
    for (const e of entrees) {
      expect(e.code).toMatch(/^F\.P[1-6]\.r\d+\.i\d+\.a\d+$/);
      expect(e.code.split('.')[1]).toBe(e.annee);
      expect(e.matiere).toBe('francais');
    }
  });

  it('n’a aucun texte vide, et reprend mot pour mot le premier attendu de P3', () => {
    for (const e of entrees) expect(e.texte.trim()).not.toBe('');
    expect(entrees.find((e) => e.code === 'F.P3.r1.i1.a1')?.texte.startsWith('Citer les paramètres de la communication')).toBe(true);
  });
});
