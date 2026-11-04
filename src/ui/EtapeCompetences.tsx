import { useState } from 'react';
import { chercher, competences } from '../data/catalogue.js';
import type { EtatParcours, Evenement } from '../parcours/etapes.js';
import { Rappel } from './FilParcours.js';

interface Props {
  etat: EtatParcours;
  envoyer: (e: Evenement) => void;
}

const MAX = 3;
const MESSAGE_MAX = 'Trois compétences au maximum : décochez-en une avant d’en choisir une autre.';

export function EtapeCompetences({ etat, envoyer }: Props) {
  const [recherche, setRecherche] = useState('');
  const [message, setMessage] = useState('');
  const { niveau, matiere, cibles } = etat.brouillon;
  const groupes = chercher(competences(niveau, matiere), recherche);

  function basculer(code: string) {
    setMessage(!cibles.includes(code) && cibles.length >= MAX ? MESSAGE_MAX : '');
    envoyer({ type: 'basculerCible', code });
  }

  return (
    <section aria-labelledby="titre-etape">
      <h2 id="titre-etape" tabIndex={-1}>Compétences visées</h2>
      <Rappel etat={etat} envoyer={envoyer} />
      <p className="aide">
        Choisissez de 1 à 3 attendus du programme que votre activité travaille. Les jeux de GameActif savent faire
        classer, relier et ordonner. Ils ne savent pas faire tracer, mesurer ou construire.
      </p>

      <label htmlFor="recherche-competences">Chercher dans les compétences</label>
      <input
        id="recherche-competences"
        type="search"
        placeholder="Exemple : fractions, déplacer, ordre"
        aria-describedby="recherche-aide"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />
      <p id="recherche-aide" className="aide">
        Le filtre porte sur le texte officiel de l’attendu, sans tenir compte des majuscules ni des accents. Il sert à
        retrouver un attendu : il ne change pas votre choix.
      </p>

      <p className="progression">{`${cibles.length} sur ${MAX}`}</p>
      <div role="status" aria-live="polite" className="retour-court">{message}</div>

      {groupes.length === 0 ? (
        <p>Aucune compétence ne correspond à cette recherche.</p>
      ) : (
        groupes.map((g) => (
          <details key={g.sousPoint} className="groupe-competences" open={recherche.trim() !== ''}>
            <summary>{`${g.sousPoint} ${g.titre} (${g.attendus.length})`}</summary>
            {g.attendus.map((a) => {
              const id = `cible-${a.code.replace(/\./g, '-')}`;
              return (
                <div key={a.code} className="att">
                  <input id={id} type="checkbox" checked={cibles.includes(a.code)} onChange={() => basculer(a.code)} />
                  <label htmlFor={id}>
                    <span className="type">{a.item_type}</span>
                    <span className="code">{a.code}</span>
                    <span>{a.texte}</span>
                  </label>
                </div>
              );
            })}
          </details>
        ))
      )}
    </section>
  );
}
