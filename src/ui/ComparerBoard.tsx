import type { ElementResult, RoundState } from '../engine/round.js';
import { SYMBOLES, splitComparaison } from '../engine/comparer.js';
import { useRoundPlay } from './useRoundPlay.js';

interface Props {
  round: RoundState;
  onDone: (results: ElementResult[]) => void;
}

/** Plateau du jeu Comparer : deux nombres séparés par un espace, l'élève choisit le symbole (>, <, =). */
export function ComparerBoard({ round, onDone }: Props) {
  const { state, message, current, resolved, total, choose, hint } = useRoundPlay(round, onDone, 'Choisis le bon symbole.');
  const [gauche, droite] = current ? splitComparaison(state.labels[current.id]) : ['', ''];

  return (
    <section className="plateau" aria-label="Plateau de jeu">
      <p className="progression">{`${resolved} sur ${total}`}</p>
      {current ? (
        <>
          <div className="comparaison" role="group" aria-label={`Compare ${gauche} et ${droite}`}>
            <span className="nombre">{gauche}</span>
            <span className="ecart" aria-hidden="true">▢</span>
            <span className="nombre">{droite}</span>
          </div>
          <div className="symboles" role="group" aria-label="Symboles">
            {SYMBOLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="symbole"
                aria-label={s.nom}
                disabled={current.eliminated.includes(s.id)}
                onClick={() => choose(s.id)}
              >
                {s.signe}
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
