# GameActif plan 7 : confiance, accessibilité prouvée, essai réel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combler les écarts de GameActif que la comparaison avec pinpon.uno (2026-11-06) a révélés et qui ne dépendent d'aucune décision de produit : pages légales en ligne, accessibilité mesurée, protocole d'essai en classe, étude du français. Le suivi des élèves est cadré par une décision de JF (tâche 0), pas codé ici.

**Architecture:** Pas de routeur. Une vue est choisie à partir de `window.location.hash` par une fonction pure ; `App.tsx` affiche `Parcours` ou une page légale. Les pages légales sont du texte statique en JSX, dont chaque phrase factuelle est reliée à une ligne de code dans le fichier de constats. L'accessibilité est mesurée par `axe-core` dans jsdom (limites dites) plus un protocole manuel pour JF.

**Tech Stack:** React 18, Vite 5, Vitest + Testing Library (déjà en place), `axe-core` (nouvelle devDependency).

**Spec:** `docs/superpowers/specs/2026-10-01-gameactif-design.md` (principes), `docs/superpowers/specs/2026-11-03-gameactif-avenant-referentiel.md` (§15 garde-fous). Constats de comparaison : section « Constats » ci-dessous.

## Constats (base du plan)

Statuts : C = constaté (commande ou lecture citée), D = déduit, N = non vérifié.

- C : dépôt `main` = `origin/main` (0 en avance, 0 en retard, `git rev-list --count origin/main..HEAD` = 0 le 2026-11-06, HEAD cfc781a). Le bundle en ligne `https://gameactif.jfb4plai.com/assets/index-0lcOymNs.js` contient « Mémo », « Comparer », « Tir aux bulles », « Casse-briques », « Libre ». Les plans 4b à 6 sont donc poussés ET déployés. (Une réponse précédente de cette session affirmait le contraire : fausse, fondée sur une note de mémoire périmée.)
- C : l'accueil en ligne n'a aucun lien (`document.querySelectorAll('a').length` = 0) : ni vie privée, ni mentions légales. Le bundle contient 0 occurrence de « vie privée » et de « mentions légales ».
- C : `src/App.tsx` affiche l'étiquette « Maquette : aucune donnée enregistrée », seul texte de ce genre.
- C : accessibilité du DOM en ligne : 1 `h1`, 2 éléments `aria-label`/`aria-live`/`role` sur la page d'accueil, pas de lien d'évitement. Les plateaux ont des régions `role="status" aria-live="polite"` (ex. `src/ui/ComparerBoard.tsx:48`).
- C : le brouillon est gardé dans `window.localStorage` (`src/ui/Parcours.tsx:27`) ; la base Supabase n'est contactée que si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` existent (`src/lib/supabase.ts:8-10`).
- C (Pinpon) : le jeu et la vie privée sont décrits sur ses pages publiques ; `tracker.js` envoie un battement de présence d'un élève connecté. Pinpon mesure le temps passé.
- D : le seul référentiel chargé est maths P1-P6 (861 attendus, `scripts/build-referentiel.mjs`) ; le français n'a pas d'adaptateur.
- N : tablette, lecteur d'écran, voix fr-BE, impression PDF, file://, essai avec élèves.

## Global Constraints

- Ne jamais écrire « vérifié », « testé » ou « confirmé » dans une page ou un document sans commande et sortie citées.
- Aucune table élève ; aucun nom d'élève ; aucun tiret cadratin dans le dépôt (règle de repo PLAI).
- Contact des outils PLAI : `jeanfrancois.beguin@ens.ecl.be` (jamais `jf.beguin@outlook.com`).
- Texte lisible : police 16 px minimum à l'écran ; Arial pour les mots de l'élève ; consignes élèves à l'infinitif, une action par puce.
- Exemples FWB uniquement ; aucun nom de produit commercial dans les pages légales.
- Pas de `git push`, pas de migration, pas de variable Vercel sans accord explicite de JF.
- `npx tsc --noEmit` et `npx vite build` passent avant chaque commit ; commits sur `main`.

## Review Focus

