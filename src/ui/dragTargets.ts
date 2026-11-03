export interface TargetRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Identifiant du premier rectangle qui contient le point (bords inclus), ou null. */
export function binAtPoint(rects: readonly TargetRect[], x: number, y: number): string | null {
  for (const r of rects) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return r.id;
  }
  return null;
}
