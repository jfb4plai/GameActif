import { describe, it, expect } from 'vitest';
import {
  FORMAT,
  VERSION_FICHIER,
  TAILLE_MAX_OCTETS,
  exporterActivite,
  lireActivite,
  nomDeFichier,
} from '../../src/atelier/fichier.js';
import { brouillonVide } from '../../src/atelier/brouillon.js';
import type { Brouillon } from '../../src/atelier/types.js';

const MAINTENANT = new Date(2026, 10, 3, 12, 0, 0);

function complet(over: Partial<Brouillon> = {}): Brouillon {
  return {
    ...brouillonVide(),
    niveau: 'P4',
    matiere: 'mathematiques',
    cibles: ['M.P4.1.1.i1.a1', 'M.P4.1.1.i1.a2'],
    titre: 'Les positions',
    contexte: '18 élèves de 4e primaire.',
    familles: [
      { label: 'Absolue', elements: 'entre\nà l’intérieur' },
      { label: 'Relative', elements: 'devant\nà gauche' },
      { label: '', elements: '' },
    ],
    paires: 'devant | derrière\nà droite | à gauche',
    etapes: 'premier\ndeuxième\ntroisième',
    ...over,
  };
}

const enveloppe = (brouillon: unknown, over: Record<string, unknown> = {}) =>
  JSON.stringify({ format: FORMAT, version: VERSION_FICHIER, exporteLe: MAINTENANT.toISOString(), brouillon, ...over });

describe('exporterActivite', () => {
  it('produit un fichier relisible dont le brouillon est identique', () => {
    const b = complet();
    const r = lireActivite(exporterActivite(b, MAINTENANT).contenu);
    expect(r).toEqual({ ok: true, brouillon: b, avertissements: [] });
  });

  it('un brouillon de français garde sa matière et ses codes F. à l’export puis à l’import', () => {
    const b = complet({ niveau: 'P3', matiere: 'francais', cibles: ['F.P3.r1.i1.a1', 'F.P3.r1.i1.a2'] });
    expect(lireActivite(exporterActivite(b, MAINTENANT).contenu)).toEqual({ ok: true, brouillon: b, avertissements: [] });
  });

  it('ne contient que format, version, exporteLe et brouillon, jamais d’identité', () => {
    const o = JSON.parse(exporterActivite(complet(), MAINTENANT).contenu);
    expect(Object.keys(o)).toEqual(['format', 'version', 'exporteLe', 'brouillon']);
    expect(o.format).toBe('gameactif-activite');
    expect(o.version).toBe(2);
    const texte = JSON.stringify(o).toLowerCase();
    for (const mot of ['email', 'e-mail', 'userid', 'user_id', 'password']) expect(texte).not.toContain(mot);
  });

  it('indente de deux espaces pour rester lisible dans un éditeur', () => {
    expect(exporterActivite(complet(), MAINTENANT).contenu).toContain('\n  "format"');
  });
});

describe('nomDeFichier', () => {
  it('retire les accents, met en minuscules et remplace espaces et apostrophes par des tirets', () => {
    expect(nomDeFichier(complet({ titre: 'Fractions, pourcentages et décimaux' }), MAINTENANT)).toBe(
      'gameactif-fractions-pourcentages-et-decimaux-2026-11-03.json',
    );
    expect(nomDeFichier(complet({ titre: 'L’école de l’été !' }), MAINTENANT)).toBe('gameactif-l-ecole-de-l-ete-2026-11-03.json');
  });

  it('un titre vide donne « activite »', () => {
    expect(nomDeFichier(complet({ titre: '  ' }), MAINTENANT)).toBe('gameactif-activite-2026-11-03.json');
  });

  it('tronque un titre de plus de 40 caractères sans finir par un tiret', () => {
    const nom = nomDeFichier(complet({ titre: 'a'.repeat(39) + ' ' + 'b'.repeat(30) }), MAINTENANT);
    const milieu = nom.replace('gameactif-', '').replace('-2026-11-03.json', '');
    expect(milieu.length).toBeLessThanOrEqual(40);
    expect(milieu.endsWith('-')).toBe(false);
  });
});

