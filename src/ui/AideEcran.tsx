import { AIDES, TITRE_AIDE, type AideId } from '../aide/aides.js';

/**
 * Aide d'un écran : un bloc replié (jamais ouvert d'office), cinq puces au plus et, pour l'enseignant, ce que l'écran ne
 * fait pas. Masqué à l'impression. Les textes viennent de `src/aide/textes.json`.
 */
export function AideEcran({ id }: { id: AideId }) {
  const aide = AIDES[id];
  return (
    <details className="aide-ecran hors-impression">
      <summary>{TITRE_AIDE}</summary>
      <ul>
        {aide.puces.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {aide.limite !== undefined && <p className="aide">{`Limite : ${aide.limite}`}</p>}
    </details>
  );
}
