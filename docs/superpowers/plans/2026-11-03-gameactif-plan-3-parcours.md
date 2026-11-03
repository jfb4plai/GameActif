# GameActif, plan 3 : parcours niveau, matière, compétences, atelier de saisie

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'enseignant de choisir un niveau, une matière et 1 à 3 compétences visées du programme, de taper ses propres éléments, puis d'arriver sur la page des jeux sur écran et des jeux physiques en regard.

**Architecture:** Les données du référentiel (maths P1 à P6) alimentent un catalogue pur (`src/data/catalogue.ts`). Un module pur transforme le brouillon saisi en `Activity` du moteur (`src/atelier/`). Un réducteur pur gère les étapes du parcours (`src/parcours/`). L'interface React ne fait que le rendu. L'écran des jeux du plan 2 (`ActivityScreen`) est réutilisé tel quel. Tout reste dans le navigateur : pas d'IA, pas de base, pas d'envoi.

**Tech Stack:** React 18, Vite 5, TypeScript 5 strict, Vitest 2, @testing-library/react, jsdom (déjà en place, plans 1 et 2).

**Spec:** `gameactif/docs/superpowers/specs/2026-11-03-gameactif-avenant-referentiel.md` (sections 4, 12, 13) et `gameactif/docs/superpowers/specs/2026-10-01-gameactif-design.md` (sections 5, 7).

## Global Constraints

- « Arial, 16 px minimum, cibles de 44 px minimum, une idée par écran. » (spec §10). Charte gazette du plan 2.
- **Guidage contextuel sur chaque champ de saisie** (règle PLAI) : un label précis, un placeholder avec un exemple réel, un texte d'aide sous le champ qui dit à quoi sert la saisie.
- « Retours : formulation bienveillante, jamais de « Faux » rouge. » Messages d'erreur de saisie : dire quoi corriger et où (numéro de ligne), sans reproche.
- Aucun nom d'élève à saisir : le champ de contexte le rappelle. Rien n'est envoyé hors du navigateur. Aucun `console.log` de données saisies.
- Codes d'attendus : forme `M.P4.1.1.i1.a1` (matière, année, sous-point, item, attendu), produits par `scripts/build-referentiel.mjs`.
- 1 à 3 attendus visés par activité (avenant §4, `validateCibles` du moteur).
- Pas de tiret cadratin dans les textes d'interface ; vocabulaire FWB (primaire P1 à P6).
- Aucune phrase de lien avec le programme n'est inventée hors pilote : « À compléter par l'enseignant » (avenant §12).
- Les éléments tapés par l'enseignant sont `origin: 'manuel'`, `validated: true` (avenant §13, hypothèse à confirmer).

## Review Focus

1. Un même mot tapé dans deux familles de Trier : le brouillon est refusé et le message nomme le mot. Test en tâche 2.
2. Une ligne de paires sans séparateur : erreur avec son numéro de ligne, sans exception. Test en tâche 2.
3. Changement de niveau après le choix de compétences : les compétences d'un autre niveau sont retirées, aucun code `M.P3` ne reste avec le niveau P5. Test en tâche 3.
4. Stockage local absent, bloqué ou contenant un brouillon corrompu : démarrage propre à l'étape 1, sans plantage. Test en tâche 3.
5. Quatrième compétence cochée : refus avec un message, les trois premières restent. Test en tâche 4.

---

## Structure des fichiers

```
gameactif/
  scripts/build-referentiel.mjs     étendu à P1-P6, champ matiere ajouté
  data/referentiel-maths-p3-p4.json renommé data/referentiel-maths.json (861 attendus)
  src/data/referentiel.ts           lit le nouveau fichier
  src/data/catalogue.ts             niveaux, matières, compétences groupées
  src/atelier/types.ts, brouillon.ts   brouillon, analyse des lignes, construction de l'Activity
  src/parcours/etapes.ts            réducteur des étapes, validité par étape
  src/parcours/stockage.ts          chargement et sauvegarde du brouillon (stockage local)
  src/ui/Parcours.tsx               cadre des étapes
  src/ui/EtapeNiveau.tsx, EtapeMatiere.tsx, EtapeCompetences.tsx, EtapeElements.tsx
  tests/data/*, tests/atelier/*, tests/parcours/*, tests/ui/parcours*.test.tsx
```

