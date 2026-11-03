import type { Scene } from './types.js';

/** Scène de la maquette `previsualisation/index.html` : une table, une boîte, deux arbres, un chat. */
export const SCENES: Record<string, Scene> = {
  'chat-table-boite-arbres': {
    id: 'chat-table-boite-arbres',
    viewBox: { w: 600, h: 340 },
    bounds: { x1: 24, y1: 34, x2: 576, y2: 290 },
    start: { x: 300, y: 56 },
    zones: [
      { id: 'z-sur', label: 'sur la table', rect: { x1: 56, y1: 100, x2: 226, y2: 168 }, repos: { x: 141, y: 140 } },
      { id: 'z-sous', label: 'sous la table', rect: { x1: 84, y1: 192, x2: 196, y2: 290 }, repos: { x: 140, y: 262 } },
      { id: 'z-dans', label: 'dans la boîte', rect: { x1: 286, y1: 214, x2: 380, y2: 290 }, repos: { x: 333, y: 252 } },
      { id: 'z-entre', label: 'entre les deux arbres', rect: { x1: 452, y1: 200, x2: 518, y2: 290 }, repos: { x: 485, y: 262 } },
    ],
    description:
      'Une scène avec, de gauche à droite, une table rouge, une boîte jaune ouverte et deux arbres. Un chat jaune se trouve en haut, au milieu, et peut être déplacé.',
  },
};