describe('lireActivite, refus', () => {
  it('refuse un fichier vide', () => {
    expect(lireActivite('')).toEqual({ ok: false, message: 'Le fichier est vide.' });
    expect(lireActivite('   \n')).toEqual({ ok: false, message: 'Le fichier est vide.' });
  });

  it('refuse un texte qui n’est pas du JSON, sans rien lever (Review Focus 1)', () => {
    expect(lireActivite('ceci n’est pas du json')).toEqual({
      ok: false,
      message: 'Ce fichier n’est pas une activité GameActif : il n’est pas lisible.',
    });
  });

  it('refuse le JSON d’un autre outil', () => {
    for (const texte of ['{"a":1}', '42', 'null', '[]', enveloppe(complet(), { format: 'autre-chose' })]) {
      expect(lireActivite(texte)).toEqual({ ok: false, message: 'Ce fichier n’est pas une activité GameActif.' });
    }
  });

  it('refuse un fichier d’une version plus récente (Review Focus 3)', () => {
    expect(lireActivite(enveloppe(complet(), { version: 3 }))).toEqual({
      ok: false,
      message: 'Ce fichier vient d’une version plus récente de GameActif. Mettez l’application à jour ou demandez un nouvel envoi.',
    });
  });

  it('refuse un fichier trop gros sans même l’analyser (Review Focus 2)', () => {
    const enorme = '{"format":"gameactif-activite","version":1,"x":"' + 'x'.repeat(TAILLE_MAX_OCTETS + 100) + '" ';
    expect(lireActivite(enorme)).toEqual({ ok: false, message: 'Ce fichier est trop gros pour être une activité GameActif.' });
  });

  it('refuse un champ de texte démesuré (Review Focus 2)', () => {
    const b = complet({ titre: 'x'.repeat(20001) });
    expect(lireActivite(enveloppe(b))).toEqual({ ok: false, message: 'Ce fichier est trop gros pour être une activité GameActif.' });
  });

  it('refuse un brouillon de forme invalide', () => {
    const faux = [
      { ...complet(), cibles: 'M.P4.1.1.i1.a1' },
      { ...complet(), familles: [{ label: 'a', elements: 'b' }] },
      { ...complet(), titre: 12 },
      null,
    ];
    for (const b of faux) {
      expect(lireActivite(enveloppe(b))).toEqual({ ok: false, message: 'Ce fichier est abîmé : l’activité n’a pas pu être relue.' });
    }
  });

  it('refuse un niveau ou une matière absents des données', () => {
    for (const b of [complet({ niveau: 'S1' }), complet({ matiere: 'histoire' }), complet({ niveau: '' })]) {
      expect(lireActivite(enveloppe(b))).toEqual({ ok: false, message: 'Ce niveau ou cette matière n’existe pas encore dans GameActif.' });
    }
  });
});

describe('lireActivite, compétences et contenu', () => {
  it('retire les compétences inconnues ou d’un autre niveau et le dit (Review Focus 4)', () => {
    const b = complet({ cibles: ['M.P4.1.1.i1.a1', 'M.P4.9.9.i9.a9', 'M.P3.1.1.i1.a1'] });
    const r = lireActivite(enveloppe(b));
    expect(r.ok && r.brouillon.cibles).toEqual(['M.P4.1.1.i1.a1']);
    expect(r.ok && r.avertissements).toEqual(['2 compétence(s) du fichier n’existent plus dans le programme chargé et ont été retirées.']);
  });

  it('un fichier sans compétence est accepté tel quel', () => {
    const r = lireActivite(enveloppe(complet({ cibles: [] })));
    expect(r.ok && r.brouillon.cibles).toEqual([]);
  });

  it('lit un texte qui ressemble à du code comme du simple texte, sans le transformer', () => {
    const piege = '<script>alert(1)</script> & "guillemets"';
    const b = complet({ familles: [{ label: piege, elements: piege }, { label: 'B', elements: 'x' }, { label: '', elements: '' }] });
    const r = lireActivite(enveloppe(b));
    expect(r.ok && r.brouillon.familles[0]).toEqual({ label: piege, elements: piege });
  });

  it('ignore les clés en trop de l’enveloppe et du brouillon', () => {
    const o = { ...complet(), intrus: 'x' };
    const r = lireActivite(enveloppe(o, { autre: 1 }));
    expect(r.ok).toBe(true);
    expect(r.ok && Object.keys(r.brouillon).sort()).toEqual(Object.keys(complet()).sort());
  });
});
