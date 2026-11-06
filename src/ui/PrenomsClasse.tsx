import { useState } from 'react';
import type { StockageLocal } from '../compte/invitation.js';
import type { ClasseLue } from '../suivi/lecture.js';
import { ecrireRoster, exporterRoster, importerRoster, lireRoster, type Roster } from '../suivi/roster.js';
import { codesDeClasse } from './formats.js';

interface Props {
  classe: ClasseLue;
  stockage: StockageLocal | null;
  telecharger: (nom: string, contenu: string) => void;
  /** Prévient le parent que la liste a changé : les autres zones relisent la liste (affichage, garde-fou). */
  onChange?: () => void;
}

const nomDeFichier = (label: string) => `prenoms-${label.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'classe'}.json`;

/**
 * Liste code vers prénom, gardée dans le navigateur de l'enseignant : elle n'est jamais envoyée à la base. Elle sert à
 * afficher le prénom à la place du code et au garde-fou des observations.
 */
export function PrenomsClasse({ classe, stockage, telecharger, onChange }: Props) {
  const [roster, setRoster] = useState<Roster>(() => lireRoster(stockage, classe.id));
  const [message, setMessage] = useState('');

  function changer(code: string, prenom: string) {
    const suivant: Roster = { ...roster };
    if (prenom.trim() === '') delete suivant[code];
    else suivant[code] = prenom.trim().slice(0, 40);
    setRoster(suivant);
    ecrireRoster(stockage, classe.id, suivant);
    onChange?.();
  }

  async function importer(fichier: File | undefined) {
    if (!fichier) return;
    const r = importerRoster(await fichier.text());
    if (r === null) {
      setMessage('Ce fichier n’est pas une liste de prénoms GameActif.');
      return;
    }
    setRoster(r);
    ecrireRoster(stockage, classe.id, r);
    setMessage('Liste importée.');
    onChange?.();
  }

  return (
    <details className="prenoms-classe">
      <summary>Liste des prénoms (reste sur cet appareil)</summary>
      <p className="aide">
        Les prénoms restent dans ce navigateur : ils ne sont jamais envoyés. Ils servent seulement à afficher le prénom à la place du code. Exportez la liste pour ne pas la perdre si vous changez d’appareil.
      </p>
      <div className="champs">
        {codesDeClasse(classe.nbCodes).map((c) => (
          <div key={c}>
            <label htmlFor={`prenom-${c}`}>{`Prénom du code ${c}`}</label>
            <input id={`prenom-${c}`} type="text" maxLength={40} placeholder="Prénom" autoComplete="off" value={roster[c] ?? ''} onChange={(e) => changer(c, e.target.value)} />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => telecharger(nomDeFichier(classe.label), exporterRoster(roster, classe.label))}>Exporter la liste des prénoms</button>
      <div>
        <label htmlFor="import-prenoms">Importer une liste de prénoms</label>
        <input id="import-prenoms" type="file" accept="application/json,.json" onChange={(e) => void importer(e.target.files?.[0])} />
      </div>
      {message !== '' && <p role="status" className="retour-court">{message}</p>}
    </details>
  );
}
