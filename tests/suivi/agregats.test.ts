import { describe, it, expect } from 'vitest';
import {
  SEUILS_ETATS_DEFAUT,
  erreursParType,
  etatEleve,
  evolution,
  faitsParEleve,
  jeuxParCible,
  participation,
  type ResultatManuel,
} from '../../src/suivi/agregats.js';
import type { ResultatEnvoye, SessionEnregistree } from '../../src/suivi/types.js';
import type { MechanicId } from '../../src/engine/types.js';

const C = 'M.P4.1.1.i1.a1';
const AUTRE = 'M.P4.1.1.i2.a1';
const LABELS = { devant: 'devant', derriere: 'derrière', entre: 'entre' };

/** Un élément réussi du premier coup, ou raté avec ces mauvais choix. */
function el(correct: string, wrong: string[] = []): ResultatEnvoye {
  return { elementId: `el-${correct}`, mechanic: 'trier', firstTry: wrong.length === 0, tries: wrong.length + 1, hintUsed: false, revealed: false, wrongChoices: wrong, correct };
}
/** `ok` éléments réussis puis `ko` éléments ratés avec « derriere » pour « devant ». */
function tour(ok: number, ko = 0): ResultatEnvoye[] {
  return [...Array.from({ length: ok }, () => el('entre')), ...Array.from({ length: ko }, () => el('devant', ['derriere']))];
}
function s(code: string, mechanic: MechanicId, jour: string, resultats: ResultatEnvoye[], cibles = [C]): SessionEnregistree {
  return { sessionId: `${code}-${mechanic}-${jour}`, studentCode: code, profile: 'standard', totalElements: resultats.length, endedAt: `${jour}T10:00:00.000Z`, results: resultats, cibles, mechanic, labels: LABELS, origine: 'ecran' };
}
const manuel = (code: string, resultat: ResultatManuel['resultat'], date: string, cible = C): ResultatManuel => ({ studentCode: code, cible, resultat, date: `${date}T10:00:00.000Z` });

describe('participation', () => {
  it('sépare les codes qui ont joué de ceux qui n’ont rien joué, dans l’ordre de la liste', () => {
    const r = participation(['E01', 'E02', 'E03'], [s('E01', 'trier', '2026-11-09', tour(2)), s('E03', 'memo', '2026-11-09', tour(2))], []);
    expect(r).toEqual({ joues: ['E01', 'E03'], absents: ['E02'] });
  });

  it('compte un résultat saisi par l’enseignant comme une participation', () => {
    const r = participation(['E01', 'E02'], [s('E01', 'trier', '2026-11-09', tour(2))], [manuel('E02', 'reussi', '2026-11-10')]);
    expect(r.absents).toEqual([]);
  });

  it('ne retient, pour un attendu donné, que les séances et les saisies de cet attendu', () => {
    const r = participation(['E01', 'E02'], [s('E01', 'trier', '2026-11-09', tour(2), [AUTRE])], [manuel('E02', 'reussi', '2026-11-10', AUTRE)], C);
    expect(r).toEqual({ joues: [], absents: ['E01', 'E02'] });
  });

  it('classe 40 codes absents quand aucune séance n’existe, sans erreur', () => {
    const codes = Array.from({ length: 40 }, (_, i) => `E${String(i + 1).padStart(2, '0')}`);
    const r = participation(codes, [], []);
    expect(r.joues).toEqual([]);
    expect(r.absents).toHaveLength(40);
  });
});

describe('erreursParType', () => {
  it('regroupe les élèves qui ont fait la même confusion, avec les étiquettes de la consigne', () => {
    const r = erreursParType([s('E01', 'trier', '2026-11-09', tour(1, 1)), s('E02', 'memo', '2026-11-09', tour(0, 2))]);
    expect(r).toEqual([{ juste: 'devant', choisi: 'derrière', eleves: ['E01', 'E02'], mecaniques: ['trier', 'memo'] }]);
  });

  it('classe d’abord la confusion qui touche le plus d’élèves', () => {
    const autre = el('entre', ['devant']);
    const r = erreursParType([s('E01', 'trier', '2026-11-09', [autre]), s('E02', 'trier', '2026-11-09', tour(0, 1)), s('E03', 'trier', '2026-11-09', tour(0, 1))]);
    expect(r.map((e) => e.eleves.length)).toEqual([2, 1]);
  });

  it('ne retient que l’attendu demandé', () => {
    const r = erreursParType([s('E01', 'trier', '2026-11-09', tour(0, 1), [AUTRE])], C);
    expect(r).toEqual([]);
  });

  it('retombe sur l’identifiant quand l’étiquette manque', () => {
    const sans = { ...s('E01', 'trier', '2026-11-09', tour(0, 1)), labels: {} };
    expect(erreursParType([sans])[0]).toMatchObject({ juste: 'devant', choisi: 'derriere' });
  });
});

describe('jeuxParCible', () => {
  it('donne, par jeu, le nombre de joueurs et la réussite moyenne au premier essai', () => {
    const r = jeuxParCible([s('E01', 'trier', '2026-11-09', tour(1, 1)), s('E02', 'trier', '2026-11-10', tour(2))], [], C);
    expect(r).toEqual([{ jeu: 'trier', joueurs: 2, r1Moyen: 0.75, derniere: '2026-11-10T10:00:00.000Z' }]);
  });

  it('ajoute une ligne « physique » pour les résultats saisis, sans pourcentage', () => {
    const r = jeuxParCible([], [manuel('E01', 'reussi', '2026-11-11'), manuel('E02', 'partiel', '2026-11-11')], C);
    expect(r).toEqual([{ jeu: 'physique', joueurs: 2, r1Moyen: null, derniere: '2026-11-11T10:00:00.000Z' }]);
  });

  it('renvoie une liste vide sans séance ni saisie', () => {
    expect(jeuxParCible([], [], C)).toEqual([]);
  });
});