1. Hash inconnu (`#/nimportequoi`) ou vide : le parcours s'affiche, pas de page blanche (tâche 1).
2. Rechargement sur `#/confidentialite` puis retour au parcours : le brouillon en `localStorage` est intact (tâche 1).
3. Texte de confidentialité exact selon la configuration : sans clé Supabase il ne parle pas d'adresse e-mail enseignant ; avec clé il la mentionne (tâche 1).
4. Le lien d'évitement reçoit le focus au premier Tab et mène à `<main id="contenu">` ; en mode calme il reste visible (tâche 2).
5. Une réponse fausse dans un plateau annonce quelque chose dans une région `aria-live` (tâche 2, mesure ; peut échouer et alors est un défaut à corriger).

---

### Task 0: Décisions et actions de JF (aucun code)

**Files:**
- Modify: `docs/superpowers/plans/2026-11-06-gameactif-plan-7-confiance-et-preuves.md` (ce fichier, section « Décisions »)

JF tranche, Claude consigne la réponse et la date dans la section « Décisions » en fin de fichier. Les tâches 1 à 4 ne dépendent d'aucune de ces réponses.

- [ ] **Step 1: D1, suivi des élèves.** Options à présenter, avantages et inconvénients :
  - (a) Pas de suivi : GameActif reste un fabricant de jeux ; argument fort « aucune donnée élève » ; l'enseignant n'a aucun retour sur ses élèves.
  - (b) Suivi par code anonyme via HubActif (option C déjà prévue) : comble l'écart fonctionnel avec Pinpon ; exige avis DPO, tables préfixées `game_`, RLS, grants ; coût de plusieurs plans.
  - (c) Pas de mesure de temps passé : Pinpon envoie un battement de présence (`tracker.js`) ; le temps n'est pas un indicateur d'apprentissage et contredit « sans chrono » (décision 2026-10-01). Recommandation : (c) quel que soit (a) ou (b).
- [ ] **Step 2: D2, ordre des chantiers.** Français avant suivi, ou suivi avant français. Recommandation : étude du français (tâche 4) d'abord, car elle ne coûte rien et chiffre l'effort.
- [ ] **Step 3: Actions déjà en attente (plan 4b), une par une avec accord :** application de `supabase/migrations/20261103_game_acces.sql`, URLs de redirection Supabase, variables Vercel `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, création du premier lien (`supabase/admin/creer-invitation.sql`), parcours d'inscription réel par JF. Tant que la migration n'est pas appliquée, la page de confidentialité décrit l'état sans compte (tâche 1, Review Focus 3).
- [ ] **Step 4: D3, critère de réussite du pilote** (maths P4 sous-point 1.1), encore ouvert depuis le 2026-11-03. Consigné dans le protocole de la tâche 3.

### Task 1: Pages Confidentialité et Mentions en ligne

**Files:**
- Create: `src/ui/vue.ts` (choix de la vue)
- Create: `src/ui/PageLegale.tsx`
- Create: `src/ui/PiedDePage.tsx`
- Create: `docs/confidentialite/constats.md` (chaque phrase de la page, avec sa ligne de code)
- Modify: `src/App.tsx`
- Test: `tests/ui/vue.test.ts`, `tests/ui/pages-legales.test.tsx`

**Interfaces:**
- Produces: `type Vue = 'parcours' | 'confidentialite' | 'mentions'`; `vueDepuisHash(hash: string): Vue`; `useVue(): Vue` (écoute `hashchange`) dans `src/ui/vue.ts`.
- Produces: `PageLegale({ page, compteActif }: { page: 'confidentialite' | 'mentions'; compteActif: boolean }): JSX.Element` ; `PiedDePage(): JSX.Element` avec deux liens `#/confidentialite` et `#/mentions` et un lien « Retour au parcours » vers `#/`.
- Consumes: `useAuthOptionnel(): AuthValeur | null` de `src/compte/auth.tsx:118` ; `compteActif` = `useAuthOptionnel() !== null`.

