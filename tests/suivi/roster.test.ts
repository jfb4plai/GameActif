import { describe, it, expect } from 'vitest';
import {
  afficher,
  contientPrenom,
  ecrireRoster,
  exporterRoster,
  importerRoster,
  lireRoster,
  type Roster,
} from '../../src/suivi/roster.js';
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

describe('contientPrenom (garde-fou avant l’envoi d’une observation)', () => {
  const r: Roster = { E04: 'Léa', E02: 'Jean-Pierre' };

  it('ne trouve rien dans un texte qui n’emploie que le code', () => {
    expect(contientPrenom('E04 a corrigé seul devant/derrière', r)).toBeNull();
  });

  it('trouve le prénom quel que soit la casse ou l’accent', () => {
    expect(contientPrenom('Léa a corrigé', r)).toBe('Léa');
    expect(contientPrenom('LEA a corrigé', r)).toBe('Léa');
    expect(contientPrenom('léa a corrigé', r)).toBe('Léa');
    expect(contientPrenom('c’est lea qui a corrigé', r)).toBe('Léa');
  });

  it('ne confond pas un mot qui contient le prénom avec le prénom', () => {
    expect(contientPrenom('Dea a corrigé', r)).toBeNull();
    expect(contientPrenom('la lecture de Léas', r)).toBeNull();
  });

  it('trouve un prénom composé', () => {
    expect(contientPrenom('Jean-Pierre est resté', r)).toBe('Jean-Pierre');
  });

  it('ne trouve rien avec une liste vide', () => {
    expect(contientPrenom('Léa a corrigé', {})).toBeNull();
  });

  it('ignore les valeurs de moins de deux lettres', () => {
    expect(contientPrenom('E a corrigé', { E01: 'E' })).toBeNull();
  });
});

describe('liste locale de prénoms', () => {
  it('s’écrit et se relit par classe', () => {
    const s = stockage();
    ecrireRoster(s, 'classe-1', { E01: 'Léa' });
    expect(lireRoster(s, 'classe-1')).toEqual({ E01: 'Léa' });
    expect(lireRoster(s, 'classe-2')).toEqual({});
  });

  it('renvoie une liste vide quand le stockage est absent, refuse ou contient n’importe quoi', () => {
    expect(lireRoster(null, 'c')).toEqual({});
    const casse: StockageLocal = {
      getItem: () => {
        throw new Error('refusé');
      },
      setItem: () => {
        throw new Error('refusé');
      },
      removeItem: () => {},
    };
    expect(lireRoster(casse, 'c')).toEqual({});
    expect(() => ecrireRoster(casse, 'c', { E01: 'Léa' })).not.toThrow();
    const s = stockage();
    s.setItem('gameactif.roster.v1.c', '{pas du json');
    expect(lireRoster(s, 'c')).toEqual({});
  });

  it('s’exporte puis se réimporte à l’identique', () => {
    const r: Roster = { E01: 'Léa', E02: 'Jean-Pierre' };
    expect(importerRoster(exporterRoster(r, 'P4 B'))).toEqual(r);
  });

  it('refuse un fichier qui n’a pas la forme attendue', () => {
    expect(importerRoster('{"x":1}')).toBeNull();
    expect(importerRoster('pas du json')).toBeNull();
    expect(importerRoster(JSON.stringify({ format: 'gameactif-roster', version: 1, classe: 'x', prenoms: { Léa: 'E01' } }))).toBeNull();
    expect(importerRoster(JSON.stringify({ format: 'gameactif-roster', version: 1, classe: 'x', prenoms: { E01: 12 } }))).toBeNull();
    expect(importerRoster(JSON.stringify({ format: 'gameactif-roster', version: 1, classe: 'x', prenoms: { E01: 'a'.repeat(200) } }))).toBeNull();
    expect(importerRoster('x'.repeat(20_001))).toBeNull();
  });

  it('affiche le prénom du code, sinon le code', () => {
    expect(afficher('E01', { E01: 'Léa' })).toBe('Léa');
    expect(afficher('E09', {})).toBe('E09');
  });
});
