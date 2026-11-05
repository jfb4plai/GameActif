# GameActif plan 5 : gabarits Comparer, Mémo et QCM libre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter trois mécaniques intégrées (Comparer, Mémo, QCM libre) avec saisie, jeu sur écran, jeu physique en regard et fichier d'échange v2, et centraliser la liste des mécaniques pour en ajouter d'autres plus tard.

**Architecture:** Moteur pur (`src/engine`) : trois modules `setupX` qui produisent un `RoundState` (le QCM gagne `choices` par élément, le Mémo gagne `deck`). Un registre `MECANIQUES` remplace les listes dupliquées. Trois plateaux React dédiés ; les fiches physiques sont calculées depuis le même tour que l'écran.

**Tech Stack:** React 18, Vite 5, TypeScript, Vitest + Testing Library (jsdom), dossier `gameactif/`.

**Spec:** `docs/superpowers/specs/2026-11-05-gabarits-comparer-memo-qcm-design.md` (validée par JF le 2026-11-05).

## Global Constraints

- Branche `main`. Commits locaux seulement : **ne jamais pousser** sans accord de JF.
- Commandes depuis `gameactif/` : `npx vitest run` (tests), `npx tsc --noEmit`, `npx vite build`. Les 459 tests existants restent verts sauf ceux dont le plan dit de changer l'attendu.
- `tsc` : de la tâche 1 à la tâche 5, des `Record<MechanicId, …>` incomplets (`templates.ts`) et le `switch` de `setup.ts` sont signalés par `tsc` ; c'est attendu. `tsc` est exigé propre à partir de la tâche 6. Jusque-là, `vitest` est la garde.
- Textes d'interface en français avec accents, ton existant (« Bien vu. », « Pas tout à fait. Essaie encore. »). Mots de l'élève en Arial, 16 px minimum. Aucun chronomètre, classement, points perdus, son. Mode calme : pas d'animation.
- Aucun nom d'élève nulle part. Aucune clé API. Aucune référence scientifique nouvelle.
- Chaque champ de saisie : label précis, placeholder concret, aide sous le champ (règle PLAI).
- Un jeu physique par mécanique : un seul groupe qui se déplace, signal d'arrêt, matériel sûr, voix chuchotée, aucun chronomètre, aucune compétition (`templateProblems`).
- Les nouveaux champs d'`Activity` sont **optionnels** (`comparisons?`, `questions?`) pour ne pas retoucher les littéraux existants ; lire avec `?? []`.
- Pas de phrases « lien programme » nouvelles : `programmeLinks` affiche déjà « À compléter par l'enseignant » sans entrée dans `PHRASES_PILOTE`.

## Review Focus

