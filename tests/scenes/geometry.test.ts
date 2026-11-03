import { describe, it, expect } from 'vitest';
import { SCENES } from '../../src/scenes/chat-table-boite-arbres.js';
import { zoneAt, clampToScene, moveBy } from '../../src/scenes/geometry.js';

const scene = SCENES['chat-table-boite-arbres'];
const centre = (id: string) => {
  const z = scene.zones.find((x) => x.id === id)!;
  return { x: (z.rect.x1 + z.rect.x2) / 2, y: (z.rect.y1 + z.rect.y2) / 2 };
};

describe('scène chat-table-boîte-arbres', () => {
  it('a quatre zones avec les rectangles de la maquette', () => {
    expect(scene.zones.map((z) => z.id)).toEqual(['z-sur', 'z-sous', 'z-dans', 'z-entre']);
    expect(scene.zones.find((z) => z.id === 'z-sur')!.rect).toEqual({ x1: 56, y1: 100, x2: 226, y2: 168 });
    expect(scene.zones.find((z) => z.id === 'z-sous')!.rect).toEqual({ x1: 84, y1: 192, x2: 196, y2: 290 });
    expect(scene.zones.find((z) => z.id === 'z-dans')!.rect).toEqual({ x1: 286, y1: 214, x2: 380, y2: 290 });
    expect(scene.zones.find((z) => z.id === 'z-entre')!.rect).toEqual({ x1: 452, y1: 200, x2: 518, y2: 290 });
    expect(scene.start).toEqual({ x: 300, y: 56 });
  });

  it('les zones ne se recouvrent pas et chaque position de repos est dans sa zone', () => {
    for (const z of scene.zones) {
      expect(zoneAt(scene, z.repos.x, z.repos.y)).toBe(z.id);
      for (const other of scene.zones) {
        if (other === z) continue;
        const overlap = z.rect.x1 < other.rect.x2 && other.rect.x1 < z.rect.x2 && z.rect.y1 < other.rect.y2 && other.rect.y1 < z.rect.y2;
        expect(overlap).toBe(false);
      }
    }
  });

  it('la description ne nomme aucune zone attendue', () => {
    expect(scene.description.length).toBeGreaterThan(20);
    for (const z of scene.zones) expect(scene.description.toLowerCase()).not.toContain(z.label.toLowerCase());
  });
});

describe('zoneAt', () => {
  it('renvoie la zone au centre de chacune', () => {
    for (const z of scene.zones) {
      const c = centre(z.id);
      expect(zoneAt(scene, c.x, c.y)).toBe(z.id);
    }
  });

  it('renvoie null en dehors de toutes les zones et à un pixel du bord extérieur', () => {
    expect(zoneAt(scene, scene.start.x, scene.start.y)).toBeNull();
    expect(zoneAt(scene, 55, 130)).toBeNull();
    expect(zoneAt(scene, 227, 130)).toBeNull();
    expect(zoneAt(scene, 141, 99)).toBeNull();
    expect(zoneAt(scene, 141, 169)).toBeNull();
  });
});

describe('clampToScene et moveBy', () => {
  it('borne x entre 24 et 576 et y entre 34 et 290', () => {
    expect(clampToScene(scene, -50, -50)).toEqual({ x: 24, y: 34 });
    expect(clampToScene(scene, 9999, 9999)).toEqual({ x: 576, y: 290 });
    expect(clampToScene(scene, 300, 100)).toEqual({ x: 300, y: 100 });
  });

  it('moveBy ne sort jamais de la scène', () => {
    expect(moveBy(scene, { x: 30, y: 40 }, -40, -40)).toEqual({ x: 24, y: 34 });
    expect(moveBy(scene, { x: 570, y: 285 }, 40, 40)).toEqual({ x: 576, y: 290 });
    expect(moveBy(scene, { x: 300, y: 56 }, 15, 0)).toEqual({ x: 315, y: 56 });
  });
});
