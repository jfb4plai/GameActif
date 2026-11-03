import type { MechanicId, ProfileId } from '../engine/types.js';

export type Movement = 'manipulation' | 'deplacement';

/** Quantités du tour réellement joué ; elles servent à calculer le matériel. */
export interface PhysicalCounts {
  elements: number;
  stations: number;
  teams: number;
}

/** Garde-fous contre le débordement et pour le calme (avenant §12). */
export interface CalmGuards {
  noRunning: true;
  noTimer: true;
  noCompetition: true;
  maxGroupsMoving: number;
  voice: 'chuchote' | 'silence';
  safeMaterial: string;
  stopSignal: string;
  pathMarked: boolean;
}

export interface PhysicalTemplate {
  mechanic: MechanicId;
  title: string;
  moves: Movement[];
  /** Indicatif, non mesuré en classe. */
  durationMin: number;
  teamSize: { min: number; max: number };
  material: { name: string; count: (c: PhysicalCounts) => number; note?: string }[];
  setup: string[];
  play: string[];
  calm: CalmGuards;
  differentiation: Record<ProfileId, string>;
  check: string;
}

export interface PhysicalCard {
  id: string;
  text: string;
}

export interface PhysicalKit {
  mechanic: MechanicId;
  title: string;
  moves: Movement[];
  durationMin: number;
  material: { name: string; count: number; note?: string }[];
  setup: string[];
  play: string[];
  calm: CalmGuards;
  differentiation: string;
  check: string;
  stations: { id: string; label: string }[];
  cards: PhysicalCard[];
  answerKey: { cardId: string; stationId: string }[];
}
