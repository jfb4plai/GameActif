import { useState } from 'react';
import { exporterActivite, lireActivite } from '../atelier/fichier.js';
import type { Brouillon } from '../atelier/types.js';

interface Props {
  brouillon: Brouillon;
  /** Un brouillon est déjà commencé : ouvrir un fichier le remplacerait. */
  enCours: boolean;
  onCharger: (b: Brouillon) => void;
  telecharger?: (nom: string, contenu: string) => void;
  maintenant?: () => Date;
}

/** Téléchargement par un lien temporaire ; la mémoire du fichier est libérée juste après. */
function telechargerParLien(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Télécharger son activité ou en ouvrir une, sans compte : le fichier est lu dans le navigateur. */
export function BarreFichier({ brouillon, enCours, onCharger, telecharger = telechargerParLien, maintenant = () => new Date() }: Props) {
  const [message, setMessage] = useState('');
  const [attente, setAttente] = useState<{ brouillon: Brouillon; avertissements: string[] } | null>(null);
  const exportable = brouillon.niveau !== '' && brouillon.matiere !== '';

  function charger(b: Brouillon, avertissements: string[]) {
    onCharger(b);
    setAttente(null);
    setMessage([`Activité ouverte : ${b.titre.trim() === '' ? 'sans titre' : b.titre.trim()}.`, ...avertissements].join(' '));
  }

  async function ouvrir(fichier: File | undefined) {
    if (!fichier) return;
    let texte: string;
    try {
      texte = await fichier.text();
    } catch {
      setMessage('Ce fichier n’a pas pu être lu. Essayez de le télécharger à nouveau.');
      return;
    }
    const lecture = lireActivite(texte);
    if (!lecture.ok) {
      setAttente(null);
      setMessage(lecture.message);
      return;
    }
    if (enCours) {
      setMessage('');
      setAttente({ brouillon: lecture.brouillon, avertissements: lecture.avertissements });
    } else {
      charger(lecture.brouillon, lecture.avertissements);
    }
  }

  return (
    <div className="barre-fichier carte">
      <div className="champ">
        <button
          type="button"
          disabled={!exportable}
          onClick={() => {
            const f = exporterActivite(brouillon, maintenant());
            telecharger(f.nom, f.contenu);
          }}
        >
          Télécharger mon activité
        </button>
        <p className="aide">Le fichier contient votre contexte de classe. Relisez-le avant de l’envoyer et n’y mettez aucun nom d’élève.</p>
      </div>

      <div className="champ">
        <label htmlFor="ouvrir-fichier">Ouvrir une activité (fichier)</label>
        <input
          id="ouvrir-fichier"
          type="file"
          accept=".json,application/json"
          aria-describedby="ouvrir-fichier-aide"
          onChange={(e) => {
            void ouvrir(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <p id="ouvrir-fichier-aide" className="aide">
          Choisissez un fichier .json téléchargé depuis GameActif, le vôtre ou celui d’un collègue. Rien n’est envoyé : le fichier est lu dans votre navigateur.
        </p>
      </div>

      {attente && (
        <div className="confirmation">
          <p><strong>Remplacer votre activité en cours ?</strong></p>
          <p className="aide">Ce que vous avez déjà saisi sera remplacé par le contenu du fichier.</p>
          <div className="navigation-parcours">
            <button type="button" onClick={() => charger(attente.brouillon, attente.avertissements)}>Remplacer</button>
            <button type="button" onClick={() => setAttente(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" className="retour-court">{message}</div>
    </div>
  );
}
