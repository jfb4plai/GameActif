# GameActif, plan 2 : application élève et jeux physiques en regard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une application React qui fait jouer les quatre mécaniques du moteur (plan 1) sur des données locales, et qui propose pour chaque mécanique un jeu physique de classe avec matériel, déroulement et lien avec le programme.

**Architecture:** Le moteur `src/engine` (plan 1) reste pur et inchangé, sauf lecture. Un module pur `src/physical` construit les fiches de jeu physique à partir d'une activité et du même tour que le jeu numérique (mêmes éléments, mêmes quantités). Les scènes de la mécanique « placer » sont des données (`src/scenes`) avec des fonctions pures de géométrie. L'interface React ne contient que du rendu et du branchement ; toute règle testable vit dans les modules purs.

**Tech Stack:** React 18, Vite 5, Tailwind CSS v3 (avec le correctif `postcss.config.js` / `tailwind.config.js` à `import.meta.url`), TypeScript 5 strict, Vitest 2, @testing-library/react, jsdom. Aucune base, aucune API : données locales seulement.

**Spec:** `gameactif/docs/superpowers/specs/2026-10-01-gameactif-design.md` (sections 6, 10) et `gameactif/docs/superpowers/specs/2026-11-03-gameactif-avenant-referentiel.md` (sections 4, 11, 12). Maquette de référence visuelle et de comportement : `gameactif/previsualisation/index.html`.

## Global Constraints