describe('etatEleve', () => {
  it('« stabilisé » : réussi dans trois jeux différents sur au moins deux jours', () => {
    const ss = [s('E01', 'trier', '2026-11-09', tour(4)), s('E01', 'associer', '2026-11-09', tour(4)), s('E01', 'memo', '2026-11-10', tour(4))];
    expect(etatEleve('E01', C, ss, [])).toBe('stabilise');
  });

  it('trois jeux le même jour ne suffisent pas : « en cours »', () => {
    const ss = [s('E01', 'trier', '2026-11-09', tour(4)), s('E01', 'associer', '2026-11-09', tour(4)), s('E01', 'memo', '2026-11-09', tour(4))];
    expect(etatEleve('E01', C, ss, [])).toBe('en-cours');
  });

  it('un résultat saisi « réussi » compte comme un jeu physique', () => {
    const ss = [s('E01', 'trier', '2026-11-09', tour(4)), s('E01', 'memo', '2026-11-10', tour(4))];
    expect(etatEleve('E01', C, ss, [manuel('E01', 'reussi', '2026-11-11')])).toBe('stabilise');
  });

  it('« à reprendre » : la même confusion dans deux jeux différents', () => {
    const ss = [s('E01', 'trier', '2026-11-09', tour(2, 2)), s('E01', 'memo', '2026-11-10', tour(2, 2))];
    expect(etatEleve('E01', C, ss, [])).toBe('a-reprendre');
  });

  it('la même confusion répétée dans un seul jeu ne suffit pas', () => {
    const ss = [s('E01', 'trier', '2026-11-09', tour(2, 2)), s('E01', 'trier', '2026-11-10', tour(2, 2))];
    expect(etatEleve('E01', C, ss, [])).toBe('en-cours');
  });

  it('une saisie « à reprendre » de l’enseignant met l’élève à reprendre', () => {
    expect(etatEleve('E01', C, [s('E01', 'trier', '2026-11-09', tour(4))], [manuel('E01', 'a_reprendre', '2026-11-10')])).toBe('a-reprendre');
  });

  it('« pas d’indice » sans séance ni saisie pour cet élève et cet attendu', () => {
    expect(etatEleve('E01', C, [], [])).toBe('pas-d-indice');
    expect(etatEleve('E01', C, [s('E02', 'trier', '2026-11-09', tour(4))], [])).toBe('pas-d-indice');
    expect(etatEleve('E01', C, [s('E01', 'trier', '2026-11-09', tour(4), [AUTRE])], [])).toBe('pas-d-indice');
  });

  it('les seuils sont réglables', () => {
    const ss = [s('E01', 'trier', '2026-11-09', tour(4)), s('E01', 'memo', '2026-11-10', tour(4))];
    expect(etatEleve('E01', C, ss, [])).toBe('en-cours');
    expect(etatEleve('E01', C, ss, [], { ...SEUILS_ETATS_DEFAUT, jeuxDifferents: 2 })).toBe('stabilise');
  });

  it('valeurs de départ : réussite 0,75, trois jeux, deux jours, deux jeux pour une erreur répétée', () => {
    expect(SEUILS_ETATS_DEFAUT).toEqual({ reussite: 0.75, jeuxDifferents: 3, jours: 2, erreurRepetee: 2 });
  });
});

describe('evolution', () => {
  it('renvoie null sous trois jours distincts', () => {
    const ss = [s('E01', 'trier', '2026-11-09', tour(2)), s('E01', 'memo', '2026-11-10', tour(2))];
    expect(evolution(ss, C)).toBeNull();
  });

  it('renvoie un point par jour à partir de trois jours, dans l’ordre des dates', () => {
    const ss = [s('E01', 'trier', '2026-11-12', tour(2)), s('E01', 'memo', '2026-11-09', tour(1, 1)), s('E01', 'qcm', '2026-11-10', tour(1, 3))];
    expect(evolution(ss, C)).toEqual([
      { jour: '2026-11-09', r1: 0.5 },
      { jour: '2026-11-10', r1: 0.25 },
      { jour: '2026-11-12', r1: 1 },
    ]);
  });

  it('peut se limiter à un code élève', () => {
    const ss = [s('E01', 'trier', '2026-11-09', tour(2)), s('E02', 'trier', '2026-11-10', tour(2)), s('E01', 'memo', '2026-11-11', tour(2)), s('E01', 'qcm', '2026-11-12', tour(2))];
    expect(evolution(ss, C, 'E02')).toBeNull();
    expect(evolution(ss, C, 'E01')).toHaveLength(3);
  });
});

describe('faitsParEleve', () => {
  it('liste les séances jouées et les saisies de l’enseignant, étiquetées, par date', () => {
    const f = faitsParEleve('E01', [s('E01', 'trier', '2026-11-10', tour(1, 1)), s('E02', 'trier', '2026-11-10', tour(2))], [manuel('E01', 'partiel', '2026-11-09')]);
    expect(f).toEqual([
      { date: '2026-11-09T10:00:00.000Z', jeu: 'physique', r1: null, erreurs: [], origine: 'enseignant', note: 'partiel' },
      { date: '2026-11-10T10:00:00.000Z', jeu: 'trier', r1: 0.5, erreurs: ['derrière au lieu de devant'], origine: 'ecran' },
    ]);
  });
});
