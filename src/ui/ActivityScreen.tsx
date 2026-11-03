import { useMemo, useState } from 'react';
import type { Activity, MechanicId, ProfileId } from '../engine/types.js';
import { availableMechanics } from '../engine/availability.js';
import { PROFILE_LABELS } from '../engine/profiles.js';
import { makeRng } from '../engine/rng.js';
import { setupRound } from '../engine/setup.js';
import type { ElementResult } from '../engine/round.js';
import { buildPhysicalKit } from '../physical/kit.js';
import { programmeLinks, type ProgrammeLink } from '../physical/programme.js';
import { PhysicalKitView } from './PhysicalKitView.js';
import { RoundBoard } from './RoundBoard.js';
import { SceneBoard } from './SceneBoard.js';

const ORDER: MechanicId[] = ['trier', 'associer', 'ordre', 'placer'];
const LABEL: Record<MechanicId, string> = {
  trier: 'Trier',
  associer: 'Associer',
  ordre: 'Remettre en ordre',
  placer: 'Placer dans une scène',
};
const A_COMPLETER = 'À compléter par l’enseignant : en quoi ce jeu travaille cet attendu.';
const DEFAULT_PUPILS = 24;

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
  const [pupilsText, setPupilsText] = useState(String(DEFAULT_PUPILS));
  const [playing, setPlaying] = useState<{ mechanic: MechanicId; seed: number } | null>(null);
  const [plays, setPlays] = useState(0);
  const [finished, setFinished] = useState<number | null>(null);

  const available = availableMechanics(activity);
  const mechanics = ORDER.filter((m) => available[m].available);
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
            <p id="eleves-aide" className="aide">Ce nombre sert seulement à calculer le matériel : équipes et cartons. Il n’est pas enregistré.</p>
          </div>
        </div>
      </div>

      {mechanics.map((m) => (
        <article key={m} className="deux-cartes">
          <div className="carte carte-ecran">
            <h2>{`Jeu sur écran : ${LABEL[m]}`}</h2>
            <LinksView links={programmeLinks(m, 'numerique', activity.cibles)} />
            <button type="button" onClick={() => jouer(m)} aria-label={`Jouer : ${LABEL[m]}`}>Jouer</button>
          </div>
          <div className="carte carte-classe">
            <h2>{`En classe, sans écran : ${kits[m].title}`}</h2>
            <PhysicalKitView kit={kits[m]} links={programmeLinks(m, 'physique', activity.cibles)} />
          </div>
        </article>
      ))}

      {playing && round && (
        <div className="carte jeu-en-cours">
          <p>
            <button type="button" onClick={() => { setPlaying(null); setFinished(null); }}>Fermer le jeu</button>
          </p>
          {playing.mechanic === 'placer' ? (
            <SceneBoard key={playing.seed} round={round} profile={profile} onDone={onDone} />
          ) : (
            <RoundBoard key={playing.seed} round={round} onDone={onDone} />
          )}
          {finished !== null && <p className="aide">{`Tour terminé : ${finished} éléments joués.`}</p>}
        </div>
      )}
    </div>
  );
}