- [ ] **Step 1: Write the failing tests.** `tests/ui/vue.test.ts` : `vueDepuisHash('#/confidentialite')` vaut `'confidentialite'` ; `'#/mentions'` vaut `'mentions'` ; `''`, `'#/'`, `'#/nimportequoi'` valent `'parcours'`. `tests/ui/pages-legales.test.tsx` : avec `compteActif={false}` la page `confidentialite` contient « jeanfrancois.beguin@ens.ecl.be », contient « localStorage » ou « stockage local de votre navigateur » et ne contient pas « adresse e-mail » ; avec `compteActif={true}` elle contient « adresse e-mail » ; aucune des deux pages ne contient « jf.beguin@outlook.com » ni le caractère U+2014 (tiret cadratin).
- [ ] **Step 2: Run** `npx vitest run tests/ui/vue.test.ts tests/ui/pages-legales.test.tsx`. Expected: FAIL, modules introuvables.
- [ ] **Step 3: Implement `vueDepuisHash` et `useVue` in `src/ui/vue.ts`**, fonction pure plus un `useState`/`useEffect` sur `hashchange`.
- [ ] **Step 4: Implement `PageLegale` in `src/ui/PageLegale.tsx`.** Contenu de `confidentialite` limité à ce qui est constaté : (1) le brouillon reste dans le navigateur de l'enseignant (stockage local, `src/ui/Parcours.tsx:27`) ; (2) le fichier téléchargé contient le contexte de classe saisi, jamais de nom d'élève demandé ; (3) l'application n'appelle aucune IA : les prompts sont copiés vers le Claude de l'enseignant, qui relève de ses propres conditions ; (4) aucun compte élève, aucune donnée élève collectée ; (5) si `compteActif` : adresse e-mail de l'enseignant et activités enregistrées dans la base partagée PLAI, droits d'accès et d'effacement par écrit à l'adresse de contact ; (6) hébergeur : écrire « Vercel » et laisser la ligne « localisation : à confirmer par JF » tant qu'elle n'est pas lue sur Vercel. `mentions` : éditeur Jean-François Beguin, Pôle Territorial de la Ville de Liège (PLAI), contact, licence PolyForm NC (LICENSE du dépôt), référentiel FWB comme source des attendus.
- [ ] **Step 5: Implement `PiedDePage` et modifier `src/App.tsx`** : `useVue()` ; si `parcours`, afficher `<Parcours />` dans `AuthProvider` comme aujourd'hui ; sinon `PageLegale` ; `PiedDePage` toujours visible. Remplacer l'étiquette « Maquette : aucune donnée enregistrée » seulement si `compteActif` (sinon la phrase reste vraie).
- [ ] **Step 6: Écrire `docs/confidentialite/constats.md`** : un tableau phrase de la page / fichier:ligne / statut (constaté ou à confirmer par JF).
- [ ] **Step 7: Run** `npx vitest run`, `npx tsc --noEmit`, `npx vite build`. Expected: tout vert, build sans erreur.
- [ ] **Step 8: Commit** `git add src/ui/vue.ts src/ui/PageLegale.tsx src/ui/PiedDePage.tsx src/App.tsx docs/confidentialite tests/ui/vue.test.ts tests/ui/pages-legales.test.tsx` puis `git commit -m "feat(legal): pages confidentialité et mentions, pied de page"`.
- [ ] **Step 9: Relecture JF obligatoire avant tout push** (texte juridique). Après accord de push et déploiement : `curl -sL https://gameactif.jfb4plai.com/ | grep -c confidentialite` n'est pas concluant pour une SPA ; ouvrir `https://gameactif.jfb4plai.com/#/confidentialite` dans le navigateur et lire le texte.

### Task 2: Accessibilité mesurée et lien d'évitement

**Files:**
- Modify: `src/App.tsx`, `src/styles/` (feuille qui contient `.entete`; classe `.lien-evitement`)
- Create: `tests/ui/accessibilite.test.tsx`
- Create: `docs/accessibilite/protocole-manuel.md`
- Create: `docs/accessibilite/constats-2026-11.md`
- Modify: `package.json` (devDependency `axe-core`)

**Interfaces:**
- Produces: `<a className="lien-evitement" href="#contenu">Aller au contenu</a>` en tête de `App`, et `<main id="contenu">`.

