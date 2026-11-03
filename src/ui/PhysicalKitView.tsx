import { useRef } from 'react';
import type { Movement, PhysicalKit } from '../physical/types.js';
import type { ProgrammeLink } from '../physical/programme.js';

const MOVE_LABEL: Record<Movement, string> = { manipulation: 'Manipulation', deplacement: 'Déplacement' };
const A_COMPLETER = 'À compléter par l’enseignant : en quoi ce jeu travaille cet attendu.';

function movesText(moves: Movement[]): string {
  const ordered = (['manipulation', 'deplacement'] as Movement[]).filter((m) => moves.includes(m));
  return ordered.map((m, i) => (i === 0 ? MOVE_LABEL[m] : MOVE_LABEL[m].toLowerCase())).join(' et ');
}

interface Props {
  kit: PhysicalKit;
  links: ProgrammeLink[];
}

/** Fiche enseignant d'un jeu physique : matériel, déroulement, calme, lien avec le programme, corrigé, cartes. */
export function PhysicalKitView({ kit, links }: Props) {
  const root = useRef<HTMLElement>(null);

  function imprimer() {
    const node = root.current;
    document.body.classList.add('impression-fiche');
    node?.setAttribute('data-impression', 'oui');
    try {
      window.print();
    } finally {
      document.body.classList.remove('impression-fiche');
      node?.removeAttribute('data-impression');
    }
  }

  const stationLabel = (id: string) => kit.stations.find((s) => s.id === id)?.label ?? id;
  const cardText = (id: string) => kit.cards.find((c) => c.id === id)?.text ?? id;

  return (
    <section className="fiche" aria-label={kit.title} ref={root}>
      <p>
        <strong>{movesText(kit.moves)}</strong>
      </p>
      <p>
        <span>{`Durée indicative : ${kit.durationMin} min`}</span>
        <span className="aide"> (non mesurée en classe)</span>
      </p>

      <h3>Matériel</h3>
      <ul>
        {kit.material.map((m) => (
          <li key={m.name}>
            <span>{`${m.name} : ${m.count}`}</span>
            {m.note && <span className="aide"> {m.note}</span>}
          </li>
        ))}
      </ul>

      <h3>Mise en place</h3>
      <ol>{kit.setup.map((s) => <li key={s}>{s}</li>)}</ol>

      <h3>Déroulement</h3>
      <ol>{kit.play.map((s) => <li key={s}>{s}</li>)}</ol>

      <h3>Calme et sécurité</h3>
      <ul>
        <li>Pas de course.</li>
        <li>Pas de chronomètre.</li>
        <li>Pas de compétition entre équipes.</li>
        <li>Un seul groupe se déplace à la fois.</li>
        <li>{kit.calm.voice === 'silence' ? 'Silence complet.' : 'Voix chuchotée.'}</li>
        {kit.calm.pathMarked && <li>Chemin balisé au sol.</li>}
        <li>{`Signal d’arrêt : ${kit.calm.stopSignal}`}</li>
        <li>{`Matériel sûr : ${kit.calm.safeMaterial}`}</li>
      </ul>

      <h3>Adaptation au profil</h3>
      <p>{kit.differentiation}</p>

      <h3>Vérification</h3>
      <p>{kit.check}</p>

      <h3>Lien avec le programme</h3>
      <ul className="liens-programme">
        {links.map((l) => (
          <li key={l.code}>
            <span className="code">{l.code}</span>
            <span>{l.texte}</span>
            {l.extraEnClasse && <span className="etiquette">attendu travaillé en plus en classe</span>}
            <p className="aide">{l.phrase ?? A_COMPLETER}</p>
          </li>
        ))}
      </ul>

      <h3 className="avant-corrige">Corrigé</h3>
      <table aria-label="Corrigé">
        <thead>
          <tr>
            <th scope="col">Carte</th>
            <th scope="col">Station attendue</th>
          </tr>
        </thead>
        <tbody>
          {kit.answerKey.map((k) => (
            <tr key={k.cardId}>
              <td>{cardText(k.cardId)}</td>
              <td>{stationLabel(k.stationId)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="avant-cartes">Cartes à imprimer</h3>
      <ol className="cartes-imprimer" aria-label="Cartes à imprimer">
        {kit.cards.map((c) => (
          <li key={c.id} className="carte-imprimer">{c.text}</li>
        ))}
      </ol>

      {kit.mechanic === 'associer' && (
        <>
          <h3>Cartes de droite à imprimer</h3>
          <ol className="cartes-imprimer" aria-label="Cartes de droite à imprimer">
            {kit.stations.map((s) => (
              <li key={s.id} className="carte-imprimer">{s.label}</li>
            ))}
          </ol>
        </>
      )}
      {kit.mechanic === 'trier' && (
        <>
          <h3>Étiquettes à imprimer</h3>
          <ol className="cartes-imprimer" aria-label="Étiquettes à imprimer">
            {kit.stations.map((s) => (
              <li key={s.id} className="carte-imprimer">{s.label}</li>
            ))}
          </ol>
        </>
      )}

      <p className="hors-impression">
        <button type="button" onClick={imprimer}>Imprimer la fiche</button>
      </p>
    </section>
  );
}
