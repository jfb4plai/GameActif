import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, ProfileId } from '../engine/types.js';
import {
  construirePrompt,
  construirePromptLibre,
  contexteLibreValide,
  CONTEXTE_MAX,
  CONTEXTE_MIN,
  modesDisponibles,
  VERIFICATION,
  VERIFICATION_LIBRE,
} from '../prompts/construire.js';
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

/**
 * Mode Libre : l'IA choisit la mécanique et invente le contenu. L'apport de l'enseignant est visible et obligatoire :
 * un contexte de classe d'au moins 20 caractères (prérempli depuis l'activité, modifiable) et la relecture cochée.
 */
function CarteLibre({
  activity,
  profile,
  graine,
  copier,
  telecharger,
}: {
  activity: Activity;
  profile: ProfileId;
  graine: number;
  copier: Copier;
  telecharger: Telecharger;
}) {
  const [contexte, setContexte] = useState(() => activity.context.slice(0, CONTEXTE_MAX));
  const coupe = activity.context.length > CONTEXTE_MAX;
  const [relu, setRelu] = useState(false);
  const [etat, setEtat] = useState<'rien' | 'copie' | 'echec'>('rien');
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLTextAreaElement>(null);
  const valide = contexteLibreValide(contexte);
  const pret = valide && relu;
  const prompt = useMemo(
    () => (valide ? construirePromptLibre(activity, profile, graine, contexte) : null),
    [activity, profile, graine, contexte, valide],
  );

  useEffect(() => setEtat('rien'), [prompt?.texte]);

  useEffect(() => {
    if (etat !== 'echec') return;
    zone.current?.focus();
    zone.current?.select();
  }, [etat, ouvert]);

  async function copierLeTexte() {
    if (!pret || !prompt) return;
    try {
      await copier(prompt.texte);
      setEtat('copie');
    } catch {
      setOuvert(true);
      setEtat('echec');
    }
  }

  function telechargerLeTexte() {
    if (!pret || !prompt) return;
    telecharger(`prompt-libre-${simplifier(activity.title)}.txt`, prompt.texte);
  }

  return (
    <section className="carte mode-arcade" aria-labelledby="mode-libre">
      <h3 id="mode-libre">Libre : l'IA choisit le jeu</h3>
      <p>L'IA choisit la forme de jeu qui convient à la compétence visée et invente le contenu à partir de votre contexte de classe.</p>
      <div className="champ">
        <label htmlFor="contexte-libre">Votre contexte de classe</label>
        <textarea
          id="contexte-libre"
          rows={4}
          maxLength={CONTEXTE_MAX}
          placeholder="Exemple : 18 élèves de 4e primaire, plusieurs élèves dyslexiques, vocabulaire de position vu la semaine dernière"
          value={contexte}
          aria-describedby="contexte-libre-aide"
          onChange={(e) => setContexte(e.target.value)}
        />
        <p id="contexte-libre-aide" className="aide">
          Ce texte sert à adapter le jeu et son contenu à votre classe. N’y mettre aucun nom d’élève. Il n’est pas enregistré. Minimum {CONTEXTE_MIN} caractères.
        </p>
        {coupe && <p className="aide">{`Votre contexte a été raccourci à ${CONTEXTE_MAX} caractères.`}</p>}
      </div>
      <label className="case-relecture">
        <input type="checkbox" checked={relu} onChange={(e) => setRelu(e.target.checked)} /> Je relirai le contenu et le corrigé avant de le donner aux élèves.
      </label>
      <div className="actions-prompt">
        <button type="button" disabled={!pret} aria-describedby={pret ? undefined : 'libre-raison'} onClick={copierLeTexte}>
          Copier le prompt : Libre
        </button>
        <button type="button" disabled={!pret} aria-describedby={pret ? undefined : 'libre-raison'} onClick={telechargerLeTexte}>
          Télécharger le prompt (.txt) : Libre
        </button>
      </div>
      {!pret && (
        <p id="libre-raison" className="aide">
          Pour copier le prompt : écrire un contexte d’au moins {CONTEXTE_MIN} caractères et cocher la case de relecture.
        </p>
      )}
      <p className="retour-court" role="status">
        {etat === 'copie' ? 'Prompt copié.' : etat === 'echec' ? MESSAGE_ECHEC : ''}
      </p>
      <details open={ouvert} onToggle={(e) => setOuvert((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Lire le prompt</summary>
        <textarea ref={zone} readOnly rows={12} aria-label="Prompt : Libre" value={prompt?.texte ?? ''} />
      </details>
      <ol aria-label="Étapes : Libre" className="etapes-prompt">
        <li>Écrire votre contexte et cocher la case de relecture.</li>
        <li>Copier le prompt (bouton ci-dessus).</li>
        <li>Ouvrir votre Claude et coller le prompt.</li>
        <li>Jouer au jeu qui s'affiche, puis lire la fiche de contrôle sous le jeu.</li>
        <li>Corriger ou refaire le jeu si le contenu ne convient pas.</li>
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
      <CarteLibre activity={activity} profile={profile} graine={graine} copier={copier} telecharger={telecharger} />
      <h3>À vérifier avant de donner le jeu aux élèves</h3>
      <ul className="verification-prompt">
        {VERIFICATION.map((v) => <li key={v}>{v}</li>)}
      </ul>
      <h4>En plus pour le mode Libre</h4>
      <ul className="verification-prompt">
        {VERIFICATION_LIBRE.map((v) => <li key={v}>{v}</li>)}
      </ul>
      <p className="aide">GameActif n'a aucun moyen de vérifier ce que l'IA produit : c'est votre part.</p>
    </div>
  );
}
