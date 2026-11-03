import { matieres } from '../data/catalogue.js';
import type { EtatParcours, Evenement } from '../parcours/etapes.js';

interface Props {
  etat: EtatParcours;
  envoyer: (e: Evenement) => void;
}

export function EtapeMatiere({ etat, envoyer }: Props) {
  const liste = matieres(etat.brouillon.niveau);
  return (
    <section aria-labelledby="titre-etape">
      <h2 id="titre-etape" tabIndex={-1}>Matière</h2>
      <p className="aide">Seules les matières dont le programme est chargé dans GameActif apparaissent.</p>
      {liste.length === 0 ? (
        <p>Aucune matière n’est encore disponible pour ce niveau.</p>
      ) : (
        <div className="choix">
          {liste.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={etat.brouillon.matiere === m.id}
              onClick={() => envoyer({ type: 'choisirMatiere', matiere: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
