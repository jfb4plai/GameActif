import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, ProfileId } from '../engine/types.js';
import { construirePrompt, CONTEXTE_MAX, modesDisponibles, VERIFICATION } from '../prompts/construire.js';
import { MODES, type ModeArcade } from '../prompts/types.js';

type Copier = (texte: string) => Promise<void>;
type Telecharger = (nom: string, contenu: string) => void;

const MESSAGE_ECHEC = 'La copie automatique n\'a pas fonctionné. Sélectionnez le texte ci-dessous et copiez-le.';

async function copierDansPressePapiers(texte: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error('Presse-papiers indisponible');
  await navigator.clipboard.writeText(texte);
}

/** Téléchargement par un lien temporaire ; la mémoire du fichier est libérée juste après. */
function telechargerParLien(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/plain;charset=utf-8' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** « Les positions dans l’espace » devient « les-positions-dans-l-espace » (nom de fichier sûr). */
function simplifier(titre: string): string {
  const s = titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return s === '' ? 'activite' : s;
}

function CarteMode({
  activity,
  mode,
  profile,
  graine,
  copier,
  telecharger,
  contexte,
}: {
  activity: Activity;
  mode: ModeArcade;
  profile: ProfileId;
  graine: number;
  copier: Copier;
  telecharger: Telecharger;
  contexte: string;
}) {
  const prompt = useMemo(() => construirePrompt(activity, mode, profile, graine, contexte), [activity, mode, profile, graine, contexte]);
  const [etat, setEtat] = useState<'rien' | 'copie' | 'echec'>('rien');
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLTextAreaElement>(null);
  const nom = MODES[mode].nom;

  // Un nouveau profil donne un nouveau texte : l'ancienne confirmation ne le concerne plus.
  useEffect(() => setEtat('rien'), [prompt.texte]);

  useEffect(() => {
    if (etat !== 'echec') return;
    zone.current?.focus();
    zone.current?.select();
  }, [etat, ouvert]);

  async function copierLeTexte() {
    try {
      await copier(prompt.texte);
      setEtat('copie');
    } catch {
      setOuvert(true);
      setEtat('echec');
    }
  }

  return (
    <section className="carte mode-arcade" aria-labelledby={`mode-${mode}`}>
      <h3 id={`mode-${mode}`}>{nom}</h3>
      <p>{MODES[mode].resume}</p>
      <div className="actions-prompt">
        <button type="button" onClick={copierLeTexte}>{`Copier le prompt : ${nom}`}</button>
        <button type="button" onClick={() => telecharger(`prompt-${mode}-${simplifier(activity.title)}.txt`, prompt.texte)}>
          {`Télécharger le prompt (.txt) : ${nom}`}
        </button>
      </div>
      <p className="retour-court" role="status">
        {etat === 'copie' ? 'Prompt copié.' : etat === 'echec' ? MESSAGE_ECHEC : ''}
      </p>
      <details open={ouvert} onToggle={(e) => setOuvert((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>{`Lire le prompt (${prompt.nbElements} éléments)`}</summary>
        <textarea ref={zone} readOnly rows={12} aria-label={`Prompt : ${nom}`} value={prompt.texte} />
      </details>
      <ol aria-label={`Étapes : ${nom}`} className="etapes-prompt">
        <li>Copier le prompt (bouton ci-dessus).</li>
        <li>Ouvrir votre Claude et coller le prompt.</li>
        <li>Si le jeu s'affiche dans la conversation, y jouer.</li>
        <li>Sinon, écrire à Claude : « Mets ce jeu dans un fichier HTML à télécharger. » Ouvrir ensuite le fichier par double-clic.</li>
      </ol>
    </section>
  );
}

/** Jeux arcade fabriqués par l'IA de l'enseignant à partir d'un prompt : GameActif n'envoie rien et ne vérifie rien. */
export function AutresJeux({
  activity,
  profile,
  graine = 1,
  copier = copierDansPressePapiers,
  telecharger = telechargerParLien,
}: {
  activity: Activity;
  profile: ProfileId;
  graine?: number;
  copier?: Copier;
  telecharger?: Telecharger;
}) {
  const modes = modesDisponibles(activity);
  const [contexte, setContexte] = useState('');
  return (
    <div className="autres-jeux">
      <p className="aide">Vous avez besoin de votre propre compte Claude. Rien n'est envoyé par GameActif.</p>
      <p className="avertissement" role="note">Ce jeu est fabriqué par votre IA, pas par GameActif : vérifiez-le avant de le donner aux élèves.</p>
      <div className="champ">
        <label htmlFor="contexte-prompt">Votre contexte (facultatif)</label>
        <textarea
          id="contexte-prompt"
          rows={3}
          maxLength={CONTEXTE_MAX}
          placeholder="Ex. : Classe de 4e primaire, beaucoup d'élèves aiment les animaux ; phrases très courtes."
          value={contexte}
          aria-describedby="contexte-prompt-aide"
          onChange={(e) => setContexte(e.target.value)}
        />
        <p id="contexte-prompt-aide" className="aide">Ce texte est ajouté au prompt pour le ton et les exemples. N'y mettre aucun nom d'élève. Il n'est pas enregistré.</p>
      </div>
      {modes.map((m) =>
        m.disponible ? (
          <CarteMode key={m.mode} activity={activity} mode={m.mode} profile={profile} graine={graine} copier={copier} telecharger={telecharger} contexte={contexte} />
        ) : (
          <section key={m.mode} className="carte mode-arcade" aria-labelledby={`mode-${m.mode}`}>
            <h3 id={`mode-${m.mode}`}>{MODES[m.mode].nom}</h3>
            <p>{m.raison}</p>
          </section>
        ),
      )}
      <h3>À vérifier avant de donner le jeu aux élèves</h3>
      <ul className="verification-prompt">
        {VERIFICATION.map((v) => <li key={v}>{v}</li>)}
      </ul>
      <p className="aide">GameActif n'a aucun moyen de vérifier ce que l'IA produit : c'est votre part.</p>
    </div>
  );
}
