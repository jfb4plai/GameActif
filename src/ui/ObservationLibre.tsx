import { useEffect, useMemo, useState } from 'react';
import { ErreurStockage } from '../compte/activites.js';
import type { StockageLocal } from '../compte/invitation.js';
import type { Observation, SuiviStore } from '../suivi/lecture.js';
import { afficher, contientPrenom, lireRoster } from '../suivi/roster.js';
import { dateFr } from './formats.js';

const MESSAGE_GENERIQUE = 'L’enregistrement n’a pas abouti. Votre saisie est conservée : réessayez.';
const messageDe = (e: unknown) => (e instanceof ErreurStockage ? e.message : MESSAGE_GENERIQUE);

interface Props {
  classId: string;
  /** Date (AAAA-MM-JJ) de suppression des résultats de la classe, rappelée sous le champ. */
  purgeLe: string;
  codes: string[];
  store: SuiviStore;
  stockage: StockageLocal | null;
  /** Personne invitée : la liste seule (celles que l'enseignant a rendues visibles), sans formulaire. */
  lectureSeule?: boolean;
}

/**
 * Les 20 % de l'enseignant : une observation libre, rangée avec les résultats de la classe. Le champ prévient de ne pas y
 * écrire de prénom, et le navigateur compare le texte à la liste locale de prénoms avant tout envoi.
 */
export function ObservationLibre({ classId, purgeLe, codes, store, stockage, lectureSeule = false }: Props) {
  const roster = useMemo(() => lireRoster(stockage, classId), [stockage, classId]);
  const [texte, setTexte] = useState('');
  const [code, setCode] = useState('');
  const [visible, setVisible] = useState(false);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [liste, setListe] = useState<Observation[]>([]);

  useEffect(() => {
    let actif = true;
    store
      .observations(classId)
      .then((l) => {
        if (actif) setListe(l);
      })
      .catch(() => {
        // La liste reste vide ; l'enregistrement d'une nouvelle observation reste possible.
      });
    return () => {
      actif = false;
    };
  }, [store, classId]);

  async function enregistrer() {
    const t = texte.trim();
    if (t === '') return;
    const prenom = contientPrenom(t, roster);
    if (prenom !== null) {
      setErreur(`Ce texte contient « ${prenom} ». Remplacez-le par son code.`);
      return;
    }
    setOccupe(true);
    setErreur('');
    try {
      const o = await store.enregistrerObservation(classId, { studentCode: code === '' ? null : code, texte: t, visibleInvites: visible });
      setListe((l) => [...l, o]);
      setTexte('');
    } catch (e) {
      setErreur(messageDe(e));
    } finally {
      setOccupe(false);
    }
  }

  const items = liste.length > 0 && (
    <ul aria-label="Observations enregistrées">
      {liste.map((o) => (
        <li key={o.id}>
          {`${o.studentCode === null ? 'Classe' : afficher(o.studentCode, roster)} : ${o.texte} (${dateFr(o.creeLe)}${o.visibleInvites ? ', visible par l’invité' : ''})`}
        </li>
      ))}
    </ul>
  );

  if (lectureSeule) {
    return (
      <div className="observation-libre">
        <h3>Observations de l’enseignant</h3>
        {items || <p>Aucune observation partagée avec vous.</p>}
      </div>
    );
  }

  return (
    <div className="observation-libre">
      <h3>Vos observations</h3>
      <div>
        <label htmlFor="obs-code">Code concerné</label>
        <select id="obs-code" value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">Toute la classe</option>
          {codes.map((c) => (
            <option key={c} value={c}>{afficher(c, roster)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="obs-texte">Observation sur la classe ou sur un code</label>
        <textarea
          id="obs-texte"
          rows={4}
          maxLength={1000}
          placeholder="E04 a corrigé seul devant/derrière en rejouant la fiche physique"
          value={texte}
          aria-describedby="obs-aide"
          onChange={(e) => setTexte(e.target.value)}
        />
        <p id="obs-aide" className="aide">
          {`Écrivez le code, jamais le prénom. Ce texte est enregistré avec les résultats de la classe et supprimé le ${dateFr(purgeLe)}.`}
        </p>
      </div>
      <div>
        <label htmlFor="obs-visible">
          <input id="obs-visible" type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} aria-describedby="obs-visible-aide" />
          {' '}Visible par la personne invitée
        </label>
        <p id="obs-visible-aide" className="aide">Cochée, la personne que vous avez invitée peut lire cette observation. Décochée, vous seul la voyez.</p>
      </div>
      {erreur !== '' && <p role="alert" className="raisons">{erreur}</p>}
      <button type="button" onClick={enregistrer} disabled={occupe || texte.trim() === ''}>Enregistrer l’observation</button>

      {items}
    </div>
  );
}
