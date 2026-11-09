import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, MechanicId, ProfileId } from '../engine/types.js';
import { availableMechanics } from '../engine/availability.js';
import { PROFILE_LABELS } from '../engine/profiles.js';
import { makeRng } from '../engine/rng.js';
import { setupRound } from '../engine/setup.js';
import type { ElementResult } from '../engine/round.js';
import { buildPhysicalKit } from '../physical/kit.js';
import { programmeLinks, type ProgrammeLink } from '../physical/programme.js';
import { AutresJeux } from './AutresJeux.js';
import { PhysicalKitView } from './PhysicalKitView.js';
import { mecanique, ordreAffichage } from '../engine/mecaniques.js';
import { PLATEAUX } from './plateaux.js';
import { QuiJoue } from './QuiJoue.js';
import type { StockageLocal } from '../compte/invitation.js';
import { enregistrerClasse, lireClasse, oublierClasse, type ClasseAppareil } from '../suivi/classeAppareil.js';
import { chercherClasse, envoyerSession, MESSAGES_ENVOI, type ClientSuivi } from '../suivi/envoi.js';
import { construirePayload } from '../suivi/payload.js';
import { NOMS_NEUTRES, estAuDessus, niveauAuDessus } from '../partage/niveaux.js';

const A_COMPLETER = 'À compléter par l’enseignant : en quoi ce jeu travaille cet attendu.';
const DEFAULT_PUPILS = 24;

