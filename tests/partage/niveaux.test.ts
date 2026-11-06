import { describe, it, expect } from 'vitest';
import { COULEURS_GROUPES, NOMS_NEUTRES, estAuDessus, niveauAuDessus, profilDuGroupe } from '../../src/partage/niveaux.js';

describe('niveauAuDessus', () => {
  it('monte d’un niveau, jamais plus, et le niveau le plus haut n’a pas de suite', () => {
    expect(niveauAuDessus('soutien')).toBe('standard');
    expect(niveauAuDessus('standard')).toBe('defi');
    expect(niveauAuDessus('defi')).toBeNull();
  });
});

describe('estAuDessus', () => {
  it('vrai seulement quand le niveau joué est plus haut que le niveau attribué', () => {
    expect(estAuDessus('standard', 'soutien')).toBe(true);
    expect(estAuDessus('defi', 'soutien')).toBe(true);
    expect(estAuDessus('soutien', 'soutien')).toBe(false);
    expect(estAuDessus('soutien', 'defi')).toBe(false);
    expect(estAuDessus('standard', 'standard')).toBe(false);
  });
});

describe('profilDuGroupe', () => {
  it('associe les groupes 1, 2 et 3 aux profils soutien, standard et défi ; sans groupe : standard', () => {
    expect(profilDuGroupe(1)).toBe('soutien');
    expect(profilDuGroupe(2)).toBe('standard');
    expect(profilDuGroupe(3)).toBe('defi');
    expect(profilDuGroupe(null)).toBe('standard');
  });
});

describe('noms vus par l’élève', () => {
  it('aucun nom neutre ne dit le niveau de difficulté ni ne contient « soutien »', () => {
    for (const nom of Object.values(NOMS_NEUTRES)) {
      expect(nom).not.toMatch(/soutien|difficult|faible|fort|facile/i);
    }
    expect(Object.keys(NOMS_NEUTRES).sort()).toEqual(['defi', 'soutien', 'standard']);
  });

  it('les couleurs des groupes sont trois mots distincts', () => {
    const couleurs = Object.values(COULEURS_GROUPES);
    expect(new Set(couleurs).size).toBe(3);
    expect(Object.keys(COULEURS_GROUPES).sort()).toEqual(['1', '2', '3']);
  });
});