---

### Task 0: Données du référentiel, maths P1 à P6

**Files:**
- Modify: `scripts/build-referentiel.mjs`, `src/data/referentiel.ts`, `tests/physical/programme.test.ts`, `tests/referentiel-data.test.ts`
- Rename: `data/referentiel-maths-p3-p4.json` vers `data/referentiel-maths.json`
- Test: `tests/data/referentiel.test.ts`

**Interfaces:**
- Consumes : `referentiels-fwb/maths/P1.json` à `P6.json` (structure `champs > sous_points > items > attendus`).
- Produces : `ReferentielEntry` gagne `matiere: string` (valeur `'mathematiques'`) et `item_type: string` ; `REFERENTIEL` compte 861 entrées ; `referentielCodes()` inchangé.

- [ ] **Step 1: Écrire le test qui échoue.** `tests/data/referentiel.test.ts` : par année P1 à P6, les comptes valent 73, 122, 150, 173, 176, 167 ; total 861 ; codes uniques ; chaque entrée a `matiere === 'mathematiques'` et un `item_type` parmi Savoir, Savoir-faire, Compétence ; les codes de la forme `M.P4.1.1.i1.a1` existent toujours (pilote).
- [ ] **Step 2: Lancer** `npx vitest run tests/data/referentiel.test.ts`. Expected : FAIL (323 entrées, pas de P1, P2, P5, P6).
- [ ] **Step 3: Étendre `scripts/build-referentiel.mjs`** : années P1 à P6, table `ATTENDUS_ATTENDUS = { P1: 73, P2: 122, P3: 150, P4: 173, P5: 176, P6: 167 }` (le script échoue si un compte change), champs `matiere` et `item_type` ajoutés aux entrées, sortie `data/referentiel-maths.json` et `previsualisation/referentiel-data.js`. Mettre à jour `src/data/referentiel.ts` (import du nouveau fichier, interface étendue).
- [ ] **Step 4: Mettre à jour les anciens tests** : `programme.test.ts` (« expose 861 attendus ») et `referentiel-data.test.ts` (chemin du fichier, comptes P3 et P4 inchangés).
- [ ] **Step 5: Lancer** `npm run build:referentiel && npx vitest run && npm run typecheck`. Expected : « OK : 861 attendus », tous les tests passent.
- [ ] **Step 6: Commit.** `git add -A . && git commit -m "feat(data): référentiel de mathématiques P1 à P6 (861 attendus)"`.

---

### Task 1: Catalogue (niveaux, matières, compétences)

**Files:**
- Create: `src/data/catalogue.ts`
- Test: `tests/data/catalogue.test.ts`

**Interfaces:**
- Consumes : `REFERENTIEL`, `ReferentielEntry`.
- Produces :
  - `interface Matiere { id: string; label: string }`
  - `interface GroupeCompetences { sousPoint: string; titre: string; attendus: ReferentielEntry[] }`
  - `function niveaux(): string[]` (triés P1 à P6, présents dans les données)
  - `function matieres(niveau: string): Matiere[]` (libellé : `mathematiques` donne « Mathématiques »)
  - `function competences(niveau: string, matiere: string): GroupeCompetences[]` (par sous-point, ordre du référentiel)
  - `function chercher(groupes: GroupeCompetences[], texte: string): GroupeCompetences[]` (filtre insensible à la casse et aux accents sur le texte officiel, groupes vides retirés)

