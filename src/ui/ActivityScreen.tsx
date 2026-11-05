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
import { MECANIQUES, mecanique } from '../engine/mecaniques.js';
import { PLATEAUX } from './plateaux.js';

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

export function ActivityScreen({ activity }: { activity: Activity }) {
  const [profile, setProfile] = useState<ProfileId>('standard');
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
  const mechanics = MECANIQUES.map((m) => m.id).filter((m) => available[m].available);
  const pupils = Number.parseInt(pupilsText, 10);
  const pupilsUsed = Number.isFinite(pupils) && pupils > 0 ? pupils : DEFAULT_PUPILS;
  const seed = seedOf(activity.id);

  const kits = useMemo(
    () => Object.fromEntries(mechanics.map((m) => [m, buildPhysicalKit(activity, m, profile, seed, pupilsUsed)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity, profile, pupilsUsed, seed, mechanics.join(',')],
  );

  function jouer(mechanic: MechanicId) {
    setPlays(plays + 1);
    setFinished(null);
    setPlaying({ mechanic, seed: plays + 1 });
  }

  const round = playing ? setupRound(activity, playing.mechanic, profile, makeRng(playing.seed)) : null;
  const onDone = (results: ElementResult[]) => setFinished(results.length);

  return (
    <div className="page-activite">
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

      {mechanics.map((m) => (
        <article key={m} className="deux-cartes">
          <div className="carte carte-ecran">
            <h2>{`Jeu sur écran : ${mecanique(m).label}`}</h2>
            <LinksView links={programmeLinks(m, 'numerique', activity.cibles)} />
            <button type="button" onClick={() => jouer(m)} aria-label={`Jouer : ${mecanique(m).label}`}>Jouer</button>
          </div>
          <div className="carte carte-classe">
            <h2>{`En classe, sans écran : ${kits[m].title}`}</h2>
            <details className="fiche-pliee">
              <summary>Voir la fiche : matériel, déroulement, cartes</summary>
              <PhysicalKitView kit={kits[m]} links={programmeLinks(m, 'physique', activity.cibles)} />
            </details>
          </div>
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
            </div>
          )}
        </article>
      ))}

      {mechanics.length === 0 && (
        <p className="aide">Aucun jeu intégré : remplissez des éléments pour en avoir, ou utilisez les jeux avec votre IA ci-dessous.</p>
      )}
      <details className="autres-jeux-pliee hors-impression" open={mechanics.length === 0 ? true : undefined}>
        <summary>Autres jeux, avec votre IA</summary>
        <AutresJeux activity={activity} profile={profile} graine={seed} />
      </details>
    </div>
  );
}
