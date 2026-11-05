import { describe, it, expect } from 'vitest';
import { FORMAT, VERSION_FICHIER, TAILLE_MAX_OCTETS, exporterActivite, lireActivite } from '../../src/atelier/fichier.js';
import { brouillonVide } from '../../src/atelier/brouillon.js';
import { chargerBrouillon } from '../../src/parcours/stockage.js';
import type { Brouillon } from '../../src/atelier/types.js';

const MAINTENANT = new Date(2026, 10, 5, 12, 0, 0);

function complet(over: Partial<Brouillon> = {}): Brouillon {
  return {
    ...brouillonVide(),
    niveau: 'P4',
    matiere: 'mathematiques',
    cibles: ['M.P4.1.1.i1.a1'],
    titre: 'Plus grand, plus petit',
    contexte: '18 élèves de 4e primaire.',
    comparaisons: '12 | 8\n3,5 | 3/4\n7 | 9',
    qcm: 'Q ? | a | b',
    ...over,
  };
}

const enveloppe = (brouillon: unknown, over: Record<string, unknown> = {}) =>
  JSON.stringify({ format: FORMAT, version: VERSION_FICHIER, exporteLe: MAINTENANT.toISOString(), brouillon, ...over });

describe('fichier d’échange v2', () => {
  it('écrit la version 2', () => {
    expect(VERSION_FICHIER).toBe(2);
    expect(JSON.parse(exporterActivite(complet(), MAINTENANT).contenu).version).toBe(2);
  });

  it('un aller-retour conserve comparaisons et qcm', () => {
    const r = lireActivite(exporterActivite(complet(), MAINTENANT).contenu);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.brouillon.comparaisons).toBe('12 | 8\n3,5 | 3/4\n7 | 9');
      expect(r.brouillon.qcm).toBe('Q ? | a | b');
    }
  });

  it('un fichier v1 sans les nouveaux champs est accepté avec des champs vides (Review Focus 1)', () => {
    const { comparaisons: _c, qcm: _q, ...ancien } = complet();
    const r = lireActivite(enveloppe(ancien, { version: 1 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.brouillon.comparaisons).toBe('');
      expect(r.brouillon.qcm).toBe('');
    }
  });

  it('refuse une version plus récente (3)', () => {
    expect(lireActivite(enveloppe(complet(), { version: 3 }))).toEqual({
      ok: false,
      message: 'Ce fichier vient d’une version plus récente de GameActif. Mettez l’application à jour ou demandez un nouvel envoi.',
    });
  });

  it('refuse un champ nouveau d’un mauvais type', () => {
    expect(lireActivite(enveloppe({ ...complet(), comparaisons: 3 })).ok).toBe(false);
  });

  it('les nouveaux champs comptent dans la taille maximale d’un champ', () => {
    expect(lireActivite(enveloppe(complet({ qcm: 'x'.repeat(20_001) }))).ok).toBe(false);
    expect(TAILLE_MAX_OCTETS).toBeGreaterThan(20_000);
  });
});

describe('stockage local d’un ancien brouillon', () => {
  it('chargerBrouillon complète les champs absents', () => {
    const { comparaisons: _c, qcm: _q, ...ancien } = complet();
    const stock = { getItem: () => JSON.stringify({ v: 1, etape: 'elements', brouillon: ancien }), setItem: () => {} };
    const etat = chargerBrouillon(stock);
    expect(etat.etape).toBe('elements');
    expect(etat.brouillon.titre).toBe('Plus grand, plus petit');
    expect(etat.brouillon.comparaisons).toBe('');
    expect(etat.brouillon.qcm).toBe('');
  });
});