- [ ] **Step 1: Écrire les tests qui échouent.** `niveaux()` égale `['P1','P2','P3','P4','P5','P6']` ; `matieres('P4')` égale `[{ id: 'mathematiques', label: 'Mathématiques' }]` ; `matieres('S1')` est vide ; `competences('P4','mathematiques')` compte 11 groupes dont le premier a `sousPoint '1.1'` et 11 attendus ; la somme des attendus des groupes vaut 173 ; `competences('P9','mathematiques')` est vide ; `chercher(groupes, 'POSITIONS relatives')` garde le groupe 1.1 et retrouve l'attendu `M.P4.1.1.i1.a2` ; `chercher(groupes, 'zzzz')` est vide ; `chercher(groupes, 'etape')` ignore les accents (« étape » trouvé si présent dans les données, sinon test sur « deplacer » qui trouve « déplacer »).
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter** les quatre fonctions ; libellés de matière dans une table `{ mathematiques: 'Mathématiques' }` ; une matière inconnue de la table garde son identifiant comme libellé.
- [ ] **Step 4: Lancer** `npx vitest run tests/data && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(data): catalogue des niveaux, matières et compétences"`.

---

### Task 2: Brouillon vers activité (module pur)

**Files:**
- Create: `src/atelier/types.ts`, `src/atelier/brouillon.ts`
- Test: `tests/atelier/brouillon.test.ts`

