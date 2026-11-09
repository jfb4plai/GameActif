import { useState } from 'react';
import { ErreurStockage } from '../compte/activites.js';
import type { ResultatManuel } from '../suivi/agregats.js';
import type { ClasseLue, SuiviStore } from '../suivi/lecture.js';
import { estCodeAttendu } from '../suivi/attendu.js';
import { codesDeClasse } from './formats.js';

const MESSAGE_FORME = 'Ce texte n’a pas le format d’un attendu, par exemple M.P4.1.1.i1.a1. Copiez-le depuis la fiche du jeu.';
const MESSAGE_GENERIQUE = 'L’enregistrement n’a pas abouti. Votre saisie est conservée : réessayez.';

const RESULTATS: { id: ResultatManuel['resultat']; label: string }[] = [
  { id: 'reussi', label: 'Réussi' },
  { id: 'partiel', label: 'En partie réussi' },
  { id: 'a_reprendre', label: 'À reprendre' },
];

interface Props {
  classe: ClasseLue;
  store: SuiviStore;
  /** Prévient le parent qu'un résultat est enregistré (le tableau de bord se recharge). */
  onEnregistre: () => void;
}

/** Un résultat vu hors écran (jeu physique, oral), saisi à la main : il apparaît étiqueté « saisi par l'enseignant ». */
export function SaisieManuelle({ classe, store, onEnregistre }: Props) {
  const [code, setCode] = useState('');
  const [cible, setCible] = useState('');
  const [resultat, setResultat] = useState<ResultatManuel['resultat']>('reussi');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [occupe, setOccupe] = useState(false);

  async function enregistrer() {
    const c = cible.trim();
    setMessage('');
    if (!estCodeAttendu(c)) {
      setErreur(MESSAGE_FORME);
      return;
    }
    setErreur('');
    setOccupe(true);
    try {
      await store.saisirManuel(classe.id, { studentCode: code, cible: c, resultat });
      setMessage('Résultat enregistré.');
      onEnregistre();
    } catch (e) {
      setErreur(e instanceof ErreurStockage ? e.message : MESSAGE_GENERIQUE);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="saisie-manuelle">
      <h3>Un résultat vu hors écran</h3>
      <p className="aide">Jeu physique, oral, cahier : saisissez ce que vous avez observé. Il apparaît dans le tableau de bord, étiqueté « saisi par l’enseignant ».</p>
      <div className="champs">
        <div>
          <label htmlFor="manuel-code">Code de l’élève (résultat saisi)</label>
          <select id="manuel-code" value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">Choisir un code</option>
            {codesDeClasse(classe.nbCodes).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="manuel-cible">Attendu (code)</label>
          <input id="manuel-cible" type="text" placeholder="M.P4.1.1.i1.a1" autoComplete="off" value={cible} aria-describedby="manuel-cible-aide" onChange={(e) => setCible(e.target.value)} />
          <p id="manuel-cible-aide" className="aide">Le code de l’attendu est affiché sur la fiche du jeu. Le résultat sera rattaché à cet attendu dans le tableau de bord.</p>
        </div>
        <div>
          <label htmlFor="manuel-resultat">Résultat vu</label>
          <select id="manuel-resultat" value={resultat} onChange={(e) => setResultat(e.target.value as ResultatManuel['resultat'])}>
            {RESULTATS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
      {erreur !== '' && <p role="alert" className="raisons">{erreur}</p>}
      {message !== '' && <p role="status" className="retour-court">{message}</p>}
      <button type="button" onClick={enregistrer} disabled={occupe || code === '' || cible.trim() === ''}>Enregistrer le résultat</button>
    </div>
  );
}
