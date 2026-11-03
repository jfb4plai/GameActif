import type { Scene } from './types.js';

type Point = { x: number; y: number };

/** Identifiant de la zone qui contient le point (bords inclus), ou null. Les zones ne se recouvrent pas. */
export function zoneAt(scene: Scene, x: number, y: number): string | null {
  for (const z of scene.zones) {
    if (x >= z.rect.x1 && x <= z.rect.x2 && y >= z.rect.y1 && y <= z.rect.y2) return z.id;
  }
  return null;
}

export function clampToScene(scene: Scene, x: number, y: number): Point {
  const b = scene.bounds;
  return { x: Math.min(b.x2, Math.max(b.x1, x)), y: Math.min(b.y2, Math.max(b.y1, y)) };
}

export function moveBy(scene: Scene, p: Point, dx: number, dy: number): Point {
  return clampToScene(scene, p.x + dx, p.y + dy);
}
