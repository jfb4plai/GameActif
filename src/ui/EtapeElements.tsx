import { avertissementsSaisie, problemesSaisie, statutsJeux } from '../atelier/brouillon.js';
import { MECANIQUES } from '../engine/mecaniques.js';
import type { Famille } from '../atelier/types.js';
import type { EtatParcours, Evenement } from '../parcours/etapes.js';

interface Props {
  etat: EtatParcours;
  envoyer: (e: Evenement) => void;
}

interface ChampProps {
  id: string;
  label: string;
  placeholder: string;
  aide: string;
  valeur: string;
  onChange: (v: string) => void;
  multiligne?: boolean;
}

/** Un champ avec label précis, exemple réel en placeholder et texte d'aide relié (règle PLAI de guidage). */
function Champ({ id, label, placeholder, aide, valeur, onChange, multiligne }: ChampProps) {
  return (
    <div className="champ">
      <label htmlFor={id}>{label}</label>
      {multiligne ? (
        <textarea id={id} rows={4} placeholder={placeholder} aria-describedby={`${id}-aide`} value={valeur} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type="text" placeholder={placeholder} aria-describedby={`${id}-aide`} value={valeur} onChange={(e) => onChange(e.target.value)} />
      )}
      <p id={`${id}-aide`} className="aide">{aide}</p>
    </div>
  );
}

/** Les jeux saisis dans l'atelier, dans l'ordre du registre (Placer passe par une scène, pas par la saisie). */
const JEUX_SAISIS = MECANIQUES.filter((m) => m.atelier) as (typeof MECANIQUES[number] & { id: keyof ReturnType<typeof statutsJeux> })[];

export function EtapeElements({ etat, envoyer }: Props) {
  const b = etat.brouillon;
  const statuts = statutsJeux(b);
  const problemes = problemesSaisie(b);
  const avertissements = avertissementsSaisie(b);

  const modifier = (champ: Parameters<typeof envoyer>[0] extends infer E ? E extends { type: 'modifier'; champ: infer C } ? C : never : never) =>
    envoyer({ type: 'modifier', champ });
  const changerFamille = (i: number, partie: Partial<Famille>) =>
    modifier({ familles: b.familles.map((f, k) => (k === i ? { ...f, ...partie } : f)) });

  return (
    <section aria-labelledby="titre-etape">
      <h2 id="titre-etape" tabIndex={-1}>Vos éléments</h2>
      <p className="aide">
        Tapez vos propres éléments : ils servent aux jeux sur écran et aux cartes des jeux en classe. Remplissez les
        jeux que vous voulez ; les autres peuvent rester vides. Vous pouvez aussi n’en remplir aucun et passer par le
        mode Libre, avec votre IA, à l’étape suivante.
      </p>

      <Champ
        id="titre"
        label="Titre de l’activité"
        placeholder="Exemple : Les positions dans l’espace"
        aide="Ce titre s’affiche en haut de la page des jeux et sur les fiches imprimées."
        valeur={b.titre}
        onChange={(titre) => modifier({ titre })}
      />
      <Champ
        id="contexte"
        label="Contexte de classe"
        placeholder="Exemple : 18 élèves de 4e primaire, vocabulaire de position travaillé la semaine dernière"
        aide="Décrivez votre classe en une phrase : elle s’affiche sur la fiche. N’écrivez aucun nom d’élève."
        valeur={b.contexte}
        onChange={(contexte) => modifier({ contexte })}
        multiligne
      />

      <h3>Familles pour le jeu Trier</h3>
      <p className="aide">Chaque famille a un nom et ses éléments. Il faut au moins deux familles et trois éléments au total.</p>
      {b.familles.map((f, i) => (
        <div key={i} className="famille">
          <Champ
            id={`famille-nom-${i + 1}`}
            label={`Nom de la famille ${i + 1}`}
            placeholder="Exemple : Position absolue"
            aide="Le nom que verront les élèves sur la boîte ou la zone où ranger les éléments."
            valeur={f.label}
            onChange={(label) => changerFamille(i, { label })}
          />
          <Champ
            id={`famille-elements-${i + 1}`}
            label={`Éléments de la famille ${i + 1}`}
            placeholder="Exemple : à l’intérieur"
            aide="Un élément par ligne. Un même mot ne peut pas être dans deux familles."
            valeur={f.elements}
            onChange={(elements) => changerFamille(i, { elements })}
            multiligne
          />
        </div>
      ))}

      <h3>Paires pour les jeux Associer et Mémo</h3>
      <Champ
        id="paires"
        label="Paires à relier"
        placeholder="Exemple : devant | derrière"
        aide="Une paire par ligne : l’élément de gauche, une barre verticale |, puis son partenaire. Il faut au moins deux paires."
        valeur={b.paires}
        onChange={(paires) => modifier({ paires })}
        multiligne
      />

      <h3>Étapes pour le jeu Remettre en ordre</h3>
      <Champ
        id="etapes"
        label="Étapes dans l’ordre"
        placeholder="Exemple : premier"
        aide="Une étape par ligne, dans le bon ordre : l’application les mélange pour les élèves. Il faut au moins trois étapes."
        valeur={b.etapes}
        onChange={(etapes) => modifier({ etapes })}
        multiligne
      />

      <h3>Comparaisons pour le jeu Comparer</h3>
      <Champ
        id="comparaisons"
        label="Nombres à comparer"
        placeholder="Exemple : 12 | 8"
        aide="Une comparaison par ligne : deux nombres séparés par une barre verticale |. L’application calcule le symbole juste, vous ne le tapez pas. Entiers, décimaux (3,5) et fractions (3/4) sont acceptés. Il faut au moins trois lignes."
        valeur={b.comparaisons}
        onChange={(comparaisons) => modifier({ comparaisons })}
        multiligne
      />

      <h3>Questions pour le QCM libre</h3>
      <Champ
        id="qcm"
        label="Questions et réponses"
        placeholder="Exemple : Quel symbole veut dire « plus grand que » ? | > | < | ="
        aide="Une question par ligne : la question, la bonne réponse, puis une à trois fausses réponses, séparées par une barre verticale |. Écrivez toujours la bonne réponse en premier : l’application mélange l’ordre pour les élèves. Il faut au moins trois questions."
        valeur={b.qcm}
        onChange={(qcm) => modifier({ qcm })}
        multiligne
      />

      <h3>Jeux disponibles</h3>
      <ul className="statuts-jeux">
        {JEUX_SAISIS.map((m) => (
          <li key={m.id}>{`${m.label} : ${statuts[m.id].available ? 'Disponible' : statuts[m.id].missing}`}</li>
        ))}
      </ul>

      <div role="status" aria-live="polite" className="problemes-saisie">
        {problemes.length > 0 && (
          <>
            <p><strong>À corriger :</strong></p>
            <ul>{problemes.map((p) => <li key={p}>{p}</li>)}</ul>
          </>
        )}
        {avertissements.length > 0 && (
          <>
            <p><strong>À vérifier :</strong></p>
            <ul>{avertissements.map((a) => <li key={a}>{a}</li>)}</ul>
          </>
        )}
      </div>
    </section>
  );
}
