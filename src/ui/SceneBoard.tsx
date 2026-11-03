import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { step, type ElementResult, type RoundState } from '../engine/round.js';
import type { ProfileId } from '../engine/types.js';
import { SCENES } from '../scenes/chat-table-boite-arbres.js';
import { clampToScene, moveBy, zoneAt } from '../scenes/geometry.js';
import type { Scene } from '../scenes/types.js';
import { useSpeech } from './useSpeech.js';

/** Nombre d'erreurs sur une consigne avant d'encadrer la zone attendue ; null = jamais d'indice de zone. */
export const HINT_AFTER_ERRORS: Record<ProfileId, number | null> = { soutien: 1, standard: 2, defi: null };

interface Props {
  round: RoundState;
  profile: ProfileId;
  onDone: (results: ElementResult[]) => void;
}

export function SceneBoard(props: Props) {
  const scene = props.round.sceneId ? SCENES[props.round.sceneId] : undefined;
  if (!scene) return <p role="alert">Cette scène est introuvable.</p>;
  return <SceneGame {...props} scene={scene} />;
}

function SceneGame({ round, profile, onDone, scene }: Props & { scene: Scene }) {
  const [state, setState] = useState<RoundState>(round);
  const [currentId, setCurrentId] = useState<string>(round.elements[0].id);
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState('Glisse le chat, ou sélectionne-le puis flèches et Entrée.');
  const [pos, setPosState] = useState(scene.start);
  const posRef = useRef(scene.start);
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const doneSent = useRef(false);
  const { available, speak } = useSpeech();

  const current = state.elements.find((e) => e.id === currentId) as RoundState['elements'][number];
  const rank = state.elements.findIndex((e) => e.id === currentId) + 1;
  const threshold = HINT_AFTER_ERRORS[profile];
  const showHint = threshold !== null && !solved && current.wrong.length >= threshold;
  const hintZone = scene.zones.find((z) => z.id === current.correct);

  useEffect(() => {
    if (state.done && !doneSent.current) {
      doneSent.current = true;
      onDone(state.results);
    }
  }, [state.done, state.results, onDone]);

  function setPos(p: { x: number; y: number }) {
    posRef.current = p;
    setPosState(p);
  }

  function back(text: string) {
    setMessage(text);
    setPos(scene.start);
  }

  function poser() {
    if (solved) return;
    const zoneId = zoneAt(scene, posRef.current.x, posRef.current.y);
    if (zoneId === null) return back('Le chat n’est dans aucune zone. Essaie encore.');
    const r = step(state, { type: 'choose', elementId: currentId, optionId: zoneId });
    if (r.feedback.kind === 'ignored') return back('Tu as déjà essayé cette zone. Essaie une autre zone.');
    setState(r.state);
    if (r.feedback.kind === 'correct' || r.feedback.kind === 'reveal') {
      const repos = (scene.zones.find((z) => z.id === current.correct) as Scene['zones'][number]).repos;
      setPos(repos);
      setSolved(true);
      setMessage(r.feedback.kind === 'correct' ? 'Bien placé.' : 'La bonne zone est montrée. On continue.');
      return;
    }
    const wrongs = (r.state.elements.find((e) => e.id === currentId) as RoundState['elements'][number]).wrong.length;
    const frame = threshold !== null && wrongs >= threshold;
    back(`Pas tout à fait. Relis la consigne, puis réessaie.${frame ? ' Un cadre rouge montre la zone.' : ''}`);
  }

  function next() {
    const following = state.elements.find((e) => e.resolvedWith === null);
    if (!following) return;
    setCurrentId(following.id);
    setSolved(false);
    setPos(scene.start);
    setMessage('Glisse le chat, ou sélectionne-le puis flèches et Entrée.');
  }

  function toScene(e: ReactPointerEvent<SVGGElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return posRef.current;
    return clampToScene(scene, ((e.clientX - box.left) * scene.viewBox.w) / box.width, ((e.clientY - box.top) * scene.viewBox.h) / box.height);
  }

  function onKeyDown(e: KeyboardEvent<SVGGElement>) {
    if (solved) return;
    const pas = e.shiftKey ? 40 : 15;
    const d: Record<string, [number, number]> = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] };
    if (d[e.key]) {
      e.preventDefault();
      setPos(moveBy(scene, posRef.current, d[e.key][0], d[e.key][1]));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      poser();
    }
  }

  return (
    <section className="plateau" aria-label="Place le chat">
      <p className="progression">{`Consigne ${rank} sur ${state.elements.length}`}</p>
      <p className="consigne">{state.labels[currentId]}</p>
      <p>
        <button
          type="button"
          onClick={() => (available ? speak(state.labels[currentId]) : setMessage('La lecture à voix haute n’est pas disponible sur cet appareil.'))}
        >
          Écouter la consigne
        </button>
      </p>
      <div className="scene-cadre">
        <svg ref={svgRef} className="scene" viewBox={`0 0 ${scene.viewBox.w} ${scene.viewBox.h}`} role="img" aria-label={scene.description}>
          <rect x="0" y="0" width="600" height="340" fill="#ddeff0" />
          <rect x="0" y="292" width="600" height="48" fill="#b9d9a8" stroke="#161616" strokeWidth="3" />
          {showHint && hintZone && (
            <rect
              data-testid="indice-zone"
              className="indice-zone"
              x={hintZone.rect.x1}
              y={hintZone.rect.y1}
              width={hintZone.rect.x2 - hintZone.rect.x1}
              height={hintZone.rect.y2 - hintZone.rect.y1}
              rx="6"
            />
          )}
          <g stroke="#161616" strokeWidth="3" fill="#e8412a">
            <rect x="56" y="168" width="170" height="20" />
            <rect x="68" y="188" width="14" height="104" />
            <rect x="200" y="188" width="14" height="104" />
          </g>
          <g stroke="#161616" strokeWidth="3" fill="#f6be2c">
            <rect x="282" y="226" width="100" height="66" />
            <polygon points="282,226 266,208 282,208" />
            <polygon points="382,226 398,208 382,208" />
          </g>
          <g stroke="#161616" strokeWidth="3">
            <rect x="421" y="190" width="18" height="102" fill="#8a5a2b" />
            <circle cx="430" cy="160" r="48" fill="#1f8a8c" />
            <rect x="531" y="190" width="18" height="102" fill="#8a5a2b" />
            <circle cx="540" cy="160" r="48" fill="#1f8a8c" />
          </g>
          <g
            className="chat"
            tabIndex={0}
            role="button"
            aria-label="Le chat. Flèches du clavier pour le déplacer, Entrée pour le poser."
            data-x={pos.x}
            data-y={pos.y}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            onKeyDown={onKeyDown}
            onPointerDown={(e) => {
              if (solved) return;
              dragging.current = true;
              (e.currentTarget as SVGGElement).setPointerCapture?.(e.pointerId);
              setPos(toScene(e));
            }}
            onPointerMove={(e) => {
              if (dragging.current) setPos(toScene(e));
            }}
            onPointerUp={() => {
              if (!dragging.current) return;
              dragging.current = false;
              poser();
            }}
          >
            <g stroke="#161616" strokeWidth="3" fill="#f6be2c">
              <polygon points="-20,-8 -22,-30 -6,-16" />
              <polygon points="20,-8 22,-30 6,-16" />
              <circle cx="0" cy="0" r="22" />
            </g>
            <circle cx="-8" cy="-3" r="3" fill="#161616" />
            <circle cx="8" cy="-3" r="3" fill="#161616" />
            <polygon points="-3,5 3,5 0,9" fill="#e8412a" />
            <path d="M-4 10 Q0 14 4 10" stroke="#161616" strokeWidth="2" fill="none" />
          </g>
        </svg>
      </div>
      <div className="retour" role="status" aria-live="polite">
        {state.done ? 'Bien joué ! Toutes les consignes sont placées.' : message}
      </div>
      {solved && !state.done && (
        <p>
          <button type="button" onClick={next}>Consigne suivante</button>
        </p>
      )}
    </section>
  );
}
