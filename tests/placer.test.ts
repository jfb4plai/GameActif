import { describe, it, expect } from 'vitest';
import { setupPlacer } from '../src/engine/placer.js';
import { setupRound } from '../src/engine/setup.js';
import { availableMechanics } from '../src/engine/availability.js';
import { makeRng } from '../src/engine/rng.js';
import { sceneActivity, solveAll } from './fixtures.js';

const zoneOf: Record<string, string> = { k1: 'z-sur', k2: 'z-sous', k3: 'z-dans', k4: 'z-entre' };

describe('setupPlacer', () => {
  it('prépare un tour où chaque consigne a sa zone et où le rendu connaît la scène', () => {
    const s = setupPlacer(sceneActivity(), 'standard', makeRng(1));
    expect(s.mechanic).toBe('placer');
    expect(s.exclusive).toBe(false);
    expect(s.sceneId).toBe('chat-table-boite-arbres');
    expect(s.elements).toHaveLength(4);
    for (const e of s.elements) expect(e.correct).toBe(zoneOf[e.id]);
    expect(s.labels['z-sous']).toBe('sous la table');
    expect(s.labels.k3).toBe('Pose le chat dans la boîte.');
  });

  it('les options sont les zones de la scène, dans l’ordre de la scène, quel que soit le profil', () => {
    for (const profile of ['soutien', 'standard', 'defi'] as const) {
      const s = setupPlacer(sceneActivity(), profile, makeRng(2));
      expect(s.options).toEqual(['z-sur', 'z-sous', 'z-dans', 'z-entre']);
    }
  });

  it('Soutien limite le nombre de consignes, pas le nombre de zones affichées', () => {
    const s = setupPlacer(sceneActivity(), 'soutien', makeRng(3));
    expect(s.elements).toHaveLength(4);
    expect(s.options).toHaveLength(4);
  });

  it('casse l’ordre d’écriture des consignes (50 graines)', () => {
    const authoring = ['k1', 'k2', 'k3', 'k4'];
    for (let seed = 0; seed < 50; seed++) {
      const ids = setupPlacer(sceneActivity(), 'standard', makeRng(seed)).elements.map((e) => e.id);
      expect(ids).not.toEqual(authoring);
      ids.forEach((id, i) => expect(id).not.toBe(authoring[i]));
    }
  });

  it('se termine quand toutes les consignes sont bien placées, résultats marqués « placer »', () => {
    const s = solveAll(setupPlacer(sceneActivity(), 'standard', makeRng(5)));
    expect(s.done).toBe(true);
    expect(s.results.every((r) => r.firstTry && r.mechanic === 'placer')).toBe(true);
  });

  it('refuse de se préparer sans scène choisie', () => {
    const a = sceneActivity();
    delete a.sceneId;
    expect(() => setupPlacer(a, 'standard', makeRng(1))).toThrow('Placer indisponible');
  });

  it('refuse de se préparer avec une seule zone utilisée', () => {
    const a = sceneActivity();
    a.memberships = a.memberships.map((m) => ({ ...m, categoryId: 'z-sur' }));
    expect(() => setupPlacer(a, 'standard', makeRng(1))).toThrow('Placer indisponible');
  });
});

describe('Placer : disponibilité et aiguillage', () => {
  it('disponible seulement quand une scène est choisie', () => {
    expect(availableMechanics(sceneActivity()).placer).toEqual({ available: true, missing: null });
    const a = sceneActivity();
    delete a.sceneId;
    expect(availableMechanics(a).placer).toEqual({ available: false, missing: 'Il faut choisir une scène.' });
  });

  it('demande au moins 2 zones contenant chacune une consigne et 3 consignes', () => {
    const a = sceneActivity();
    a.memberships = a.memberships.filter((m) => m.categoryId === 'z-sur');
    expect(availableMechanics(a).placer).toEqual({
      available: false,
      missing: 'Il faut au moins 2 zones contenant chacune une consigne.',
    });
    const b = sceneActivity();
    b.memberships = b.memberships.slice(0, 2);
    expect(availableMechanics(b).placer).toEqual({ available: false, missing: 'Il faut au moins 3 consignes.' });
  });

  it('setupRound aiguille vers placer', () => {
    expect(setupRound(sceneActivity(), 'placer', 'standard', makeRng(1)).mechanic).toBe('placer');
  });
});
