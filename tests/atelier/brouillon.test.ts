import { describe, it, expect } from 'vitest';
import {
  brouillonVide,
  lignes,
  analysePaires,
  problemesBrouillon,
  construireActivite,
  libelleNiveau,
  problemesSaisie,
  statutsJeux,
} from '../../src/atelier/brouillon.js';
import type { Brouillon } from '../../src/atelier/types.js';
import { availableMechanics } from '../../src/engine/availability.js';
import { canPublish } from '../../src/engine/validation.js';
import { referentielCodes } from '../../src/data/referentiel.js';

function complet(over: Partial<Brouillon> = {}): Brouillon {
  return {
    niveau: 'P4',
    matiere: 'mathematiques',
    cibles: ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2'],
    titre: 'Les positions',
    contexte: '18 élèves de 4e primaire, vocabulaire de position travaillé la semaine dernière.',
    familles: [
      { label: 'Position absolue', elements: 'à l’intérieur\nentre' },
      { label: 'Position relative', elements: 'devant\nà gauche' },
      { label: '', elements: '' },
    ],
    paires: 'devant | derrière\nà droite | à gauche',
    etapes: 'premier\ndeuxième\ntroisième',
    comparaisons: '',
    qcm: '',
    ...over,
  };
}

describe('lignes', () => {
  it('garde une entrée par ligne non vide, sans espace de bord ni espace multiple', () => {
    expect(lignes('  a  b \n\n c ')).toEqual(['a b', 'c']);
    expect(lignes('')).toEqual([]);
  });

  it('conserve les apostrophes typographiques et un texte long', () => {
    const long = 'x'.repeat(30) + ' ' + 'y'.repeat(30) + ' ' + 'z'.repeat(28);
    expect(lignes(`à l’intérieur\n${long}`)).toEqual(['à l’intérieur', long]);
  });
});

describe('analysePaires', () => {
  it('lit les paires séparées par « | »', () => {
    expect(analysePaires('devant | derrière\nà droite|à gauche').paires).toEqual([
      { gauche: 'devant', droite: 'derrière' },
      { gauche: 'à droite', droite: 'à gauche' },
    ]);
  });

  it('signale une ligne sans séparateur avec son numéro, sans exception (Review Focus 2)', () => {
    const r = analysePaires('devant | derrière\nà droite');
    expect(r.paires).toHaveLength(1);
    expect(r.erreurs).toEqual([{ numero: 2, message: 'Il manque le séparateur « | » entre les deux éléments.' }]);
  });

  it('compte les lignes vides dans la numérotation', () => {
    expect(analysePaires('a | b\n\nc').erreurs[0].numero).toBe(3);
  });

  it('signale une paire dont un côté est vide', () => {
    expect(analysePaires('a | ').erreurs).toEqual([{ numero: 1, message: 'Il manque un élément d’un côté du séparateur.' }]);
  });
});

describe('problemesBrouillon', () => {
  it('ne signale rien pour un brouillon complet', () => {
    expect(problemesBrouillon(complet())).toEqual([]);
  });

  it('nomme le mot écrit dans deux familles (Review Focus 1)', () => {
    const b = complet({
      familles: [
        { label: 'Famille A', elements: 'entre\ndevant' },
        { label: 'Famille B', elements: 'derrière\nEntre' },
      ],
    });
    expect(problemesBrouillon(b)).toContain('Le mot « entre » est dans deux familles : Famille A et Famille B.');
  });

  it('nomme le mot écrit deux fois dans la même famille', () => {
    const b = complet({ familles: [{ label: 'Famille A', elements: 'entre\nentre' }, { label: 'B', elements: 'x' }, { label: '', elements: '' }] });
    expect(problemesBrouillon(b)).toContain('Le mot « entre » est écrit deux fois dans la famille Famille A.');
  });

  it('refuse deux paires qui ont le même élément à gauche', () => {
    expect(problemesBrouillon(complet({ paires: 'a | b\na | c' }))).toContain('Le mot « a » est à gauche dans deux paires.');
  });

  it('refuse un titre vide, un contexte vide et un nombre de compétences hors de 1 à 3', () => {
    const p = problemesBrouillon(complet({ titre: ' ', contexte: '', cibles: [] }));
    expect(p).toContain('Le titre est obligatoire.');
    expect(p).toContain('Le contexte de classe est obligatoire.');
    expect(p).toContain('Il faut choisir de 1 à 3 compétences visées.');
    expect(problemesBrouillon(complet({ cibles: ['a', 'b', 'c', 'd'] }))).toContain('Il faut choisir de 1 à 3 compétences visées.');
  });

  it('reprend les erreurs de paires avec leur numéro de ligne', () => {
    expect(problemesBrouillon(complet({ paires: 'a | b\nsans separateur' }))).toContain(
      'Paires, ligne 2 : Il manque le séparateur « | » entre les deux éléments.',
    );
  });

  it('signale une famille qui a des éléments mais pas de nom', () => {
    const b = complet({ familles: [{ label: '', elements: 'x\ny' }, { label: 'B', elements: 'z' }, { label: '', elements: '' }] });
    expect(problemesBrouillon(b)).toContain('La famille 1 a des éléments mais pas de nom.');
  });
});

