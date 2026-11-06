import { describe, it, expect } from 'vitest';
import { SEUILS_ETATS_DEFAUT } from '../../src/suivi/agregats.js';
import { ecrireSeuils, lireSeuils } from '../../src/suivi/seuils.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

function stockage(): StockageLocal & { donnees: Map<string, string> } {
  const donnees = new Map<string, string>();
  return { donnees, getItem: (k) => donnees.get(k) ?? null, setItem: (k, v) => void donnees.set(k, v), removeItem: (k) => void donnees.delete(k) };
}

describe('seuils des états, par classe, dans le navigateur', () => {
  it('valent les valeurs de départ tant que rien n’est enregistré', () => {
    expect(lireSeuils(stockage(), 'c1')).toEqual(SEUILS_ETATS_DEFAUT);
    expect(lireSeuils(null, 'c1')).toEqual(SEUILS_ETATS_DEFAUT);
  });

  it('s’écrivent et se relisent par classe', () => {
    const s = stockage();
    ecrireSeuils(s, 'c1', { reussite: 0.8, jeuxDifferents: 2, jours: 1, erreurRepetee: 3 });
    expect(lireSeuils(s, 'c1')).toEqual({ reussite: 0.8, jeuxDifferents: 2, jours: 1, erreurRepetee: 3 });
    expect(lireSeuils(s, 'c2')).toEqual(SEUILS_ETATS_DEFAUT);
  });

  it('retombent sur les valeurs de départ pour un contenu invalide ou hors limites, sans lever', () => {
    const s = stockage();
    for (const brut of ['{pas du json', '{"reussite":2,"jeuxDifferents":3,"jours":2,"erreurRepetee":2}', '{"reussite":0.75,"jeuxDifferents":0,"jours":2,"erreurRepetee":2}', '{"reussite":0.75,"jeuxDifferents":3,"jours":"2","erreurRepetee":2}', 'null']) {
      s.setItem('gameactif.seuils.v1.c1', brut);
      expect(lireSeuils(s, 'c1'), brut).toEqual(SEUILS_ETATS_DEFAUT);
    }
  });

  it('ne lèvent pas quand le stockage refuse', () => {
    const casse: StockageLocal = {
      getItem: () => {
        throw new Error('refusé');
      },
      setItem: () => {
        throw new Error('refusé');
      },
      removeItem: () => {},
    };
    expect(lireSeuils(casse, 'c1')).toEqual(SEUILS_ETATS_DEFAUT);
    expect(() => ecrireSeuils(casse, 'c1', SEUILS_ETATS_DEFAUT)).not.toThrow();
  });
});
