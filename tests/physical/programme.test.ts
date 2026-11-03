import { describe, it, expect } from 'vitest';
import { programmeLinks, PHRASES_PILOTE } from '../../src/physical/programme.js';
import { REFERENTIEL, referentielCodes } from '../../src/data/referentiel.js';

const A1 = 'M.P4.1.1.i1.a1';
const A2 = 'M.P4.1.1.i1.a2';
const A3 = 'M.P4.1.1.i1.a3';
const PLACE2D = 'M.P4.1.1.i2.a2';
const DEPLACE3D = 'M.P4.1.1.i3.a1';

// Phrases de l'avenant §12 (jeu physique), copie exacte.
const TRIER_PHYSIQUE =
  'Les élèves rangent chaque mot dans sa famille de position. Le jeu fait manipuler le vocabulaire de l\'attendu ; il ne montre pas si l\'élève sait l\'employer dans une phrase.';
const PLACER_PHYSIQUE =
  'Les élèves placent un objet selon une consigne de position. En classe, ils déplacent un objet réel, ce que l\'écran ne permet pas. Le jeu ne travaille pas les positions relatives, qui dépendent du point de vue.';

const texteOf = (code: string) => REFERENTIEL.find((e) => e.code === code)?.texte;

describe('jeu de données du référentiel', () => {
  it('expose 323 attendus et leurs codes', () => {
    expect(REFERENTIEL).toHaveLength(323);
    expect(referentielCodes().has(A1)).toBe(true);
  });
});

describe('programmeLinks, jeu physique', () => {
  it('Trier : une phrase par attendu du pilote, texte officiel repris du jeu de données', () => {
    const links = programmeLinks('trier', 'physique', [A1, A2, A3]);
    expect(links.map((l) => l.code)).toEqual([A1, A2, A3]);
    for (const l of links) {
      expect(l.phrase).toBe(TRIER_PHYSIQUE);
      expect(l.texte).toBe(texteOf(l.code));
      expect(l.extraEnClasse).toBe(false);
    }
  });

  it('Placer : ajoute l’attendu de déplacement dans l’espace réel, marqué « en plus en classe »', () => {
    const links = programmeLinks('placer', 'physique', [A1, PLACE2D]);
    expect(links.map((l) => l.code)).toEqual([A1, PLACE2D, DEPLACE3D]);
    expect(links[0].phrase).toBe(PLACER_PHYSIQUE);
    const extra = links[2];
    expect(extra.extraEnClasse).toBe(true);
    expect(extra.phrase).not.toBeNull();
    expect(extra.texte).toBe(texteOf(DEPLACE3D));
  });

  it('Placer : n’ajoute pas deux fois l’attendu déjà ciblé', () => {
    const links = programmeLinks('placer', 'physique', [A1, DEPLACE3D]);
    expect(links.filter((l) => l.code === DEPLACE3D)).toHaveLength(1);
    expect(links.find((l) => l.code === DEPLACE3D)?.extraEnClasse).toBe(false);
  });
});

describe('programmeLinks, jeu sur écran', () => {
  it('Placer sur écran : aucun attendu « en plus en classe »', () => {
    const links = programmeLinks('placer', 'numerique', [A1, PLACE2D]);
    expect(links.map((l) => l.code)).toEqual([A1, PLACE2D]);
    expect(links.every((l) => !l.extraEnClasse)).toBe(true);
  });

  it('chaque mécanique a une phrase sur écran pour au moins un attendu du pilote', () => {
    expect(programmeLinks('trier', 'numerique', [A1])[0].phrase).not.toBeNull();
    expect(programmeLinks('associer', 'numerique', [A1])[0].phrase).not.toBeNull();
    expect(programmeLinks('ordre', 'numerique', [A3])[0].phrase).not.toBeNull();
    expect(programmeLinks('placer', 'numerique', [PLACE2D])[0].phrase).not.toBeNull();
  });
});

describe('repli honnête', () => {
  it('un attendu valide sans phrase prévue a une phrase nulle et son texte officiel', () => {
    const [l] = programmeLinks('trier', 'physique', ['M.P4.2.1.i1.a1']);
    expect(l.phrase).toBeNull();
    expect(l.texte).toBe(texteOf('M.P4.2.1.i1.a1'));
  });

  it('un code absent du jeu de données donne « Attendu introuvable », sans exception', () => {
    const [l] = programmeLinks('trier', 'physique', ['M.P9.9.9.i9.a9']);
    expect(l.texte).toBe('Attendu introuvable');
    expect(l.phrase).toBeNull();
  });
});

describe('formulation', () => {
  it('aucune phrase ne contient de tiret cadratin ni d’affirmation d’efficacité', () => {
    const all = PHRASES_PILOTE.flatMap((p) => [p.numerique, p.physique, p.extraPhysique].filter(Boolean) as string[]);
    expect(all.length).toBeGreaterThan(4);
    for (const s of all) {
      expect(s).not.toMatch(/[—–]/);
      expect(s.toLowerCase()).not.toMatch(/efficace|prouve|améliore/);
    }
  });
});
