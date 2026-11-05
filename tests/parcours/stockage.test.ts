import { describe, it, expect } from 'vitest';
import { chargerBrouillon, sauverBrouillon, type Stockage } from '../../src/parcours/stockage.js';
import { etatInitial, type EtatParcours } from '../../src/parcours/etapes.js';

function memoire(): Stockage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const etat = (): EtatParcours => ({
  etape: 'elements',
  brouillon: {
    niveau: 'P4',
    matiere: 'mathematiques',
    cibles: ['M.P4.1.1.i1.a1'],
    titre: 'Les positions',
    contexte: '18 élèves.',
    familles: [
      { label: 'Absolue', elements: 'entre\nà l’intérieur' },
      { label: '', elements: '' },
      { label: '', elements: '' },
    ],
    paires: 'devant | derrière',
    etapes: 'premier\ndeuxième',
    comparaisons: '12 | 8',
    qcm: 'Q ? | a | b',
  },
});

describe('stockage du brouillon', () => {
  it('un aller-retour rend l’état identique', () => {
    const s = memoire();
    sauverBrouillon(s, etat());
    expect(chargerBrouillon(s)).toEqual(etat());
  });

  it('un stockage absent rend l’état de départ sans exception (Review Focus 4)', () => {
    expect(chargerBrouillon(null)).toEqual(etatInitial());
    expect(() => sauverBrouillon(null, etat())).not.toThrow();
  });

  it('un contenu corrompu, d’un autre type ou d’une autre version rend l’état de départ', () => {
    for (const brut of ['pas du json', '42', 'null', '{"v":2}', '{"v":1,"etape":"inconnue","brouillon":{}}', '{"v":1,"etape":"elements","brouillon":{"niveau":3}}']) {
      const s = memoire();
      s.data.set('gameactif.brouillon.v1', brut);
      expect(chargerBrouillon(s)).toEqual(etatInitial());
    }
  });

  it('un stockage qui refuse d’écrire (quota, navigation privée) est avalé', () => {
    const s: Stockage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(() => sauverBrouillon(s, etat())).not.toThrow();
  });

  it('un stockage dont la lecture lève une exception rend l’état de départ', () => {
    const s: Stockage = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => {} };
    expect(chargerBrouillon(s)).toEqual(etatInitial());
  });

  it('ne sauvegarde jamais l’étape des jeux : retour à la saisie au rechargement', () => {
    const s = memoire();
    sauverBrouillon(s, { ...etat(), etape: 'jeux' });
    expect(chargerBrouillon(s).etape).toBe('elements');
  });
});