- [ ] **Step 1: Write the failing tests** dans `tests/ui/accessibilite.test.tsx` : (a) `App` rendu contient un lien « Aller au contenu » dont `href` est `#contenu` et un `main` d'`id` `contenu` ; (b) `axe.run(container)` sur `App` ne renvoie aucune violation de niveau `critical` ou `serious` ; (c) pour chacun des plateaux `RoundBoard`, `ComparerBoard`, `MemoBoard`, `QcmBoard`, `SceneBoard` rendus avec les données de `tests/fixtures.ts`, `axe.run` ne renvoie aucune violation `critical`/`serious` ; (d) après une réponse fausse dans `ComparerBoard`, un élément `[role="status"]` contient du texte non vide.
- [ ] **Step 2: Run** `npm i -D axe-core` puis `npx vitest run tests/ui/accessibilite.test.tsx`. Expected: FAIL au moins sur (a). Les échecs de (b) à (d) sont des constats à consigner, pas à masquer.
- [ ] **Step 3: Implement** le lien d'évitement (visible au focus, y compris en mode calme) et `id="contenu"` sur `main`. Corriger les violations `critical`/`serious` trouvées en (b) et (c) ; pour chaque violation corrigée, une ligne dans `constats-2026-11.md`.
- [ ] **Step 4: Run** `npx vitest run tests/ui/accessibilite.test.tsx`. Expected: PASS. `axe` dans jsdom ne mesure pas le contraste ni l'ordre réel du focus : le dire dans `constats-2026-11.md`, statut « non vérifié » pour ces deux points.
- [ ] **Step 5: Écrire `docs/accessibilite/protocole-manuel.md`** : pour JF, chemins complets et URL exacte `https://gameactif.jfb4plai.com/` ; parcours à jouer au clavier seul (Tab, Entrée, flèches) pour Trier, Associer, Mémo, QCM ; lecture avec NVDA (Windows, gratuit) : ce qu'il doit annoncer après une réponse juste et fausse ; tablette réelle : glisser-déposer Trier et Placer ; voix fr-BE : bouton lecture à voix haute. Une grille à cocher, colonnes OK / pas OK / remarque.
- [ ] **Step 6: Run** `npx vitest run`, `npx tsc --noEmit`, `npx vite build`. Expected: vert.
- [ ] **Step 7: Commit** `git add package.json package-lock.json src tests/ui/accessibilite.test.tsx docs/accessibilite` puis `git commit -m "feat(a11y): lien d'évitement, mesures axe, protocole manuel"`.

### Task 3: Protocole d'essai en classe

**Files:**
- Create: `docs/essais-classe/protocole.md`
- Create: `docs/essais-classe/grille-observation.md`

Pas de code. Le livrable est un protocole que JF et 2 ou 3 collègues du Pôle peuvent utiliser sans Claude.

- [ ] **Step 1: Écrire `protocole.md`** : pilote maths P4 sous-point 1.1 (vocabulaire de position) ; 2 ou 3 enseignants ; une séance par classe ; chemin : niveau, matière, compétences, éléments, jeu sur écran puis jeu physique ; l'enseignant note le temps de préparation (de l'ouverture à l'activité jouable) ; critère de réussite proposé à JF (D3) : « un enseignant qui n'a jamais vu l'outil produit, sans aide, une activité jouable en moins de 15 minutes, et la juge utilisable avec ses élèves » ; seuil et durée sont des propositions de Claude, à fixer par JF.
- [ ] **Step 2: Écrire `grille-observation.md`** : ce que l'enseignant observe (ce qu'il n'a pas compris, l'élève qui décroche, l'élève dyslexique/TDAH, la lecture à voix haute utilisée ou non) ; une question de fin : « Qu'avez-vous modifié vous-même (le 20 %) ? » ; aucune donnée nominative d'élève, codes E1, E2.
- [ ] **Step 3: Vérification.** Relire les deux fichiers : aucune phrase ne promet un résultat ; les seuils sont étiquetés « proposition ». Commit `git add docs/essais-classe` puis `git commit -m "docs: protocole d'essai en classe du pilote P4"`.

### Task 4: Étude du français (adaptateur de référentiel)

**Files:**
- Create: `docs/superpowers/specs/2026-11-06-francais-adaptateur-etude.md`
- Create: `scripts/etude-referentiel-francais.mjs` (lecture seule, ne modifie aucune donnée)