/** Effectif cité dans le contexte de classe (« 18 élèves »), de 1 à 40 ; null si le texte n'en cite pas de crédible. */
export function effectifDuContexte(contexte: string): number | null {
  const m = contexte.match(/(?:^|[^\d])(\d{1,3})\s*(?:élèves?|eleves?|enfants?)/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return n >= 1 && n <= 40 ? n : null;
}

/** Graine stable tirée de l'identifiant de l'activité : une fiche imprimée plus tard reste identique. */
function seedOf(id: string): number {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function LinksView({ links }: { links: ProgrammeLink[] }) {
  return (
    <ul className="liens-programme">
      {links.map((l) => (
        <li key={l.code}>
          <span className="code">{l.code}</span>
          <span>{l.texte}</span>
          <p className="aide">{l.phrase ?? A_COMPLETER}</p>
        </li>
      ))}
    </ul>
  );
}

function stockageNavigateur(): StockageLocal | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function nouvelId(): string | null {
  return globalThis.crypto?.randomUUID?.() ?? null;
}

/** Vue élève d'une activité partagée : sans l'outillage de l'enseignant, au profil décidé par l'enseignant. */
export interface EleveProps {
  /** Profil joué tant qu'aucun code n'a donné le sien (mode « même profil » ou « un lien par groupe »). */
  profilDepart: ProfileId;
  /** Mode « par code » : renvoie le profil du code choisi ; null ou erreur laisse le profil de départ. */
  resoudreProfil?: (codeEleve: string) => Promise<ProfileId | null>;
}

const MESSAGE_NIVEAU_DEFAUT = 'Niveau par défaut : le niveau de votre code n’a pas pu être chargé.';

interface Props {
  activity: Activity;
  /** Client de la base : sans lui, aucun suivi (comportement d'origine). */
  suivi?: ClientSuivi;
  /** Stockage local de l'appareil (classe associée) ; par défaut `localStorage`. */
  stockage?: StockageLocal | null;
  /** Présente : vue élève (outillage de l'enseignant masqué, dépassement d'un niveau possible). */
  eleve?: EleveProps;
}

export function ActivityScreen({ activity, suivi, stockage, eleve }: Props) {
  const magasin = stockage !== undefined ? stockage : stockageNavigateur();
  const [classe, setClasse] = useState<ClasseAppareil | null>(() => (suivi ? lireClasse(magasin) : null));
  const [quiJoue, setQuiJoue] = useState('');
  const [retour, setRetour] = useState('');
  const [profile, setProfile] = useState<ProfileId>(eleve?.profilDepart ?? 'standard');
  // Vue élève : niveau décidé par l'enseignant (le niveau joué peut le dépasser), dernier tour joué, message de repli.
  const [profilAttribue, setProfilAttribue] = useState<ProfileId>(eleve?.profilDepart ?? 'standard');
  const [dernier, setDernier] = useState<{ code: string; profil: ProfileId; attribue: ProfileId; mechanic: MechanicId } | null>(null);
  const [messageNiveau, setMessageNiveau] = useState('');
  const jeton = useRef(0);
  const effectif = effectifDuContexte(activity.context);
  const [pupilsText, setPupilsText] = useState(String(effectif ?? DEFAULT_PUPILS));
  const [playing, setPlaying] = useState<{ mechanic: MechanicId; seed: number } | null>(null);
  const [plays, setPlays] = useState(0);
  const [finished, setFinished] = useState<number | null>(null);
  const gameRef = useRef<HTMLDivElement>(null);

  // Le jeu s'ouvre sous son bouton « Jouer » : la page y défile, sinon le clic semble ne rien faire.
  useEffect(() => {
    if (!playing) return;
    gameRef.current?.scrollIntoView?.({ block: 'start' });
    gameRef.current?.focus?.({ preventScroll: true });
  }, [playing]);

  // Les fiches sont repliées : on les ouvre le temps de l'impression (bouton ou Ctrl+P), puis on restaure.
  useEffect(() => {
    const before = new Map<HTMLDetailsElement, boolean>();
    const onBefore = () =>
      document.querySelectorAll<HTMLDetailsElement>('details.fiche-pliee').forEach((d) => {
        before.set(d, d.open);
        d.open = true;
      });
    const onAfter = () => {
      before.forEach((wasOpen, d) => {
        d.open = wasOpen;
      });
      before.clear();
    };
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
    };
  }, []);

  const available = availableMechanics(activity);
  const mechanics = ordreAffichage(activity.year).map((m) => m.id).filter((m) => available[m].available);
  const pupils = Number.parseInt(pupilsText, 10);
  const pupilsUsed = Number.isFinite(pupils) && pupils > 0 ? pupils : DEFAULT_PUPILS;
  const seed = seedOf(activity.id);

  const kits = useMemo(
    () => Object.fromEntries(mechanics.map((m) => [m, buildPhysicalKit(activity, m, profile, seed, pupilsUsed)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity, profile, pupilsUsed, seed, mechanics.join(',')],
  );

  async function associer(codeClasse: string): Promise<string | null> {
    if (!suivi) return 'Le suivi n’est pas disponible.';
    const c = await chercherClasse(suivi, codeClasse);
    if (!c) return 'Ce code n’est pas reconnu, ou la connexion a échoué. Vérifiez le code et réessayez.';
    enregistrerClasse(magasin, c);
    setClasse(c);
    return null;
  }

  /** Vue élève : choisir un code donne son niveau (mode « par code »), le vider rend le niveau de départ. */
  async function choisirCode(code: string) {
    setQuiJoue(code);
    if (!eleve) return;
    const numero = ++jeton.current;
    if (code === '' || !eleve.resoudreProfil) {
      setProfilAttribue(eleve.profilDepart);
      setProfile(eleve.profilDepart);
      setMessageNiveau('');
      return;
    }
    let p: ProfileId | null = null;
    try {
      p = await eleve.resoudreProfil(code);
    } catch {
      p = null;
    }
    if (numero !== jeton.current) return; // un autre code a été choisi entre-temps
    setMessageNiveau(p === null ? MESSAGE_NIVEAU_DEFAUT : '');
    const niveau = p ?? eleve.profilDepart;
    setProfilAttribue(niveau);
    setProfile(niveau);
  }

  function jouer(mechanic: MechanicId, reprise?: { code: string; profil: ProfileId; attribue: ProfileId }) {
    if (eleve) {
      if (reprise) {
        // « Rejouer un niveau au-dessus » : même élève, niveau suivant, le niveau décidé par l'enseignant ne change pas.
        setQuiJoue(reprise.code);
        setProfilAttribue(reprise.attribue);
        setProfile(reprise.profil);
      } else if (quiJoue === '') {
        // Un tour sans code repart du niveau de départ : jamais celui de l'élève précédent sur un appareil partagé.
        setProfilAttribue(eleve.profilDepart);
        setProfile(eleve.profilDepart);
      }
      setDernier(null);
    }
    setPlays(plays + 1);
    setFinished(null);
    setRetour('');
    setPlaying({ mechanic, seed: plays + 1 });
  }

  const round = playing ? setupRound(activity, playing.mechanic, profile, makeRng(playing.seed)) : null;
  const onDone = (results: ElementResult[]) => {
    setFinished(results.length);
    if (eleve && playing) setDernier({ code: quiJoue, profil: profile, attribue: profilAttribue, mechanic: playing.mechanic });
    if (!suivi || !classe || quiJoue === '' || !round) return;
    // Le code repasse à « Jouer sans enregistrer » dès l'envoi : sur un appareil partagé, le tour suivant
    // n'est jamais attribué à l'élève précédent.
    const code = quiJoue;
    setQuiJoue('');
    const sessionId = nouvelId();
    if (!sessionId) {
      setRetour(MESSAGES_ENVOI.echec);
      return;
    }
    const auDessus = eleve ? estAuDessus(profile, profilAttribue) : false;
    const payload = construirePayload({ sessionId, round, results, profile, cibles: activity.cibles, maintenant: new Date(), auDessus });
    void envoyerSession(suivi, classe.code, code, payload).then((r) => setRetour(MESSAGES_ENVOI[r]));
  };

  return (
    <div className="page-activite">
      {eleve && (
        <div className="carte controles">
          <h2>{activity.title}</h2>
          <p className="aide">{`${activity.discipline}, ${activity.year}`}</p>
          <p>{`Niveau : ${NOMS_NEUTRES[profile]}`}</p>
          {messageNiveau !== '' && <p role="status" className="aide">{messageNiveau}</p>}
        </div>
      )}
      {!eleve && (
      <div className="carte controles">
        <h2>{activity.title}</h2>
        <p className="aide">{`${activity.discipline}, ${activity.year}`}</p>
        <div className="champs">
          <div>
            <label htmlFor="profil">Profil</label>
            <select id="profil" value={profile} aria-describedby="profil-aide" onChange={(e) => setProfile(e.target.value as ProfileId)}>
              {(Object.keys(PROFILE_LABELS) as ProfileId[]).map((p) => (
                <option key={p} value={p}>{PROFILE_LABELS[p]}</option>
              ))}
            </select>
            <p id="profil-aide" className="aide">Le profil règle le nombre d’éléments et les aides, sur écran comme en classe. Rien n’est décidé pour un élève.</p>
          </div>
          <div>
            <label htmlFor="eleves">Nombre d’élèves</label>
            <input
              id="eleves"
              type="number"
              min={1}
              max={40}
              inputMode="numeric"
              placeholder="24"
              value={pupilsText}
              aria-describedby="eleves-aide"
              onChange={(e) => setPupilsText(e.target.value)}
            />
            <p id="eleves-aide" className="aide">Ce nombre sert seulement à calculer le matériel : équipes et cartons. Il n’est pas enregistré.{effectif !== null && ' Prérempli d’après votre contexte de classe : modifiez-le si besoin.'}</p>
          </div>
        </div>
      </div>
      )}

      {suivi && (
        <div className="carte">
          <QuiJoue
            classe={classe}
            valeur={quiJoue}
            onChange={(code) => void choisirCode(code)}
            onAssocier={associer}
            onOublier={() => { oublierClasse(magasin); setClasse(null); setQuiJoue(''); }}
          />
          <p role="status" aria-live="polite" className="retour-court">{playing ? '' : retour}</p>
        </div>
      )}

      {mechanics.map((m) => (
        <article key={m} className="deux-cartes">
          <div className="carte carte-ecran">
            <h2>{`Jeu sur écran : ${mecanique(m).label}`}</h2>
            {!eleve && <LinksView links={programmeLinks(m, 'numerique', activity.cibles)} />}
            <button type="button" onClick={() => jouer(m)} aria-label={`Jouer : ${mecanique(m).label}`}>Jouer</button>
          </div>
          {!eleve && (
          <div className="carte carte-classe">
            <h2>{`En classe, sans écran : ${kits[m].title}`}</h2>
            <details className="fiche-pliee">
              <summary>Voir la fiche : matériel, déroulement, cartes</summary>
              <PhysicalKitView kit={kits[m]} links={programmeLinks(m, 'physique', activity.cibles)} />
            </details>
          </div>
          )}
          {playing?.mechanic === m && round && (
            <div className="carte jeu-en-cours" ref={gameRef} tabIndex={-1}>
              <p>
                <button type="button" onClick={() => { setPlaying(null); setFinished(null); }}>Fermer le jeu</button>
              </p>
              {(() => {
                const Plateau = PLATEAUX[m];
                return <Plateau key={playing.seed} round={round} profile={profile} onDone={onDone} />;
              })()}
              {finished !== null && <p className="aide">{`Tour terminé : ${finished} éléments joués.`}</p>}
              {/* Le résultat de l'envoi s'affiche ici pendant qu'un jeu est ouvert (sinon dans la carte « Qui joue ? »). */}
              <p role="status" aria-live="polite" className="retour-court">{retour}</p>
              {eleve && finished !== null && dernier !== null && niveauAuDessus(dernier.profil) !== null && (
                <button
                  type="button"
                  onClick={() => jouer(dernier.mechanic, { code: dernier.code, profil: niveauAuDessus(dernier.profil) as ProfileId, attribue: dernier.attribue })}
                >
                  Rejouer un niveau au-dessus
                </button>
              )}
            </div>
          )}
        </article>
      ))}

      {eleve && mechanics.length === 0 && <p className="aide">Aucun jeu sur écran pour cette activité.</p>}
      {!eleve && mechanics.length === 0 && (
        <p className="aide">Aucun jeu intégré : remplissez des éléments pour en avoir, ou utilisez les jeux avec votre IA ci-dessous.</p>
      )}
      {!eleve && (
        <details className="autres-jeux-pliee hors-impression" open={mechanics.length === 0 ? true : undefined}>
          <summary>Autres jeux, avec votre IA</summary>
          <AutresJeux activity={activity} profile={profile} graine={seed} />
        </details>
      )}
    </div>
  );
}
