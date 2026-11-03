import { niveaux } from '../data/catalogue.js';
import { libelleNiveau } from '../atelier/brouillon.js';
import type { EtatParcours, Evenement } from '../parcours/etapes.js';

interface Props {
  etat: EtatParcours;
  envoyer: (e: Evenement) => void;
}

export function EtapeNiveau({ etat, envoyer }: Props) {
  return (
    <section aria-labelledby="titre-etape">
      <h2 id="titre-etape" tabIndex={-1}>Niveau</h2>
      <p className="aide">Choisissez le niveau de vos élèves. Le programme affiché à l’étape suivante est celui de ce niveau.</p>
      <div className="choix">
        {niveaux().map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={etat.brouillon.niveau === n}
            title={libelleNiveau(n)}
            onClick={() => envoyer({ type: 'choisirNiveau', niveau: n })}
          >
            {n}
          </button>
        ))}
      </div>
    </section>
  );
}