- [ ] **Step 1: Write the failing test** `tests/data/etude-francais.test.ts` : l'import de `compterFrancais(racine: string): { fichiers: number; attendusParAnnee: Record<string, number> }` depuis `scripts/etude-referentiel-francais.mjs` sur un dossier de fixture (2 fichiers JSON minimaux copiés dans `tests/fixtures/referentiel-fr/`) renvoie `{ fichiers: 2, attendusParAnnee: { P3: 2, P4: 1 } }`.
- [ ] **Step 2: Run** `npx vitest run tests/data/etude-francais.test.ts`. Expected: FAIL, module introuvable.
- [ ] **Step 3: Implement `compterFrancais`** dans `scripts/etude-referentiel-francais.mjs` : parcourt `../referentiels-fwb/` en excluant `maths/`, détecte la structure réelle des fichiers de français et compte les attendus par année. La fonction ne devine aucun format : si un fichier ne correspond pas au format attendu par la fixture, elle l'ajoute à une liste `illisibles` et continue.
- [ ] **Step 4: Run** le test puis `node scripts/etude-referentiel-francais.mjs ../referentiels-fwb`. Expected: PASS, et un décompte réel par année (ou la liste `illisibles` si la structure diffère, ce qui est le résultat de l'étude).
- [ ] **Step 5: Écrire l'étude** : structure constatée du français, nombre d'attendus par année, écart avec `scripts/build-referentiel.mjs`, estimation de l'effort de l'adaptateur (en tâches, pas en jours), mécaniques existantes utilisables telles quelles (Associer, Trier, Remettre en ordre, Comparer, Mémo, QCM) et celles qui ne le sont pas. Statut de chaque chiffre : constaté ou déduit.
- [ ] **Step 6: Commit** `git add scripts/etude-referentiel-francais.mjs tests/data/etude-francais.test.ts tests/fixtures/referentiel-fr docs/superpowers/specs/2026-11-06-francais-adaptateur-etude.md` puis `git commit -m "docs(referentiel): étude de l'adaptateur français"`.

### Task 5: Suivi des élèves (porte fermée jusqu'à D1)

**Files:** aucun dans ce plan.

- [ ] **Step 1: Si D1 = (a)**, consigner la décision dans `docs/confidentialite/constats.md` (« GameActif ne collecte aucune donnée élève, par choix ») et fermer cette tâche.
- [ ] **Step 2: Si D1 = (b)**, lancer `superpowers:brainstorming` avec ces entrées imposées : codes anonymes, aucune table élève nominative, tables préfixées `game_`, `GRANT` et RLS dans la même migration, essai en transaction annulée avant toute application, avis DPO, pont HubActif décrit dans `lexiactif-branchement-hub`, indicateur = « quoi réenseigner / quel niveau ajuster » (décision 2026-10-01), jamais le temps passé. Sortie attendue : spec puis plan 8.

## Self-review

- Couverture : écarts « vie privée et mentions » (tâche 1), « accessibilité sans preuve » (tâche 2), « aucune preuve d'usage » (tâche 3), « français » (tâche 4), « suivi » (tâches 0 et 5). Écart « volume de jeux » volontairement non traité (décision de ne pas rivaliser, section Constats de la comparaison).
- Types : `Vue`, `vueDepuisHash`, `useVue`, `PageLegale`, `PiedDePage`, `compterFrancais` sont définis une fois et réutilisés avec la même signature.
- Proportion : plan plus court que l'avenant référentiel ; aucun corps de fonction écrit.
- Limites : `axe-core` sous jsdom ne mesure ni contraste ni focus réel ; la tâche 2 le dit et renvoie au protocole manuel.

## Décisions

- 2026-11-06, D1 : JF choisit (b), suivi des élèves par code anonyme. Tâche 5, étape 2 déclenchée (brainstorming, puis spec et plan 8). La recommandation (c), ne pas mesurer le temps passé, n'a pas été contredite par JF ; elle reste une entrée imposée de la spec, à confirmer.
- D2, D3 et les actions du plan 4b : en attente.