- « Arial, 16 px minimum, cibles de 44 px minimum, une idée par écran. » (spec §10). Supports imprimés : Arial 12 minimum ; cartes à imprimer : 24 pt.
- « Animations de moins de 500 ms, sans clignotement ; `prefers-reduced-motion` respecté. » (spec §10)
- « Mode calme : pas d'animations, pas de sons, décor uni, mascotte statique ; activable par l'élève ou imposé par l'enseignant. » (spec §10). Ici : activé par défaut si `prefers-reduced-motion: reduce`.
- « Retours : formulation bienveillante (« Pas tout à fait. Regarde l'indice. »), jamais de « Faux » rouge, pas de score chiffré en échec, pas de perte de points. » (spec §10)
- « Pas de classement, pas de chrono, pas de séries quotidiennes, pas de points perdus. » (spec §2)
- Charte visuelle « gazette » demandée par JF le 2026-11-03 : `--journal #EFE6D2`, `--papier #FBF6E9`, `--encre #161616`, `--sarcelle #1F8A8C`, `--jaune #F6BE2C`, `--vermillon #E8412A`, `--ombre rgba(0,0,0,.38)` ; titres Alfa Slab One, étiquettes Special Elite, texte lu par l'élève en Arial.
- Logo PLAI : hauteur 32 px, largeur automatique, jamais de `width` et `height` identiques.
- Aucun `console.log` de données utilisateur. Aucune clé ni variable secrète (cette app n'en a pas).
- Une phrase de lien avec le programme n'est écrite que pour les attendus du pilote (avenant §12) ; ailleurs « À compléter par l'enseignant : en quoi ce jeu travaille cet attendu ».
- Aucune affirmation d'efficacité sur le jeu, la manipulation ou le mouvement n'est affichée (avenant §12, vérification RISS).
- Pas de tiret cadratin dans les textes d'interface ; consignes élèves à l'infinitif, une action par puce.

## Review Focus

1. Activité qui a moins d'éléments que le maximum du profil (3 consignes au lieu de 8) : les quantités de matériel suivent le tour réellement joué, pas le maximum. Test en tâche 1.
2. Texte d'élément très long (plus de 60 caractères) : la carte imprimable garde le texte entier, sans troncature. Test en tâche 1.
3. Cible dont le code est absent du jeu de données : la fiche s'affiche avec « Attendu introuvable » et ne plante pas. Test en tâche 2.
4. Glissement relâché hors de toute zone : l'élément revient, aucun essai n'est compté. Tests en tâches 5 et 6.
5. Jeu terminé au clavier seul, `prefers-reduced-motion` actif : mode calme par défaut, parcours complet sans souris. Tests en tâches 4 et 5.
6. Cartes imprimées : l'ordre d'impression ne reproduit pas l'ordre des réponses (anti indice de surface). Test en tâche 1.

---

## Structure des fichiers

```
gameactif/
  index.html, vite.config.ts (base './'), tailwind.config.js, postcss.config.js
  public/plai-logo.jpg
  src/
    main.tsx, App.tsx, styles/gazette.css
    data/pilote.ts            activité d'exemple maths P4 1.1 (4 mécaniques), non relue
    data/referentiel.ts       lecture typée de data/referentiel-maths-p3-p4.json
    physical/types.ts         PhysicalTemplate, PhysicalKit, ProgrammeLink
    physical/templates.ts     4 modèles (un par MechanicId)
    physical/programme.ts     phrases du pilote + programmeLinks()
    physical/kit.ts           buildPhysicalKit()
    scenes/types.ts, scenes/chat-table-boite-arbres.ts, scenes/geometry.ts
    ui/CalmContext.tsx, ui/useSpeech.ts
    ui/RoundBoard.tsx         Associer, Trier, Ordre (tour du moteur)
    ui/dragTargets.ts         binAtPoint() pur
    ui/SceneBoard.tsx         Placer
    ui/ActivityScreen.tsx     choix du jeu numérique et du jeu physique en regard
    ui/PhysicalKitView.tsx    fiche enseignant + cartes imprimables
  tests/ (existants du plan 1) + tests/physical/*.test.ts, tests/scenes/*.test.ts, tests/ui/*.test.tsx
```

---

### Task 0: Squelette React, charte gazette, outils de test

**Files:**
- Create: `index.html`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `src/main.tsx`, `src/App.tsx`, `src/styles/gazette.css`, `public/plai-logo.jpg`
- Modify: `package.json`, `tsconfig.json` (ajouter `jsx`, `dom`), `vitest.config.ts` (environnement jsdom pour `tests/ui`)
- Test: `tests/ui/app.test.tsx`

**Interfaces:**
- Produces: `App` (composant par défaut, rend `ActivityScreen` à la tâche 7) ; variables CSS de la charte ; `npm run dev`, `npm run build`, `npm test`.

- [ ] **Step 1: Écrire le test qui échoue.** `tests/ui/app.test.tsx` (`// @vitest-environment jsdom` en tête) : `render(<App />)` affiche un titre de niveau 1 « GameActif » et une image d'alt « PLAI » dont le style n'a pas `width` égal à `height`.
- [ ] **Step 2: Lancer** `npx vitest run tests/ui/app.test.tsx`. Expected : FAIL, `App` introuvable.
- [ ] **Step 3: Installer et configurer.** Dépendances : `react@18`, `react-dom@18`, `vite@5`, `@vitejs/plugin-react`, `tailwindcss@3`, `postcss`, `autoprefixer`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@types/react`, `@types/react-dom`. Scripts : `dev`, `build` (`vite build`), `preview`. `vite.config.ts` : `base: './'` (la version construite s'ouvre aussi en `file://`). `tailwind.config.js` et `postcss.config.js` : chemins résolus avec `import.meta.url` (anti-pattern connu du workspace). Copier `projets/portail-plai/public/plai-logo.jpg` vers `public/`. `gazette.css` : variables de la charte, polices Google Alfa Slab One et Special Elite, `body` en Arial 18 px, styles `button` (bord 2 px encre, ombre dure, focus visible 4 px vermillon, hauteur minimale 44 px), `.carte`, `.etiquette`. Reprendre les valeurs de `previsualisation/index.html`.
- [ ] **Step 4: Implémenter** `App` : en-tête gazette (logo en hauteur 32 px, h1 « GameActif », étiquette « Maquette »).
- [ ] **Step 5: Vérifier.** `npx vitest run && npm run typecheck && npm run build`. Expected : tests au vert, `tsc` propre, dossier `dist/` créé sans erreur.
- [ ] **Step 6: Commit.** `git add -A . ':!node_modules' && git commit -m "feat(app): squelette React, charte gazette, outils de test"`.

---

### Task 1: Modèles de jeux physiques et fiche (module pur)

**Files:**
- Create: `src/physical/types.ts`, `src/physical/templates.ts`, `src/physical/kit.ts`
- Test: `tests/physical/templates.test.ts`, `tests/physical/kit.test.ts`

**Interfaces:**
- Consumes (plan 1) : `Activity`, `MechanicId`, `ProfileId`, `RoundState`, `setupRound(activity, mechanic, profile, rng, overrides?)`, `makeRng`, `shuffleNoFixedPoint`, `PROFILES`.
- Produces :
  - `type Movement = 'manipulation' | 'deplacement'`
  - `interface PhysicalCounts { elements: number; stations: number; teams: number }` (stations = boîtes, zones, cases d'ordre ; équipes = `Math.ceil(pupils / teamSize)`)
  - `interface CalmGuards { noRunning: true; noTimer: true; noCompetition: true; maxGroupsMoving: number; voice: 'chuchote' | 'silence'; safeMaterial: string; stopSignal: string; pathMarked: boolean }`
  - `interface PhysicalTemplate { mechanic: MechanicId; title: string; moves: Movement[]; durationMin: number; teamSize: { min: number; max: number }; material: { name: string; count: (c: PhysicalCounts) => number; note?: string }[]; setup: string[]; play: string[]; calm: CalmGuards; differentiation: Record<ProfileId, string>; check: string }`
  - `const PHYSICAL_TEMPLATES: Record<MechanicId, PhysicalTemplate>`
  - `function templateProblems(t: PhysicalTemplate): string[]` (liste vide = conforme aux contraintes de JF)
  - `interface PhysicalCard { id: string; text: string }`
  - `interface PhysicalKit { mechanic: MechanicId; title: string; moves: Movement[]; durationMin: number; material: { name: string; count: number; note?: string }[]; setup: string[]; play: string[]; calm: CalmGuards; differentiation: string; check: string; stations: { id: string; label: string }[]; cards: PhysicalCard[]; answerKey: { cardId: string; stationId: string }[] }`
  - `function buildPhysicalKit(activity: Activity, mechanic: MechanicId, profile: ProfileId, seed: number, pupils: number): PhysicalKit`

- [ ] **Step 1: Écrire les tests qui échouent.**
  - `templates.test.ts` : (a) `Object.keys(PHYSICAL_TEMPLATES)` égale exactement `['associer','trier','ordre','placer']` (chaque mécanique numérique a un jeu physique) ; (b) `templateProblems(t)` renvoie `[]` pour les quatre ; (c) un modèle sans `moves` est refusé (« Il faut au moins une manipulation ou un déplacement ») ; (d) un modèle avec `calm.maxGroupsMoving` égal à 0 ou supérieur à 1 est refusé ; (e) un modèle sans `stopSignal` ou sans `safeMaterial` est refusé ; (f) `calm.voice` hors `chuchote`/`silence` est refusé ; (g) `ordre.calm.voice === 'silence'`.
  - `kit.test.ts` avec `sceneActivity()` et `eauActivity()` du plan 1 : (a) en Standard, le kit Trier de `eauActivity` a autant de cartes que d'éléments du tour (6) et autant de stations que de catégories du tour (3), et la quantité de boîtes du matériel vaut 3 ; (b) activité de 3 consignes en Standard : la quantité de cartes du kit Placer vaut 3, pas 6 (Review Focus 1) ; (c) un élément de 90 caractères garde son texte entier dans `cards` (Review Focus 2) ; (d) pour 50 graines, l'ordre des cartes n'est jamais l'ordre d'écriture et l'élément à la position i n'a pas sa réponse en position i (Review Focus 6) ; (e) `answerKey` donne pour chaque carte la station du moteur (`RoundState.elements[].correct`) ; (f) deux appels avec la même graine donnent le même kit ; (g) le nombre d'équipes du matériel vaut `Math.ceil(pupils / template.teamSize.max)`, au moins 1.
- [ ] **Step 2: Lancer** `npx vitest run tests/physical`. Expected : FAIL, modules introuvables.
- [ ] **Step 3: Implémenter `types.ts` et `templates.ts`.** Les quatre modèles reprennent le tableau de l'avenant §12 : titres « Les boîtes aux lettres » (trier), « Les paires à pincer » (associer), « La chaîne silencieuse » (ordre), « Place-le dans la classe » (placer). Pour chacun : `moves` selon l'avenant, `calm.maxGroupsMoving: 1`, `noRunning/noTimer/noCompetition: true`, `stopSignal: 'main levée, tous se figent'`, `pathMarked` vrai quand un déplacement existe, `safeMaterial` qui interdit petites pièces, objets qui roulent ou se lancent (placer : objets doux seulement). `differentiation` par profil : Soutien = moins de cartes (celles du tour Soutien), lecture à voix basse par un pair, indice de la zone montré ; Standard = tour standard ; Défi = tour Défi avec cartes distractrices et sans indice. `check` : vérifier avec le corrigé de la fiche, jamais pendant le déplacement. `setup` et `play` en phrases courtes, une action par phrase, à l'impératif ; texte exact libre mais conforme à l'avenant §12 (matériel principal, déroulement, calme).
- [ ] **Step 4: Implémenter `buildPhysicalKit`.** Joue `setupRound(activity, mechanic, profile, makeRng(seed))` pour obtenir éléments, options et réponses ; cartes = éléments dans l'ordre `shuffleNoFixedPoint` déjà fourni par le moteur (ne pas remélanger) ; `stations` = options avec `labels` du tour ; `PhysicalCounts.elements` = éléments du tour, `stations` = options du tour ; `material[].count` évalué sur ces nombres.
- [ ] **Step 5: Lancer** `npx vitest run tests/physical && npm run typecheck`. Expected : tous les tests passent, `tsc` propre.
- [ ] **Step 6: Commit.** `git add src/physical tests/physical && git commit -m "feat(physical): modèles de jeux physiques et fiche calculée depuis le tour du moteur"`.

---

### Task 2: Lien avec le programme (phrases du pilote, repli honnête)

**Files:**
- Create: `src/data/referentiel.ts`, `src/physical/programme.ts`
- Test: `tests/physical/programme.test.ts`

**Interfaces:**
- Consumes : `data/referentiel-maths-p3-p4.json` (entrées `{ code, annee, texte, ... }`), `MechanicId`.
- Produces :
  - `interface ReferentielEntry { code: string; annee: string; texte: string; sous_point: string; item_contenu: string }`
  - `const REFERENTIEL: ReferentielEntry[]` (import JSON typé) et `function referentielCodes(): ReadonlySet<string>`
  - `type Support = 'numerique' | 'physique'`
  - `interface ProgrammeLink { code: string; texte: string; phrase: string | null; extraEnClasse: boolean }`
  - `function programmeLinks(mechanic: MechanicId, support: Support, cibles: readonly string[], ref?: readonly ReferentielEntry[]): ProgrammeLink[]`

- [ ] **Step 1: Écrire les tests qui échouent.**
  - Trier, `physique`, cibles `['M.P4.1.1.i1.a1','M.P4.1.1.i1.a2','M.P4.1.1.i1.a3']` : trois liens, `phrase` égale à la phrase « Trier » de l'avenant §12, `texte` égal au texte du jeu de données, `extraEnClasse` faux.
  - Placer, `physique`, cibles `['M.P4.1.1.i1.a1','M.P4.1.1.i2.a2']` : liens pour ces deux codes avec la phrase « Placer », puis un lien supplémentaire pour `M.P4.1.1.i3.a1` avec `extraEnClasse: true` (« attendu travaillé en plus en classe »).
  - Placer, `numerique`, mêmes cibles : aucun lien `extraEnClasse`.
  - Un code valide du jeu de données sans phrase prévue (`M.P4.2.1.i1.a1`) : `phrase` est `null` (l'interface affichera « À compléter par l'enseignant : en quoi ce jeu travaille cet attendu »).
  - Un code absent du jeu de données (`M.P9.9.9.i9.a9`) : `texte` égal à « Attendu introuvable » et `phrase` à `null`, sans exception (Review Focus 3).
  - Aucune phrase du module ne contient de tiret cadratin ni les mots « efficace » ou « prouve ».
- [ ] **Step 2: Lancer** `npx vitest run tests/physical/programme.test.ts`. Expected : FAIL.
- [ ] **Step 3: Implémenter.** `referentiel.ts` importe le JSON avec `resolveJsonModule` (ajouter à `tsconfig`). `programme.ts` contient une table de phrases `{ mechanic, supports, codes, phrase, extraPhysique?: string[] }` dont le texte des quatre phrases est copié mot pour mot de l'avenant §12 « Phrases du pilote ». `programmeLinks` : un lien par code de `cibles` présent dans une entrée de la table pour cette mécanique et ce support ; pour `support === 'physique'` ajoute les codes `extraPhysique` non déjà ciblés avec `extraEnClasse: true`.
- [ ] **Step 4: Lancer** `npx vitest run tests/physical && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(physical): lien avec le programme, phrases du pilote et repli honnête"`.

---

### Task 3: Activité pilote et scène « chat » (données et géométrie)

**Files:**
- Create: `src/data/pilote.ts`, `src/scenes/types.ts`, `src/scenes/chat-table-boite-arbres.ts`, `src/scenes/geometry.ts`
- Test: `tests/data/pilote.test.ts`, `tests/scenes/geometry.test.ts`

**Interfaces:**
- Consumes : `Activity`, `availableMechanics`, `referentielCodes()`.
- Produces :
  - `function activitePilote(): Activity` : maths P4, sous-point 1.1 ; `cibles` = `['M.P4.1.1.i1.a1','M.P4.1.1.i1.a2','M.P4.1.1.i1.a3','M.P4.1.1.i2.a2']` ; `sceneId: 'chat-table-boite-arbres'` ; éléments tous `validated: false`, `origin: 'manuel'` (exemple non relu par un enseignant). Contenu : famille de position (3 catégories absolue, relative, ordinale avec 3 mots chacune, repris mot pour mot des listes de l'attendu) ; paires de contraires (à l'intérieur / à l'extérieur, devant / derrière, à droite / à gauche, au-dessus / en dessous) ; rangs premier, deuxième, troisième, dernier ; quatre consignes de la scène avec leurs zones.
  - `interface Zone { id: string; label: string; rect: { x1: number; y1: number; x2: number; y2: number }; repos: { x: number; y: number } }`, `interface Scene { id: string; viewBox: { w: number; h: number }; zones: Zone[]; start: { x: number; y: number }; description: string }`
  - `const SCENES: Record<string, Scene>`
  - `function zoneAt(scene: Scene, x: number, y: number): string | null`, `function clampToScene(scene: Scene, x: number, y: number): { x: number; y: number }`, `function moveBy(scene: Scene, p: { x: number; y: number }, dx: number, dy: number): { x: number; y: number }`

- [ ] **Step 1: Écrire les tests qui échouent.**
  - `pilote.test.ts` : (a) `availableMechanics(activitePilote())` donne les quatre mécaniques disponibles ; (b) tous les codes de `cibles` sont dans `referentielCodes()` ; (c) chaque mot des listes de position figure dans le texte de l'attendu correspondant du jeu de données (copie exacte, pas de mot inventé) ; (d) `canPublish(activitePilote(), referentielCodes())` est refusée avec la raison « 12 élément(s) pas encore validé(s). » ou le compte réel : le test lit le compte dans l'activité, pas une valeur écrite.
  - `geometry.test.ts` avec les rectangles de la maquette (`sur` 56,100 à 226,168 ; `sous` 84,192 à 196,290 ; `dans` 286,214 à 380,290 ; `entre` 452,200 à 518,290) : `zoneAt` renvoie l'identifiant de zone pour le centre de chaque zone, `null` en dehors, `null` sur le bord extérieur d'un pixel ; `clampToScene` borne x à 24..576 et y à 34..290 ; `moveBy` ne sort jamais de la scène.
- [ ] **Step 2: Lancer** les deux fichiers. Expected : FAIL.
- [ ] **Step 3: Implémenter.** La scène reprend les coordonnées de la maquette (`viewBox` 600 par 340, départ 300,56, positions de repos indiquées dans `previsualisation/index.html`). `description` : phrase décrivant les objets présents et leur disposition générale sans nommer la zone attendue (avenant §11, point 3).
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(data): activité pilote P4 1.1 et scène chat avec géométrie"`.

---

### Task 4: Mode calme, voix et cadre de l'application

**Files:**
- Create: `src/ui/CalmContext.tsx`, `src/ui/useSpeech.ts`
- Modify: `src/App.tsx`
- Test: `tests/ui/calm.test.tsx`

**Interfaces:**
- Produces : `CalmProvider` (props `{ children }`), `useCalm(): { calm: boolean; setCalm(on: boolean): void }` ; `useSpeech(): { available: boolean; speak(text: string): void }` (voix française, `lang` « fr-BE », repli sur la première voix `fr*` ; `available` faux sans `speechSynthesis`) ; bouton `CalmToggle` libellé « Mode calme : activé » ou « Mode calme : désactivé ».

- [ ] **Step 1: Écrire les tests qui échouent** (jsdom) : (a) sans préférence, le mode calme est désactivé ; (b) avec `matchMedia('(prefers-reduced-motion: reduce)')` à vrai, il est activé au départ (Review Focus 5) ; (c) activer le bouton ajoute la classe `calme` sur `document.body` ; (d) `useSpeech().available` est faux quand `window.speechSynthesis` est absent et `speak` ne lève pas d'exception.
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter.** La classe `calme` de `gazette.css` coupe animations, transitions, rotations et rayons du décor (valeurs de la maquette). Aucun son n'est jamais émis par l'application.
- [ ] **Step 4: Lancer** `npx vitest run tests/ui && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ui): mode calme par défaut sous reduced-motion, voix, bouton"`.

---

### Task 5: Jeu numérique Associer, Trier, Remettre en ordre

**Files:**
- Create: `src/ui/dragTargets.ts`, `src/ui/RoundBoard.tsx`
- Test: `tests/ui/dragTargets.test.ts`, `tests/ui/roundboard.test.tsx`

**Interfaces:**
- Consumes : `RoundState`, `step(state, action)`, `progress(state)`, `setupRound`, `Feedback`.
- Produces :
  - `function binAtPoint(rects: { id: string; left: number; top: number; right: number; bottom: number }[], x: number, y: number): string | null`
  - `RoundBoard` : props `{ round: RoundState; onDone(results: ElementResult[]): void }`. Le joueur choisit un élément puis une option (clic ou Entrée), ou glisse l'élément sur une option ; un bouton d'indice par élément ; retour du moteur affiché dans une zone `role="status"` ; progression « n sur m » en texte ; aucune note chiffrée ni mot « Faux ».

- [ ] **Step 1: Écrire les tests qui échouent.**
  - `dragTargets.test.ts` : `binAtPoint` renvoie l'identifiant du rectangle qui contient le point, `null` hors de tous, `null` pour une liste vide, premier rectangle en cas de recouvrement.
  - `roundboard.test.tsx` (jsdom, `userEvent`) avec un tour Trier de `activitePilote()` graine fixe : (a) choisir un élément puis la bonne option affiche « Bien vu. » et décrémente le nombre d'éléments restants ; (b) mauvaise option affiche « Pas tout à fait. Essaie encore. » et ne résout rien ; (c) l'indice écarte une option et désactive ce bouton ; (d) parcours complet au clavier seul (Tab, Entrée) jusqu'à `onDone` appelé une fois avec autant de résultats que d'éléments ; (e) lâcher un glissement hors de toute option rappelle l'élément à sa place et `onDone` n'est pas appelé, aucun essai compté (`round` inchangé) (Review Focus 4) ; (f) le texte « Faux » n'apparaît jamais, y compris après trois erreurs.
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter.** Glisser avec les événements pointeur (capture du pointeur, déplacement après 6 px, comme la maquette) ; en mode calme, placement instantané et sans rotation. Chaque bouton fait au moins 44 px de haut ; le texte des éléments est en Arial 21 px ; l'ordre d'affichage est celui de `round.elements` et `round.options`, sans remélange.
- [ ] **Step 4: Lancer** `npx vitest run tests/ui && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ui): plateau des jeux associer, trier, ordre avec glisser, clic et clavier"`.

---

### Task 6: Jeu numérique Placer dans une scène

**Files:**
- Create: `src/ui/SceneBoard.tsx`
- Test: `tests/ui/sceneboard.test.tsx`

**Interfaces:**
- Consumes : `RoundState` (mécanique `placer`, `sceneId`), `SCENES`, `zoneAt`, `moveBy`, `clampToScene`, `step`, `useSpeech`.
- Produces : `SceneBoard` : props `{ round: RoundState; onDone(results: ElementResult[]): void }`. Affiche la consigne de l'élément courant (le premier élément non résolu de `round.elements`), la scène en SVG avec le chat déplaçable (pointeur ou flèches, pas de 15, Maj pour 40 ; Entrée ou Espace pour poser), bouton « Écouter la consigne », cadre d'indice autour de la zone attendue après 2 erreurs sur la consigne en Standard (1 en Soutien, jamais en Défi), bouton « Consigne suivante » après une réussite.

- [ ] **Step 1: Écrire les tests qui échouent.** (a) la consigne affichée est le libellé du premier élément non résolu ; (b) poser le chat au centre de la bonne zone (via le clavier) résout l'élément et affiche « Bien placé » ; (c) poser hors de toute zone ne compte aucun essai (`round` inchangé) et le chat revient au départ (Review Focus 4) ; (d) poser dans une mauvaise zone affiche « Pas tout à fait. Relis la consigne, puis réessaie. » ; (e) après 2 erreurs en Standard le cadre d'indice apparaît (`data-testid="indice-zone"`), après 1 en Soutien, jamais en Défi ; (f) parcours complet au clavier seul jusqu'à `onDone` ; (g) l'élément `svg` porte un `aria-label` égal à `Scene.description` ; (h) le texte de l'indice ne cite jamais la zone attendue par son libellé.
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter.** Le moteur ne connaît pas les coordonnées : `SceneBoard` convertit la position du chat en zone avec `zoneAt`, puis appelle `step(state, { type: 'choose', elementId, optionId: zoneId })` ; une position hors zone n'appelle pas `step`. Le seuil d'indice selon le profil est une constante exportée `HINT_AFTER_ERRORS: Record<ProfileId, number | null>` (soutien 1, standard 2, defi null). Reprendre l'animation de retour de la maquette (moins de 500 ms) et la couper en mode calme.
- [ ] **Step 4: Lancer** `npx vitest run tests/ui && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ui): jeu placer dans une scène, glisser et clavier, indice par profil"`.

---

### Task 7: Écran d'activité et jeu physique en regard

**Files:**
- Create: `src/ui/ActivityScreen.tsx`, `src/ui/PhysicalKitView.tsx`
- Modify: `src/App.tsx`
- Test: `tests/ui/activityscreen.test.tsx`, `tests/ui/physicalkit.test.tsx`

**Interfaces:**
- Consumes : `activitePilote`, `availableMechanics`, `setupRound`, `buildPhysicalKit`, `programmeLinks`, `RoundBoard`, `SceneBoard`, `PROFILE_LABELS`.
- Produces : `ActivityScreen` (props `{ activity: Activity }`) : pour chaque mécanique disponible, une carte « Jeu sur écran » et, juste en regard, une carte « En classe, sans écran » ; choix du profil (Soutien, Standard, Défi) et du nombre d'élèves (champ numérique, valeur 24 par défaut, avec label, placeholder et texte d'aide expliquant que le nombre ne sert qu'à calculer le matériel) ; `PhysicalKitView` (props `{ kit: PhysicalKit; links: ProgrammeLink[] }`) : fiche enseignant (titre, durée indicative, « Manipulation » et/ou « Déplacement », matériel avec quantités, mise en place, déroulement, garde-fous de calme, adaptation du profil, vérification, lien avec le programme) puis corrigé puis cartes à imprimer.

- [ ] **Step 1: Écrire les tests qui échouent.**
  - `activityscreen.test.tsx` : pour `activitePilote()`, il y a exactement quatre cartes « Jeu sur écran » et quatre cartes « En classe, sans écran », chacune de la seconde nommée comme `PHYSICAL_TEMPLATES[m].title` ; une mécanique indisponible (activité sans scène) n'affiche ni l'une ni l'autre ; changer de profil rappelle `buildPhysicalKit` avec ce profil (nombre de cartes du kit Trier différent entre Soutien et Défi) ; changer le nombre d'élèves change la quantité d'équipes affichée.
  - `physicalkit.test.tsx` : la fiche affiche chaque ligne de matériel avec sa quantité, la mention « Manipulation » et/ou « Déplacement » selon `moves`, les garde-fous (pas de course, pas de chronomètre, pas de compétition, signal d'arrêt), un lien de programme avec code, texte officiel et phrase ; quand `phrase` est `null` : « À compléter par l'enseignant : en quoi ce jeu travaille cet attendu » ; un lien `extraEnClasse` porte « attendu travaillé en plus en classe » ; le corrigé liste toutes les cartes ; chaque carte imprimable contient le texte complet de l'élément (Review Focus 2).
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter.** Fiche et cartes en Arial ; cartes en 24 pt, huit par page A4 (2 colonnes), traits de découpe ; feuille de style `@media print` : masque navigation, boutons et mode calme, saut de page avant « Corrigé » et avant « Cartes », `break-inside: avoid` sur chaque carte ; bouton « Imprimer la fiche » qui appelle `window.print()`. Le kit est calculé avec la graine de l'activité (constante, pas de `Math.random`) pour qu'une impression ultérieure reste identique.
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck && npm run build`. Expected : PASS, `dist/` construit.
- [ ] **Step 5: Commit.** `git commit -m "feat(ui): écran d'activité avec jeu physique en regard, fiche et cartes à imprimer"`.

---

### Task 8: Vérification globale, parcours réel, sauvegarde

**Files:**
- Modify: `memory/gameactif-session-prompt.md` (workspace parent), `.claude/launch.json` (entrée `gameactif-app`)

- [ ] **Step 1: Suite et build.** `npm test && npm run typecheck && npm run build`. Expected : tous les fichiers de test passent, `tsc` sans erreur, build sans erreur. Aucun avertissement de dépendance de sécurité ignoré sans note.
- [ ] **Step 2: Parcours réel dans le navigateur.** Lancer le serveur (`npm run dev`, port 5196, entrée `gameactif-app` dans `.claude/launch.json`) et dérouler : ouvrir l'activité pilote ; jouer Trier avec un glissement à la souris, une erreur puis une réussite ; jouer Placer au clavier seul ; ouvrir chaque fiche physique ; imprimer en PDF (aperçu d'impression) et vérifier pagination et corrigé. Noter chaque constat avec sa preuve (capture, valeur lue) ; ce qui n'est pas vu reste « non vérifié ».
- [ ] **Step 3: Ouverture hors serveur.** Ouvrir `dist/index.html` en `file://` dans un navigateur ordinaire (le volet intégré ne montre qu'une copie figée, il ne compte pas). Expected : l'application charge et les jeux répondent ; sinon corriger les chemins avant de conclure.
- [ ] **Step 4: Accessibilité de base.** Parcours au clavier seul sur les quatre jeux ; contraste des couleurs de texte contrôlé sur les 6 couples utilisés (texte encre sur papier, jaune, vert, sarcelle) ; `prefers-reduced-motion` émulé. Noter le résultat de chaque contrôle.
- [ ] **Step 5: Mettre à jour le fil conducteur** (`memory/gameactif-session-prompt.md` : état du plan 2, ce qui est vérifié et ce qui ne l'est pas, points restants) et demander l'accord de JF avant tout `git push`.

---

## Auto-revue contre la spec

| Exigence | Tâche |
|---|---|
| Spec §6, §10 : trois mécaniques jouables au glisser, au toucher puis toucher, au clavier | 5 |
| Avenant §11 : mécanique placer, indice de zone par profil, description accessible de scène, hors zone sans essai | 3, 6 |
| Spec §10 : mode calme, lecture à voix haute, Arial 16 px, cibles 44 px, retours bienveillants, aucune note chiffrée en échec | 0, 4, 5, 6 |
| Avenant §12 : un jeu physique pour chaque mécanique, manipulation ou déplacement, calme, matériel listé | 1, 7 |
| Avenant §12 : lien avec le programme, phrases du pilote, repli « à compléter », attendus en plus en classe | 2, 7 |
| Avenant §4 et §5 : cibles de l'activité visibles (texte officiel) | 2, 7 |
| Charte gazette demandée par JF | 0 |
| Pas d'affirmation d'efficacité affichée | 2 (test sur les mots), Global Constraints |

Hors de ce plan : création avec l'IA et .docx (plan 3), tables, RLS et HubActif (plan 4), tableau de bord (plan 5), bibliothèque de scènes au-delà de « chat » (coût par scène à chiffrer, avenant §11), saisie manuelle des résultats d'un jeu physique (avenant §12, limites).

Noms utilisés d'une tâche à l'autre, vérifiés : `PHYSICAL_TEMPLATES`, `templateProblems`, `buildPhysicalKit`, `PhysicalKit`, `PhysicalCounts`, `programmeLinks`, `ProgrammeLink`, `referentielCodes`, `activitePilote`, `SCENES`, `zoneAt`, `moveBy`, `clampToScene`, `binAtPoint`, `HINT_AFTER_ERRORS`, `useCalm`, `useSpeech`.
