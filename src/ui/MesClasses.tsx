import { useCallback, useEffect, useState } from 'react';
import { ErreurStockage } from '../compte/activites.js';
import type { StockageLocal } from '../compte/invitation.js';
import type { ClasseLue, SuiviStore } from '../suivi/lecture.js';
import { codesDeClasse, dateFr } from './formats.js';
import { InvitationClasse } from './InvitationClasse.js';
import { ObservationLibre } from './ObservationLibre.js';
import { NiveauxParCode } from './NiveauxParCode.js';
import type { PartageStore } from '../partage/magasin.js';
import { PrenomsClasse } from './PrenomsClasse.js';
import { SaisieManuelle } from './SaisieManuelle.js';
import { TableauDeBord } from './TableauDeBord.js';
import { AideEcran } from './AideEcran.js';

const MESSAGE_LISTE = 'La liste de vos classes n’a pas pu être chargée. Réessayez.';
const MESSAGE_GENERIQUE = 'L’opération n’a pas abouti. Réessayez.';
const MESSAGE_CODE_INVALIDE = 'Ce code d’invitation n’est plus valable. Demandez-en un nouveau.';
const messageDe = (e: unknown) => (e instanceof ErreurStockage ? e.message : MESSAGE_GENERIQUE);

function telechargerParLien(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

interface Props {
  store: SuiviStore;
  stockage: StockageLocal | null;
  telecharger?: (nom: string, contenu: string) => void;
  /** Faux pour un compte sans accès enseignant : il ne peut que rejoindre une classe par code d'invitation. */
  peutCreer?: boolean;
  /** Magasin des activités partagées et des niveaux par code : sans lui, pas de « Niveaux par code ». */
  partage?: PartageStore;
}

/** « Mes classes » : créer une classe, suivre ses résultats, inviter une personne, ou lire la classe d'un collègue. */
export function MesClasses({ store, stockage, telecharger = telechargerParLien, peutCreer = true, partage }: Props) {
  const [classes, setClasses] = useState<ClasseLue[] | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [erreurListe, setErreurListe] = useState(false);
  const [version, setVersion] = useState(0);
  // Compteur qui ne sert qu'à relancer le rendu des zones qui relisent la liste locale de prénoms.
  const [, setPrenoms] = useState(0);

  const [nom, setNom] = useState('');
  const [nbCodes, setNbCodes] = useState('24');
  const [erreurCreation, setErreurCreation] = useState('');
  const [occupe, setOccupe] = useState(false);

  const [codeInvitation, setCodeInvitation] = useState('');
  const [retourInvitation, setRetourInvitation] = useState<{ erreur: boolean; texte: string } | null>(null);

  const [suppression, setSuppression] = useState(false);

  const charger = useCallback(
    async (aSelectionner?: string) => {
      try {
        const l = await store.classes();
        setClasses(l);
        setErreurListe(false);
        setChoisie((prec) => aSelectionner ?? (prec !== null && l.some((c) => c.id === prec) ? prec : (l[0]?.id ?? null)));
      } catch {
        setClasses([]);
        setErreurListe(true);
      }
    },
    [store],
  );

  useEffect(() => {
    void charger();
  }, [charger]);

  const n = Number(nbCodes);
  const nbValide = Number.isInteger(n) && n >= 1 && n <= 40;
  const classe = classes?.find((c) => c.id === choisie) ?? null;

  async function creer() {
    setOccupe(true);
    setErreurCreation('');
    try {
      const c = await store.creerClasse(nom.trim(), n);
      setNom('');
      await charger(c.id);
    } catch (e) {
      setErreurCreation(messageDe(e));
    } finally {
      setOccupe(false);
    }
  }

  async function rejoindre() {
    setRetourInvitation(null);
    try {
      const r = await store.rejoindre(codeInvitation.trim());
      if (r === 'invalide') {
        setRetourInvitation({ erreur: true, texte: MESSAGE_CODE_INVALIDE });
        return;
      }
      setCodeInvitation('');
      setRetourInvitation({ erreur: false, texte: r === 'ok' ? 'Vous avez maintenant accès à cette classe, en lecture seule.' : 'Vous avez déjà accès à cette classe.' });
      await charger();
    } catch (e) {
      setRetourInvitation({ erreur: true, texte: messageDe(e) });
    }
  }

  async function supprimer(c: ClasseLue) {
    try {
      await store.supprimerClasse(c.id);
      setSuppression(false);
      setChoisie(null);
      await charger();
    } catch (e) {
      setErreurCreation(messageDe(e));
    }
  }

  return (
    <section aria-label="Mes classes" className="mes-classes">
      <h2>Mes classes</h2>
      <AideEcran id="classes" />
      {erreurListe && <p role="alert" className="raisons">{MESSAGE_LISTE}</p>}

      {classes !== null && classes.length > 0 && (
        <div>
          <label htmlFor="classe-choisie">Classe</label>
          <select
            id="classe-choisie"
            value={choisie ?? ''}
            onChange={(e) => {
              setChoisie(e.target.value);
              setSuppression(false);
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.proprietaire ? c.label : `${c.label} (classe invitée)`}</option>
            ))}
          </select>
        </div>
      )}

      {classe !== null && classe.proprietaire && (
        <div className="classe-proprietaire">
          <h3>{classe.label}</h3>
          <p>{`Code de la classe : ${classe.classCode}`}</p>
          <p className="aide">Donnez ce code à vos élèves : ils l’entrent une seule fois sur l’appareil, avec « Associer cet appareil à une classe », puis choisissent leur code E01, E02… avant de jouer.</p>
          <p>{`Les résultats de cette classe sont supprimés le ${dateFr(classe.purgeLe)}.`}</p>

          <PrenomsClasse key={`prenoms-${classe.id}`} classe={classe} stockage={stockage} telecharger={telecharger} onChange={() => setPrenoms((v) => v + 1)} />
          <TableauDeBord key={`tdb-${classe.id}-${version}`} classe={classe} store={store} stockage={stockage} />
          {partage && <NiveauxParCode key={`niveaux-${classe.id}`} classe={classe} partage={partage} stockage={stockage} />}
          <SaisieManuelle key={`manuel-${classe.id}`} classe={classe} store={store} onEnregistre={() => setVersion((v) => v + 1)} />
          <ObservationLibre key={`obs-${classe.id}`} classId={classe.id} purgeLe={classe.purgeLe} codes={codesDeClasse(classe.nbCodes)} store={store} stockage={stockage} />
          <InvitationClasse key={`inv-${classe.id}`} classe={classe} store={store} />

          {!suppression ? (
            <button type="button" onClick={() => setSuppression(true)}>Supprimer cette classe</button>
          ) : (
            <div role="group" aria-label="Confirmation de suppression">
              <p>{`Supprimer « ${classe.label} » et tous ses résultats ? Cette action est définitive.`}</p>
              <button type="button" onClick={() => void supprimer(classe)}>Oui, supprimer la classe et ses résultats</button>
              <button type="button" onClick={() => setSuppression(false)}>Annuler la suppression</button>
            </div>
          )}
        </div>
      )}

      {classe !== null && !classe.proprietaire && (
        <div className="classe-invitee">
          <h3>{classe.label}</h3>
          <p>Vous consultez cette classe en tant que personne invitée : lecture seule, codes sans prénoms.</p>
          <TableauDeBord key={`tdb-${classe.id}`} classe={classe} store={store} stockage={stockage} />
          <ObservationLibre classId={classe.id} purgeLe={classe.purgeLe} codes={[]} store={store} stockage={stockage} lectureSeule />
        </div>
      )}

      {peutCreer && (
      <details open={classes !== null && classes.length === 0}>
        <summary>Créer une classe</summary>
        <div>
          <label htmlFor="classe-nom">Nom de la classe</label>
          <input id="classe-nom" type="text" maxLength={80} placeholder="P4 B, 2026-2027" autoComplete="off" value={nom} aria-describedby="classe-nom-aide" onChange={(e) => setNom(e.target.value)} />
          <p id="classe-nom-aide" className="aide">Pas de prénom ni de nom : ce nom est enregistré dans la base et vu par les personnes que vous invitez.</p>
        </div>
        <div>
          <label htmlFor="classe-nb">Nombre de codes</label>
          <input id="classe-nb" type="number" min={1} max={40} inputMode="numeric" placeholder="24" value={nbCodes} aria-describedby="classe-nb-aide" onChange={(e) => setNbCodes(e.target.value)} />
          <p id="classe-nb-aide" className="aide">Un code par élève : E01, E02… jusqu’au nombre indiqué (40 au plus). Vous gardez chez vous la correspondance entre les codes et les prénoms.</p>
        </div>
        {erreurCreation !== '' && <p role="alert" className="raisons">{erreurCreation}</p>}
        <button type="button" onClick={creer} disabled={occupe || nom.trim() === '' || !nbValide}>Créer la classe</button>
      </details>
      )}

      <details open={!peutCreer}>
        <summary>Rejoindre la classe d’un collègue (lecture seule)</summary>
        <label htmlFor="code-invitation">Code d’accès d’un collègue</label>
        <input id="code-invitation" type="text" maxLength={40} autoComplete="off" placeholder="Les 32 caractères donnés par votre collègue" value={codeInvitation} aria-describedby="code-invitation-aide" onChange={(e) => setCodeInvitation(e.target.value)} />
        <p id="code-invitation-aide" className="aide">Seulement si un collègue qui gère une classe vous a donné ce code : il vous ouvre sa classe en lecture seule, sans rien modifier. Ce n’est pas le code d’inscription de votre compte.</p>
        {retourInvitation !== null && (
          <p role={retourInvitation.erreur ? 'alert' : 'status'} className={retourInvitation.erreur ? 'raisons' : 'retour-court'}>{retourInvitation.texte}</p>
        )}
        <button type="button" onClick={rejoindre} disabled={codeInvitation.trim() === ''}>Rejoindre la classe</button>
      </details>
    </section>
  );
}
