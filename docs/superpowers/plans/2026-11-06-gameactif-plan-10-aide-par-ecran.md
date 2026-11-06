# GameActif plan 10 : aide repliable sur chaque écran et modes d'emploi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque écran de GameActif a un bloc d'aide repliable (5 puces au plus, une limite honnête, une source dans le code pour chaque affirmation), et les mêmes textes alimentent deux modes d'emploi HTML pour le portail PLAI.

**Architecture:** Les textes vivent une seule fois dans `src/aide/textes.json`. Un composant `AideEcran` les affiche dans un `<details>` fermé par défaut. Un script génère les modes d'emploi HTML à partir du même fichier. Des tests imposent la forme (longueur, nombre de puces, infinitif pour l'élève) et vérifient que chaque source citée existe dans le dépôt.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library, `axe-core` (déjà installé), Node pour le script de génération.

**Spec:** la présente section « Constats et décisions » (demande de JF du 2026-11-06 : « sur chaque page, quelques explications pour optimiser l'utilisation » ; forme validée : bloc repliable, 5 lignes au plus, en puces, sourcé).

## Constats et décisions

- Constaté : chaque champ a déjà un label, un exemple et une aide (règle PLAI) ; il manque l'aide au niveau de l'écran. Les écrans à documenter, d'après `src/ui/` : les cinq étapes du parcours (`EtapeNiveau`, `EtapeMatiere`, `EtapeCompetences`, `EtapeElements`, jeux), `PublierActivite`, `MesClasses`, `TableauDeBord`, `NiveauxParCode`, `VueEleve`.
- Décision de JF : bloc repliable, fermé par défaut, 5 lignes au plus, en puces. [JF]
- Choix de Claude, à confirmer : une puce « limite » par écran enseignant (« ce que l'outil ne fait pas », question de conception du `CLAUDE.md`) ; vouvoiement pour l'enseignant, infinitif sans pronom pour l'élève (une action par puce) ; l'élève peut écouter son aide avec la synthèse vocale du navigateur (`useSpeech`) ; la page Confidentialité garde son propre texte et n'a pas de bloc.
- Textes : copie exacte dans l'annexe ci-dessous ; JF les relit avant exécution.

## Global Constraints

- Une seule source de texte : `src/aide/textes.json`. Aucun texte d'aide écrit en dur dans un composant.
- Au plus 5 puces par aide, 140 caractères au plus par puce, plus une `limite` facultative de 140 caractères au plus.
- Chaque aide cite au moins une source : un chemin du dépôt qui existe. Aucune phrase sur un comportement sans source.
- Élève : puces à l'infinitif, une action par puce, aucun nom de niveau (« Soutien » interdit), aucune adresse e-mail.
- Aucun tiret cadratin (U+2014) dans le dépôt ; police 16 px minimum ; bloc fermé par défaut ; masqué à l'impression (`hors-impression`).
- Contact des modes d'emploi PLAI : `jeanfrancois.beguin@ens.ecl.be`.
- Pas de `git push` hors branche de travail, pas de modification du dépôt `portail-plai`, pas de déploiement sans accord explicite de JF.
- `npx tsc --noEmit`, `npx vitest run` et `npx vite build` passent avant chaque commit.

## Review Focus

1. Un bloc d'aide ne s'ouvre jamais tout seul et n'est jamais dupliqué quand l'étape change (tâche 2).
2. L'aide d'un écran ne contredit pas son comportement : chaque source citée existe, et les trois affirmations chiffrées (1 à 3 attendus, 5 puces, 30 août) correspondent au code (tâches 1 et 2).
3. Vue élève : aucun mot « Soutien », aucune puce qui n'est pas à l'infinitif, lecture à voix haute qui ne plante pas sans synthèse vocale (tâches 1 et 3).
4. Les modes d'emploi générés s'ouvrent en `file://` et à l'URL publique : chemins relatifs, aucune ressource externe (tâche 4).
5. Un texte d'aide devenu faux (par exemple « seules les mathématiques ») est détecté : une source supprimée ou renommée fait échouer le test (tâche 1).

---

### Task 1: Les textes et le composant `AideEcran`

**Files:**
- Create: `src/aide/textes.json`, `src/aide/aides.ts`, `src/ui/AideEcran.tsx`
- Modify: `src/styles/gazette.css` (classe `.aide-ecran`)
- Test: `tests/aide/textes.test.ts`, `tests/ui/aide-ecran.test.tsx`

**Interfaces:**
- Produces: `type AideId = 'parcours-niveau' | 'parcours-matiere' | 'parcours-competences' | 'parcours-elements' | 'parcours-jeux' | 'proposer' | 'classes' | 'tableau' | 'niveaux' | 'eleve'` ; `interface Aide { public: 'enseignant' | 'eleve'; puces: string[]; limite?: string; sources: string[] }` ; `TITRE_AIDE = 'Comment utiliser cet écran'` ; `AIDES: Record<AideId, Aide>` (lu dans `textes.json`) ; `AideEcran({ id }: { id: AideId }): JSX.Element` : `<details className="aide-ecran hors-impression">` fermé, `<summary>` = `TITRE_AIDE`, une liste `<ul>` des puces, puis, si présente, un paragraphe « Limite : {limite} ».

- [ ] **Step 1: Write the failing tests.** `tests/aide/textes.test.ts` : les 10 identifiants de `AideId` existent, et pas d'autre ; pour chaque aide, 1 à 5 puces, chacune de 5 à 140 caractères, `limite` de 140 caractères au plus ; chaque entrée de `sources` est un chemin dont le fichier existe (`fs.existsSync` depuis la racine de `gameactif/`) et il y en a au moins une ; aucun caractère U+2014 ; aucune puce ne contient `Soutien`. Pour l'aide `eleve` : chaque puce commence par un verbe à l'infinitif (expression `^[A-ZÉ][a-zéèêàâîôû]+(er|ir|re|oir)\b`), ne contient ni « vous » ni « tu » ni `@`, et il y a une `limite` absente ; pour les aides `enseignant` : une `limite` est présente. `tests/ui/aide-ecran.test.tsx` : `AideEcran id="classes"` rend un `details` fermé dont le `summary` vaut `Comment utiliser cet écran` ; ouvert, il liste les puces de `AIDES.classes` et la limite précédée de « Limite : » ; le bloc a la classe `hors-impression` ; un `id` sans limite n'affiche pas de paragraphe de limite.
- [ ] **Step 2: Run** `npx vitest run tests/aide tests/ui/aide-ecran.test.tsx`. Expected: FAIL (modules absents).
- [ ] **Step 3: Implement.** Créer `src/aide/textes.json` avec exactement les textes de l'annexe, `src/aide/aides.ts` (import JSON typé, export de `AIDES` et `TITRE_AIDE`), `AideEcran.tsx` et la classe `.aide-ecran` (police 1rem, `summary` avec zone de clic de 44 px, contraste du thème, marge sous le bloc).
- [ ] **Step 4: Run** les tests puis `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src tests` puis `git commit -m "feat(aide): textes et composant AideEcran"`.

### Task 2: Monter l'aide sur chaque écran

**Files:**
- Modify: `src/ui/Parcours.tsx`, `src/ui/PublierActivite.tsx`, `src/ui/MesClasses.tsx`, `src/ui/TableauDeBord.tsx`, `src/ui/NiveauxParCode.tsx`, `src/ui/VueEleve.tsx`
- Test: `tests/ui/aide-montee.test.tsx`, `tests/ui/accessibilite.test.tsx` (cas ajoutés)

**Interfaces:**
- Consumes: `AideEcran`, `AideId` (tâche 1).
- Produces: chaque écran contient exactement un bloc d'aide : `Parcours` rend `parcours-niveau`, `-matiere`, `-competences`, `-elements` ou `-jeux` selon `etat.etape` (au-dessus de la carte de l'étape) ; `PublierActivite` rend `proposer` en tête de section ; `MesClasses` rend `classes` sous le titre ; `TableauDeBord` rend `tableau` en tête ; `NiveauxParCode` rend `niveaux` sous le titre ; `VueEleve` rend `eleve` au-dessus de l'activité.

- [ ] **Step 1: Write the failing tests** (`aide-montee.test.tsx`) : à chaque étape du parcours (parcourues avec les fixtures de `tests/ui/publier-parcours.test.tsx`), `document.querySelectorAll('details.aide-ecran')` contient exactement 1 élément, fermé, et son contenu correspond à `AIDES['parcours-' + étape]` ; passer de l'étape « niveau » à « matière » remplace le bloc (pas de doublon, pas d'état ouvert conservé) ; `PublierActivite`, `MesClasses`, `TableauDeBord`, `NiveauxParCode` et `VueEleve` rendus avec les magasins en mémoire contiennent chacun exactement un bloc, fermé, avec l'aide attendue ; le bloc de `VueEleve` est l'aide `eleve`. Dans `accessibilite.test.tsx` : `axe` sur le parcours avec un bloc ouvert, et sur `VueEleve`, ne renvoie aucune violation grave.
- [ ] **Step 2: Run** `npx vitest run tests/ui/aide-montee.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** : insérer `<AideEcran id={...} />` aux six endroits. L'aide du parcours porte une `key` égale à l'étape pour être remplacée, pas réutilisée.
- [ ] **Step 4: Run** les tests, puis `npx vitest run`, `npx tsc --noEmit`, `npx vite build`. Expected: tout PASS (les tests de rôles existants ne doivent pas casser : le `<details>` n'est ni `region` ni `group`).
- [ ] **Step 5: Commit** `git add src tests` puis `git commit -m "feat(aide): un bloc d'aide sur chaque écran"`.

### Task 3: Lecture à voix haute de l'aide élève

**Files:**
- Modify: `src/ui/AideEcran.tsx`
- Test: `tests/ui/aide-ecran.test.tsx` (cas ajoutés)

**Interfaces:**
- Consumes: `useSpeech(): { available: boolean; speak: (text: string) => void }` de `src/ui/useSpeech.ts`.
- Produces: pour une aide dont `public` vaut `'eleve'` et quand la synthèse vocale existe, un bouton « Écouter l'aide » dans le bloc ouvert, qui lit les puces l'une après l'autre ; sans synthèse, aucun bouton et aucune erreur.

- [ ] **Step 1: Write the failing tests** : avec `window.speechSynthesis` simulé, le bouton « Écouter l’aide » est présent pour `eleve` et absent pour `classes` ; un clic appelle `speak` avec le texte des puces joint par des points ; sans `speechSynthesis`, le bloc `eleve` s'affiche sans bouton et sans lever.
- [ ] **Step 2: Run** `npx vitest run tests/ui/aide-ecran.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** le test puis `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src tests` puis `git commit -m "feat(aide): lecture à voix haute de l'aide élève"`.

