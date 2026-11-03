import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { progress, step, type ElementResult, type RoundState } from '../engine/round.js';
import { binAtPoint, type TargetRect } from './dragTargets.js';

interface Props {
  round: RoundState;
  onDone: (results: ElementResult[]) => void;
}

const DRAG_THRESHOLD_PX = 6;

/**
 * Plateau des jeux Associer, Trier et Remettre en ordre. Le moteur (`step`) décide de tout ;
 * ce composant n'affiche que l'état et traduit clic, clavier ou glissement en actions.
 */
export function RoundBoard({ round, onDone }: Props) {
  const [state, setState] = useState<RoundState>(round);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('Choisis un élément pour commencer.');
  const optionRefs = useRef(new Map<string, HTMLElement>());
  const doneSent = useRef(false);
  const dragged = useRef(false);

  useEffect(() => {
    if (state.done && !doneSent.current) {
      doneSent.current = true;
      onDone(state.results);
    }
  }, [state.done, state.results, onDone]);

  const remaining = state.elements.filter((e) => e.resolvedWith === null);
  const current = state.elements.find((e) => e.id === selected) ?? null;
  const { resolved, total } = progress(state);

  function place(elementId: string, optionId: string) {
    const r = step(state, { type: 'choose', elementId, optionId });
    if (r.feedback.kind === 'ignored') return;
    setState(r.state);
    setMessage(r.feedback.message);
    if (r.feedback.kind === 'correct' || r.feedback.kind === 'reveal') setSelected(null);
  }

  function hint() {
    if (!selected) return;
    const r = step(state, { type: 'hint', elementId: selected });
    if (r.feedback.kind === 'ignored') return;
    setState(r.state);
    setMessage(r.feedback.message);
  }

  function targetRects(): TargetRect[] {
    return [...optionRefs.current].map(([id, el]) => {
      const b = el.getBoundingClientRect();
      return { id, left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    });
  }

  function dragHandlers(elementId: string) {
    let start: { x: number; y: number } | null = null;
    return {
      onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
        if (e.button !== 0) return;
        start = { x: e.clientX, y: e.clientY };
        dragged.current = false;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!dragged.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) dragged.current = true;
        if (dragged.current) {
          e.currentTarget.classList.add('glisse');
          e.currentTarget.style.translate = `${dx}px ${dy}px`;
        }
      },
      onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
        const el = e.currentTarget;
        const wasDragging = dragged.current;
        start = null;
        el.classList.remove('glisse');
        el.style.translate = '';
        if (!wasDragging) return;
        const optionId = binAtPoint(targetRects(), e.clientX, e.clientY);
        if (optionId) place(elementId, optionId);
      },
    };
  }

  return (
    <section className="plateau" aria-label="Plateau de jeu">
      <p className="progression">{`${resolved} sur ${total}`}</p>
      <div className="mots" role="group" aria-label="Éléments à placer">
        {remaining.length === 0 ? (
          <span>Tous les éléments sont placés.</span>
        ) : (
          remaining.map((e, i) => (
            <button
              key={e.id}
              type="button"
              className="mot"
              style={{ ['--r' as string]: `${((i * 37) % 7 - 3) * 0.7}deg` }}
              aria-pressed={selected === e.id}
              {...dragHandlers(e.id)}
              onClick={() => {
                if (dragged.current) {
                  dragged.current = false;
                  return;
                }
                setSelected(e.id);
                setMessage(`Élément choisi : ${state.labels[e.id]}. Choisis où le placer.`);
              }}
            >
              {state.labels[e.id]}
            </button>
          ))
        )}
      </div>
      <p>
        <button type="button" onClick={hint} disabled={!current || current.hintUsed || state.hintsLeft <= 0}>
          Indice
        </button>
      </p>
      <div className="retour" role="status" aria-live="polite">
        {message}
      </div>
      <div className="bins">
        {state.options.map((o) => {
          const placed = state.elements.filter((e) => e.resolvedWith === o);
          const blocked =
            !current || current.eliminated.includes(o) || (state.exclusive && state.elements.some((e) => e.resolvedWith === o));
          return (
            <div key={o} className="bin" ref={(el) => void (el ? optionRefs.current.set(o, el) : optionRefs.current.delete(o))}>
              <h3>{state.labels[o]}</h3>
              <button
                type="button"
                className="place"
                disabled={blocked}
                aria-label={`Placer dans « ${state.labels[o]} »`}
                onClick={() => current && place(current.id, o)}
              >
                Placer ici
              </button>
              <div className="contenu-bin">
                {placed.map((e) => (
                  <span key={e.id} className="place-fait">{state.labels[e.id]}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
