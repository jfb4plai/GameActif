import { useEffect, useRef, useState } from 'react';
import { progress, type ElementResult, type RoundState } from '../engine/round.js';
import { attemptMatch, hintMemo } from '../engine/memo.js';

interface Props {
  round: RoundState;
  onDone: (results: ElementResult[]) => void;
}

/**
 * Plateau du jeu Mémo. Le moteur décide des paires (`attemptMatch`) ; ce composant garde les cartes retournées.
 * Après une erreur, les deux cartes restent visibles jusqu'à « Cacher les cartes » ou jusqu'au clic sur une autre
 * carte : aucune minuterie, pour laisser le temps de lire (lecteur d'écran, lecture lente).
 */
export function MemoBoard({ round, onDone }: Props) {
  const [state, setState] = useState<RoundState>(round);
  const [visibles, setVisibles] = useState<string[]>([]);
  const [entouree, setEntouree] = useState<string | null>(null);
  const [message, setMessage] = useState('Choisis une carte.');
  const doneSent = useRef(false);

  useEffect(() => {
    if (state.done && !doneSent.current) {
      doneSent.current = true;
      onDone(state.results);
    }
  }, [state.done, state.results, onDone]);

  const deck = state.deck ?? [];
  const { resolved, total } = progress(state);
  const trouvee = (id: string) => state.elements.some((e) => e.resolvedWith !== null && (e.id === id || e.correct === id));

  function retourner(id: string) {
    if (trouvee(id) || visibles.includes(id) || state.done) return;
    setEntouree(null);
    if (visibles.length === 1) {
      const r = attemptMatch(state, visibles[0], id);
      if (r.feedback.kind === 'ignored') return;
      setState(r.state);
      setMessage(r.feedback.message);
      setVisibles(r.feedback.kind === 'correct' ? [] : [visibles[0], id]);
      return;
    }
    // Aucune carte retournée, ou deux cartes d'une erreur : celle-ci devient la première d'une nouvelle tentative.
    setVisibles([id]);
    setMessage('Choisis une deuxième carte.');
  }

  function indice() {
    if (visibles.length !== 1) return;
    const r = hintMemo(state, visibles[0]);
    if (r.partnerId === null) return;
    setState(r.state);
    setEntouree(r.partnerId);
    setMessage('Une carte est entourée : elle va avec celle-ci.');
  }

  function cacher() {
    setVisibles([]);
    setEntouree(null);
    setMessage('Choisis une carte.');
  }

  return (
    <section className="plateau" aria-label="Plateau de jeu">
      <p className="progression">{`${resolved} sur ${total}`}</p>
      <div className="grille-memo">
        {deck.map((id, i) => {
          const face = trouvee(id) || visibles.includes(id);
          const nom = trouvee(id)
            ? `Carte ${i + 1} : ${state.labels[id]}, trouvée`
            : face
              ? `Carte ${i + 1} : ${state.labels[id]}`
              : `Carte ${i + 1}, face cachée`;
          const classes = ['carte-memo', trouvee(id) ? 'trouvee' : face ? 'visible' : 'face-cachee', id === entouree ? 'indice' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button key={id} type="button" className={classes} aria-label={nom} onClick={() => retourner(id)}>
              {face ? state.labels[id] : '?'}
            </button>
          );
        })}
      </div>
      <p>
        <button type="button" onClick={indice} disabled={visibles.length !== 1 || state.hintsLeft <= 0}>
          Indice
        </button>{' '}
        {visibles.length === 2 && (
          <button type="button" onClick={cacher}>
            Cacher les cartes
          </button>
        )}
      </p>
      {state.done && <p>Toutes les paires sont trouvées.</p>}
      <div className="retour" role="status" aria-live="polite">
        {message}
      </div>
    </section>
  );
}