### Task 4: Modes d'emploi HTML générés

**Files:**
- Create: `scripts/build-modes-emploi.mjs`, `docs/modes-emploi/gameactif-enseignant.html`, `docs/modes-emploi/gameactif-eleve.html` (générés, versionnés)
- Test: `tests/aide/modes-emploi.test.ts`

**Interfaces:**
- Consumes: `src/aide/textes.json` (tâche 1).
- Produces: `node scripts/build-modes-emploi.mjs [--stdout enseignant|eleve]` écrit les deux pages dans `docs/modes-emploi/` (ou imprime l'une d'elles). Chaque page est un HTML autonome : charte PLAI (vert #0f6e56, orange #f97316, DM Sans et DM Serif Display chargées depuis Google Fonts avec repli sur Arial si indisponible), police 16 px minimum, un titre par écran avec ses puces et sa limite, le contact `jeanfrancois.beguin@ens.ecl.be` en pied, aucun chemin absolu ni `fetch`.

- [ ] **Step 1: Write the failing tests** : la sortie `--stdout enseignant` contient la puce et la limite de chacune des 9 aides enseignant et ne contient aucune puce de l'aide élève ; `--stdout eleve` ne contient que l'aide élève ; aucune des deux ne contient `Soutien`, U+2014 ni `jf.beguin@outlook.com` ; elles contiennent le contact ; chaque `src=` et `href=` est relatif ou une ancre (pas de `file:///` ni de `C:\`) ; relancer le script sans changer `textes.json` produit des fichiers identiques (déterminisme) ; les fichiers versionnés sont identiques à la sortie du script.
- [ ] **Step 2: Run** `npx vitest run tests/aide/modes-emploi.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** le script (gabarit HTML en chaîne, échappement du texte), puis l'exécuter pour produire les deux fichiers.
- [ ] **Step 4: Run** le test, puis ouvrir les deux fichiers en `file://` dans le navigateur de l'application et constater qu'ils s'affichent (capture lue, aucune erreur de console). Expected: PASS.
- [ ] **Step 5: Commit** `git add scripts tests docs/modes-emploi` puis `git commit -m "feat(aide): modes d'emploi générés depuis les textes d'aide"`.

### Task 5: Jalon JF (aucun code, chaque étape avec accord explicite)

- [ ] **Step 1: Relecture des textes** de l'annexe par JF (ton, justesse, limites). Toute correction passe par `textes.json` puis `node scripts/build-modes-emploi.mjs`.
- [ ] **Step 2: Copie dans le portail** : copier les deux pages dans `projets/portail-plai/public/` (dépôt séparé ; copie, commit et push demandent un accord), puis mettre à jour l'entrée GameActif de `projets/portail-plai/src/data/apps.ts` (la règle PLAI de synchronisation des vignettes). Vérifier d'abord que l'entrée existe localement : elle n'a pas été trouvée dans la copie locale le 2026-11-06.
- [ ] **Step 3: Vérifier à l'URL publique** du portail que les deux pages s'ouvrent, en plus du `file://`.

## Annexe : textes de `src/aide/textes.json` (à relire par JF)

Chaque aide : `public`, puces, limite, sources. Les affirmations viennent du code cité.

| Id | Public | Puces | Limite | Sources |
|---|---|---|---|---|
| `parcours-niveau` | enseignant | 1. Choisir le niveau de vos élèves, de P1 à P6 : le programme affiché ensuite est celui de ce niveau. 2. « Voir l’exemple des positions (P4) » ouvre une activité prête à jouer, sans rien saisir. 3. Votre saisie est gardée dans ce navigateur : rien n’est envoyé. 4. Pour reprendre une activité exportée : « Ouvrir une activité (fichier) », en bas de page. | Seules les mathématiques sont disponibles pour l’instant. | `src/ui/EtapeNiveau.tsx`, `src/ui/Parcours.tsx`, `src/data/catalogue.ts`, `src/parcours/stockage.ts` |
| `parcours-matiere` | enseignant | 1. Choisir la matière : elle détermine les attendus proposés à l’étape suivante. 2. Revenir en arrière avec « Précédent » ne perd rien de ce qui est saisi. | Seules les mathématiques sont disponibles pour l’instant. | `src/ui/EtapeMatiere.tsx`, `src/parcours/etapes.ts`, `src/data/catalogue.ts` |
| `parcours-competences` | enseignant | 1. Cocher de 1 à 3 attendus du programme que l’activité travaille. 2. Chaque jeu sera relié à ces attendus, côté écran et côté classe. 3. Les attendus viennent des référentiels de la Fédération Wallonie-Bruxelles. | Cocher un attendu ne prouve pas que le jeu le travaille : c’est à vous d’en juger. | `src/ui/EtapeCompetences.tsx`, `src/atelier/brouillon.ts`, `src/data/referentiel.ts` |
| `parcours-elements` | enseignant | 1. Saisir vos éléments : mots, paires, étapes, comparaisons, questions. 2. Un jeu devient disponible quand ses données sont suffisantes : son statut est affiché. 3. Le contexte de classe est obligatoire : n’y mettez aucun nom d’élève. 4. Relire chaque élément : les élèves verront exactement ce que vous saisissez. | L’outil ne vérifie pas que vos contenus sont justes. | `src/ui/EtapeElements.tsx`, `src/atelier/brouillon.ts` |
| `parcours-jeux` | enseignant | 1. Jouer chaque jeu avant de le proposer. 2. Chaque jeu sur écran a son jeu en classe, sans écran, avec une fiche à imprimer. 3. Le profil règle le nombre d’éléments et les aides ; il ne décide rien pour un élève. 4. « Télécharger mon activité » donne un fichier à partager avec un collègue. | Les phrases « lien programme » sont à compléter par vous. | `src/ui/ActivityScreen.tsx`, `src/ui/BarreFichier.tsx`, `src/physical/programme.ts` |
| `proposer` | enseignant | 1. Choisir la classe qui reçoit l’activité. 2. Choisir comment décider du niveau : même niveau, un lien par groupe, ou niveau par code. 3. Afficher le QR au TBI ou copier le lien. 4. « Mettre à jour le lien » après une modification ; « Retirer le lien » quand l’activité est finie. | Votre contexte de classe n’est jamais envoyé ; le lien disparaît avec la classe, le 30 août. | `src/ui/PublierActivite.tsx`, `src/partage/magasin.ts`, `supabase/migrations/20261108_game_partage.sql` |
| `classes` | enseignant | 1. Créer une classe, puis donner son code aux élèves. 2. Chaque élève joue sous un code (E01, E02…) : gardez chez vous la liste des prénoms, elle reste sur cet appareil. 3. Consulter le tableau de bord après chaque séance. 4. Inviter une personne en lecture seule si besoin. | Les résultats d’une classe sont supprimés le 30 août suivant sa création. | `src/ui/MesClasses.tsx`, `src/ui/PrenomsClasse.tsx`, `src/ui/InvitationClasse.tsx`, `supabase/migrations/20261107_game_suivi.sql` |
| `tableau` | enseignant | 1. Lire d’abord « Qui a joué ». 2. Regarder les erreurs par type : elles disent quoi réenseigner. 3. Les états sont un indice, pas une preuve : décidez avec ce que vous observez. 4. Noter vos observations avec le code, jamais le prénom. | Quiconque connaît le code de classe peut enregistrer un résultat sous un code élève : ce tableau n’est pas une preuve. | `src/ui/TableauDeBord.tsx`, `src/ui/ObservationLibre.tsx`, `src/suivi/agregats.ts`, `docs/confidentialite/dossier-dpo-suivi.md` |
| `niveaux` | enseignant | 1. Le niveau de chaque code est votre décision, jamais automatique. 2. Standard est le niveau par défaut. 3. L’élève ne voit pas le nom de son niveau. 4. Il peut rejouer un niveau au-dessus ; vous le voyez dans le tableau de bord. | Un camarade qui connaît le code de classe peut essayer d’autres codes et deviner un niveau. | `src/ui/NiveauxParCode.tsx`, `src/ui/ActivityScreen.tsx`, `supabase/migrations/20261108_game_partage.sql` |
| `eleve` | élève | 1. Choisir son code dans la liste « Qui joue ? ». 2. Appuyer sur « Jouer ». 3. Lire la consigne, puis choisir une réponse. 4. Écouter la consigne avec le bouton prévu. 5. Rejouer un niveau au-dessus après un tour, si l’envie est là. | (aucune) | `src/ui/VueEleve.tsx`, `src/ui/QuiJoue.tsx`, `src/ui/ActivityScreen.tsx` |

## Self-review

- **Couverture de la demande :** une aide sur chaque écran (tâches 1 et 2) ; forme repliable et courte (contraintes globales, tests de la tâche 1) ; mode d'emploi pour le portail (tâche 4) ; accessibilité (axe, tâche 2) ; lecture à voix haute pour l'élève (tâche 3).
- **Cohérence des types :** `AideId`, `Aide`, `AIDES`, `TITRE_AIDE` et `AideEcran` sont définis à la tâche 1 et réutilisés tels quels.
- **Limites assumées :** un texte d'aide peut devenir faux sans que le test le voie si la source existe toujours mais a changé de comportement ; seul le test des sources supprimées ou renommées le détecte. Aucun essai avec de vrais enseignants sur la clarté des textes (à ajouter dans la grille d'observation du plan 7).
- **Proportion :** plan court ; les textes sont en annexe, copie exacte.

## Décisions

- 2026-11-06 : tâches 1 à 4 exécutées sur la branche `feat/aide-par-ecran` (coupée de `feat/confiance-preuves`). Suite complète : 94 fichiers, 985 tests ; `tsc` et `vite build` propres. Écarts assumés : les modes d'emploi n'embarquent ni lien Google Fonts ni logo (polices du système, zéro ressource externe) ; les écrans composites montrent plusieurs blocs, un par écran. Correction : une puce de l'aide élève disait que chaque jeu a un bouton « Écouter la consigne » ; seul « Placer » en a un.
- Tâche 5 (jalon JF) : non commencée ; la relecture de l'annexe par JF, la copie dans le portail et la vignette attendent son accord.
