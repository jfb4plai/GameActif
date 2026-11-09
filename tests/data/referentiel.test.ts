import { describe, it, expect } from 'vitest';
import { REFERENTIEL, referentielCodes } from '../../src/data/referentiel.js';

const MATHS = REFERENTIEL.filter((e) => e.matiere === 'mathematiques');
const ATTENDUS_PAR_ANNEE: Record<string, number> = { P1: 73, P2: 122, P3: 150, P4: 173, P5: 176, P6: 167 };

describe('référentiel de mathématiques P1 à P6', () => {
  it('compte les attendus de chaque année', () => {
    for (const [annee, n] of Object.entries(ATTENDUS_PAR_ANNEE)) {
      expect(MATHS.filter((e) => e.annee === annee)).toHaveLength(n);
    }
    expect(MATHS).toHaveLength(861);
    expect(REFERENTIEL).toHaveLength(861 + 1028);
  });

  it('les codes sont uniques et la forme est stable', () => {
    expect(referentielCodes().size).toBe(REFERENTIEL.length);
    expect(referentielCodes().has('F.P3.r1.i1.a1')).toBe(true);
    for (const e of MATHS) expect(e.code).toMatch(/^M\.P[1-6]\.\d\.\d\.i\d+\.a\d+$/);
  });

  it('chaque entrée porte sa matière et son type d’item', () => {
    for (const e of MATHS) {
      expect(e.matiere).toBe('mathematiques');
      expect(['Savoir', 'Savoir-faire', 'Compétence']).toContain(e.item_type);
      expect(e.texte.trim().length).toBeGreaterThan(5);
    }
  });

  it('les attendus du pilote existent toujours', () => {
    for (const c of ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2', 'M.P4.1.1.i1.a3', 'M.P4.1.1.i2.a2', 'M.P4.1.1.i3.a1']) {
      expect(referentielCodes().has(c)).toBe(true);
    }
  });
});
