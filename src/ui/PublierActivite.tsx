import { useCallback, useEffect, useState } from 'react';
import type { Brouillon } from '../atelier/types.js';
import { ErreurStockage } from '../compte/activites.js';
import { PROFILE_LABELS } from '../engine/profiles.js';
import type { ProfileId } from '../engine/types.js';
import { lienActivite, type Groupe } from '../partage/lien.js';
import type { Mode } from '../partage/lecture.js';
import { ErreurPartage, type PartageStore, type Publication } from '../partage/magasin.js';
import { COULEURS_GROUPES } from '../partage/niveaux.js';
import type { ClasseLue, SuiviStore } from '../suivi/lecture.js';
import { dateFr } from './formats.js';
import { CodeQr } from './CodeQr.js';
import { AideEcran } from './AideEcran.js';

const MESSAGE_GENERIQUE = 'L’opération n’a pas abouti. Réessayez.';
const messageDe = (e: unknown) => (e instanceof ErreurPartage || e instanceof ErreurStockage ? e.message : MESSAGE_GENERIQUE);
const MODES: { id: Mode; label: string }[] = [
  { id: 'meme', label: 'Même niveau pour tous' },
  { id: 'groupes', label: 'Un lien par groupe' },
  { id: 'par-code', label: 'Niveau par code élève' },
];
const GROUPES: Groupe[] = [1, 2, 3];
const libelleMode = (m: Mode) => MODES.find((x) => x.id === m)?.label ?? m;

async function copierParDefaut(texte: string): Promise<void> {
  await navigator.clipboard.writeText(texte);
}

interface Props {
  brouillon: Brouillon;
  suivi: SuiviStore;
  partage: PartageStore;
  /** Origine de l'application, par exemple `https://gameactif.jfb4plai.com`. */
  origine: string;
  copier?: (texte: string) => Promise<void>;
}

/**
 * « Proposer à la classe » : publie l'activité pour une classe et montre le QR et le lien à afficher au TBI ou à envoyer.
 * Le contexte de classe du brouillon n'est jamais affiché ici ; le serveur le remplace avant de le stocker.
 */
