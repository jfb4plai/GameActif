import { describe, it, expect } from 'vitest';
import { FORME_CODE_ACTIVITE, lienActivite, lireLienActivite } from '../../src/partage/lien.js';

describe('lienActivite', () => {
  it('construit le lien court, avec ou sans groupe', () => {
    expect(lienActivite('https://gameactif.jfb4plai.com', 'K7M2XQ9A')).toBe('https://gameactif.jfb4plai.com/?activite=K7M2XQ9A');
    expect(lienActivite('https://gameactif.jfb4plai.com', 'K7M2XQ9A', 2)).toBe('https://gameactif.jfb4plai.com/?activite=K7M2XQ9A&g=2');
  });

  it('ne double pas la barre finale de l’origine', () => {
    expect(lienActivite('https://gameactif.jfb4plai.com/', 'K7M2XQ9A')).toBe('https://gameactif.jfb4plai.com/?activite=K7M2XQ9A');
  });
});

describe('lireLienActivite', () => {
  it('lit le code et le groupe puis nettoie l’adresse', () => {
    expect(lireLienActivite(new URL('https://x.be/?activite=K7M2XQ9A&g=3'))).toEqual({ code: 'K7M2XQ9A', groupe: 3, urlNettoyee: '/' });
  });

  it('sans groupe : groupe nul', () => {
    expect(lireLienActivite(new URL('https://x.be/?activite=K7M2XQ9A'))?.groupe).toBeNull();
  });

  it('un groupe invalide retombe sur le groupe 2', () => {
    for (const g of ['9', 'x', '0', '', '1.5']) {
      expect(lireLienActivite(new URL(`https://x.be/?activite=K7M2XQ9A&g=${g}`))?.groupe, g).toBe(2);
    }
  });

  it('renvoie null sans paramètre ou avec un code mal formé', () => {
    expect(lireLienActivite(new URL('https://x.be/'))).toBeNull();
    expect(lireLienActivite(new URL('https://x.be/?activite=abc'))).toBeNull();
    expect(lireLienActivite(new URL('https://x.be/?activite=K7M2XQ9I'))).toBeNull();
  });

  it('garde les autres paramètres et le fragment', () => {
    expect(lireLienActivite(new URL('https://x.be/app?activite=K7M2XQ9A&g=1&a=1#haut'))?.urlNettoyee).toBe('/app?a=1#haut');
  });

  it('la forme d’un code exclut I, L, O, 0 et 1', () => {
    for (const c of ['ABCDEFGH', 'K7M2XQ9A']) expect(FORME_CODE_ACTIVITE.test(c)).toBe(true);
    for (const c of ['ABCDEFGI', 'ABCDEFGL', 'ABCDEFGO', 'ABCDEFG0', 'ABCDEFG1', 'abcdefgh', 'ABCDEFG']) expect(FORME_CODE_ACTIVITE.test(c), c).toBe(false);
  });
});
