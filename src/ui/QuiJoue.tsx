import { useState } from 'react';
import type { ClasseAppareil } from '../suivi/classeAppareil.js';

interface Props {
  classe: ClasseAppareil | null;
  /** Code élève choisi ; chaîne vide = jouer sans enregistrer. */
  valeur: string;
  onChange: (code: string) => void;
  /** Associe l'appareil à une classe. Renvoie un message d'erreur, ou null quand c'est fait. */
  onAssocier: (codeClasse: string) => Promise<string | null>;
  /** Dissocie l'appareil de sa classe (appareil partagé qui change de classe). */
  onOublier?: () => void;
}

const codes = (n: number) => Array.from({ length: n }, (_, i) => `E${String(i + 1).padStart(2, '0')}`);

/**
 * « Qui joue ? » : le code élève est choisi dans une liste avant le tour, jamais tapé. Par défaut rien n'est enregistré.
 * Sans classe associée, un champ permet d'entrer le code de classe donné par l'enseignant.
 */
export function QuiJoue({ classe, valeur, onChange, onAssocier, onOublier }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  if (classe) {
    return (
      <div className="qui-joue">
        <label htmlFor="qui-joue">Qui joue ?</label>
        <select id="qui-joue" value={valeur} aria-describedby="qui-joue-aide" onChange={(e) => onChange(e.target.value)}>
          <option value="">Jouer sans enregistrer</option>
          {codes(classe.nbCodes).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <p id="qui-joue-aide" className="aide">
          Choisissez votre code avant de jouer : le résultat de votre tour sera enregistré sous ce code, sans votre prénom. Après votre tour, la liste revient sur « Jouer sans enregistrer ».
        </p>
        {onOublier && (
          <button type="button" onClick={onOublier}>Dissocier cet appareil</button>
        )}
      </div>
    );
  }

  async function associer() {
    setEnCours(true);
    setErreur('');
    const message = await onAssocier(saisie.replace(/\s+/g, '').toUpperCase());
    setEnCours(false);
    if (message !== null) setErreur(message);
    else {
      setOuvert(false);
      setSaisie('');
    }
  }

  if (!ouvert) {
    return (
      <div className="qui-joue">
        <button type="button" onClick={() => setOuvert(true)}>Associer cet appareil à une classe</button>
      </div>
    );
  }

  return (
    <div className="qui-joue">
      <label htmlFor="code-classe">Code de la classe</label>
      <input
        id="code-classe"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={20}
        placeholder="Par exemple : K7M2XQ9A"
        value={saisie}
        aria-describedby="code-classe-aide"
        onChange={(e) => setSaisie(e.target.value)}
      />
      <p id="code-classe-aide" className="aide">
        Le code est donné par votre enseignant. Rien d’autre que votre code élève n’est envoyé.
      </p>
      {erreur !== '' && <p role="alert" className="raisons">{erreur}</p>}
      <button type="button" onClick={associer} disabled={enCours || saisie.trim() === ''}>Associer</button>
      <button type="button" onClick={() => { setOuvert(false); setErreur(''); }}>Annuler</button>
    </div>
  );
}
