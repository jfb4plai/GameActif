import { describe, it, expect } from 'vitest';
import { estCodeAttendu } from '../../src/suivi/attendu';

describe('estCodeAttendu', () => {
  it('accepte les codes de maths et de français', () => {
    expect(estCodeAttendu('M.P4.1.1.i1.a1')).toBe(true);
    expect(estCodeAttendu('F.P3.r1.i1.a1')).toBe(true);
  });

  it('refuse une autre matière, un niveau hors P1 à P6, un code incomplet, une minuscule ou le vide', () => {
    for (const c of ['X.P4.1', 'F.P7.r1', 'F.P3', 'f.P3.r1', 'M.P4.', '']) expect(estCodeAttendu(c)).toBe(false);
  });
});
