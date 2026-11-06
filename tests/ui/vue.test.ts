import { describe, it, expect } from 'vitest';
import { vueDepuisHash } from '../../src/ui/vue.js';

describe('vueDepuisHash', () => {
  it('reconnaît les deux pages légales', () => {
    expect(vueDepuisHash('#/confidentialite')).toBe('confidentialite');
    expect(vueDepuisHash('#/mentions')).toBe('mentions');
  });

  it('retombe sur le parcours pour tout le reste : vide, racine, inconnu, casse ou suffixe différents', () => {
    for (const h of ['', '#', '#/', '#/nimportequoi', '#/Confidentialite', '#/confidentialite/x', '#confidentialite', '#/mentions?x=1']) {
      expect(vueDepuisHash(h), h).toBe('parcours');
    }
  });
});
