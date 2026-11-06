import { describe, it, expect } from 'vitest';
import { enregistrerClasse, lireClasse, oublierClasse } from '../../src/suivi/classeAppareil.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

function stockage(): StockageLocal & { donnees: Map<string, string> } {
  const donnees = new Map<string, string>();
  return {
    donnees,
    getItem: (k) => donnees.get(k) ?? null,
    setItem: (k, v) => void donnees.set(k, v),
    removeItem: (k) => void donnees.delete(k),
  };
}

describe('classe associée à l’appareil', () => {
  it('s’enregistre, se relit et s’oublie', () => {
    const s = stockage();
    expect(lireClasse(s)).toBeNull();
    enregistrerClasse(s, { code: 'ABCD2345', nbCodes: 24 });
    expect(lireClasse(s)).toEqual({ code: 'ABCD2345', nbCodes: 24 });
    oublierClasse(s);
    expect(lireClasse(s)).toBeNull();
  });

  it('renvoie null quand le stockage est absent ou qui lève', () => {
    expect(lireClasse(null)).toBeNull();
    const casse: StockageLocal = {
      getItem: () => {
        throw new Error('refusé');
      },
      setItem: () => {
        throw new Error('refusé');
      },
      removeItem: () => {
        throw new Error('refusé');
      },
    };
    expect(lireClasse(casse)).toBeNull();
    expect(() => enregistrerClasse(casse, { code: 'ABCD2345', nbCodes: 24 })).not.toThrow();
    expect(() => oublierClasse(casse)).not.toThrow();
  });

  it('refuse un contenu qui n’a pas la forme d’un code de classe et d’un nombre de codes de 1 à 40', () => {
    const s = stockage();
    for (const brut of ['{pas du json', '{"code":"abc","nbCodes":24}', '{"code":"ABCD2345","nbCodes":0}', '{"code":"ABCD2345","nbCodes":41}', '{"code":"ABCD2345","nbCodes":"24"}', 'null']) {
      s.setItem('gameactif.classe.v1', brut);
      expect(lireClasse(s), brut).toBeNull();
    }
  });

  it('ne garde rien d’autre que le code de classe et le nombre de codes', () => {
    const s = stockage();
    enregistrerClasse(s, { code: 'ABCD2345', nbCodes: 24, prenom: 'Léa' } as never);
    expect(JSON.parse(s.donnees.get('gameactif.classe.v1') ?? '{}')).toEqual({ code: 'ABCD2345', nbCodes: 24 });
  });
});
