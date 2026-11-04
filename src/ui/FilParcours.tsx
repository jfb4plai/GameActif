import { libelleNiveau } from '../atelier/brouillon.js';
import { matieres } from '../data/catalogue.js';
import { ETAPES, reduire, type Etape, type EtatParcours, type Evenement } from '../parcours/etapes.js';

export const NOM_ETAPE: Record<Etape, string> = {
  niveau: 'Niveau',
  matiere: 'Matière',
  competences: 'Compétences visées',
  elements: 'Vos éléments',
  jeux: 'Vos jeux',
};

function libelleMatiere(etat: EtatParcours): string {
  const b = etat.brouillon;
  return matieres(b.niveau).find((m) => m.id === b.matiere)?.label ?? '';
}

/** Ce que l'enseignant a déjà choisi à chaque étape, pour qu'il voie d'un coup d'œil s'il s'est trompé. */
function choisi(etat: EtatParcours, etape: Etape): string {
  const b = etat.brouillon;
  switch (etape) {
    case 'niveau':
      return b.niveau === '' ? '' : libelleNiveau(b.niveau);
    case 'matiere':
      return libelleMatiere(etat);
    case 'competences':
      return b.cibles.length === 0 ? '' : `${b.cibles.length} choisie${b.cibles.length > 1 ? 's' : ''}`;
    default:
      return '';
  }
}

/** Les cinq étapes de la création : on voit où l'on est, ce qui est choisi, et on revient en un clic sur une étape déjà passée. */
export function FilParcours({ etat, envoyer }: { etat: EtatParcours; envoyer: (e: Evenement) => void }) {
  return (
    <nav aria-label="Étapes de la création" className="fil-parcours">
      <ol>
        {ETAPES.map((e, i) => {
          const courante = e === etat.etape;
          const atteignable = courante || reduire(etat, { type: 'aller', etape: e }).etape === e;
          const valeur = choisi(etat, e);
          return (
            <li key={e}>
              <button
                type="button"
                aria-current={courante ? 'step' : undefined}
                disabled={!atteignable}
                onClick={() => envoyer({ type: 'aller', etape: e })}
              >
                <span className="fil-nom">{`${i + 1}. ${NOM_ETAPE[e]}`}</span>
                {valeur !== '' && <span className="fil-valeur">{valeur}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Rappel du niveau et de la matière choisis, avec un accès direct pour les changer. */
export function Rappel({ etat, envoyer }: { etat: EtatParcours; envoyer: (e: Evenement) => void }) {
  const b = etat.brouillon;
  return (
    <div className="rappel-choix">
      <p>{`Niveau : ${libelleNiveau(b.niveau)}. Matière : ${libelleMatiere(etat)}.`}</p>
      <button type="button" onClick={() => envoyer({ type: 'aller', etape: 'niveau' })}>Changer le niveau</button>
      <button type="button" onClick={() => envoyer({ type: 'aller', etape: 'matiere' })}>Changer la matière</button>
    </div>
  );
}
