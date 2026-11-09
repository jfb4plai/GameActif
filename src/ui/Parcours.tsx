import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { construireActivite } from '../atelier/brouillon.js';
import { activitePilote } from '../data/pilote.js';
import { ETAPES, problemesEtape, reduire } from '../parcours/etapes.js';
import { FilParcours, NOM_ETAPE } from './FilParcours.js';
import { magasinSupabase, type ActivitesStore, type ClientActivites } from '../compte/activites.js';
import { useAuthOptionnel } from '../compte/auth.js';
import { codeConserve, lireCodeDansAdresse, type StockageLocal } from '../compte/invitation.js';
import { getSupabase } from '../lib/supabase.js';
import { chargerBrouillon, sauverBrouillon, type Stockage } from '../parcours/stockage.js';
import { ActivityScreen } from './ActivityScreen.js';
import { BarreFichier } from './BarreFichier.js';
import { EspaceEnseignant, type EtatAcces } from './EspaceEnseignant.js';
import { MesActivites } from './MesActivites.js';
import { MesClasses } from './MesClasses.js';
import type { ClientSuivi } from '../suivi/envoi.js';
import { lireLienActivite } from '../partage/lien.js';
import type { ClientPartage } from '../partage/lecture.js';
import { VueEleve } from './VueEleve.js';
import { AideEcran } from './AideEcran.js';
import type { AideId } from '../aide/aides.js';
import { SUIVI_ACTIF_PAR_DEFAUT } from '../suivi/interrupteur.js';
import { PublierActivite } from './PublierActivite.js';

/** Niveaux où le lien de partage (jeu en autonomie) est proposé : pas de jeu asynchrone avant la 3e primaire (décision de JF, 2026-11-09). */
const PARTAGE_DES_LA_P3: ReadonlySet<string> = new Set(['P3', 'P4', 'P5', 'P6']);
import { magasinPartageSupabase, type ClientPartageEcriture, type PartageStore } from '../partage/magasin.js';
import { magasinSuiviSupabase, type ClientLecture, type SuiviStore } from '../suivi/lecture.js';
import { EtapeCompetences } from './EtapeCompetences.js';
import { EtapeElements } from './EtapeElements.js';
import { EtapeMatiere } from './EtapeMatiere.js';
import { EtapeNiveau } from './EtapeNiveau.js';


type Rpc = (nom: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

const rpcSupabase: Rpc = (nom, args) => getSupabase().rpc(nom, args) as unknown as PromiseLike<{ data: unknown; error: unknown }>;

function stockageDuNavigateur(): (Stockage & StockageLocal) | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}


function clientSuiviDuNavigateur(): ClientSuivi | undefined {
  try {
    return getSupabase() as unknown as ClientSuivi;
  } catch {
    return undefined;
  }
}

/** Magasin de publication lié à la base ; null si la base n'est pas configurée (le bouton « Proposer à la classe » reste caché). */
function magasinPartageDuNavigateur(): PartageStore | null {
  try {
    return magasinPartageSupabase(getSupabase() as unknown as ClientPartageEcriture);
  } catch {
    return null;
  }
}

function clientPartageDuNavigateur(): (ClientPartage & ClientSuivi) | undefined {
  try {
    return getSupabase() as unknown as ClientPartage & ClientSuivi;
  } catch {
    return undefined;
  }
}

