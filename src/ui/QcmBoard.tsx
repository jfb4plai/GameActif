import type { ElementResult, RoundState } from '../engine/round.js';
import { useRoundPlay } from './useRoundPlay.js';

interface Props {
  round: RoundState;
  onDone: (results: ElementResult[]) => void;
}

/** Plateau du QCM libre : une question à la fois, l'élève choisit sa réponse parmi quelques propositions. */
export function QcmBoard({ round, onDone }: Props) {
  const { state, message, current, resolved, total, choose, hint } = useRoundPlay(round, onDone, 'Choisis une réponse.');

  return (
    <section className="plateau" aria-label="Plateau de jeu">
      <p className="progression">{`${resolved} sur ${total}`}</p>
      {current ? (
        <>
          <h3 className="question">{state.labels[current.id]}</h3>
          <div className="reponses" role="group" aria-label="Réponses">
            {(current.choices ?? state.options).map((c) => (
              <button
                key={c}
                type="button"
                className="reponse"
                disabled={current.eliminated.includes(c)}
                onClick={() => choose(c)}
              >
                {state.labels[c]}
              </button>
            ))}
          </div>
          <p>
            <button type="button" onClick={hint} disabled={current.hintUsed || state.hintsLeft <= 0}>
              Indice
            </button>
          </p>
        </>
      ) : (
        <p>Tous les éléments sont faits.</p>
      )}
      <div className="retour" role="status" aria-live="polite">
        {message}
      </div>
    </section>
  );
}
