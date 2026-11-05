import type { MechanicId } from './types.js';

export interface ElementState {
  id: string;
  /** Identifiant de la bonne option. */
  correct: string;
  /** Option avec laquelle l'élément est résolu ; null tant qu'il ne l'est pas. */
  resolvedWith: string | null;
  /** Mauvais choix faits, dans l'ordre. */
  wrong: string[];
  /** Options grisées pour cet élément (mauvais choix et indices). */
  eliminated: string[];
  hintUsed: boolean;
  revealed: boolean;
  /** Options proposées à cet élément seulement (QCM) ; absent = toutes les options du tour. */
  choices?: string[];
}

/** Résultat d'un élément résolu : une ligne de `game_attempts` au plan 4. */
export interface ElementResult {
  elementId: string;
  mechanic: MechanicId;
  /** Résolu sans aucune erreur ni révélation. */
  firstTry: boolean;
  /** Nombre de choix faits, bonne réponse incluse (révélation : nombre d'erreurs). */
  tries: number;
  hintUsed: boolean;
  revealed: boolean;
  wrongChoices: string[];
}

export interface RoundState {
  mechanic: MechanicId;
  /** Scène à afficher (mécanique « placer » seulement) ; le moteur ne connaît pas ses coordonnées. */
  sceneId?: string;
  /** Une option résolue ne peut plus être choisie par un autre élément. */
  exclusive: boolean;
  /** Éléments dans l'ordre d'affichage. */
  elements: ElementState[];
  /** Options dans l'ordre d'affichage. */
  options: string[];
  /** Libellé affichable de chaque identifiant d'élément et d'option. */
  labels: Record<string, string>;
  hintsLeft: number;
  maxTries: number | null;
  results: ElementResult[];
  done: boolean;
  /** Ordre des cartes du Mémo (ids d'éléments et d'options mélangés) ; absent pour les autres jeux. */
  deck?: string[];
}

export interface RoundSpec {
  mechanic: MechanicId;
  exclusive: boolean;
  elements: { id: string; correct: string; choices?: string[] }[];
  options: string[];
  labels: Record<string, string>;
  hintsLeft: number;
  maxTries: number | null;
  deck?: string[];
}

export type Action =
  | { type: 'choose'; elementId: string; optionId: string }
  | { type: 'hint'; elementId: string };

export type FeedbackKind = 'correct' | 'retry' | 'reveal' | 'hint' | 'no-hint' | 'ignored';

export interface Feedback {
  kind: FeedbackKind;
  message: string;
}

export interface StepResult {
  state: RoundState;
  feedback: Feedback;
}

const FEEDBACK: Record<FeedbackKind, Feedback> = {
  correct: { kind: 'correct', message: 'Bien vu.' },
  retry: { kind: 'retry', message: 'Pas tout à fait. Essaie encore.' },
  reveal: { kind: 'reveal', message: 'Voici la bonne réponse. On continue.' },
  hint: { kind: 'hint', message: 'Une proposition a été écartée.' },
  'no-hint': { kind: 'no-hint', message: 'Plus d’indice utile pour celui-ci.' },
  ignored: { kind: 'ignored', message: '' },
};

/** Texte de retour d'un type de réponse ; sert aux mécaniques qui écrivent leur propre état (Mémo). */
export function feedbackFor(kind: FeedbackKind): Feedback {
  return FEEDBACK[kind];
}

export function createRound(spec: RoundSpec): RoundState {
  return {
    mechanic: spec.mechanic,
    exclusive: spec.exclusive,
    elements: spec.elements.map((e) => ({
      id: e.id,
      correct: e.correct,
      resolvedWith: null,
      wrong: [],
      eliminated: [],
      hintUsed: false,
      revealed: false,
      ...(e.choices ? { choices: e.choices.slice() } : {}),
    })),
    options: spec.options.slice(),
    labels: { ...spec.labels },
    hintsLeft: spec.hintsLeft,
    maxTries: spec.maxTries,
    results: [],
    done: false,
    ...(spec.deck ? { deck: spec.deck.slice() } : {}),
  };
}

export function progress(state: RoundState): { resolved: number; total: number } {
  return {
    resolved: state.elements.filter((e) => e.resolvedWith !== null).length,
    total: state.elements.length,
  };
}

function consumedOptions(state: RoundState): Set<string> {
  const out = new Set<string>();
  if (!state.exclusive) return out;
  for (const e of state.elements) if (e.resolvedWith !== null) out.add(e.resolvedWith);
  return out;
}

function withElement(state: RoundState, index: number, element: ElementState): RoundState {
  return { ...state, elements: state.elements.map((e, i) => (i === index ? element : e)) };
}

function resolve(state: RoundState, index: number, element: ElementState, revealed: boolean): StepResult {
  const resolved: ElementState = { ...element, resolvedWith: element.correct, revealed };
  const result: ElementResult = {
    elementId: element.id,
    mechanic: state.mechanic,
    firstTry: !revealed && element.wrong.length === 0,
    tries: element.wrong.length + (revealed ? 0 : 1),
    hintUsed: element.hintUsed,
    revealed,
    wrongChoices: element.wrong.slice(),
  };
  const next = withElement(state, index, resolved);
  return {
    state: { ...next, results: [...state.results, result], done: next.elements.every((e) => e.resolvedWith !== null) },
    feedback: revealed ? FEEDBACK.reveal : FEEDBACK.correct,
  };
}

function choose(state: RoundState, index: number, optionId: string): StepResult {
  const element = state.elements[index];
  if (
    !state.options.includes(optionId) ||
    (element.choices !== undefined && !element.choices.includes(optionId)) ||
    element.eliminated.includes(optionId) ||
    consumedOptions(state).has(optionId)
  ) {
    return { state, feedback: FEEDBACK.ignored };
  }
  if (optionId === element.correct) return resolve(state, index, element, false);

  const failed: ElementState = {
    ...element,
    wrong: [...element.wrong, optionId],
    eliminated: [...element.eliminated, optionId],
  };
  if (state.maxTries !== null && failed.wrong.length >= state.maxTries) {
    return resolve(state, index, failed, true);
  }
  return { state: withElement(state, index, failed), feedback: FEEDBACK.retry };
}

function useHint(state: RoundState, index: number): StepResult {
  const element = state.elements[index];
  const consumed = consumedOptions(state);
  const candidate = (element.choices ?? state.options).find(
    (o) => o !== element.correct && !element.eliminated.includes(o) && !consumed.has(o),
  );
  if (state.hintsLeft <= 0 || candidate === undefined) {
    return { state, feedback: FEEDBACK['no-hint'] };
  }
  const hinted: ElementState = {
    ...element,
    eliminated: [...element.eliminated, candidate],
    hintUsed: true,
  };
  return {
    state: { ...withElement(state, index, hinted), hintsLeft: state.hintsLeft - 1 },
    feedback: FEEDBACK.hint,
  };
}

export function step(state: RoundState, action: Action): StepResult {
  const index = state.elements.findIndex((e) => e.id === action.elementId);
  if (index < 0 || state.done || state.elements[index].resolvedWith !== null) {
    return { state, feedback: FEEDBACK.ignored };
  }
  return action.type === 'hint' ? useHint(state, index) : choose(state, index, action.optionId);
}
