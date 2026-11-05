import { useEffect, useRef, useState } from 'react';
import { progress, step, type ElementResult, type ElementState, type RoundState } from '../engine/round.js';

/**
 * Déroulement d'un tour où l'on répond à un élément à la fois (Comparer, QCM). Le moteur (`step`) décide de tout ;
 * ce hook garde l'état, le message de retour et prévient une seule fois quand le tour est fini.
 */
export function useRoundPlay(round: RoundState, onDone: (results: ElementResult[]) => void, messageDepart: string) {
  const [state, setState] = useState<RoundState>(round);
  const [message, setMessage] = useState(messageDepart);
  const doneSent = useRef(false);

  useEffect(() => {
    if (state.done && !doneSent.current) {
      doneSent.current = true;
      onDone(state.results);
    }
  }, [state.done, state.results, onDone]);

  const current: ElementState | null = state.elements.find((e) => e.resolvedWith === null) ?? null;
  const { resolved, total } = progress(state);

  function choose(optionId: string) {
    if (!current) return;
    const r = step(state, { type: 'choose', elementId: current.id, optionId });
    if (r.feedback.kind === 'ignored') return;
    setState(r.state);
    setMessage(r.feedback.message);
  }

  function hint() {
    if (!current) return;
    const r = step(state, { type: 'hint', elementId: current.id });
    if (r.feedback.kind === 'ignored') return;
    setState(r.state);
    setMessage(r.feedback.message);
  }

  return { state, message, current, resolved, total, choose, hint };
}
