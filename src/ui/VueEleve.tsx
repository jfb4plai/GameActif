import { useEffect, useMemo, useState } from 'react';
import { construireActivite } from '../atelier/brouillon.js';
import type { StockageLocal } from '../compte/invitation.js';
import type { Activity, ProfileId } from '../engine/types.js';
import type { Groupe } from '../partage/lien.js';
import { chargerActivite, profilPourCode, type ActivitePartagee, type ClientPartage } from '../partage/lecture.js';
import { profilDuGroupe } from '../partage/niveaux.js';
import { enregistrerClasse } from '../suivi/classeAppareil.js';
import type { ClientSuivi } from '../suivi/envoi.js';
import { ActivityScreen } from './ActivityScreen.js';

const MESSAGE_RETIREE = 'Cette activité n’est plus proposée.';
const MESSAGE_ECHEC = 'L’activité n’a pas pu être chargée. Vérifiez la connexion et réessayez.';
const MESSAGE_ILLISIBLE = 'Cette activité n’a pas pu être ouverte. Demandez un nouveau lien à votre enseignant.';
const MESSAGE_HORS_LIGNE = 'Activité ouverte sans connexion : vos résultats ne seront pas enregistrés tant que la connexion ne revient pas.';

type Etat = { etat: 'chargement' } | { etat: 'retiree' } | { etat: 'echec' } | { etat: 'ok'; activite: ActivitePartagee; depuisCache: boolean };

interface Props {
  code: string;
  groupe: Groupe | null;
  client: ClientPartage & ClientSuivi;
  stockage: StockageLocal | null;
}

/**
 * Ce que voit un élève qui ouvre le lien d'une activité : le titre, « Qui joue ? » et les jeux sur écran, au niveau décidé
 * par l'enseignant. Le contexte de classe n'existe pas ici : la base ne le renvoie jamais.
 */
export function VueEleve({ code, groupe, client, stockage }: Props) {
  const [chargement, setChargement] = useState<Etat>({ etat: 'chargement' });
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let actif = true;
    setChargement({ etat: 'chargement' });
    void chargerActivite(client, stockage, code).then((r) => {
      if (!actif) return;
      if (r.etat === 'ok') {
        // L'appareil est associé à la classe de l'activité avant l'affichage de « Qui joue ? ».
        enregistrerClasse(stockage, { code: r.activite.classCode, nbCodes: r.activite.nbCodes });
        setChargement({ etat: 'ok', activite: r.activite, depuisCache: r.depuisCache });
      } else {
        setChargement(r);
      }
    });
    return () => {
      actif = false;
    };
  }, [client, stockage, code, essai]);

  const ouverte = chargement.etat === 'ok' ? chargement : null;
  const activity = useMemo<Activity | null>(() => {
    if (!ouverte) return null;
    try {
      return construireActivite(ouverte.activite.brouillon);
    } catch {
      return null;
    }
  }, [ouverte]);

  if (chargement.etat === 'chargement') return <p role="status">Ouverture de l’activité…</p>;
  if (chargement.etat === 'retiree') return <p role="alert">{MESSAGE_RETIREE}</p>;
  if (chargement.etat === 'echec') {
    return (
      <div>
        <p role="alert">{MESSAGE_ECHEC}</p>
        <button type="button" onClick={() => setEssai((n) => n + 1)}>Réessayer</button>
      </div>
    );
  }
  if (!ouverte || !activity) return <p role="alert">{MESSAGE_ILLISIBLE}</p>;

  const a = ouverte.activite;
  const profilDepart: ProfileId = a.mode === 'groupes' ? profilDuGroupe(groupe) : a.profilDefaut;
  return (
    <div className="vue-eleve">
      {ouverte.depuisCache && <p role="status" className="aide">{MESSAGE_HORS_LIGNE}</p>}
      <ActivityScreen
        activity={activity}
        suivi={client}
        stockage={stockage}
        eleve={{ profilDepart, resoudreProfil: a.mode === 'par-code' ? (codeEleve) => profilPourCode(client, a.classCode, codeEleve) : undefined }}
      />
    </div>
  );
}
