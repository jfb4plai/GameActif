import { useEffect, useState } from 'react';
import { ErreurStockage } from '../compte/activites.js';
import type { StockageLocal } from '../compte/invitation.js';
import { PROFILE_LABELS } from '../engine/profiles.js';
import type { ProfileId } from '../engine/types.js';
import type { PartageStore } from '../partage/magasin.js';
import type { ClasseLue } from '../suivi/lecture.js';
import { afficher, lireRoster } from '../suivi/roster.js';
import { codesDeClasse, dateFr } from './formats.js';
import { AideEcran } from './AideEcran.js';

const MESSAGE_CHARGEMENT = 'Les niveaux n’ont pas pu être chargés. Réessayez.';
const MESSAGE_GENERIQUE = 'L’enregistrement n’a pas abouti. Réessayez.';
const NIVEAUX: ProfileId[] = ['standard', 'soutien', 'defi'];

/**
 * Mode « niveau par code élève » : l'enseignant fixe le niveau de chaque code (Standard par défaut). La décision est la
 * sienne ; elle est enregistrée sous le code, sans prénom, et supprimée avec la classe. L'élève ne voit jamais le nom du niveau.
 */
export function NiveauxParCode({ classe, partage, stockage }: { classe: ClasseLue; partage: PartageStore; stockage: StockageLocal | null }) {
  const [profils, setProfils] = useState<Record<string, ProfileId> | null>(null);
  const [erreur, setErreur] = useState('');
  // Relue à chaque rendu : la liste de prénoms peut être modifiée ailleurs sur la page.
  const roster = lireRoster(stockage, classe.id);

  useEffect(() => {
    let actif = true;
    setProfils(null);
    partage
      .profils(classe.id)
      .then((p) => {
        if (actif) setProfils(p);
      })
      .catch(() => {
        if (actif) {
          setProfils({});
          setErreur(MESSAGE_CHARGEMENT);
        }
      });
    return () => {
      actif = false;
    };
  }, [partage, classe.id]);

  async function changer(code: string, niveau: ProfileId) {
    if (profils === null) return;
    setErreur('');
    const avant = profils;
    const suivant = { ...profils };
    if (niveau === 'standard') delete suivant[code];
    else suivant[code] = niveau;
    setProfils(suivant);
    try {
      if (niveau === 'standard') await partage.retirerProfil(classe.id, code);
      else await partage.definirProfil(classe.id, code, niveau);
    } catch (e) {
      setProfils(avant);
      setErreur(e instanceof ErreurStockage ? e.message : MESSAGE_GENERIQUE);
    }
  }

  if (profils === null) return <p role="status">Chargement des niveaux…</p>;

  return (
    <section aria-label="Niveaux par code" className="niveaux-par-code">
      <details className="section-tdb">
        <summary><h3>Niveaux par code</h3></summary>
        <AideEcran id="niveaux" />
        <p className="aide">
          {`Ce choix est le vôtre : il est enregistré sous le code, sans prénom, et supprimé le ${dateFr(classe.purgeLe)}. L’élève ne voit pas le nom de son niveau. Un code que vous ne fixez pas joue au niveau Standard.`}
        </p>
        {erreur !== '' && <p role="alert" className="raisons">{erreur}</p>}
        <div className="champs">
          {codesDeClasse(classe.nbCodes).map((c) => (
            <div key={c}>
              <label htmlFor={`niveau-${c}`}>{`Niveau de ${afficher(c, roster)}`}</label>
              <select id={`niveau-${c}`} value={profils[c] ?? 'standard'} onChange={(e) => void changer(c, e.target.value as ProfileId)}>
                {NIVEAUX.map((n) => (
                  <option key={n} value={n}>{PROFILE_LABELS[n]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
