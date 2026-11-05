import type { Activity, ProfileId } from './types.js';
import { PROFILES, type ProfileParams } from './profiles.js';
import { createRound, feedbackFor, step, type ElementState, type RoundState, type StepResult } from './round.js';
import { orderByProfile } from './select.js';
import { shuffle, type Rng } from './rng.js';
import { validPairs } from './availability.js';

/**
 * Mémo : retrouver les paires parmi des cartes face cachées. Les cartes sont les paires saisies pour Associer,
 * sans carte orpheline. Le moteur mélange le `deck` une seule fois ; l'affichage ne remélange jamais.
 */
export function setupMemo(
  activity: Activity,
  profile: ProfileId,
  rng: Rng,
  overrides: Partial<ProfileParams> = {},
): RoundState {
  const params = { ...PROFILES[profile], ...overrides };
  const pairs = validPairs(activity);
  if (pairs.length < 2) throw new Error('Mémo indisponible : il faut au moins 2 paires.');

  const difficulty = new Map(activity.items.map((i) => [i.id, i.difficulty] as const));
  const active = orderByProfile(pairs, (p) => difficulty.get(p.leftId) ?? 'moyen', profile, rng).slice(0, params.maxItems);

  const labels: Record<string, string> = {};
  for (const item of activity.items) labels[item.id] = item.text;

  return createRound({
    mechanic: 'memo',
    exclusive: true,
    elements: active.map((p) => ({ id: p.leftId, correct: p.rightId })),
    options: active.map((p) => p.rightId),
    labels,
    hintsLeft: params.hintsPerRound,
    maxTries: null,
    deck: shuffle(active.flatMap((p) => [p.leftId, p.rightId]), rng),
  });
}

function ownerOf(state: RoundState, cardId: string): ElementState | null {
  return state.elements.find((e) => e.id === cardId || e.correct === cardId) ?? null;
}

/** Carte qui forme une paire avec `cardId`, ou null si la carte n'est pas dans le tour. */
export function partnerOf(state: RoundState, cardId: string): string | null {
  const owner = ownerOf(state, cardId);
  if (!owner) return null;
  return cardId === owner.id ? owner.correct : owner.id;
}

/**
 * Deux cartes retournées. Bonne paire : l'élément est résolu. Sinon l'erreur est notée sur la paire de la
 * PREMIÈRE carte retournée (celle que l'élève cherchait) ; la seconde, simplement découverte, n'est pas pénalisée.
 */
export function attemptMatch(state: RoundState, firstId: string, secondId: string): StepResult {
  const ignored: StepResult = { state, feedback: feedbackFor('ignored') };
  if (state.done || firstId === secondId) return ignored;
  const a = ownerOf(state, firstId);
  const b = ownerOf(state, secondId);
  if (!a || !b || a.resolvedWith !== null || b.resolvedWith !== null) return ignored;

  if (partnerOf(state, firstId) === secondId) {
    return step(state, { type: 'choose', elementId: a.id, optionId: a.correct });
  }
  return {
    state: { ...state, elements: state.elements.map((e) => (e.id === a.id ? { ...e, wrong: [...e.wrong, secondId] } : e)) },
    feedback: feedbackFor('retry'),
  };
}

/** Indice : désigne la carte partenaire de `firstId` et consomme un indice du tour. */
export function hintMemo(state: RoundState, firstId: string): { state: RoundState; partnerId: string | null } {
  const owner = ownerOf(state, firstId);
  if (!owner || owner.resolvedWith !== null || state.hintsLeft <= 0) return { state, partnerId: null };
  return {
    state: {
      ...state,
      hintsLeft: state.hintsLeft - 1,
      elements: state.elements.map((e) => (e.id === owner.id ? { ...e, hintUsed: true } : e)),
    },
    partnerId: partnerOf(state, firstId),
  };
}