**Interfaces:**
- Consumes (plan 1) : `Activity`, `Item`, `availableMechanics`, `canPublish`.
- Produces :
  - `interface Famille { label: string; elements: string }` (éléments en texte, un par ligne)
  - `interface Brouillon { niveau: string; matiere: string; cibles: string[]; titre: string; contexte: string; familles: Famille[]; paires: string; etapes: string }`
  - `function brouillonVide(): Brouillon` (niveau et matière vides, 3 familles vides, tout le reste vide)
  - `function lignes(texte: string): string[]` (une entrée par ligne non vide, espaces de bord retirés, espaces multiples réduits à un seul)
  - `interface Ligne { numero: number; message: string }`
  - `function analysePaires(texte: string): { paires: { gauche: string; droite: string }[]; erreurs: Ligne[] }` (séparateur « | » ; numéro de ligne compté sur le texte brut, lignes vides comprises)
  - `function problemesBrouillon(b: Brouillon): string[]` (liste vide = brouillon cohérent)
  - `function construireActivite(b: Brouillon): Activity` (lève une erreur si `problemesBrouillon` n'est pas vide)

- [ ] **Step 1: Écrire les tests qui échouent.** `lignes('  a  b \n\n c ')` donne `['a b', 'c']` ; `analysePaires('devant | derrière\nà droite')` renvoie une paire et une erreur `{ numero: 2, message: 'Il manque le séparateur « | » entre les deux éléments.' }` ; une ligne vide au milieu ne décale pas la numérotation ; `problemesBrouillon` : mot répété dans deux familles donne « Le mot « entre » est dans deux familles : Famille A et Famille B. » (Review Focus 1) ; deux paires de même gauche refusées ; un titre vide, un contexte vide, 0 compétence ou 4 compétences refusés avec des messages en français ; `construireActivite` d'un brouillon complet (2 familles de 2 mots, 2 paires, 3 étapes, 2 cibles réelles) produit une `Activity` où `availableMechanics` donne Trier, Associer et Ordre disponibles et Placer indisponible, `cibles` recopiées, tous les éléments `origin: 'manuel'` et `validated: true`, ids stables (`f1e1`, `p1g`, `p1d`, `s1`), et `canPublish(activity, referentielCodes())` est `{ ok: true }` ; les rangs suivent l'ordre des lignes d'étapes ; un brouillon qui n'a que des étapes donne seulement Ordre disponible.
- [ ] **Step 2: Lancer** `npx vitest run tests/atelier`. Expected : FAIL.
- [ ] **Step 3: Implémenter.** Un élément de Trier est classé dans la catégorie de sa famille ; une famille sans label ni élément est ignorée ; une paire donne deux éléments distincts ; une étape donne un élément et un rang. Les textes sont conservés tels quels après `lignes` (aucune troncature, apostrophes typographiques intactes).
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(atelier): du brouillon saisi à l'activité du moteur"`.

---

### Task 3: Étapes du parcours et brouillon conservé

**Files:**
- Create: `src/parcours/etapes.ts`, `src/parcours/stockage.ts`
- Test: `tests/parcours/etapes.test.ts`, `tests/parcours/stockage.test.ts`

**Interfaces:**
- Consumes : `Brouillon`, `brouillonVide`, `competences`, `matieres`.
- Produces :
  - `type Etape = 'niveau' | 'matiere' | 'competences' | 'elements' | 'jeux'` et `const ETAPES: Etape[]` (dans cet ordre)
  - `interface EtatParcours { etape: Etape; brouillon: Brouillon }`
  - `type Evenement = { type: 'choisirNiveau'; niveau: string } | { type: 'choisirMatiere'; matiere: string } | { type: 'basculerCible'; code: string } | { type: 'modifier'; champ: Partial<Brouillon> } | { type: 'suivant' } | { type: 'precedent' } | { type: 'aller'; etape: Etape } | { type: 'recommencer' }`
  - `function reduire(etat: EtatParcours, ev: Evenement): EtatParcours`
  - `function problemesEtape(etat: EtatParcours): string[]` (liste vide = on peut passer à l'étape suivante)
  - `interface Stockage { getItem(k: string): string | null; setItem(k: string, v: string): void }`
  - `function chargerBrouillon(s: Stockage | null): EtatParcours`, `function sauverBrouillon(s: Stockage | null, e: EtatParcours): void` (clé `gameactif.brouillon.v1`)

- [ ] **Step 1: Écrire les tests qui échouent.**
  - `etapes.test.ts` : l'état de départ est à l'étape `niveau` ; `suivant` sans niveau reste à `niveau` et `problemesEtape` dit « Choisissez un niveau. » ; choisir P4 puis `suivant` passe à `matiere` ; choisir une matière absente des données est refusé ; à `competences`, `suivant` exige 1 à 3 cibles ; `basculerCible` ajoute puis retire un code, et refuse un 4e (état inchangé) ; **changer de niveau retire les cibles des autres niveaux et remet la matière à vide si elle n'existe plus pour ce niveau** (Review Focus 3) ; à `elements`, `suivant` exige titre, contexte et un brouillon sans problème (`problemesBrouillon`) avec au moins un jeu disponible ; `precedent` revient d'une étape sans rien effacer ; `recommencer` rend `brouillonVide` à l'étape `niveau` ; `aller` vers une étape en avant n'est possible que si les étapes précédentes sont valides.
  - `stockage.test.ts` : aller-retour de sauvegarde et chargement donne l'état identique ; stockage `null` ne lève pas d'exception et rend l'état de départ ; JSON invalide, valeur d'un autre type, ou version inconnue rendent l'état de départ (Review Focus 4) ; un `setItem` qui lève (quota, mode privé) est avalé sans exception ; l'état sauvegardé ne contient jamais l'étape `jeux` (retour à `elements` au rechargement).
- [ ] **Step 2: Lancer** `npx vitest run tests/parcours`. Expected : FAIL.
- [ ] **Step 3: Implémenter** `reduire` et `problemesEtape` en fonctions pures ; le stockage valide la forme du JSON lu (types des champs) avant de l'accepter.
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(parcours): étapes, validité par étape et brouillon conservé"`.

---

### Task 4: Étapes 1 à 3 (niveau, matière, compétences)

**Files:**
- Create: `src/ui/EtapeNiveau.tsx`, `src/ui/EtapeMatiere.tsx`, `src/ui/EtapeCompetences.tsx`
- Modify: `src/styles/gazette.css`
- Test: `tests/ui/parcours-etapes-1-3.test.tsx`

**Interfaces:**
- Consumes : `niveaux`, `matieres`, `competences`, `chercher`, `EtatParcours`, `Evenement`.
- Produces : trois composants, chacun avec les props `{ etat: EtatParcours; envoyer: (e: Evenement) => void }`.
  - `EtapeNiveau` : un bouton par niveau (« P1 » à « P6 »), `aria-pressed` pour le niveau choisi.
  - `EtapeMatiere` : un bouton par matière du niveau ; message « Aucune matière n'est encore disponible pour ce niveau. » si la liste est vide.
  - `EtapeCompetences` : champ de recherche (label « Chercher dans les compétences », placeholder « Exemple : fractions, déplacer, ordre », aide), groupes par sous-point dans des `details`, une case par attendu avec type, code et texte officiel, compteur « n sur 3 », région `aria-live` pour les messages.

- [ ] **Step 1: Écrire les tests qui échouent** (jsdom) : six boutons de niveau ; cliquer P5 envoie `choisirNiveau`; la matière « Mathématiques » s'affiche pour P5 ; l'étape 3 affiche 11 groupes pour P4 avec le texte officiel d'un attendu connu ; cocher trois attendus puis un quatrième : la quatrième case reste décochée et le message « Trois compétences au maximum : décochez-en une avant d'en choisir une autre. » s'affiche, les trois premières restent cochées (Review Focus 5) ; la recherche « positions relatives » ne laisse que le groupe 1.1 ; chaque champ de saisie a un label, un placeholder et un texte d'aide relié par `aria-describedby`.
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter** les trois composants et leur style (reprise des classes `carte`, `aide`, `etiquette`). Le message d'aide de l'étape 3 dit ce que les jeux savent faire et ne pas faire (avenant §13, limite) : classer, relier, ordonner oui ; tracer, mesurer, construire non.
- [ ] **Step 4: Lancer** `npx vitest run tests/ui && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ui): étapes niveau, matière et compétences visées"`.

---

### Task 5: Étape 4, saisie guidée des éléments

**Files:**
- Create: `src/ui/EtapeElements.tsx`
- Test: `tests/ui/parcours-etape-4.test.tsx`

**Interfaces:**
- Consumes : `Brouillon`, `lignes`, `analysePaires`, `problemesBrouillon`, `construireActivite`, `availableMechanics`, `Evenement`.
- Produces : `EtapeElements` (props `{ etat: EtatParcours; envoyer: (e: Evenement) => void }`) : champs titre et contexte de classe, trois familles (label de famille et zone d'éléments, un par ligne), zone de paires (une par ligne, « gauche | droite »), zone d'étapes (une par ligne, dans l'ordre). Sous les champs : pour chaque jeu, « Disponible » ou le message du moteur (`missing`) ; liste des problèmes du brouillon avec numéros de ligne.

- [ ] **Step 1: Écrire les tests qui échouent** : le contexte a pour label « Contexte de classe », un placeholder « Exemple : 18 élèves de 4e primaire, vocabulaire de position travaillé la semaine dernière », une aide qui rappelle de ne saisir aucun nom d'élève ; chaque zone a label, placeholder réel et aide ; taper deux paires valides et un séparateur manquant à la ligne 3 affiche « Ligne 3 : il manque le séparateur « | » entre les deux éléments. » ; taper un mot dans deux familles affiche le message du test de la tâche 2 ; les statuts « Disponible » et le message du moteur (« Il faut au moins 2 paires. ») se mettent à jour à la saisie ; les saisies passent par `envoyer({ type: 'modifier', champ })` ; une zone peut contenir une apostrophe typographique et un texte de 90 caractères sans être modifiés.
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter.** Les erreurs de ligne et les problèmes s'affichent dans une région `role="status"` ; aucune erreur n'est bloquante avant le clic sur « Suivant ».
- [ ] **Step 4: Lancer** `npx vitest run tests/ui && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ui): saisie guidée des éléments avec statut par jeu"`.

---

### Task 6: Cadre du parcours et branchement dans l'application

**Files:**
- Create: `src/ui/Parcours.tsx`
- Modify: `src/App.tsx`
- Test: `tests/ui/parcours.test.tsx`, `tests/ui/app.test.tsx`

**Interfaces:**
- Consumes : `reduire`, `problemesEtape`, `chargerBrouillon`, `sauverBrouillon`, `construireActivite`, `ActivityScreen`, `activitePilote`, les cinq étapes.
- Produces : `Parcours` (sans props) : indicateur d'étape (« Étape 2 sur 5 : Matière »), étape courante, boutons « Précédent » et « Suivant » (désactivé tant que `problemesEtape` n'est pas vide, avec le message sous le bouton), bouton « Recommencer », bouton « Voir l'exemple des positions (P4) » qui ouvre `ActivityScreen` avec `activitePilote()`, étape `jeux` = `ActivityScreen` de l'activité construite plus un bouton « Modifier mes éléments ».

- [ ] **Step 1: Écrire les tests qui échouent** : parcours complet au clavier seul (niveau P4, matière, deux compétences, éléments d'un brouillon valide, étape des jeux) jusqu'à voir « Jeu sur écran : Trier » ; « Suivant » désactivé et message visible à chaque étape incomplète ; l'étape des jeux n'affiche pas « Placer dans une scène » pour une activité saisie ; le lien programme d'un attendu non pilote affiche « À compléter par l'enseignant » ; « Voir l'exemple des positions (P4) » affiche les quatre jeux ; rechargement (nouveau rendu avec le même stockage) revient à l'étape des éléments avec le texte saisi ; `App` affiche toujours le titre « GameActif » et le logo.
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter** `Parcours` avec `useReducer(reduire, …)`, sauvegarde du brouillon à chaque changement (stockage local dans `try/catch`), focus placé sur le titre de l'étape au changement d'étape. `App` rend `Parcours` à la place de `ActivityScreen` seul.
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck && npm run build`. Expected : PASS, build sans erreur.
- [ ] **Step 5: Commit.** `git commit -m "feat(ui): parcours niveau, matière, compétences, éléments puis jeux"`.

---

### Task 7: Vérification réelle et sauvegarde

**Files:**
- Modify: `memory/gameactif-session-prompt.md` (workspace parent)

- [ ] **Step 1: Suite et build.** `npm test && npm run typecheck && npm run build`. Expected : tout au vert.
- [ ] **Step 2: Parcours réel dans le navigateur** (`npm run dev`, port 5196) : P5 puis Mathématiques, deux compétences de nombres (exemple : un attendu sur les fractions), saisie de paires et d'étapes réalistes, page des jeux, un tour de Trier et d'Associer à la souris, ouverture d'une fiche physique et de son lien avec le programme. Noter chaque constat avec sa preuve ; ce qui n'est pas vu reste « non vérifié ».
- [ ] **Step 3: Cas limites vus à l'écran.** Séparateur manquant, mot en double, quatrième compétence, changement de niveau après choix, actualisation de la page avec un brouillon en cours.
- [ ] **Step 4: Mettre à jour le fil conducteur** et demander l'accord de JF avant tout `git push`.

---

## Auto-revue contre la spec

| Exigence | Tâche |
|---|---|
| Avenant §13 : niveau, matière, compétences visées, puis jeux | 1, 3, 4, 6 |
| Avenant §13 : couverture maths P1 à P6, comptes par année | 0 |
| Avenant §13 : éléments tapés `manuel` et validés, Placer exclu de l'atelier | 2 |
| Avenant §13 : brouillon dans le navigateur, aucun nom d'élève | 3, 5 |
| Avenant §4 : 1 à 3 cibles, texte officiel affiché | 3, 4 |
| Avenant §12 : phrase de lien absente hors pilote, « À compléter » | 6 |
| Guidage de champ (label, placeholder, aide) | 4, 5 |
| Avenant §13, limite : ce que les jeux savent faire et ne pas faire | 4 |

Hors de ce plan : français et autres matières (adaptateur par matière), proposition d'éléments par l'IA et import .docx (plan suivant), base de données et HubActif, tableau de bord, bibliothèque de scènes au-delà de « chat ».

Noms utilisés d'une tâche à l'autre, vérifiés : `niveaux`, `matieres`, `competences`, `chercher`, `GroupeCompetences`, `Brouillon`, `brouillonVide`, `lignes`, `analysePaires`, `problemesBrouillon`, `construireActivite`, `EtatParcours`, `Evenement`, `reduire`, `problemesEtape`, `chargerBrouillon`, `sauverBrouillon`.
