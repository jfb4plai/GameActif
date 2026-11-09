# Français comme matière (P1 à P6) : plan d'implémentation

> **Pour les exécutants :** sous-compétence requise : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** proposer « Français » à l'étape « Matière » du parcours, avec les 1 028 attendus des rubriques de P1 à P6, suivi par code compris.

**Architecture :** un second jeu de données `data/referentiel-francais.json`, fabriqué par `scripts/build-referentiel.mjs` avec des codes `F.P#.r#.i#.a#` (le français n'a aucun code dans sa source) ; `src/data/referentiel.ts` fusionne les deux jeux ; l'expression régulière des codes d'attendus devient `^[MF]\.P[1-6](\.[A-Za-z0-9]+)+$` en TypeScript et dans une nouvelle migration SQL (la migration 20261107 est déjà appliquée en production : on n'y touche pas).

**Pile :** TypeScript, React, Vitest, PGlite pour les essais SQL, Supabase (projet partagé dfoaumjleqtxjeaplnna).

**Spec :** `docs/superpowers/specs/2026-11-06-francais-adaptateur-etude.md` (étude, constats et chiffres) et les décisions de JF du 2026-11-09 ci-dessous.

## Décisions et hypothèses

- Décidé par JF le 2026-11-09 : français, **tous les niveaux P1 à P6**.
- Hypothèse (non donnée par JF) : **rubriques** (1 028 attendus), pas les compétences (112, trop larges pour un suivi). Les compétences restent hors périmètre.
- Hypothèse (non donnée par JF) : **ni activité pilote de français ni filtre par visée** dans ce plan (l'étude les posait comme décisions ouvertes) : à ajouter plus tard si JF les veut.
- Hors périmètre : secondaire, `previsualisation/referentiel-data.js` (reste maths), lisibilité des codes `F.` dans la liste « Attendu » du tableau de bord (affiche le code seul, comme pour les maths).
- Chargement : les deux jeux sont embarqués d'office. Mesure avant (constatée, `npx vite build`, 2026-11-09) : `index-*.js` 807,50 kB, gzip 169,59 kB. Le chargement à la demande n'est pas dans ce plan.

## Contraintes globales

- TDD : chaque test est écrit et vu échouer avant le code.
- Avant tout `git push` : suite complète, `npx tsc --noEmit`, `npx vite build` au vert. Branche `main`, jamais `master`.
- Tout accord de JF est requis avant : appliquer la migration à la base partagée, pousser. Les essais en base se font en transaction annulée.
- Aucun prénom ni nom d'élève dans les données ou les tests. Fins de ligne : ne pas commiter les `supabase/essai-rollback-*.sql` modifiés par les fins de ligne Windows.
- Consignes élèves à l'infinitif, exemples FWB.

## Revue ciblée (cas que les tests de tâche n'exercent pas)

- Une activité de français enregistrée sous un code `F.` est refusée par la base tant que la migration n'est pas appliquée : le message d'erreur côté élève doit rester celui des refus habituels (testé en tâche 5 côté TypeScript ; la base est essayée en tâche 6).
- Un brouillon enregistré avec une matière `francais` puis rouvert : la matière doit être reconnue (tâche 3).
- Un fichier d'activité exporté en français puis importé : les codes `F.` sont conservés (tâche 3).

---

### Tâche 1 : données du français

**Fichiers :**
- Modifier : `scripts/build-referentiel.mjs` (second bloc, après le bloc maths)
- Créer : `data/referentiel-francais.json` (généré, commité)
- Tester : `tests/data/referentiel-francais.test.ts`

**Interfaces :**
- Produit : `data/referentiel-francais.json`, tableau d'entrées de même forme que `referentiel-maths.json` : `{ code, annee, matiere: 'francais', champ: 'rubrique', champ_titre, sous_point, sous_point_titre, item_type, item_contenu, texte, version_source }`.
- Code : `F.${annee}.r${rubrique}.i${item}.a${attendu}`, rangs à partir de 1 dans l'ordre du fichier `referentiels-fwb/francais/P#.json` (`rubriques[]`, puis `items[]`, puis `attendus[]`). `sous_point` = `r${rubrique}`. `sous_point_titre` = `rubrique`, suivi de ` : ${sous_rubrique}` quand `sous_rubrique` n'est pas nul. `item_type` = `type`, `item_contenu` = `contenu`.

- [ ] **Étape 1 : écrire le test qui échoue.** `referentiel-francais.test.ts` lit `data/referentiel-francais.json` et vérifie : nombre d'entrées par année `{P1:116,P2:131,P3:168,P4:191,P5:212,P6:210}` ; codes uniques et conformes à `/^F\.P[1-6]\.r\d+\.i\d+\.a\d+$/` ; `matiere === 'francais'` partout ; aucun `texte` vide ; l'entrée `F.P3.r1.i1.a1` a un texte qui commence par « Citer les paramètres de la communication ».
- [ ] **Étape 2 : lancer le test, constater l'échec** (`npx vitest run tests/data/referentiel-francais.test.ts` : fichier introuvable).
- [ ] **Étape 3 : généraliser `scripts/build-referentiel.mjs`.** Ajouter la constante `ATTENDUS_FRANCAIS` (les six comptes ci-dessus), un second bloc qui lit `../referentiels-fwb/francais/P#.json`, échoue si un compte diffère (comme `ATTENDUS_ATTENDUS`), vérifie l'unicité des codes, écrit `data/referentiel-francais.json`. Le bloc maths et ses sorties restent inchangés.
- [ ] **Étape 4 : lancer `node scripts/build-referentiel.mjs`.** Attendu : une ligne « OK » par jeu, 861 et 1 028 attendus ; `git diff --stat data/referentiel-maths.json` vide.
- [ ] **Étape 5 : relancer le test, constater le succès.**
- [ ] **Étape 6 : commit** (`feat(referentiel): données du français P1 à P6, 1 028 attendus`).

### Tâche 2 : chargement et catalogue

**Fichiers :**
- Modifier : `src/data/referentiel.ts`, `src/data/catalogue.ts`
- Tester : `tests/data/catalogue.test.ts`, `tests/data/referentiel.test.ts`, et les tests existants qui supposent une seule matière.

**Interfaces :**
- Consomme : `data/referentiel-francais.json` (tâche 1).
- Produit : `REFERENTIEL` contient maths puis français (1 889 entrées) ; `matieres(niveau)` renvoie `[{id:'mathematiques',label:'Mathématiques'},{id:'francais',label:'Français'}]` dans cet ordre pour tout niveau P1 à P6 ; `competences('P3','francais')` renvoie 10 groupes.

- [ ] **Étape 1 : tests qui échouent.** `matieres('P3')` donne les deux matières dans l'ordre ; `competences('P3','francais')` a 10 groupes dont chaque attendu commence par `F.P3.` ; tous les codes de `REFERENTIEL` sont uniques ; `referentielCodes()` contient `F.P3.r1.i1.a1`.
- [ ] **Étape 2 : lancer, constater l'échec.**
- [ ] **Étape 3 : implémenter.** `referentiel.ts` importe les deux JSON et exporte la concaténation ; `catalogue.ts` ajoute `francais: 'Français'` à `LIBELLES_MATIERES` et trie les matières selon l'ordre `['mathematiques','francais']`.
- [ ] **Étape 4 : suite complète.** Des tests existants peuvent supposer une seule matière ou un nombre d'attendus : les adapter en gardant leur intention, et ledger chaque adaptation. Attendu : tout au vert, `tsc` propre.
- [ ] **Étape 5 : commit** (`feat(catalogue): le français devient une matière du parcours`).

### Tâche 3 : parcours, brouillon et fichier en français

**Fichiers :**
- Tester : `tests/parcours/etapes.test.ts`, `tests/atelier/fichier.test.ts`, `tests/ui/parcours-etapes-1-3.test.tsx`
- Modifier : seulement si un test échoue pour une raison de code (aucune modification attendue : `etapes.ts` et `fichier.ts` filtrent déjà par `matiere` et `code`).

**Interfaces :**
- Consomme : `matieres()`, `competences()`, `REFERENTIEL` (tâche 2).

- [ ] **Étape 1 : tests.** (a) `etapes` : après `choisirNiveau` P3 puis `choisirMatiere` `francais`, ajouter la cible `F.P3.r1.i1.a1` est accepté, `M.P3.1.1.i1.a1` est refusé ; changer de matière retire les cibles de l'autre matière. (b) `fichier` : un brouillon français exporté puis importé garde ses cibles `F.` et sa matière. (c) UI : au niveau P3, l'étape « Matière » propose Mathématiques et Français ; choisir Français puis « Suivant » affiche 10 groupes de compétences (`.groupe-competences`).
- [ ] **Étape 2 : lancer. Constater** quels tests échouent, et pourquoi. Si tous passent d'emblée, vérifier par mutation (retirer `francais` de `LIBELLES_MATIERES` fait échouer (c)) avant de continuer : un test qui passe sans code neuf doit être prouvé utile.
- [ ] **Étape 3 : corriger le code seulement si nécessaire**, ledger la raison.
- [ ] **Étape 4 : suite complète au vert, commit** (`test(parcours): parcours et fichier d'activité en français`).

### Tâche 4 : forme d'un code d'attendu (TypeScript)

**Fichiers :**
- Créer : `src/suivi/attendu.ts`
- Modifier : `src/ui/SaisieManuelle.tsx` (ligne 7 : remplacer `FORME_ATTENDU` par l'appel)
- Tester : `tests/suivi/attendu.test.ts`

**Interfaces :**
- Produit : `export function estCodeAttendu(code: string): boolean` : vrai pour `/^[MF]\.P[1-6](\.[A-Za-z0-9]+)+$/`.

- [ ] **Étape 1 : test qui échoue** : vrai pour `M.P4.1.1.i1.a1` et `F.P3.r1.i1.a1` ; faux pour `X.P4.1`, `F.P7.r1`, `F.P3`, `f.P3.r1`, chaîne vide.
- [ ] **Étape 2 : lancer, constater l'échec.** Étape 3 : implémenter `attendu.ts` et brancher `SaisieManuelle.tsx`. Étape 4 : suite complète au vert.
- [ ] **Étape 5 : commit** (`feat(suivi): les codes d'attendus F. sont acceptés côté application`).

### Tâche 5 : liens programme et prompts avec un code `F.`

**Fichiers :**
- Tester : `tests/physical/programme.test.ts`, `tests/prompts/construire.test.ts`
- Modifier : `src/physical/programme.ts`, `src/prompts/construire.ts` seulement si les tests montrent une erreur ou un texte faux.

**Interfaces :**
- Consomme : `programmeLinks(mecanique, support, cibles, ref = REFERENTIEL)` (`src/physical/programme.ts:84`), `REFERENTIEL.find` (`src/prompts/construire.ts:57`).

- [ ] **Étape 1 : tests.** `programmeLinks('trier','numerique',['F.P3.r1.i1.a1'])` ne lève pas d'erreur et renvoie un lien dont le texte vient du référentiel ou « À compléter par l'enseignant » (jamais `undefined`) ; le prompt construit avec une cible `F.P3.r1.i1.a1` contient le texte de l'attendu et la discipline « Français ».
- [ ] **Étape 2 : lancer, constater.** Étape 3 : corriger le code si un test échoue, ledger la raison. Étape 4 : suite au vert, commit (`test(programme): liens et prompts pour les attendus du français`).

### Tâche 6 : migration SQL, essai et fichier d'essai en transaction annulée

**Fichiers :**
- Créer : `supabase/migrations/20261109_game_codes_francais.sql`, `supabase/essais/game_francais.assertions.sql`, `tests/sql/game_francais.test.ts`
- Modifier : `scripts/build-essai-sql.mjs` (quatrième bloc), génère `supabase/essai-rollback-game_francais.sql`

**Interfaces :**
- Consomme : les migrations `20261103`, `20261107`, `20261108` ; `jouer(sqlMigrations, sqlEssais)` et `lire(chemin)` de `tests/sql/supabaseSimule.ts` ; le modèle `tests/sql/game_partage.test.ts` (même structure : cas, mutations, fraîcheur du fichier d'essai).
- Produit : la fonction `public.game_record_session(text, text, jsonb)` recréée à l'identique de celle de `20261107_game_suivi.sql` (lignes 162 à 296, droits compris), avec la seule expression régulière des cibles changée en `'^[MF]\.P[1-6](\.[A-Za-z0-9]+)+$'` ; la contrainte de `public.game_manual_results.cible` remplacée par la même expression (`alter table … drop constraint game_manual_results_cible_check`, puis `add constraint … check (cible ~ '…')` ; vérifier le nom réel de la contrainte dans PGlite avant d'écrire).
- En-tête de la migration : « NON APPLIQUÉE à la base partagée » (le test de statut suit le modèle des autres migrations, avec « NON APPLIQUÉE » tant que JF n'a pas appliqué).

- [ ] **Étape 1 : écrire `game_francais.assertions.sql` et `game_francais.test.ts`.** Cas : (f1) `game_record_session` accepte une séance dont la cible est `F.P3.r1.i1.a1` ; (f2) elle accepte encore `M.P4.1.1.i1.a1` ; (f3) elle refuse `X.P3.r1` et `F.P7.r1` ; (f4) l'enseignant propriétaire peut insérer un résultat manuel avec la cible `F.P3.r1.i1.a1` ; (f5) un résultat manuel avec `X.P3.r1` est refusé ; (f6) les droits sont inchangés : `anon` peut exécuter `game_record_session`, `anon` ne peut pas lire `game_sessions`. Le test du fichier : toutes les migrations rejouées puis les essais passent ; mutation « ancienne expression régulière » échoue sur `ECHEC (f1)` ; chaque cas `OK (f#)` est présent ; la migration ne crée que des objets préfixés `game_` ; le fichier d'essai de la base partagée est à jour.
- [ ] **Étape 2 : lancer, constater l'échec** (migration absente).
- [ ] **Étape 3 : écrire la migration**, puis le quatrième bloc de `build-essai-sql.mjs` : `begin; set local lock_timeout = '3s';` + migration 20261109 + essais `game_francais` + `rollback;` (sans rejouer les trois premières migrations : elles sont appliquées en production), puis `node scripts/build-essai-sql.mjs`. Ne commiter que le nouveau fichier d'essai, pas les trois anciens.
- [ ] **Étape 4 : suite complète, `tsc`, `vite build` au vert, commit** (`feat(suivi): la base accepte les codes d'attendus du français (non appliquée)`).
- [ ] **Étape 5 (accord de JF requis, une étape à la fois) :** (a) essai en transaction annulée sur la base partagée : `npx --no-install supabase db query --remote=dfoaumjleqtxjeaplnna --yes -f supabase/essai-rollback-game_francais.sql` ; (b) application de la migration ; (c) mettre l'en-tête à « APPLIQUÉE le <date> » et le test avec.

### Tâche 7 : poids, vérification dans le navigateur, documents

**Fichiers :**
- Modifier : `docs/superpowers/specs/2026-11-06-francais-adaptateur-etude.md` (statut), `C:\Users\jfbeg\OneDrive\claude-workspace\memory\gameactif-session-prompt.md`

- [ ] **Étape 1 : mesurer le poids.** `npx vite build` ; noter `index-*.js` et gzip, à comparer à 807,50 kB et 169,59 kB. Reporter les deux chiffres dans la réponse à JF ; pas de seuil décidé : c'est JF qui juge.
- [ ] **Étape 2 : parcours réel en local** (`npm run dev` via `preview_start`) : P3, Français, choisir un attendu de la rubrique 1, saisir quelques éléments, arriver à « Vos jeux », vérifier que « Associer » est en tête et qu'un jeu se lance ; exporter le fichier puis le réimporter. Prouver par capture ou lecture de page, pas par déclaration.
- [ ] **Étape 3 : mettre à jour l'étude (statut : exécutée, résultats) et le fichier de session**, trois statuts : constaté, déduit, non vérifié. Rappeler : vignette du portail (`portail-plai/src/data/apps.ts`) à mettre à jour par JF, mention « maths et français ».
- [ ] **Étape 4 : revue finale de toute la branche** (sous-agent ou auto-revue déclarée), puis commit.
