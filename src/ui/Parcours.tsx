import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { construireActivite } from '../atelier/brouillon.js';
import { activitePilote } from '../data/pilote.js';
import { ETAPES, problemesEtape, reduire, type Etape } from '../parcours/etapes.js';
import { chargerBrouillon, sauverBrouillon, type Stockage } from '../parcours/stockage.js';
import { ActivityScreen } from './ActivityScreen.js';
import { BarreFichier } from './BarreFichier.js';
import { EtapeCompetences } from './EtapeCompetences.js';
import { EtapeElements } from './EtapeElements.js';
import { EtapeMatiere } from './EtapeMatiere.js';
import { EtapeNiveau } from './EtapeNiveau.js';

const NOM_ETAPE: Record<Etape, string> = {
  niveau: 'Niveau',
  matiere: 'Matière',
  competences: 'Compétences visées',
  elements: 'Vos éléments',
  jeux: 'Vos jeux',
};

function stockageDuNavigateur(): Stockage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Parcours : niveau, matière, compétences visées, saisie des éléments, puis les jeux sur écran et en classe. */
export function Parcours({
  stockage = stockageDuNavigateur(),
  telecharger,
}: {
  stockage?: Stockage | null;
  telecharger?: (nom: string, contenu: string) => void;
}) {
  const [etat, envoyer] = useReducer(reduire, stockage, chargerBrouillon);
  const [exemple, setExemple] = useState(false);
  const premier = useRef(true);

  useEffect(() => {
    sauverBrouillon(stockage, etat);
  }, [stockage, etat]);

  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    document.getElementById('titre-etape')?.focus();
  }, [etat.etape]);

  const activite = useMemo(() => {
    if (etat.etape !== 'jeux') return null;
    try {
      return construireActivite(etat.brouillon);
    } catch {
      return null;
    }
  }, [etat.etape, etat.brouillon]);

  if (exemple) {
    return (
      <div>
        <p>
          <button type="button" onClick={() => setExemple(false)}>Retour au parcours</button>
        </p>
        <ActivityScreen activity={activitePilote()} />
      </div>
    );
  }

  const index = ETAPES.indexOf(etat.etape);
  const raisons = problemesEtape(etat);
  const b = etat.brouillon;
  const enCours = b.niveau !== '' || [b.titre, b.contexte, b.paires, b.etapes].some((t) => t.trim() !== '') || b.familles.some((f) => f.label.trim() !== '' || f.elements.trim() !== '');
  const barreVisible = etat.etape === 'niveau' || etat.etape === 'elements' || etat.etape === 'jeux';

  return (
    <div className="parcours">
      <p className="progression">{`Étape ${index + 1} sur ${ETAPES.length} : ${NOM_ETAPE[etat.etape]}`}</p>

      {etat.etape === 'niveau' && (
        <p>
          <button type="button" onClick={() => setExemple(true)}>Voir l’exemple des positions (P4)</button>
        </p>
      )}

      <div className="carte">
        {etat.etape === 'niveau' && <EtapeNiveau etat={etat} envoyer={envoyer} />}
        {etat.etape === 'matiere' && <EtapeMatiere etat={etat} envoyer={envoyer} />}
        {etat.etape === 'competences' && <EtapeCompetences etat={etat} envoyer={envoyer} />}
        {etat.etape === 'elements' && <EtapeElements etat={etat} envoyer={envoyer} />}
        {etat.etape === 'jeux' && (
          <>
            <h2 id="titre-etape" tabIndex={-1}>Vos jeux</h2>
            {activite ? (
              <ActivityScreen activity={activite} />
            ) : (
              <p>Votre saisie n’est plus complète. Revenez à l’étape précédente pour la corriger.</p>
            )}
          </>
        )}
      </div>

      <div className="navigation-parcours">
        <button type="button" onClick={() => envoyer({ type: 'precedent' })} disabled={index === 0}>Précédent</button>
        {etat.etape === 'jeux' ? (
          <button type="button" onClick={() => envoyer({ type: 'aller', etape: 'elements' })}>Modifier mes éléments</button>
        ) : (
          <button type="button" onClick={() => envoyer({ type: 'suivant' })} disabled={raisons.length > 0}>Suivant</button>
        )}
        <button type="button" onClick={() => envoyer({ type: 'recommencer' })}>Recommencer</button>
      </div>

      {etat.etape !== 'jeux' && raisons.length > 0 && (
        <ul className="raisons">
          {raisons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}

      {barreVisible && (
        <BarreFichier brouillon={b} enCours={enCours} onCharger={(brouillon) => envoyer({ type: 'charger', brouillon })} telecharger={telecharger} />
      )}
    </div>
  );
}