describe('construireActivite', () => {
  it('produit une activité où Trier, Associer et Remettre en ordre sont disponibles, pas Placer', () => {
    const a = construireActivite(complet());
    const m = availableMechanics(a);
    expect(m.trier.available).toBe(true);
    expect(m.associer.available).toBe(true);
    expect(m.ordre.available).toBe(true);
    expect(m.placer.available).toBe(false);
    expect(a.sceneId).toBeUndefined();
  });

  it('recopie le titre, le contexte, les cibles, la matière et le niveau', () => {
    const a = construireActivite(complet());
    expect(a.title).toBe('Les positions');
    expect(a.cibles).toEqual(['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2']);
    expect(a.discipline).toBe('Mathématiques');
    expect(a.year).toBe('4e primaire');
    expect(a.context).toContain('18 élèves');
  });

  it('marque tous les éléments comme saisis et validés par l’enseignant, ids stables', () => {
    const a = construireActivite(complet());
    expect(a.items.every((i) => i.origin === 'manuel' && i.validated && !i.modified)).toBe(true);
    const ids = a.items.map((i) => i.id);
    expect(ids).toContain('f1e1');
    expect(ids).toContain('p1g');
    expect(ids).toContain('p1d');
    expect(ids).toContain('s1');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('range les rangs dans l’ordre des lignes d’étapes', () => {
    const a = construireActivite(complet());
    const textes = new Map(a.items.map((i) => [i.id, i.text]));
    expect([...a.ranks].sort((x, y) => x.position - y.position).map((r) => textes.get(r.itemId))).toEqual(['premier', 'deuxième', 'troisième']);
  });

  it('est publiable avec les vrais codes du référentiel', () => {
    expect(canPublish(construireActivite(complet()), referentielCodes())).toEqual({ ok: true, reasons: [] });
  });

  it('un brouillon qui n’a que des étapes ne propose que Remettre en ordre', () => {
    const a = construireActivite(complet({ familles: brouillonVide().familles, paires: '' }));
    const m = availableMechanics(a);
    expect([m.trier.available, m.associer.available, m.ordre.available]).toEqual([false, false, true]);
  });

  it('ignore une famille vide et numérote les autres selon leur position', () => {
    const a = construireActivite(
      complet({ familles: [{ label: '', elements: '' }, { label: 'B', elements: 'x\ny' }, { label: 'C', elements: 'z' }] }),
    );
    expect(a.categories.map((c) => c.id)).toEqual(['f2', 'f3']);
  });

  it('lève une erreur claire quand le brouillon a des problèmes', () => {
    expect(() => construireActivite(complet({ titre: '' }))).toThrow('Le titre est obligatoire.');
  });
});

describe('libelleNiveau et brouillonVide', () => {
  it('écrit les niveaux à la belge', () => {
    expect([libelleNiveau('P1'), libelleNiveau('P2'), libelleNiveau('P6')]).toEqual(['1re primaire', '2e primaire', '6e primaire']);
  });

  it('un brouillon vide a trois familles vides et aucune cible', () => {
    const b = brouillonVide();
    expect(b.familles).toHaveLength(3);
    expect(b.cibles).toEqual([]);
    expect(b.niveau).toBe('');
  });
});

describe('problemesSaisie et statutsJeux', () => {
  it('problemesSaisie ne contient ni le titre, ni le contexte, ni les compétences', () => {
    const p = problemesSaisie(complet({ titre: '', contexte: '', cibles: [], paires: 'a | b\nsans' }));
    expect(p).toEqual(['Paires, ligne 2 : Il manque le séparateur « | » entre les deux éléments.']);
  });

  it('problemesBrouillon reprend problemesSaisie', () => {
    const b = complet({ paires: 'a | b\nsans' });
    for (const p of problemesSaisie(b)) expect(problemesBrouillon(b)).toContain(p);
  });

  it('statutsJeux d’un brouillon vide donne le message du moteur pour chaque jeu', () => {
    const s = statutsJeux(brouillonVide());
    expect(s.trier).toEqual({ available: false, missing: 'Il faut au moins 2 catégories contenant chacune un élément.' });
    expect(s.associer).toEqual({ available: false, missing: 'Il faut au moins 2 paires.' });
    expect(s.ordre).toEqual({ available: false, missing: 'Il faut au moins 3 éléments avec des positions 1, 2, 3…' });
  });

  it('statutsJeux marque disponible ce qui est assez rempli, même si le brouillon a d’autres problèmes', () => {
    const s = statutsJeux(complet({ titre: '', paires: 'a | b\nc | d\nsans' }));
    expect(s.associer.available).toBe(true);
    expect(s.trier.available).toBe(true);
    expect(s.ordre.available).toBe(true);
  });

  it('refuse deux familles qui portent le même nom, en le disant clairement', () => {
    const b = complet({
      familles: [
        { label: 'Position absolue', elements: 'entre\nà l’intérieur' },
        { label: 'Position absolue', elements: 'sur\nsous' },
        { label: '', elements: '' },
      ],
    });
    expect(problemesSaisie(b)).toContain(
      'Deux familles portent le même nom : « Position absolue » (familles 1 et 2). Donnez-leur des noms différents ou regroupez leurs éléments dans une seule famille.',
    );
  });

  it('ignore la casse et les espaces en trop pour reconnaître deux noms identiques', () => {
    const b = complet({
      familles: [
        { label: 'Position absolue', elements: 'entre' },
        { label: '  position   ABSOLUE ', elements: 'sur\nsous' },
        { label: '', elements: '' },
      ],
    });
    expect(problemesSaisie(b).some((p) => p.startsWith('Deux familles portent le même nom'))).toBe(true);
  });

  it('deux familles sans nom ne sont pas signalées comme identiques', () => {
    const b = complet({ familles: [{ label: '', elements: 'x' }, { label: '', elements: 'y' }, { label: '', elements: '' }] });
    expect(problemesSaisie(b).some((p) => p.startsWith('Deux familles portent'))).toBe(false);
  });

  it('refuse deux paires qui ont le même élément à droite', () => {
    expect(problemesSaisie(complet({ paires: 'a | x\nb | x' }))).toContain('Le mot « x » est à droite dans deux paires.');
  });
});

