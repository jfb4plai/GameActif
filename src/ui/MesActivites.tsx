import { useCallback, useEffect, useState } from 'react';
import { ErreurStockage, type ActiviteEnregistree, type ActivitesStore } from '../compte/activites.js';
import type { Brouillon } from '../atelier/types.js';

interface Props {
  store: ActivitesStore;
  brouillon: Brouillon;
  /** Un brouillon est déjà commencé : ouvrir une activité enregistrée le remplacerait. */
  enCours: boolean;
  onOuvrir: (b: Brouillon) => void;
}

type Confirmation = { type: 'ouvrir'; activite: ActiviteEnregistree } | { type: 'supprimer'; activite: ActiviteEnregistree } | null;

const MESSAGE_GENERIQUE = 'L’opération n’a pas abouti. Votre saisie est conservée : réessayez.';
const messageDe = (e: unknown) => (e instanceof ErreurStockage ? e.message : MESSAGE_GENERIQUE);

/** Activités enregistrées dans l'espace de l'enseignant : enregistrer, mettre à jour, ouvrir, supprimer. */
export function MesActivites({ store, brouillon, enCours, onOuvrir }: Props) {
  const [activites, setActivites] = useState<ActiviteEnregistree[] | null>(null);
  const [listeEnErreur, setListeEnErreur] = useState(false);
  const [idCourant, setIdCourant] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    try {
      setActivites(await store.lister());
      setListeEnErreur(false);
    } catch {
      setActivites([]);
      setListeEnErreur(true);
    }
  }, [store]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Un brouillon remis à zéro ne doit pas écraser l'activité suivie au prochain enregistrement.
  useEffect(() => {
    if (brouillon.niveau === '') setIdCourant(null);
  }, [brouillon.niveau]);

  const enregistrable = brouillon.niveau !== '' && brouillon.matiere !== '';

  async function enregistrer(id: string | null) {
    setOccupe(true);
    setMessage('');
    try {
      const a = await store.enregistrer(brouillon, id ?? undefined);
      setIdCourant(a.id);
      setMessage(id === null ? `Activité enregistrée : ${a.titre}.` : `Activité mise à jour : ${a.titre}.`);
      await charger();
    } catch (e) {
      setMessage(messageDe(e));
    } finally {
      setOccupe(false);
    }
  }

  function ouvrir(a: ActiviteEnregistree) {
    onOuvrir(a.brouillon);
    setIdCourant(a.id);
    setConfirmation(null);
    setMessage(`Activité ouverte : ${a.titre}.`);
  }

  async function supprimer(a: ActiviteEnregistree) {
    setConfirmation(null);
    setOccupe(true);
    try {
      await store.supprimer(a.id);
      if (idCourant === a.id) setIdCourant(null);
      setMessage(`Activité supprimée : ${a.titre}.`);
      await charger();
    } catch (e) {
      setMessage(messageDe(e));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section className="mes-activites" aria-label="Mes activités">
      <h3>Mes activités</h3>
      <div className="navigation-parcours">
        {idCourant === null ? (
          <button type="button" disabled={!enregistrable || occupe} onClick={() => void enregistrer(null)}>Enregistrer dans mon espace</button>
        ) : (
          <>
            <button type="button" disabled={!enregistrable || occupe} onClick={() => void enregistrer(idCourant)}>Mettre à jour mon activité</button>
            <button type="button" disabled={!enregistrable || occupe} onClick={() => void enregistrer(null)}>Enregistrer comme nouvelle activité</button>
          </>
        )}
      </div>

      <div role="status" aria-live="polite" className="retour-court">{message}</div>

      {listeEnErreur && <p>Vos activités n’ont pas pu être chargées. Réessayez dans un instant.</p>}
      {activites !== null && activites.length === 0 && !listeEnErreur && <p>Vous n’avez pas encore enregistré d’activité.</p>}

      {activites !== null && activites.length > 0 && (
        <ul className="liste-activites">
          {activites.map((a) => (
            <li key={a.id}>
              <span className="titre-activite">{a.titre}</span>
              <span className="aide">{` ${a.niveau}, modifiée le ${new Date(a.misAJour).toLocaleDateString('fr-BE')}`}</span>
              <span className="navigation-parcours">
                <button type="button" aria-label={`Ouvrir : ${a.titre}`} onClick={() => (enCours ? setConfirmation({ type: 'ouvrir', activite: a }) : ouvrir(a))}>Ouvrir</button>
                <button type="button" aria-label={`Supprimer : ${a.titre}`} onClick={() => setConfirmation({ type: 'supprimer', activite: a })}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {confirmation?.type === 'ouvrir' && (
        <div className="confirmation">
          <p><strong>Remplacer votre activité en cours ?</strong></p>
          <p className="aide">Ce que vous avez déjà saisi sera remplacé par « {confirmation.activite.titre} ».</p>
          <div className="navigation-parcours">
            <button type="button" onClick={() => ouvrir(confirmation.activite)}>Remplacer</button>
            <button type="button" onClick={() => setConfirmation(null)}>Annuler</button>
          </div>
        </div>
      )}
      {confirmation?.type === 'supprimer' && (
        <div className="confirmation">
          <p><strong>Supprimer cette activité ? Cette action est définitive.</strong></p>
          <p className="aide">« {confirmation.activite.titre} » sera supprimée de votre espace.</p>
          <div className="navigation-parcours">
            <button type="button" disabled={occupe} onClick={() => void supprimer(confirmation.activite)}>Supprimer</button>
            <button type="button" onClick={() => setConfirmation(null)}>Annuler</button>
          </div>
        </div>
      )}
    </section>
  );
}
