import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../compte/auth.js';
import {
  MESSAGE_INVITATION_INVALIDE,
  codeConserve,
  codePlausible,
  conserverCode,
  lireCodeDansAdresse,
  oublierCode,
  utiliserInvitation,
  type StockageLocal,
} from '../compte/invitation.js';

export type EtatAcces = 'inconnu' | 'indisponible' | 'anonyme' | 'sans-acces' | 'enseignant';

type Rpc = (nom: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

interface Props {
  rpc: Rpc;
  stockage: StockageLocal | null;
  adresse?: () => URL;
  remplacerAdresse?: (url: string) => void;
  /** Prévient le parent (le parcours) de l'état d'accès : seul « enseignant » ouvre l'enregistrement. */
  onAcces?: (etat: EtatAcces) => void;
}

const MESSAGE_ABSENCE = 'Ce compte n’a pas encore accès à GameActif. Ouvrez le lien d’invitation que vous avez reçu.';
const MESSAGE_REESSAI = 'La vérification de votre accès n’a pas abouti. Réessayez.';
const MESSAGE_CONFIRMATION = 'Un courriel de confirmation vient de vous être envoyé. Cliquez sur le lien qu’il contient, puis revenez vous connecter.';

const adresseCourante = () => new URL(window.location.href);
const remplacerAdresseNavigateur = (url: string) => window.history.replaceState(null, '', url);

/** Zone « Mon espace » : connexion, création de compte par invitation, état d'accès. Le parcours reste utilisable sans elle. */
export function EspaceEnseignant({ rpc, stockage, adresse = adresseCourante, remplacerAdresse = remplacerAdresseNavigateur, onAcces }: Props) {
  const auth = useAuth();

  // Code lu une seule fois à l'ouverture : adresse d'abord (lien reçu), sinon code conservé (retour du courriel).
  const [lu] = useState(() => {
    const l = lireCodeDansAdresse(adresse());
    return { adresse: l, plausible: l.code !== null && codePlausible(l.code) };
  });
  const [mode, setMode] = useState<'creer' | 'connexion'>(lu.plausible ? 'creer' : 'connexion');
  const [acces, setAcces] = useState<EtatAcces>('inconnu');
  const [message, setMessage] = useState(lu.adresse.code !== null && !lu.plausible ? MESSAGE_INVITATION_INVALIDE : '');
  const [essai, setEssai] = useState(0);

  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (lu.adresse.code === null) return;
    if (lu.plausible) conserverCode(stockage, lu.adresse.code as string);
    remplacerAdresse(lu.adresse.urlNettoyee);
    // lecture unique à l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userId = auth.user?.id ?? null;
  const dernierEssai = useRef<string>('');

  useEffect(() => {
    if (!auth.disponible) return void setAcces('indisponible');
    if (auth.chargement) return void setAcces('inconnu');
    if (userId === null) {
      setAcces('anonyme');
      return;
    }
    let actif = true;
    void (async () => {
      const code = codeConserve(stockage);
      if (code !== null) {
        const r = await utiliserInvitation(rpc, code);
        if (!actif) return;
        if (r === 'ok' || r === 'deja') {
          oublierCode(stockage);
          setMessage('');
          setAcces('enseignant');
        } else if (r === 'invalide') {
          oublierCode(stockage);
          setMessage(MESSAGE_INVITATION_INVALIDE);
          setAcces('sans-acces');
        } else {
          setMessage(MESSAGE_REESSAI);
          setAcces('sans-acces');
        }
        return;
      }
      let reponse: { data: unknown; error: unknown };
      try {
        reponse = await rpc('game_is_teacher', {});
      } catch {
        reponse = { data: null, error: true };
      }
      if (!actif) return;
      if (reponse.error) {
        setMessage(MESSAGE_REESSAI);
        setAcces('sans-acces');
      } else if (reponse.data === true) {
        setMessage('');
        setAcces('enseignant');
      } else {
        setMessage(MESSAGE_ABSENCE);
        setAcces('sans-acces');
      }
    })();
    return () => {
      actif = false;
    };
    // `essai` relance la vérification après « Réessayer »
  }, [auth.disponible, auth.chargement, userId, essai, rpc, stockage]);

  useEffect(() => {
    if (dernierEssai.current !== acces) {
      dernierEssai.current = acces;
      onAcces?.(acces);
    }
  }, [acces, onAcces]);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    setMessage('');
    setOccupe(true);
    try {
      if (mode === 'creer') {
        const { confirmationRequise } = await auth.creerCompte(email.trim(), mdp);
        if (confirmationRequise) setMessage(MESSAGE_CONFIRMATION);
      } else {
        // La vérification de l'accès qui suit la connexion écrit elle-même son message : ne pas l'effacer ici.
        await auth.seConnecter(email.trim(), mdp);
      }
      setMdp('');
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'La connexion n’a pas abouti. Réessayez dans un instant.');
      setMdp('');
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section className="espace-enseignant" aria-label="Mon espace">
      {!auth.disponible && <p>La connexion n’est pas disponible pour le moment.</p>}
      {auth.disponible && auth.chargement && <p>Chargement…</p>}

      {auth.disponible && !auth.chargement && userId === null && (
        <form onSubmit={soumettre} noValidate>
          {mode === 'creer' && <p><strong>Vous avez reçu une invitation à GameActif.</strong></p>}
          {mode === 'connexion' && !lu.plausible && <p className="aide">Pour créer un compte, ouvrez le lien d’invitation que vous avez reçu.</p>}
          {mode === 'connexion' && codeConserve(stockage) !== null && <p className="aide">Votre invitation est en attente : connectez-vous pour l’activer.</p>}

          <div className="champ">
            <label htmlFor="espace-email">Adresse e-mail</label>
            <input
              id="espace-email"
              type="email"
              autoComplete="email"
              placeholder="Exemple : prenom.nom@ecole.be"
              aria-describedby="espace-email-aide"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p id="espace-email-aide" className="aide">Elle sert uniquement à vous connecter et à retrouver vos activités. Elle n’est jamais demandée aux élèves.</p>
          </div>
          <div className="champ">
            <label htmlFor="espace-mdp">Mot de passe</label>
            <input
              id="espace-mdp"
              type="password"
              autoComplete={mode === 'creer' ? 'new-password' : 'current-password'}
              placeholder="Au moins 8 caractères"
              aria-describedby="espace-mdp-aide"
              value={mdp}
              onChange={(e) => setMdp(e.target.value)}
            />
            <p id="espace-mdp-aide" className="aide">Choisissez un mot de passe que vous n’utilisez nulle part ailleurs. Il n’est jamais affiché ni enregistré par cette page.</p>
          </div>

          <div className="navigation-parcours">
            <button type="submit" disabled={occupe || email.trim() === '' || mdp === ''}>{mode === 'creer' ? 'Créer mon compte' : 'Se connecter'}</button>
            {mode === 'creer' && <button type="button" onClick={() => setMode('connexion')}>J’ai déjà un compte</button>}
            {mode === 'connexion' && (lu.plausible || codeConserve(stockage) !== null) && (
              <button type="button" onClick={() => setMode('creer')}>J’ai une invitation : créer mon compte</button>
            )}
          </div>
          {erreur !== '' && <p role="alert" className="raisons">{erreur}</p>}
        </form>
      )}

      {auth.disponible && !auth.chargement && userId !== null && acces === 'enseignant' && (
        <p>
          {`Connecté : ${auth.user?.email ?? 'compte enseignant'}`}{' '}
          <button type="button" onClick={() => void auth.seDeconnecter()}>Se déconnecter</button>
        </p>
      )}

      {auth.disponible && !auth.chargement && userId !== null && acces === 'sans-acces' && (
        <div>
          <p className="raisons">{message}</p>
          <div className="navigation-parcours">
            {message === MESSAGE_REESSAI && <button type="button" onClick={() => setEssai((n) => n + 1)}>Réessayer</button>}
            <button type="button" onClick={() => void auth.seDeconnecter()}>Se déconnecter</button>
          </div>
        </div>
      )}

      {userId === null && message !== '' && <p role="status" className="raisons">{message}</p>}
    </section>
  );
}