1. Ancien brouillon (stockage local, fichier v1, ligne Supabase) sans `comparaisons` ni `qcm` : ne doit jamais planter, champs vides. Test en tâche 7.
2. Nombres mal écrits (`1/0`, `3,5,2`, `abc`, ligne vide, `12 |`) : message en français, aucune exception. Tâches 2 et 7.
3. `0,5 | 1/2` et `2/6 | 1/3` valent `=`. Tâche 2.
4. Moins de paires que `maxItems` du profil (Mémo Défi avec 3 paires) : le plateau a 6 cartes, sans erreur ni carte orpheline. Tâche 4.
5. QCM Défi avec une seule fausse réponse saisie : 2 choix, pas d'erreur. Tâche 3.
6. Mémo : clic sur la même carte deux fois, sur une carte déjà trouvée, ou sur une troisième carte pendant que deux sont visibles : ignoré. Tâche 9.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/engine/types.ts` (modif) | `MechanicId` +3, `Comparison`, `Question`, champs optionnels d'`Activity` |
| `src/engine/round.ts` (modif) | `ElementState.choices`, `RoundState.deck`, `feedbackFor` |
| `src/engine/profiles.ts` (modif) | `choices` (2/3/4) |
| `src/engine/nombres.ts` (nouveau) | `parseNombre`, `symboleJuste` |
| `src/engine/comparer.ts`, `qcm.ts`, `memo.ts` (nouveaux) | un module pur par mécanique |
| `src/engine/availability.ts` (modif) | disponibilité des trois nouvelles |
| `src/engine/mecaniques.ts` (nouveau) | registre `MECANIQUES` |
| `src/engine/setup.ts` (modif) | délègue au registre |
| `src/physical/templates.ts`, `kit.ts` (modif), `src/ui/PhysicalKitView.tsx` (modif) | jeux physiques |
| `src/atelier/types.ts`, `brouillon.ts`, `fichier.ts` (modif), `src/parcours/stockage.ts`, `src/compte/activites.ts` (modif) | saisie, tolérance, fichier v2 |
| `src/ui/ComparerBoard.tsx`, `QcmBoard.tsx`, `MemoBoard.tsx`, `plateaux.tsx` (nouveaux) | plateaux |
| `src/ui/ActivityScreen.tsx`, `EtapeElements.tsx`, `Parcours.tsx`, `src/parcours/etapes.ts` (modif) | intégration |

---

### Task 1 : Socle du moteur

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/round.ts`, `src/engine/profiles.ts`, `src/engine/index.ts`
- Create: `src/engine/nombres.ts`
- Test: `tests/round.test.ts`, `tests/nombres.test.ts` (nouveau), `tests/rng.test.ts` non touché
- Modify: `tests/fixtures.ts` (nouvelles activités d'exemple)

**Interfaces:**
- Produces:
  - `type MechanicId = 'associer' | 'trier' | 'ordre' | 'placer' | 'comparer' | 'memo' | 'qcm'`
  - `interface Comparison { id: string; left: string; right: string }`
  - `interface Question { itemId: string; correctId: string; distractorIds: string[] }`
  - `Activity.comparisons?: Comparison[]`, `Activity.questions?: Question[]`
  - `ElementState.choices?: string[]`, `RoundState.deck?: string[]`, `RoundSpec.elements: { id: string; correct: string; choices?: string[] }[]`, `RoundSpec.deck?: string[]`
  - `feedbackFor(kind: FeedbackKind): Feedback` (exporte le texte déjà défini dans `round.ts`)
  - `ProfileParams.choices: number` : Soutien 2, Standard 3, Défi 4
  - `parseNombre(texte: string): number | null` ; `symboleJuste(a: number, b: number): '>' | '<' | '='`
  - Fixtures : `comparerActivity()`, `qcmActivity()`, `toutesActivity()`

- [ ] **Step 1: Écrire les tests qui échouent**

`tests/round.test.ts` (ajouter un `describe('choices et feedbackFor')`) :
- `refuse une option hors des choix de l'élément` : `createRound({ mechanic: 'qcm', exclusive: false, elements: [{ id: 'q1', correct: 'a', choices: ['a', 'b'] }], options: ['a', 'b', 'c'], labels: {}, hintsLeft: 1, maxTries: null })` ; `step(s, { type: 'choose', elementId: 'q1', optionId: 'c' })` donne `feedback.kind === 'ignored'` et `state` identique (`toBe(s)`).
- `l'indice n'écarte qu'une option des choix` : même tour ; après `step(s, { type: 'hint', elementId: 'q1' })`, `elements[0].eliminated` vaut `['b']`.
- `un élément sans choices accepte toutes les options` : comportement inchangé (une option quelconque de `options` est acceptée).
- `feedbackFor('retry').message` vaut `'Pas tout à fait. Essaie encore.'`.
- `createRound` recopie `deck` quand il est fourni et le laisse `undefined` sinon.

`tests/nombres.test.ts` :
- `parseNombre` : `'12'`→12, `' 7 '`→7, `'3,5'`→3.5, `'3.5'`→3.5, `'3/4'`→0.75, `'-2'`→-2 ; `null` pour `''`, `'abc'`, `'1/0'`, `'1,2,3'`, `'3/'`, `'/4'`, `'1 2'`.
- `symboleJuste(12, 8)` vaut `'>'`, `(7, 9)` `'<'`, `(parseNombre('0,5') as number, parseNombre('1/2') as number)` `'='`, `(2/6, 1/3)` `'='`.

`tests/fixtures.ts` : ajouter
- `comparerActivity()` : `comparisons` c1 `12|8`, c2 `3,5|3,50`, c3 `1/2|3/4`, c4 `7|9`, c5 `10|2` ; `items`, `pairs`, etc. vides, mêmes en-têtes qu'`eauActivity`, `cibles: ['TEST.comparer.1']`.
- `qcmActivity()` : 5 questions. Questions `q1` à `q4` avec 3 fausses réponses chacune (items `q1`, `q1r0` bonne, `q1r1` à `q1r3` fausses, etc.), `q5` avec 1 seule fausse. `questions: [{ itemId: 'q1', correctId: 'q1r0', distractorIds: ['q1r1','q1r2','q1r3'] }, …]`. Thème : symboles `>`, `<`, `=` et leurs noms.
- `toutesActivity()` : fusion d'`eauActivity`, `comparerActivity`, `qcmActivity`, `sceneActivity` (items, catégories, pairs, memberships, ranks, comparisons, questions concaténés ; `sceneId` de la scène).

- [ ] **Step 2: Lancer les tests, constater l'échec**

Run: `npx vitest run tests/round.test.ts tests/nombres.test.ts`
Expected: FAIL (`feedbackFor`, `parseNombre` introuvables ; `choices` ignoré).

- [ ] **Step 3: Implémenter**

- `types.ts` : mêmes noms que dans Interfaces.
- `round.ts` : `createRound` recopie `choices` (copie du tableau) et `deck` ; dans `choose`, retourner `ignored` si `element.choices && !element.choices.includes(optionId)` ; dans `useHint`, chercher le candidat dans `element.choices ?? state.options` ; exporter `feedbackFor(kind)` en lisant le tableau `FEEDBACK` existant (ne pas dupliquer les textes).
- `profiles.ts` : ajouter `choices` aux trois profils, avec commentaire « nombre de réponses affichées par question (QCM) ».
- `nombres.ts` : fonctions pures sans import. `parseNombre` : trim, accepte `^-?\d+([.,]\d+)?$` et `^-?\d+/\d+$` avec dénominateur non nul, sinon `null`.
- `index.ts` : exporter `nombres.js`.

- [ ] **Step 4: Lancer les tests, constater le succès**

Run: `npx vitest run`
Expected: tout vert (459 + nouveaux).

- [ ] **Step 5: Commit**

```bash
git add src/engine tests
git commit -m "feat(moteur): socle des gabarits Comparer, Mémo et QCM (choices, deck, nombres)"
```

---

### Task 2 : Moteur Comparer

**Files:**
- Create: `src/engine/comparer.ts`, `tests/comparer.test.ts`
- Modify: `src/engine/availability.ts`, `src/engine/index.ts`, `tests/availability.test.ts`

**Interfaces:**
- Consumes: `parseNombre`, `symboleJuste`, `createRound`, `orderByProfile`, `PROFILES`.
- Produces:
  - `const COMPARE_GAP = ' ▢ '`
  - `const SYMBOLES: readonly { id: '>' | '<' | '='; signe: string; nom: string }[]` : `>` « plus grand que », `<` « plus petit que », `=` « égal à »
  - `splitComparaison(label: string): [string, string]`
  - `setupComparer(activity: Activity, profile: ProfileId, rng: Rng, overrides?: Partial<ProfileParams>): RoundState`
  - `validComparisons(activity: Activity): Comparison[]` dans `availability.ts` (les deux côtés lisibles par `parseNombre`)
  - `availableMechanics(...).comparer` : indisponible avec `'Il faut au moins 3 comparaisons valides.'` sous 3

- [ ] **Step 1: Écrire les tests qui échouent** (`tests/comparer.test.ts`)

- `calcule le symbole juste` : pour `comparerActivity()`, Standard, graine 1, chaque `element.correct` vaut `{ c1: '>', c2: '=', c3: '<', c4: '<', c5: '>' }[element.id]`.
- `le tour propose les trois symboles, non exclusifs` : `options` vaut `['>','<','=']`, `exclusive` faux, `mechanic` `'comparer'`, `labels['>']` vaut `'>'`.
- `le libellé d'une comparaison contient l'écart` : `labels.c1` vaut `'12 ▢ 8'` ; `splitComparaison('12 ▢ 8')` vaut `['12','8']`.
- `le profil limite le nombre de comparaisons` : Soutien 4 éléments, Standard 5 (il n'y en a que 5), Défi 5 avec `hintsLeft` 0 et `maxTries` 3.
- `même graine, même tour` : deux appels `makeRng(7)` donnent les mêmes ids dans le même ordre.
- `ignore une ligne illisible` : activité avec une comparaison `{ left: 'abc', right: '2' }` en plus : elle n'apparaît pas dans le tour.
- `availableMechanics` : 2 comparaisons valides donnent `available: false` avec le message ci-dessus ; 3 donnent `true`.
- `solveAll` du fixtures joue le tour sans erreur et `done` est vrai.

- [ ] **Step 2: Lancer, constater l'échec**

Run: `npx vitest run tests/comparer.test.ts tests/availability.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`setupComparer` : `validComparisons`, tri par `orderByProfile` avec difficulté constante `'moyen'`, découpe à `maxItems`, éléments `{ id, correct: symboleJuste(...) }` dans l'ordre obtenu, options `SYMBOLES.map(s => s.id)` dans l'ordre fixe, `labels` des éléments (`left + COMPARE_GAP + right`) et des symboles (`signe`), `exclusive: false`. Lève `Error('Comparer indisponible : il faut au moins 3 comparaisons valides.')` sous 3. Ajouter l'entrée `comparer` à `availableMechanics`.

- [ ] **Step 4: Lancer, constater le succès**

Run: `npx vitest run`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src/engine tests
git commit -m "feat(moteur): jeu Comparer (symbole calculé, fractions et décimaux)"
```

---

### Task 3 : Moteur QCM

**Files:**
- Create: `src/engine/qcm.ts`, `tests/qcm.test.ts`
- Modify: `src/engine/availability.ts`, `src/engine/index.ts`, `tests/availability.test.ts`

**Interfaces:**
- Consumes: `ElementState.choices`, `ProfileParams.choices`, `orderByProfile`, `shuffle`.
- Produces:
  - `validQuestions(activity: Activity): Question[]` (dans `availability.ts`) : question et bonne réponse existent comme items, au moins 1 et au plus 3 fausses existantes
  - `setupQcm(activity: Activity, profile: ProfileId, rng: Rng, overrides?: Partial<ProfileParams>): RoundState`
  - `availableMechanics(...).qcm` : indisponible avec `'Il faut au moins 3 questions avec une bonne réponse et une fausse réponse.'`

- [ ] **Step 1: Tests qui échouent** (`tests/qcm.test.ts`, `qcmActivity()`)

- `le nombre de réponses suit le profil` : sur les 4 premières questions, chaque `choices.length` vaut 2 en Soutien, 3 en Standard, 4 en Défi.
- `la bonne réponse est toujours dans les choix et les choix sont des items de la question` (50 graines).
- `la bonne réponse n'est pas toujours en première position` : sur 50 graines, Standard, la position de la bonne réponse de `q1` prend au moins 3 valeurs différentes.
- `options` est l'union des choix, sans doublon ; `mechanic` `'qcm'`, `exclusive` faux.
- `une seule fausse saisie en Défi donne 2 choix` : un tour réduit à `q5` (`overrides: { maxItems: 1 }` et activité ne contenant que `q5`) : `choices.length` 2, aucune erreur.
- `choisir une réponse d'une autre question est ignoré` (via `step`).
- `l'indice écarte une fausse réponse de la même question, jamais la bonne`.
- `availableMechanics` : 2 questions valides indisponible, 3 disponible ; une question avec 4 fausses est écartée.

- [ ] **Step 2: Lancer, constater l'échec**

Run: `npx vitest run tests/qcm.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`setupQcm` : questions valides ordonnées par `orderByProfile` (difficulté de l'item question), découpées à `maxItems` ; pour chacune, `choices = shuffle([correctId, ...shuffle(distractorIds).slice(0, params.choices - 1)])` ; élément `{ id: itemId, correct: correctId, choices }` ; `options` = union ordonnée des choix ; `labels` de tous les items ; `exclusive: false`. Lève une erreur sous 3 questions.

- [ ] **Step 4: Lancer, constater le succès**

Run: `npx vitest run`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src/engine tests
git commit -m "feat(moteur): jeu QCM libre (réponses par question selon le profil)"
```

---

### Task 4 : Moteur Mémo

**Files:**
- Create: `src/engine/memo.ts`, `tests/memo.test.ts`
- Modify: `src/engine/availability.ts` (entrée `memo` : mêmes règles que `associer`, message `'Il faut au moins 2 paires.'`), `src/engine/index.ts`, `tests/availability.test.ts`

**Interfaces:**
- Consumes: `validPairs`, `createRound`, `step`, `feedbackFor`, `orderByProfile`, `shuffle`.
- Produces:
  - `setupMemo(activity: Activity, profile: ProfileId, rng: Rng, overrides?: Partial<ProfileParams>): RoundState` : `mechanic: 'memo'`, `exclusive: true`, `maxTries: null`, éléments = côtés gauches, options = côtés droits, `deck` = tous les ids de cartes mélangés une fois. Aucun distracteur.
  - `partnerOf(state: RoundState, cardId: string): string | null`
  - `attemptMatch(state: RoundState, firstId: string, secondId: string): StepResult`
  - `hintMemo(state: RoundState, firstId: string): { state: RoundState; partnerId: string | null }`

- [ ] **Step 1: Tests qui échouent** (`tests/memo.test.ts`, `eauActivity()`)

- `le deck contient chaque carte une seule fois` : Standard, `deck.length` vaut `2 * elements.length`, ids uniques, contient tous les `elements[i].id` et `options`.
- `profil Défi : pas de carte sans partenaire` : avec 3 paires et `maxItems` 8, `deck.length` vaut 6 et `options.length` vaut `elements.length`.
- `même graine, même deck`.
- `une bonne paire se résout` : `attemptMatch(s, 'a1', 'b1')` donne `feedback.kind === 'correct'`, `results` de longueur 1, `firstTry` vrai. Dans l'autre sens (`'b1'` puis `'a1'`) même résultat.
- `une erreur est attribuée à la paire de la première carte` : `attemptMatch(s, 'a1', 'b2')` donne `retry`, `elements` de `a1` avec `wrong` égal à `['b2']`, aucun résultat ; puis la bonne paire donne `firstTry` faux et `tries` 2. L'élément `a2` reste sans erreur.
- `deux cartes du même côté ne forment pas une paire` : `attemptMatch(s, 'a1', 'a2')` donne `retry` et une erreur sur `a1`.
- `une carte déjà trouvée ou la même carte deux fois est ignorée` : `feedback.kind === 'ignored'`, `state` identique.
- `le tour se termine quand toutes les paires sont trouvées` : `done` vrai.
- `hintMemo` : retourne `partnerId` `'b1'` pour `'a1'`, `hintsLeft` diminue de 1, l'élément `a1` a `hintUsed` vrai ; en Défi (`hintsLeft` 0) retourne `partnerId: null` sans changer l'état.

- [ ] **Step 2: Lancer, constater l'échec**

Run: `npx vitest run tests/memo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`attemptMatch` : ignorer (`feedbackFor('ignored')`, même état) si les ids sont identiques, inconnus, ou si l'une des cartes appartient à un élément déjà résolu ; si `partnerOf(first) === second`, appeler `step(state, { type: 'choose', elementId: <côté gauche>, optionId: <côté droit> })` ; sinon ajouter `second` à `wrong` de l'élément de `first` (côté gauche de la paire de `first`) en copiant l'état, sans résultat, avec `feedbackFor('retry')`. `hintMemo` consomme un indice et marque `hintUsed`.

- [ ] **Step 4: Lancer, constater le succès**

Run: `npx vitest run`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src/engine tests
git commit -m "feat(moteur): jeu Mémo (deck mélangé une fois, erreur attribuée à la première carte)"
```

---

### Task 5 : Registre des mécaniques

**Files:**
- Create: `src/engine/mecaniques.ts`, `tests/mecaniques.test.ts`
- Modify: `src/engine/setup.ts`, `src/engine/index.ts`

**Interfaces:**
- Consumes: les sept `setupX`.
- Produces:
  - `interface MecaniqueDef { id: MechanicId; label: string; atelier: boolean; setup: (activity: Activity, profile: ProfileId, rng: Rng, overrides?: Partial<ProfileParams>) => RoundState }`
  - `const MECANIQUES: readonly MecaniqueDef[]` dans l'ordre d'affichage `trier, associer, memo, ordre, comparer, qcm, placer`, libellés `Trier`, `Associer`, `Mémo`, `Remettre en ordre`, `Comparer`, `QCM libre`, `Placer dans une scène` ; `atelier` vrai pour tous sauf `placer`
  - `mecanique(id: MechanicId): MecaniqueDef`
  - `setupRound` garde sa signature et délègue à `mecanique(id).setup`

- [ ] **Step 1: Tests qui échouent** (`tests/mecaniques.test.ts`)

- `les sept mécaniques sont listées une fois` : ids triés égaux à `['associer','comparer','memo','ordre','placer','qcm','trier']`.
- `l'ordre d'affichage est celui prévu`.
- `chaque mécanique disponible dans toutesActivity() se prépare` : pour chaque id où `availableMechanics(toutesActivity())[id].available`, `setupRound(toutesActivity(), id, 'standard', makeRng(1))` retourne un tour dont `mechanic` vaut l'id.
- `placer est la seule hors atelier`.
- Les tests existants de `setup.test.ts` passent inchangés.

- [ ] **Step 2: Lancer, constater l'échec**

Run: `npx vitest run tests/mecaniques.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter** le registre et réduire `setup.ts` à une délégation.

- [ ] **Step 4: Lancer, constater le succès**

Run: `npx vitest run`
Expected: vert. `tsc` ne signale plus que `templates.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/engine tests
git commit -m "refactor(moteur): registre MECANIQUES, setupRound délègue"
```

---

### Task 6 : Jeux physiques

**Files:**
- Modify: `src/physical/templates.ts`, `src/physical/kit.ts`, `src/ui/PhysicalKitView.tsx`
- Test: `tests/physical/templates.test.ts`, `tests/physical/kit.test.ts`, `tests/physical/programme.test.ts`, `tests/ui/physicalkit.test.tsx`

**Interfaces:**
- Consumes: `setupRound`, `PhysicalTemplate`, `calm()` local à `templates.ts`.
- Produces: `PHYSICAL_TEMPLATES.comparer|memo|qcm` ; `buildPhysicalKit` couvre les sept mécaniques.

Valeurs fixées (le reste des phrases `setup`/`play`/`differentiation` suit le ton des quatre modèles existants, à voix basse, sans course) :

| | Comparer | Mémo | QCM |
|---|---|---|---|
| `title` | Les cartons-symboles | Les cartes qui se retrouvent | Les cartons A, B, C |
| `moves` | `['manipulation']` | `['manipulation']` | `['manipulation']` |
| `durationMin` | 10 | 15 | 10 |
| `teamSize` | 2 à 4 | 2 à 4 | 2 à 4 |
| matériel | cartes-nombres `c.elements * 2` ; cartons-symboles `c.teams * 3` ; cartons verts `c.teams` | cartes `c.elements * 2` ; cartons verts `c.teams` | cartes-questions `c.elements` ; cartons de lettres `c.teams * 4` |
| `calm` | `pathMarked: false`, `voice: 'chuchote'` | idem | idem |

Kit :
- Comparer : comportement générique (cartes = comparaisons, stations = trois symboles).
- Mémo : `cards` = toutes les cartes du `deck` (texte `round.labels`), `stations` = côtés droits, `answerKey` = une ligne par paire (carte gauche vers carte droite).
- QCM : `stations` = lettres `A`… jusqu'au plus grand nombre de choix du tour (`{ id: 'A', label: 'A' }`) ; chaque carte a pour texte la question suivie de ses réponses lettrées dans l'ordre de `choices` (`'Question ? A : x, B : y, C : z'`) ; `answerKey` donne la lettre de la bonne réponse.

- [ ] **Step 1: Tests qui échouent**

- `templates.test.ts` : la liste des clés devient `['associer','comparer','memo','ordre','placer','qcm','trier']` ; chaque modèle passe `templateProblems` ; les trois titres ci-dessus ; `moves` de chacun vaut `['manipulation']` (pas de déplacement).
- `kit.test.ts`, sur `toutesActivity()`, Standard, graine 1 : Comparer, `cards.length` 5 et `answerKey` en phase avec `solveAll` ; Mémo, `cards.length` égal à `2 * answerKey.length` ; QCM, `stations` commence par `A`, et pour chaque carte la lettre de `answerKey` désigne dans le texte la bonne réponse.
- `programme.test.ts` : `programmeLinks('comparer', 'numerique', ['M.P4.1.1.i1.a1'])` retourne `phrase: null` (« à compléter »).
- `physicalkit.test.tsx` : la fiche Mémo affiche « Cartes à imprimer » avec `2n` cartes et le corrigé ; la fiche QCM affiche les lettres.

- [ ] **Step 2: Lancer, constater l'échec**

Run: `npx vitest run tests/physical tests/ui/physicalkit.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter** les trois modèles, les deux cas particuliers de `kit.ts`, et dans `PhysicalKitView` la liste « Cartes à imprimer » inchangée (le Mémo y affiche tout le deck) plus un bloc « Lettres des cartons » pour le QCM.

- [ ] **Step 4: Lancer, constater le succès**

Run: `npx vitest run` puis `npx tsc --noEmit`
Expected: vert ; `tsc` propre.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(physique): fiches Comparer, Mémo et QCM"
```

---

### Task 7 : Saisie, tolérance des anciens brouillons, fichier v2

**Files:**
- Modify: `src/atelier/types.ts`, `src/atelier/brouillon.ts`, `src/atelier/fichier.ts`, `src/parcours/stockage.ts`, `src/compte/activites.ts`, `src/parcours/etapes.ts`, `src/ui/Parcours.tsx`
- Test: `tests/atelier/brouillon.test.ts`, `tests/atelier/fichier.test.ts`, `tests/parcours/stockage.test.ts`, `tests/parcours/etapes.test.ts`, `tests/compte/` (le fichier de test d'`activites` existant)

**Interfaces:**
- Produces:
  - `Brouillon.comparaisons: string` (une comparaison `gauche | droite` par ligne), `Brouillon.qcm: string` (une question par ligne : `question | bonne | fausse 1 | fausse 2 | fausse 3`)
  - `completerBrouillon(b: unknown-conforme): Brouillon` : ajoute `''` aux champs absents
  - `analyseComparaisons(texte: string): { comparaisons: { gauche: string; droite: string }[]; erreurs: Ligne[] }`
  - `analyseQcm(texte: string): { questions: { question: string; bonne: string; fausses: string[] }[]; erreurs: Ligne[] }`
  - `avertissementsSaisie(b: Brouillon): string[]` (non bloquant)
  - `statutsJeux(b)` retourne les six jeux `trier, associer, memo, ordre, comparer, qcm`
  - Ids produits par `assembler` : comparaisons `c<k>`, question `q<k>`, réponses `q<k>r0` (bonne), `q<k>r1`…
  - `VERSION_FICHIER = 2` ; `lireActivite` accepte 1 et 2

- [ ] **Step 1: Tests qui échouent**

- `formeBrouillonValide` accepte un brouillon sans `comparaisons` ni `qcm`, refuse `comparaisons: 3`. `completerBrouillon` ajoute `''`. **(Review Focus 1)**
- `chargerBrouillon` d'un stockage `{ v: 1, … }` sans les nouveaux champs donne un brouillon avec `comparaisons === ''` et `qcm === ''` ; idem pour la lecture d'une ligne Supabase (`versActivite`) et la copie `copie()` qui enregistre les deux nouveaux champs.
- `analyseComparaisons` : `'12 | 8'` valide ; erreurs en français, avec numéro de ligne, pour `'12'` (« Il manque le séparateur « | » entre les deux nombres. »), `'12 | 8 | 3'`, `'12 |'`, `'abc | 2'`, `'1/0 | 2'` (« « 1/0 » n'est pas un nombre : écrivez 12, 3,5 ou 3/4. »). **(Review Focus 2)**
- `problemesSaisie` : doublon `'12 | 8'` deux fois ; QCM : question sans bonne réponse, une seule colonne, plus de trois fausses, deux réponses identiques dans une même question, question écrite deux fois.
- `avertissementsSaisie` : avec 3 lignes toutes `>`, signale que les comparaisons donnent toutes le même symbole ; avec un mélange, liste vide ; avec moins de 3 lignes, liste vide.
- `construireActivite` : produit `comparisons` et `questions` aux ids prévus ; une question donne un item question et ses réponses items validés.
- `statutsJeux` : six clés ; `memo` suit `associer` ; `comparer` et `qcm` indisponibles tant qu'il y a moins de 3 lignes.
- Fichier : un fichier v1 sans nouveaux champs est accepté et donne des champs vides ; un fichier v2 les conserve ; `exporterActivite` écrit `version: 2` ; une version 3 est refusée avec le message existant « version plus récente » ; les nouveaux champs comptent dans `CHAMP_MAX`.
- `etapes.test.ts` : l'étape `elements` n'est plus bloquée quand seul un QCM de trois lignes est rempli ; le message d'erreur cite « des comparaisons, des questions » en plus.

- [ ] **Step 2: Lancer, constater l'échec**

Run: `npx vitest run tests/atelier tests/parcours tests/compte`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

`brouillonVide` ajoute les deux champs ; `formeBrouillonValide` vérifie le type seulement s'ils sont présents ; `lireActivite`, `chargerBrouillon`, `versActivite` passent par `completerBrouillon` ; `copie()` et `lireActivite` recopient les nouveaux champs ; `Parcours.tsx` (`enCours`) les prend en compte ; `assembler` remplit `comparisons` et `questions`. `avertissementsSaisie` : au moins 3 comparaisons valides dont les non-égales donnent toutes le même symbole.

- [ ] **Step 4: Lancer, constater le succès**

Run: `npx vitest run` puis `npx tsc --noEmit`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(atelier): saisie Comparer et QCM, anciens brouillons tolérés, fichier v2"
```

---

### Task 8 : Plateaux Comparer et QCM

**Files:**
- Create: `src/ui/ComparerBoard.tsx`, `src/ui/QcmBoard.tsx`, `tests/ui/comparerboard.test.tsx`, `tests/ui/qcmboard.test.tsx`
- Modify: `src/styles/gazette.css` (classes `.comparaison`, `.symboles`, `.reponses`, `.indice-ecarte` ; aucune animation en `body.calme`)

**Interfaces:**
- Consumes: `step`, `progress`, `RoundState`, `ElementResult`, `SYMBOLES`, `splitComparaison`.
- Produces: `ComparerBoard({ round, onDone }: { round: RoundState; onDone: (r: ElementResult[]) => void })` et `QcmBoard` (mêmes props).

Comportement commun : un seul élément visible à la fois (le premier non résolu), progression « `k sur n` » (`progress`), bouton « Indice » (désactivé si plus d'indice), zone `role="status"` `aria-live="polite"` pour le retour du moteur, option écartée désactivée, `onDone(results)` appelé une seule fois à la fin avec message « Tous les éléments sont faits. ». Comparer : groupe `aria-label` « Compare 12 et 8 » affichant `12`, `▢` (aria-hidden) et `8` ; trois boutons au nom accessible `plus grand que`, `plus petit que`, `égal à` et au texte visible `>`, `<`, `=`. QCM : la question en titre, une réponse par bouton dans l'ordre de `choices`.

- [ ] **Step 1: Tests qui échouent** (mêmes montages que `roundboard.test.tsx` : `CalmProvider`, `matchMedia` simulé)

Pour chaque plateau :
- affiche le premier élément et `0 sur n` ;
- une bonne réponse affiche « Bien vu. » et passe à `1 sur n` ;
- une mauvaise affiche « Pas tout à fait. Essaie encore. » et l'élément reste affiché ;
- « Indice » désactive une mauvaise option (`toBeDisabled`) sans toucher la bonne ;
- jouer tout le tour appelle `onDone` une fois avec `n` résultats ;
- utilisable au clavier : `userEvent.tab()` puis `userEvent.keyboard('{Enter}')` sur un bouton répond.
Comparer en plus : le nom accessible des trois boutons ci-dessus.

- [ ] **Step 2: Lancer, constater l'échec**

Run: `npx vitest run tests/ui/comparerboard.test.tsx tests/ui/qcmboard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter** les deux composants (état local `RoundState`, `step` pour tout, comme `RoundBoard`).

- [ ] **Step 4: Lancer, constater le succès**

Run: `npx vitest run`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(ui): plateaux Comparer et QCM"
```

---

### Task 9 : Plateau Mémo

**Files:**
- Create: `src/ui/MemoBoard.tsx`, `tests/ui/memoboard.test.tsx`
- Modify: `src/styles/gazette.css` (grille de cartes, états `face-cachee`, `visible`, `trouvee`, `indice`)

**Interfaces:**
- Consumes: `attemptMatch`, `hintMemo`, `partnerOf`, `progress`.
- Produces: `MemoBoard({ round, onDone }: { round: RoundState; onDone: (r: ElementResult[]) => void })`.

Décision de ce plan, écart assumé avec le 5.2 de la spec : la pause après une erreur est **pilotée par l'élève** (les deux cartes restent visibles jusqu'au bouton « Cacher les cartes » ou jusqu'au clic sur une autre carte), pas par un minuteur. Raison : la règle « aucun chronomètre » et les lecteurs d'écran, qui n'ont pas le temps de lire une carte qui se retourne seule. À signaler à JF.

Comportement : grille issue de `round.deck` ; nom accessible `Carte 3, face cachée`, puis `Carte 3 : <texte>`, puis `Carte 3 : <texte>, trouvée` ; deux cartes visibles au plus ; après erreur, retour « Pas tout à fait. Essaie encore. » ; bouton « Indice » après la première carte retournée : entoure la carte partenaire (`hintMemo`) et annonce « Une carte est entourée : elle va avec celle-ci. » ; progression « k sur n » ; `onDone` une fois ; mode calme : l'état change sans animation.

- [ ] **Step 1: Tests qui échouent** (`eauActivity()`, Standard, graine 1)

- la grille a `2n` boutons de nom `Carte k, face cachée` ;
- retourner une carte puis son partenaire : les deux deviennent `trouvée`, retour « Bien vu. », progression `1 sur n` ;
- retourner deux cartes non liées : retour « Pas tout à fait. Essaie encore. », les deux restent visibles, une troisième carte est ignorée (pas de changement), « Cacher les cartes » les remet face cachée ; cliquer une autre carte à la place les cache et retourne celle-ci ; **(Review Focus 6)**
- cliquer deux fois la même carte ne compte pas comme une paire ;
- cliquer une carte trouvée est ignoré ;
- « Indice » : la carte partenaire a la classe `indice` et le retour contient « Une carte est entourée » ; désactivé quand `hintsLeft` vaut 0 ;
- toutes les paires trouvées : `onDone` appelé une fois avec `n` résultats.

- [ ] **Step 2: Lancer, constater l'échec**

Run: `npx vitest run tests/ui/memoboard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter** `MemoBoard` (état : `RoundState`, `visibles: string[]`, message ; la paire trouvée est dérivée de `resolvedWith`).

- [ ] **Step 4: Lancer, constater le succès**

Run: `npx vitest run`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(ui): plateau Mémo, pause pilotée par l'élève"
```

---

### Task 10 : Intégration dans les écrans

**Files:**
- Create: `src/ui/plateaux.tsx`
- Modify: `src/ui/ActivityScreen.tsx`, `src/ui/EtapeElements.tsx`
- Test: `tests/ui/activityscreen.test.tsx`, `tests/ui/app.test.tsx`, `tests/ui/parcours-etapes-1-3.test.tsx` (ajuster les attendus qui comptent les jeux), nouveau `tests/ui/etape-elements.test.tsx`

**Interfaces:**
- Consumes: `MECANIQUES`, `mecanique`, les cinq plateaux.
- Produces: `PLATEAUX: Record<MechanicId, ComponentType<{ round: RoundState; profile: ProfileId; onDone: (r: ElementResult[]) => void }>>` ; `ActivityScreen` n'a plus de `ORDER`, `LABEL` ni de test `m === 'placer'` ; `EtapeElements` n'a plus de `NOMS_JEUX`.

Textes d'`EtapeElements` (guidage obligatoire) :
- Titre de section « Paires pour les jeux Associer et Mémo » (le champ `paires` ne change pas).
- « Comparaisons pour le jeu Comparer » : label « Nombres à comparer », placeholder « Exemple : 12 | 8 », aide « Une comparaison par ligne : deux nombres séparés par une barre verticale |. L'application calcule le symbole juste, vous ne le tapez pas. Entiers, décimaux (3,5) et fractions (3/4) sont acceptés. Il faut au moins trois lignes. »
- « Questions pour le QCM libre » : label « Questions et réponses », placeholder « Exemple : Quel symbole veut dire « plus grand que » ? | > | < | = », aide « Une question par ligne : la question, la bonne réponse, puis une à trois fausses réponses, séparées par une barre verticale |. Écrivez toujours la bonne réponse en premier : l'application mélange l'ordre pour les élèves. Il faut au moins trois questions. »
- Zone `role="status"` « À vérifier : » listant `avertissementsSaisie` (distincte de « À corriger : »).
- « Jeux disponibles » liste les mécaniques `atelier` du registre avec `statutsJeux`.

- [ ] **Step 1: Tests qui échouent**

- `ActivityScreen` avec `toutesActivity()` : un bouton « Jouer : Comparer », « Jouer : Mémo », « Jouer : QCM libre » existent ; l'ordre des titres suit le registre ; cliquer « Jouer : Mémo » ouvre une grille de cartes, « Jouer : Comparer » un symbole cliquable, « Jouer : QCM libre » une question ; Placer garde `SceneBoard`.
- Chaque nouveau jeu a sa carte « En classe, sans écran » avec le titre du modèle physique.
- `EtapeElements` : les deux nouveaux champs ont label, placeholder et aide reliée (`aria-describedby`) ; saisir `12 | 8` et deux autres lignes passe « Comparer » à « Disponible » ; saisir `12` affiche l'erreur de ligne ; trois lignes `>` affichent l'avertissement sans bloquer.
- Les tests existants qui comptaient quatre jeux sont ajustés (le Mémo apparaît dès que deux paires existent).

- [ ] **Step 2: Lancer, constater l'échec**

Run: `npx vitest run tests/ui`
Expected: FAIL.

- [ ] **Step 3: Implémenter** `plateaux.tsx` (cinq plateaux ; `SceneBoard` reçoit `profile`, les autres l'ignorent) et brancher les deux écrans sur le registre.

- [ ] **Step 4: Lancer, constater le succès**

Run: `npx vitest run` puis `npx tsc --noEmit` puis `npx vite build`
Expected: vert, `tsc` propre, build sans erreur.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(ui): Comparer, Mémo et QCM dans la saisie et les jeux"
```

---

### Task 11 : Vérification dans le navigateur et suivi

**Files:**
- Modify: `memory/gameactif-session-prompt.md` (workspace), `gameactif/essais/` si un constat est écrit

- [ ] **Step 1: Vérifier dans le navigateur**

Lancer le serveur `gameactif-app` (`preview_start`, port 5196). Parcours réel : niveau P4, maths, une compétence, saisir un titre, un contexte (« 18 élèves »), 3 comparaisons dont une fraction, 2 paires `plus grand que | >` et `plus petit que | <`, 3 questions QCM. Constater : les six jeux sont « Disponible » ; jouer Comparer (clic et clavier), Mémo (paire juste, erreur, « Cacher les cartes », indice), QCM (profils Soutien et Défi) ; ouvrir une fiche physique de chacun ; exporter le fichier, recharger la page, réimporter : les nouveaux champs reviennent ; importer un fichier v1 d'une activité précédente : accepté. `read_console_messages` : aucune erreur.

- [ ] **Step 2: Écrire le constat honnêtement**

Dans `memory/gameactif-session-prompt.md`, ajouter l'état du plan 5 : ce qui est constaté (commande ou capture), ce qui n'est pas vérifié (tablette, lecteur d'écran réel, impression PDF, `file://`, essai avec élèves), l'écart sur la pause du Mémo, et que rien n'est poussé.

- [ ] **Step 3: Vérifications finales**

Run: `npx vitest run`, `npx tsc --noEmit`, `npx vite build`
Expected: tout au vert ; reporter les nombres exacts de fichiers de test et de tests.

- [ ] **Step 4: Commit**

```bash
git add essais docs
git commit -m "docs: constat du plan 5 (Comparer, Mémo, QCM)"
```
