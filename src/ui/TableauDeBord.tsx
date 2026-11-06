import { useEffect, useMemo, useState } from 'react';
import type { StockageLocal } from '../compte/invitation.js';
import { mecanique } from '../engine/mecaniques.js';
import type { MechanicId } from '../engine/types.js';
import {
  erreursParType,
  etatEleve,
  evolution,
  faitsParEleve,
  jeuxParCible,
  participation,
  type Etat,
  type PointEvolution,
  type ResultatManuel,
  type SeuilsEtats,
} from '../suivi/agregats.js';
import type { ClasseLue, SuiviStore } from '../suivi/lecture.js';
import { afficher, lireRoster } from '../suivi/roster.js';
import { ecrireSeuils, lireSeuils } from '../suivi/seuils.js';
import type { SessionEnregistree } from '../suivi/types.js';
import { codesDeClasse, dateFr, pourcent } from './formats.js';
import { AideEcran } from './AideEcran.js';

const MESSAGE_CHARGEMENT = 'Les résultats n’ont pas pu être chargés. Réessayez.';

const codes = codesDeClasse;
const date = dateFr;
const nomJeu = (j: MechanicId | 'physique') => (j === 'physique' ? 'Jeu physique (saisi par l’enseignant)' : mecanique(j).label);

const ETATS: { id: Etat; picto: string; mot: string }[] = [
  { id: 'stabilise', picto: '✔', mot: 'Stabilisé' },
  { id: 'en-cours', picto: '◐', mot: 'En cours' },
  { id: 'a-reprendre', picto: '▲', mot: 'À reprendre' },
  { id: 'pas-d-indice', picto: '○', mot: 'Pas d’indice' },
];

function regle(id: Etat, s: SeuilsEtats): string {
  switch (id) {
    case 'stabilise':
      return `Réussi dans ${s.jeuxDifferents} jeu${s.jeuxDifferents > 1 ? 'x' : ''} différent${s.jeuxDifferents > 1 ? 's' : ''}, sur au moins ${s.jours} jour${s.jours > 1 ? 's' : ''} (réussi : au moins ${pourcent(s.reussite)} au premier essai).`;
    case 'en-cours':
      return 'A joué cet attendu, sans remplir les conditions des autres états.';
    case 'a-reprendre':
      return `Même confusion dans ${s.erreurRepetee} jeux différents, ou résultat « à reprendre » saisi par vous.`;
    case 'pas-d-indice':
      return 'N’a pas joué cet attendu et aucun résultat n’a été saisi.';
  }
}

interface Donnees {
  sessions: SessionEnregistree[];
  manuels: ResultatManuel[];
}

const NOTES = { reussi: 'réussi', partiel: 'partiel', a_reprendre: 'à reprendre' } as const;

/** Courbe de la réussite au premier essai, par jour. Le tableau placé dessous porte les mêmes valeurs. */
function Courbe({ points }: { points: PointEvolution[] }) {
  const largeur = 300;
  const hauteur = 100;
  const marge = 10;
  const x = (i: number) => (points.length === 1 ? largeur / 2 : marge + (i * (largeur - 2 * marge)) / (points.length - 1));
  const y = (r: number) => hauteur - marge - r * (hauteur - 2 * marge);
  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label="Courbe de la réussite au premier essai par jour" width="100%" height={120}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points.map((p, i) => `${x(i)},${y(p.r1)}`).join(' ')} />
      {points.map((p, i) => (
        <circle key={p.jour} cx={x(i)} cy={y(p.r1)} r={4} fill="currentColor" />
      ))}
    </svg>
  );
}

/** Section repliable : le titre reste visible, le contenu se replie pour alléger l'écran. */
function Section({ titre, ouvert, children }: { titre: string; ouvert: boolean; children: React.ReactNode }) {
  return (
    <details className="section-tdb" open={ouvert}>
      <summary><h3>{titre}</h3></summary>
      {children}
    </details>
  );
}

/**
 * Couche A du tableau de bord : qui a joué, erreurs par type, même attendu dans les autres jeux, états.
 * Les codes sont remplacés par les prénoms de la liste locale à l'affichage seulement.
 */