/** Parcours : niveau, matière, compétences visées, saisie des éléments, puis les jeux sur écran et en classe. */
export function Parcours({
  stockage = stockageDuNavigateur(),
  telecharger,
  rpc = rpcSupabase,
  stockageInvitation = stockageDuNavigateur(),
  magasin: magasinImpose,
  suiviActif = SUIVI_ACTIF_PAR_DEFAUT,
  suivi: suiviImpose,
  magasinSuivi: magasinSuiviImpose,
  stockageSuivi = stockageDuNavigateur(),
  partage: partageImpose,
  magasinPartage: magasinPartageImpose,
}: {
  stockage?: Stockage | null;
  telecharger?: (nom: string, contenu: string) => void;
  rpc?: Rpc;
  stockageInvitation?: StockageLocal | null;
  /** Magasin d'activités ; par défaut celui de la base Supabase pour le compte connecté. */
  magasin?: ActivitesStore;
  /** Suivi des élèves par code : actif seulement avec cet interrupteur. */
  suiviActif?: boolean;
  /** Client pour « Qui joue ? » ; par défaut celui de la base, s'il est configuré. */
  suivi?: ClientSuivi;
  /** Magasin des classes et résultats ; par défaut celui de la base pour le compte connecté. */
  magasinSuivi?: SuiviStore;
  stockageSuivi?: StockageLocal | null;
  /** Client de la vue élève (lecture d'une activité partagée) ; par défaut celui de la base, s'il est configuré. */
  partage?: ClientPartage & ClientSuivi;
  /** Magasin de publication des activités partagées ; par défaut celui de la base pour le compte connecté. */
  magasinPartage?: PartageStore;
}) {
  const compte = useAuthOptionnel();
  // Lien d'activité lu une seule fois à l'ouverture. L'adresse est gardée : un rechargement de la tablette rouvre l'activité.
  const [lienEleve] = useState(() => (suiviActif && typeof window !== 'undefined' ? lireLienActivite(new URL(window.location.href)) : null));
  const clientPartage = useMemo(() => partageImpose ?? (compte?.disponible ? clientPartageDuNavigateur() : undefined), [partageImpose, compte?.disponible]);
  const [acces, setAcces] = useState<EtatAcces>('inconnu');
  const userId = compte?.user?.id ?? null;
  const clientSuivi = useMemo<ClientSuivi | undefined>(
    () => (!suiviActif ? undefined : (suiviImpose ?? (compte?.disponible ? clientSuiviDuNavigateur() : undefined))),
    [suiviActif, suiviImpose, compte?.disponible],
  );
  const magasinPartage = useMemo<PartageStore | null>(
    () => (!suiviActif || userId === null ? null : (magasinPartageImpose ?? magasinPartageDuNavigateur())),
    [suiviActif, magasinPartageImpose, userId],
  );
  const magasinSuivi = useMemo<SuiviStore | null>(
    () => (!suiviActif || userId === null ? null : (magasinSuiviImpose ?? magasinSuiviSupabase(getSupabase() as unknown as ClientLecture, userId))),
    [suiviActif, magasinSuiviImpose, userId],
  );
  const magasin = useMemo<ActivitesStore | null>(
    () => magasinImpose ?? (userId !== null ? magasinSupabase(getSupabase() as unknown as ClientActivites, userId) : null),
    [magasinImpose, userId],
  );
  // « Mon espace » s'ouvre tout seul quand on arrive par un lien d'invitation (ou au retour du courriel de confirmation).
  const [espaceOuvert, setEspaceOuvert] = useState(
    () => typeof window !== 'undefined' && (lireCodeDansAdresse(new URL(window.location.href)).code !== null || codeConserve(stockageInvitation) !== null),
  );
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

  if (lienEleve !== null && clientPartage !== undefined) {
    return <VueEleve code={lienEleve.code} groupe={lienEleve.groupe} client={clientPartage} stockage={stockageSuivi} />;
  }

  if (exemple) {
    return (
      <div>
        <p>
          <button type="button" onClick={() => setExemple(false)}>Retour au parcours</button>
        </p>
        <ActivityScreen activity={activitePilote()} suivi={clientSuivi} />
      </div>
    );
  }

  const index = ETAPES.indexOf(etat.etape);
  const raisons = problemesEtape(etat);
  const b = etat.brouillon;
  const enCours = b.niveau !== '' || [b.titre, b.contexte, b.paires, b.etapes, b.comparaisons, b.qcm].some((t) => t.trim() !== '') || b.familles.some((f) => f.label.trim() !== '' || f.elements.trim() !== '');
  const barreVisible = etat.etape === 'niveau' || etat.etape === 'elements' || etat.etape === 'jeux';

  return (
    <div className="parcours">
      <p className="progression">{`Étape ${index + 1} sur ${ETAPES.length} : ${NOM_ETAPE[etat.etape]}`}</p>
      <FilParcours etat={etat} envoyer={envoyer} />

      {etat.etape === 'niveau' && (
        <p>
          <button type="button" onClick={() => setExemple(true)}>Voir l’exemple des positions (P4)</button>
        </p>
      )}

      {/* key : le bloc est remplacé à chaque étape, jamais réutilisé ouvert. */}
      <AideEcran key={etat.etape} id={`parcours-${etat.etape}` as AideId} />

      <div className="carte">
        {etat.etape === 'niveau' && <EtapeNiveau etat={etat} envoyer={envoyer} />}
        {etat.etape === 'matiere' && <EtapeMatiere etat={etat} envoyer={envoyer} />}
        {etat.etape === 'competences' && <EtapeCompetences etat={etat} envoyer={envoyer} />}
        {etat.etape === 'elements' && <EtapeElements etat={etat} envoyer={envoyer} />}
        {etat.etape === 'jeux' && (
          <>
            <h2 id="titre-etape" tabIndex={-1}>Vos jeux</h2>
            {activite ? (
              <>
                <ActivityScreen activity={activite} suivi={clientSuivi} />
                {acces === 'enseignant' && magasinSuivi !== null && magasinPartage !== null && (
                  PARTAGE_DES_LA_P3.has(b.niveau) ? (
                    <PublierActivite brouillon={b} suivi={magasinSuivi} partage={magasinPartage} origine={window.location.origin} />
                  ) : (
                    <p className="aide">Le partage par lien est ouvert à partir de la 3e primaire : avant, les jeux se jouent avec vous, en classe.</p>
                  )
                )}
              </>
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

      {acces === 'enseignant' && magasin !== null && (etat.etape === 'elements' || etat.etape === 'jeux') && (
        <MesActivites store={magasin} brouillon={b} enCours={enCours} onOuvrir={(brouillon) => envoyer({ type: 'charger', brouillon })} />
      )}

      {magasinSuivi !== null && (
        <details className="espace-pliee">
          <summary>Mes classes et résultats</summary>
          <MesClasses store={magasinSuivi} stockage={stockageSuivi} telecharger={telecharger} peutCreer={acces === 'enseignant'} partage={magasinPartage ?? undefined} />
        </details>
      )}

      {compte?.disponible && (
        <details className="espace-pliee" open={espaceOuvert} onToggle={(e) => setEspaceOuvert((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>{acces === 'enseignant' ? 'Mon espace : connecté' : 'Mon espace'}</summary>
          <EspaceEnseignant rpc={rpc} stockage={stockageInvitation} onAcces={setAcces} />
        </details>
      )}
    </div>
  );
}
