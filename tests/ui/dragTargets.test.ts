import { describe, it, expect } from 'vitest';
import { binAtPoint } from '../../src/ui/dragTargets.js';

const rects = [
  { id: 'a', left: 0, top: 0, right: 100, bottom: 100 },
  { id: 'b', left: 200, top: 0, right: 300, bottom: 100 },
  { id: 'c', left: 50, top: 50, right: 150, bottom: 150 },
];

describe('binAtPoint', () => {
  it('renvoie l’identifiant du rectangle qui contient le point', () => {
    expect(binAtPoint(rects, 250, 40)).toBe('b');
    expect(binAtPoint(rects, 120, 140)).toBe('c');
  });

  it('renvoie null hors de tous les rectangles', () => {
    expect(binAtPoint(rects, 180, 40)).toBeNull();
    expect(binAtPoint(rects, 500, 500)).toBeNull();
  });

  it('renvoie null pour une liste vide', () => {
    expect(binAtPoint([], 10, 10)).toBeNull();
  });

  it('renvoie le premier rectangle en cas de recouvrement', () => {
    expect(binAtPoint(rects, 75, 75)).toBe('a');
  });
});
