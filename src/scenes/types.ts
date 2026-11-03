export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Zone {
  /** Identifiant partagé avec la catégorie `zone` de l'activité. */
  id: string;
  label: string;
  rect: Rect;
  /** Position où l'objet se pose quand la consigne est réussie. */
  repos: { x: number; y: number };
}

export interface Scene {
  id: string;
  viewBox: { w: number; h: number };
  /** Limites où l'objet déplaçable peut se trouver. */
  bounds: Rect;
  zones: Zone[];
  start: { x: number; y: number };
  /** Description pour lecteur d'écran : objets et disposition, sans nommer la zone attendue. */
  description: string;
}
