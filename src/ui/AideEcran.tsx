import { AIDES, TITRE_AIDE, type AideId } from '../aide/aides.js';
import { useSpeech } from './useSpeech.js';

/**
 * Aide d'un écran : un bloc replié (jamais ouvert d'office), cinq puces au plus et, pour l'enseignant, ce que l'écran ne
 * fait pas. Masqué à l'impression. Les textes viennent de `src/aide/textes.json`. Pour l'élève, un bouton lit l'aide à
 * voix haute quand le navigateur a une synthèse vocale ; sans elle, rien n'est affiché et rien ne plante.
 */
export function AideEcran({ id }: { id: AideId }) {
  const aide = AIDES[id];
  const { available, speak } = useSpeech();
  return (
    <details className="aide-ecran hors-impression">
      <summary>{TITRE_AIDE}</summary>
      <ul>
        {aide.puces.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {aide.limite !== undefined && <p className="aide">{`Limite : ${aide.limite}`}</p>}
      {aide.public === 'eleve' && available && (
        <p>
          <button type="button" onClick={() => speak(aide.puces.join(' '))}>Écouter l’aide</button>
        </p>
      )}
    </details>
  );
}