export function TableauDeBord({ classe, store, stockage }: { classe: ClasseLue; store: SuiviStore; stockage: StockageLocal | null }) {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [eleve, setEleve] = useState('');
  const [seuils, setSeuils] = useState<SeuilsEtats>(() => lireSeuils(stockage, classe.id));
  // Relue à chaque rendu : la liste peut être modifiée ailleurs sur la page (le prénom s'affiche aussitôt).
  const roster = lireRoster(stockage, classe.id);
  const tous = useMemo(() => codes(classe.nbCodes), [classe.nbCodes]);

  useEffect(() => {
    let actif = true;
    setDonnees(null);
    setErreur(false);
    Promise.all([store.sessions(classe.id), store.manuels(classe.id)])
      .then(([sessions, manuels]) => {
        if (actif) setDonnees({ sessions, manuels });
      })
      .catch(() => {
        if (actif) setErreur(true);
      });
    return () => {
      actif = false;
    };
  }, [store, classe.id]);

  if (erreur) return <p role="alert" className="raisons">{MESSAGE_CHARGEMENT}</p>;
  if (donnees === null) return <p role="status">Chargement des résultats…</p>;

  const cibles = [...new Set([...donnees.sessions.flatMap((s) => s.cibles), ...donnees.manuels.map((m) => m.cible)])].sort();
  if (cibles.length === 0) return <p>Aucune séance reçue pour cette classe.</p>;
  const cible = choisie !== null && cibles.includes(choisie) ? choisie : cibles[0];

  const { sessions, manuels } = donnees;
  const p = participation(tous, sessions, manuels, cible);
  const erreurs = erreursParType(sessions, cible);
  const jeux = jeuxParCible(sessions, manuels, cible);
  const etats = new Map<Etat, string[]>(ETATS.map((e) => [e.id, []]));
  for (const code of tous) etats.get(etatEleve(code, cible, sessions, manuels, seuils))?.push(code);
  const noms = (liste: string[]) => liste.map((c) => afficher(c, roster)).join(', ');
  const points = evolution(sessions.filter((s) => s.cibles.includes(cible)), cible, eleve === '' ? undefined : eleve);
  const faits = eleve === '' ? [] : faitsParEleve(eleve, sessions.filter((s) => s.cibles.includes(cible)), manuels.filter((m) => m.cible === cible));

  function changer(champ: keyof SeuilsEtats, brut: string, min: number, max: number, facteur = 1) {
    const v = Number(brut) / facteur;
    if (!Number.isFinite(v) || v < min || v > max || (facteur === 1 && !Number.isInteger(v))) return;
    const suivants = { ...seuils, [champ]: v };
    setSeuils(suivants);
    ecrireSeuils(stockage, classe.id, suivants);
  }

  return (
    <section aria-label="Tableau de bord" className="tableau-de-bord">
      <AideEcran id="tableau" />
      <div>
        <label htmlFor="attendu">Attendu</label>
        <select id="attendu" value={cible} onChange={(e) => setChoisie(e.target.value)}>
          {cibles.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <Section titre="Qui a joué" ouvert>
        <progress max={tous.length} value={p.joues.length} aria-label="Participation de la classe" />
        <p>{p.joues.length === 1 ? `1 code sur ${tous.length} a joué` : `${p.joues.length} codes sur ${tous.length} ont joué`}</p>
        {p.absents.length > 0 && <p>{`Pas encore joué : ${noms(p.absents)}`}</p>}
      </Section>

      <Section titre="Où en sont les élèves" ouvert={true}>
        <p className="bandeau-indice">
          <strong>Indice, pas une preuve.</strong> Réussir plusieurs parties ne prouve pas que l’élève a compris : la preuve, c’est ce que vous voyez à l’oral, au cahier, dans une autre situation.
        </p>
        <table aria-label="Où en sont les élèves">
          <thead>
            <tr><th scope="col">État</th><th scope="col">Règle</th><th scope="col">Élèves</th></tr>
          </thead>
          <tbody>
            {ETATS.map((e) => {
              const liste = etats.get(e.id) ?? [];
              return (
                <tr key={e.id}>
                  <th scope="row"><span aria-hidden="true">{e.picto} </span>{e.mot}</th>
                  <td>{regle(e.id, seuils)}</td>
                  <td>{liste.length === 0 ? 'Aucun' : `${liste.length} : ${noms(liste)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section titre="Erreurs : fréquence et type" ouvert={erreurs.length > 0}>
        {erreurs.length === 0 ? (
          <p>Aucune erreur enregistrée pour cet attendu.</p>
        ) : (
          <table>
            <caption>Erreurs par type</caption>
            <thead>
              <tr><th scope="col">Confusion</th><th scope="col">Élèves</th><th scope="col">Jeux</th></tr>
            </thead>
            <tbody>
              {erreurs.map((e) => (
                <tr key={`${e.juste}|${e.choisi}`}>
                  <th scope="row">{`« ${e.choisi} » choisi au lieu de « ${e.juste} »`}</th>
                  <td>{`${e.eleves.length} : ${noms(e.eleves)}`}</td>
                  <td>{e.mecaniques.map((m) => mecanique(m).label).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section titre="Le même attendu dans les autres jeux" ouvert={false}>
        <table aria-label="Le même attendu dans les autres jeux">
          <thead>
            <tr><th scope="col">Jeu</th><th scope="col">Joué par</th><th scope="col">Réussite au 1er essai</th><th scope="col">Dernière séance</th></tr>
          </thead>
          <tbody>
            {jeux.map((j) => (
              <tr key={j.jeu}>
                <th scope="row">{nomJeu(j.jeu)}</th>
                <td>{j.dontAuDessus > 0 ? `${j.joueurs}, dont ${j.dontAuDessus} au niveau au-dessus` : j.joueurs}</td>
                <td>{j.r1Moyen === null ? 'saisi par l’enseignant' : pourcent(j.r1Moyen)}</td>
                <td>{date(j.derniere)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div>
        <label htmlFor="eleve-detail">Élève</label>
        <select id="eleve-detail" value={eleve} onChange={(e) => setEleve(e.target.value)}>
          <option value="">Toute la classe</option>
          {tous.map((c) => (
            <option key={c} value={c}>{afficher(c, roster)}</option>
          ))}
        </select>
      </div>

      <Section titre="Évolution dans le temps" ouvert={eleve !== ''}>
        {points === null ? (
          <p>Pas assez de séances pour une tendance (3 jours minimum).</p>
        ) : (
          <>
            <Courbe points={points} />
            <table>
              <caption>Réussite au 1er essai par jour</caption>
              <thead>
                <tr><th scope="col">Jour</th><th scope="col">Réussite au 1er essai</th></tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.jour}><th scope="row">{date(p.jour)}</th><td>{pourcent(p.r1)}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Section>

      <Section titre="Faits par code" ouvert={eleve !== ''}>
        {eleve === '' ? (
          <p>Choisissez un code pour voir ses faits.</p>
        ) : faits.length === 0 ? (
          <p>Aucun fait enregistré pour ce code.</p>
        ) : (
          <table>
            <caption>{`Faits pour ${afficher(eleve, roster)}`}</caption>
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Jeu</th><th scope="col">Réussite au 1er essai</th><th scope="col">Erreurs</th><th scope="col">Origine</th></tr>
            </thead>
            <tbody>
              {faits.map((f, i) => (
                <tr key={`${f.date}-${f.jeu}-${i}`}>
                  <th scope="row">{date(f.date)}</th>
                  <td>{nomJeu(f.jeu)}</td>
                  <td>{f.r1 === null ? 'sans objet' : pourcent(f.r1)}</td>
                  <td>{f.erreurs.length === 0 ? 'aucune' : f.erreurs.join(' ; ')}</td>
                  <td>{f.origine === 'ecran' ? (f.auDessus ? 'jeu sur écran, niveau au-dessus' : 'jeu sur écran') : `saisi par l’enseignant : ${f.note ? NOTES[f.note] : ''}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <details>
        <summary>Seuils des états</summary>
        <p className="aide">Valeurs de départ : proposition, non validée scientifiquement. Vous les ajustez ; elles sont gardées dans ce navigateur, pour cette classe.</p>
        <div className="champs">
          <div>
            <label htmlFor="seuil-reussite">Réussite minimale au 1er essai (%)</label>
            <input id="seuil-reussite" type="number" min={50} max={100} placeholder="75" value={Math.round(seuils.reussite * 100)} onChange={(e) => changer('reussite', e.target.value, 0.5, 1, 100)} aria-describedby="seuil-reussite-aide" />
            <p id="seuil-reussite-aide" className="aide">Une partie compte comme réussie à partir de ce pourcentage d’éléments réussis du premier coup.</p>
          </div>
          <div>
            <label htmlFor="seuil-jeux">Jeux différents réussis</label>
            <input id="seuil-jeux" type="number" min={1} max={7} placeholder="3" value={seuils.jeuxDifferents} onChange={(e) => changer('jeuxDifferents', e.target.value, 1, 7)} aria-describedby="seuil-jeux-aide" />
            <p id="seuil-jeux-aide" className="aide">Nombre de jeux différents (Trier, Mémo, jeu physique saisi…) à réussir pour passer à « Stabilisé ».</p>
          </div>
          <div>
            <label htmlFor="seuil-jours">Jours différents</label>
            <input id="seuil-jours" type="number" min={1} max={10} placeholder="2" value={seuils.jours} onChange={(e) => changer('jours', e.target.value, 1, 10)} aria-describedby="seuil-jours-aide" />
            <p id="seuil-jours-aide" className="aide">Une réussite répétée le même jour ne suffit pas : il en faut sur ce nombre de jours.</p>
          </div>
          <div>
            <label htmlFor="seuil-erreur">Jeux où la même confusion se répète</label>
            <input id="seuil-erreur" type="number" min={2} max={7} placeholder="2" value={seuils.erreurRepetee} onChange={(e) => changer('erreurRepetee', e.target.value, 2, 7)} aria-describedby="seuil-erreur-aide" />
            <p id="seuil-erreur-aide" className="aide">Une même confusion dans ce nombre de jeux différents place l’élève « À reprendre ».</p>
          </div>
        </div>
      </details>
    </section>
  );
}
