import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { AIDES, TITRE_AIDE, type AideId } from '../../src/aide/aides.js';

const IDS: AideId[] = ['parcours-niveau', 'parcours-matiere', 'parcours-competences', 'parcours-elements', 'parcours-jeux', 'proposer', 'classes', 'tableau', 'niveaux', 'eleve'];
const racine = (chemin: string) => new URL(`../../${chemin}`, import.meta.url);

describe('textes d’aide', () => {
  it('contiennent exactement les dix écrans prévus', () => {
    expect(Object.keys(AIDES).sort()).toEqual([...IDS].sort());
  });

  it('ont un titre commun', () => {
    expect(TITRE_AIDE).toBe('Comment utiliser cet écran');
  });

  for (const id of IDS) {
    describe(id, () => {
      const a = AIDES[id];

      it('tiennent en cinq puces au plus, courtes', () => {
        expect(a.puces.length).toBeGreaterThanOrEqual(1);
        expect(a.puces.length).toBeLessThanOrEqual(5);
        for (const p of a.puces) {
          expect(p.length, p).toBeGreaterThanOrEqual(5);
          expect(p.length, p).toBeLessThanOrEqual(140);
        }
        if (a.limite !== undefined) expect(a.limite.length).toBeLessThanOrEqual(140);
      });

      it('citent des sources qui existent dans le dépôt', () => {
        expect(a.sources.length).toBeGreaterThanOrEqual(1);
        for (const s of a.sources) expect(existsSync(racine(s)), s).toBe(true);
      });

      it('n’emploient ni tiret cadratin ni le nom d’un niveau de difficulté', () => {
        const tout = [...a.puces, a.limite ?? ''].join(' ');
        expect(tout).not.toMatch(/—/);
        expect(tout).not.toMatch(/Soutien/);
      });

      if (id === 'eleve') {
        it('est écrite à l’infinitif, sans « tu », « vous » ni adresse, et sans limite', () => {
          expect(a.public).toBe('eleve');
          expect(a.limite).toBeUndefined();
          for (const p of a.puces) {
            expect(p, p).toMatch(/^[A-ZÉ][a-zéèêàâîôû]+(er|ir|re|oir)\b/);
            expect(p).not.toMatch(/\b(tu|vous|ton|ta|tes|votre|vos)\b/i);
            expect(p).not.toMatch(/@/);
          }
        });
      } else {
        it('est une aide pour l’enseignant avec une limite honnête', () => {
          expect(a.public).toBe('enseignant');
          expect(a.limite?.length ?? 0).toBeGreaterThan(10);
        });
      }
    });
  }
});