export function PublierActivite({ brouillon, suivi, partage, origine, copier = copierParDefaut }: Props) {
  const [classes, setClasses] = useState<ClasseLue[] | null>(null);
  const [classeId, setClasseId] = useState('');
  const [mode, setMode] = useState<Mode>('meme');
  const [profil, setProfil] = useState<ProfileId>('standard');
  const [publie, setPublie] = useState<{ code: string; mode: Mode } | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let actif = true;
    suivi
      .classes()
      .then((l) => {
        if (!actif) return;
        const miennes = l.filter((c) => c.proprietaire);
        setClasses(miennes);
        setClasseId((prec) => (miennes.some((c) => c.id === prec) ? prec : (miennes[0]?.id ?? '')));
      })
      .catch(() => {
        if (actif) setClasses([]);
      });
    return () => {
      actif = false;
    };
  }, [suivi]);

  const chargerPublications = useCallback(async () => {
    if (classeId === '') {
      setPublications([]);
      return;
    }
    try {
      setPublications(await partage.publications(classeId));
    } catch {
      // La liste reste telle quelle ; publier reste possible.
    }
  }, [partage, classeId]);

  useEffect(() => {
    setPublie(null);
    void chargerPublications();
  }, [chargerPublications]);

  const classe = classes?.find((c) => c.id === classeId) ?? null;

  async function proposer() {
    setOccupe(true);
    setErreur('');
    setMessage('');
    try {
      const code = await partage.publier(classeId, brouillon, mode, mode === 'groupes' ? 'standard' : profil, publie?.code);
      setPublie({ code, mode });
      await chargerPublications();
    } catch (e) {
      setErreur(messageDe(e));
    } finally {
      setOccupe(false);
    }
  }

  async function retirer(code: string) {
    setErreur('');
    try {
      await partage.retirer(code);
      if (publie?.code === code) setPublie(null);
      await chargerPublications();
    } catch (e) {
      setErreur(messageDe(e));
    }
  }

  async function copierLien(lien: string) {
    try {
      await copier(lien);
      setMessage('Lien copié.');
    } catch {
      setMessage('Copie impossible : sélectionnez le lien et copiez-le.');
    }
  }

  if (classes === null) return <p role="status">Chargement de vos classes…</p>;
  if (classes.length === 0) return <p>Créez d’abord une classe dans Mes classes.</p>;

  const liens: { lien: string; titre: string; couleur?: string }[] = publie
    ? publie.mode === 'groupes'
      ? GROUPES.map((g) => ({ lien: lienActivite(origine, publie.code, g), titre: `Groupe ${COULEURS_GROUPES[g]}`, couleur: COULEURS_GROUPES[g] }))
      : [{ lien: lienActivite(origine, publie.code), titre: 'Lien de l’activité' }]
    : [];

  return (
    <section aria-label="Proposer à la classe" className="publier-activite">
      <h3>Proposer à la classe</h3>
      <AideEcran id="proposer" />
      <div className="champs">
        <div>
          <label htmlFor="pub-classe">Classe</label>
          <select id="pub-classe" value={classeId} aria-describedby="pub-classe-aide" onChange={(e) => setClasseId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <p id="pub-classe-aide" className="aide">
            {`La classe qui reçoit l’activité : les résultats des élèves arrivent dans son tableau de bord, et le lien est supprimé avec la classe${classe ? `, le ${dateFr(classe.purgeLe)}` : ''}.`}
          </p>
        </div>
        <div>
          <label htmlFor="pub-mode">Façon de décider du niveau</label>
          <select id="pub-mode" value={mode} aria-describedby="pub-mode-aide" onChange={(e) => setMode(e.target.value as Mode)}>
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <p id="pub-mode-aide" className="aide">
            Même niveau : un seul lien. Un lien par groupe : trois liens de couleurs différentes, à distribuer à chaque groupe. Niveau par code : le niveau de chaque élève est fixé dans Mes classes. Dans tous les cas, l’élève peut ensuite rejouer un niveau au-dessus.
          </p>
        </div>
        {mode !== 'groupes' && (
          <div>
            <label htmlFor="pub-profil">Niveau de départ</label>
            <select id="pub-profil" value={profil} aria-describedby="pub-profil-aide" onChange={(e) => setProfil(e.target.value as ProfileId)}>
              {(Object.keys(PROFILE_LABELS) as ProfileId[]).map((p) => (
                <option key={p} value={p}>{PROFILE_LABELS[p]}</option>
              ))}
            </select>
            <p id="pub-profil-aide" className="aide">
              Le niveau joué par tous les élèves. En mode « niveau par code », il ne sert que si le niveau d’un code ne peut pas être chargé. L’élève ne voit pas le nom de ce niveau.
            </p>
          </div>
        )}
      </div>
      {erreur !== '' && <p role="alert" className="raisons">{erreur}</p>}
      <p className="aide">Avant de proposer : l’activité sera lisible par quiconque a le lien. Vérifier qu’elle ne contient ni prénom ni nom d’élève.</p>
      <button type="button" onClick={proposer} disabled={occupe || classeId === ''}>{publie ? 'Mettre à jour le lien' : 'Proposer à la classe'}</button>

      {publie && (
        <div className="liens-partage">
          {publie.mode === 'par-code' && <p className="aide">Définissez le niveau de chaque code dans Mes classes, « Niveaux par code ».</p>}
          {liens.map((l) => (
            <div key={l.lien}>
              <h4>{l.titre}</h4>
              <CodeQr lien={l.lien} libelle={`${brouillon.titre}, ${l.titre.toLowerCase()}`} />
              <p className="lien-partage">{l.lien}</p>
              <button type="button" onClick={() => void copierLien(l.lien)}>{l.couleur ? `Copier le lien du groupe ${l.couleur}` : 'Copier le lien'}</button>
            </div>
          ))}
          {message !== '' && <p role="status" className="retour-court">{message}</p>}
          <button type="button" onClick={() => void retirer(publie.code)}>Retirer le lien</button>
        </div>
      )}

      {publications.length > 0 && (
        <ul aria-label="Activités déjà proposées">
          {publications.map((p) => (
            <li key={p.code}>
              {`${p.titre}, ${libelleMode(p.mode)}, code ${p.code}, mise à jour le ${dateFr(p.majLe)} `}
              <button type="button" onClick={() => void retirer(p.code)}>{`Retirer le lien « ${p.titre} »`}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
