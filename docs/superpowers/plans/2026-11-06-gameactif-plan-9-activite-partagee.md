# GameActif plan 9 : activité partagée par lien et QR, profils au choix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un enseignant publie une activité pour une de ses classes et obtient un QR et un lien courts ; une tablette sans compte l'ouvre, choisit un code élève et joue, au profil décidé par l'enseignant (même profil, un lien par groupe, ou profil par code), avec un dépassement libre d'un niveau visible dans le tableau de bord.

**Architecture:** L'activité partagée est une ligne `game_shared_activities` rattachée à une classe (suppression en cascade). Elle est écrite par une fonction Postgres réservée au propriétaire, qui remplace le contexte de classe par un texte fixe côté serveur, et lue par une fonction ouverte à `anon`. Le profil par code est une table `game_class_profiles` lue par une fonction ciblée. Côté navigateur, `?activite=CODE` remplace le parcours par une vue élève ; `ActivityScreen` reçoit une propriété `eleve` qui masque l'outillage de l'enseignant et gère le dépassement ; l'indicateur `above` suit la séance jusqu'au tableau de bord.

**Tech Stack:** React 18, TypeScript, Vite 5, Vitest + Testing Library, Supabase, PGlite pour le SQL, `qrcode-generator` 1.4.4 (MIT).

**Spec:** `docs/superpowers/specs/2026-11-06-activite-partagee-design.md`. Base de départ : la branche `feat/suivi-par-code` (plan 8 : classes, séances, tableau de bord), non poussée.

## Global Constraints

- Tables, fonctions, index, politiques préfixés `game_` ; `GRANT` explicites dans la migration ; RLS actif ; jamais d'`EXISTS` auto-joint (fonction `security definer`) ; essai de la migration en transaction annulée avant application.
- Le contexte de classe n'est jamais stocké ni affiché chez l'élève : le serveur le remplace par `Activité partagée à la classe`.
- `anon` ne lit rien directement ; il n'appelle que `game_get_shared_activity`, `game_profile_for`, `game_class_info`, `game_record_session`.
- Contenu partagé : 200 000 octets au plus ; aucun prénom ; aucun appel à un service externe pour le QR.
- Le profil reste une décision de l'enseignant ; aucun nom de profil montré à l'élève (noms neutres) ; le dépassement monte d'un niveau seulement, jamais d'un niveau vers le bas.
- Un tour joué au-dessus du profil n'alimente ni « À reprendre » ni les erreurs par type ni la courbe d'évolution.
- Police 16 px minimum ; chaque champ a un label, un exemple concret et une aide ; consignes élèves à l'infinitif ; aucun tiret cadratin dans le dépôt.
- Pas de `git push`, pas d'application de migration, pas de variable Vercel sans accord explicite de JF.
- `npx tsc --noEmit`, `npx vitest run` et `npx vite build` passent avant chaque commit.

## Décisions de plan [Plan]

- Tant que `20261107_game_suivi.sql` n'est pas appliquée, la colonne `above` et sa validation sont ajoutées dans ce fichier (pas de `create or replace`). Si elle est appliquée avant l'exécution de ce plan, reporter la tâche 1, étape A dans une nouvelle migration `20261108_...` avec `create or replace function`.
- Les noms neutres des niveaux sont provisoires : « Pas à pas », « Équilibre », « Défi » (Soutien, Standard, Défi). Les couleurs du mode 2 : vert, bleu, orange. JF les fixe ; ils ne vivent que dans `src/partage/niveaux.ts`.
- Un lien de groupe invalide (`g=9`, `g=x`) retombe sur le groupe 2 (profil standard).
- Mode 3 : si la fonction de profil échoue (réseau), la tablette joue au profil par défaut de l'activité et le dit.
- Le cache local de l'activité est une copie lisible seulement ; il ne contient jamais de contexte.
- Où publier : le bouton « Proposer à la classe » est dans l'étape « Vos jeux » du parcours. « Mes activités » viendra plus tard.

## Review Focus

1. Lien inconnu, retiré, ou classe supprimée : la vue élève affiche « Cette activité n'est plus proposée. », jamais une page blanche (tâches 8 et 9).
2. Brouillon publié dont le contexte contient un prénom : la base stocke et renvoie le texte fixe ; la vue élève n'affiche jamais le contexte (tâches 1 et 8).
3. Mode 3 : code sans profil assigné reçoit « standard » ; réseau en panne au choix du code : profil par défaut et message (tâches 4 et 8).
4. Dépassement : Défi n'a pas de bouton ; un tour au-dessus n'alimente pas « À reprendre » ; `g=9` retombe sur le groupe 2 (tâches 3, 7 et 8).
5. Hors ligne : rouvrir le lien affiche la dernière activité en cache avec un message ; un cache corrompu est ignoré sans planter (tâches 4 et 8).

---

### Task 1: Base : activité partagée, profils par code, indicateur `above`

**Files:**
- Modify: `supabase/migrations/20261107_game_suivi.sql` (colonne `above`, validation)
- Create: `supabase/migrations/20261108_game_partage.sql`
- Create: `supabase/essais/game_partage.assertions.sql`
- Create: `tests/sql/supabaseSimule.ts` (extrait de `tests/sql/game_suivi.test.ts` : `baseSupabase`, `jouer`, `lire`)
- Modify: `tests/sql/game_suivi.test.ts` (importe l'aide ; ajoute le cas `(s25)`)
- Modify: `supabase/essais/game_suivi.assertions.sql` (cas `(s25)`)
- Test: `tests/sql/game_partage.test.ts`

**Interfaces:**
- Produces (SQL) :
  - `game_sessions.above boolean not null default false` ; `game_record_session` accepte `above` (booléen, facultatif ; une valeur d'un autre type renvoie `'invalide'`).
  - `game_shared_activities(id uuid pk, class_id uuid, code text unique ^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$, titre text, brouillon jsonb, mode text in ('meme','groupes','par-code'), profil_defaut text in ('soutien','standard','defi'), created_at, updated_at)`, `on delete cascade` depuis `game_classes`.
  - `game_publish_activity(p_class_id uuid, p_code text, p_brouillon jsonb, p_mode text, p_profil text) returns text` : propriétaire seulement ; `p_code` nul = nouvelle ligne (20 au plus par classe), sinon met à jour la ligne de ce code ; remplace `brouillon.contexte` par `Activité partagée à la classe` ; refuse un brouillon qui n'est pas un objet, de plus de 200 000 octets, ou sans `titre` ; renvoie le code.
  - `game_unpublish_activity(p_code text) returns void` : propriétaire seulement.
  - `game_get_shared_activity(p_code text) returns jsonb` : `anon`, `authenticated` ; renvoie `{titre, brouillon, mode, profilDefaut, classCode, nbCodes}` ou `null` (code inconnu, mal formé, classe échue).
  - `game_class_profiles(class_id uuid, student_code text ^E[0-9]{2}$, profile text, primary key (class_id, student_code))` ; propriétaire seul : `select`, `insert`, `update`, `delete`.
  - `game_profile_for(p_class_code text, p_student_code text) returns text` : `anon`, `authenticated` ; profil assigné, sinon `'standard'` ; `null` si la classe est inconnue ou échue ou le code élève mal formé.
  - Politique `select` de `game_shared_activities` : propriétaire (`game_owns_class`) ; aucun droit d'écriture direct.

- [ ] **Step A: Écrire les essais `(s25)` dans `game_suivi.assertions.sql`** : une séance valide avec `"above": true` est acceptée et `game_sessions.above` vaut `true` ; sans `above`, `false` ; avec `"above": "oui"`, `'invalide'`. Ajouter `'(s25)'` à la liste `CAS` de `game_suivi.test.ts`. Run `npx vitest run tests/sql/game_suivi.test.ts`. Expected: FAIL.
- [ ] **Step B: Implémenter** la colonne `above` et sa validation dans `20261107_game_suivi.sql` (la fonction relit `p_payload -> 'above'` : absent, faux ; booléen, retenu ; autre type, refus). Run le test. Expected: PASS.
- [ ] **Step C: Extraire `tests/sql/supabaseSimule.ts`** et faire importer `game_suivi.test.ts`. Run `npx vitest run tests/sql`. Expected: PASS (comportement inchangé).
- [ ] **Step D: Écrire `game_partage.assertions.sql` (cas `(p1)` à `(p9)`) et `game_partage.test.ts`** (migrations appliquées dans l'ordre : `20261103`, `20261107`, `20261108`) :
  - `(p1)` le propriétaire publie : code de forme attendue ; un autre enseignant et un compte sans accès obtiennent une exception.
  - `(p2)` publier un brouillon dont `contexte` vaut « Classe de Léa, 24 élèves » : `game_get_shared_activity` renvoie `contexte = 'Activité partagée à la classe'` et aucune table ne contient « Léa ».
  - `(p3)` republier avec `p_code` conserve le code et change le titre ; la 21e publication d'une même classe lève une exception.
  - `(p4)` un brouillon qui n'est pas un objet, un brouillon sans `titre`, un mode `'x'`, un profil `'x'`, un brouillon de plus de 200 000 octets : exceptions.
  - `(p5)` `game_get_shared_activity` renvoie `null` pour un code inconnu, `'abc'`, après `game_unpublish_activity`, et pour une classe dont `purge_on < current_date` ; `anon` n'a aucun droit de `select` sur `game_shared_activities` ni sur `game_class_profiles`.
  - `(p6)` `game_unpublish_activity` par un non-propriétaire : exception.
  - `(p7)` le propriétaire insère, modifie et supprime des profils par code ; `game_profile_for` renvoie le profil assigné, `'standard'` pour un code sans profil, `null` pour une classe inconnue et pour `'Léa'` ; un autre enseignant ne voit aucun profil de la classe.
  - `(p8)` supprimer la classe supprime ses activités partagées et ses profils.
  - `(p9)` `game_purge_expired` supprime aussi les activités partagées et les profils des classes échues.
  Ajouter 8 mutations dans `game_partage.test.ts` : contexte non remplacé (`(p2)`), plafond de 20 retiré (`(p3)`), `anon` peut lire les activités (`(p5)`), classe échue encore servie (`(p5)`), non-propriétaire qui retire (`(p6)`), profil par défaut absent (`(p7)`), `anon` peut lire les profils (`(p5)`), profils d'un autre enseignant visibles (`(p7)`). Run `npx vitest run tests/sql/game_partage.test.ts`. Expected: FAIL (migration absente).
- [ ] **Step E: Implémenter `20261108_game_partage.sql`** (en-tête « NON APPLIQUÉE », même style que `20261107_game_suivi.sql`). Run `npx vitest run tests/sql`. Expected: tous PASS, les 8 mutations détectées.
- [ ] **Step F: Commit** `git add supabase tests/sql` puis `git commit -m "feat(partage): activité partagée, profils par code et indicateur above (migration non appliquée)"`.

### Task 2: Lien d'activité

**Files:**
- Create: `src/partage/lien.ts`
- Test: `tests/partage/lien.test.ts`

**Interfaces:**
- Produces: `type Groupe = 1 | 2 | 3` ; `FORME_CODE_ACTIVITE: RegExp` (`^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$`) ; `lienActivite(origine: string, code: string, groupe?: Groupe): string` ; `lireLienActivite(url: URL): { code: string; groupe: Groupe | null; urlNettoyee: string } | null` (null si le paramètre `activite` est absent ou n'a pas la forme d'un code ; `urlNettoyee` ne contient plus `activite` ni `g`).

- [ ] **Step 1: Write the failing test** : `lienActivite('https://gameactif.jfb4plai.com', 'K7M2XQ9A')` vaut `'https://gameactif.jfb4plai.com/?activite=K7M2XQ9A'` ; avec groupe 2, `'...?activite=K7M2XQ9A&g=2'` ; `lireLienActivite(new URL('https://x.be/?activite=K7M2XQ9A&g=3'))` renvoie `{ code: 'K7M2XQ9A', groupe: 3, urlNettoyee: '/' }` ; `g=9`, `g=x`, `g=0` donnent `groupe: 2` ; sans `g`, `groupe: null` ; `?activite=abc` et l'absence de paramètre donnent `null` ; les autres paramètres et le fragment sont conservés dans `urlNettoyee`.
- [ ] **Step 2: Run** `npx vitest run tests/partage/lien.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** dans `src/partage/lien.ts`, sur le patron de `lireCodeDansAdresse` (`src/compte/invitation.ts`).
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/partage tests/partage` puis `git commit -m "feat(partage): lien d'activité"`.

### Task 3: Niveaux : noms neutres, groupes, dépassement

**Files:**
- Create: `src/partage/niveaux.ts`
- Test: `tests/partage/niveaux.test.ts`

**Interfaces:**
- Consumes: `ProfileId` de `src/engine/types.ts`, `Groupe` (tâche 2).
- Produces: `NOMS_NEUTRES: Record<ProfileId, string>` (`soutien: 'Pas à pas'`, `standard: 'Équilibre'`, `defi: 'Défi'`) ; `COULEURS_GROUPES: Record<Groupe, string>` (`1: 'vert'`, `2: 'bleu'`, `3: 'orange'`) ; `profilDuGroupe(g: Groupe | null): ProfileId` (1 soutien, 2 ou null standard, 3 defi) ; `niveauAuDessus(p: ProfileId): ProfileId | null` ; `estAuDessus(joue: ProfileId, attribue: ProfileId): boolean`.

- [ ] **Step 1: Write the failing test** : `niveauAuDessus('soutien')` vaut `'standard'`, `('standard')` vaut `'defi'`, `('defi')` vaut `null` ; `profilDuGroupe(null)` vaut `'standard'` ; `estAuDessus('standard', 'soutien')` vrai, `('soutien', 'soutien')` faux, `('soutien', 'defi')` faux ; aucun nom de `NOMS_NEUTRES` ne contient « soutien » ni « difficulté » (insensible à la casse).
- [ ] **Step 2: Run** `npx vitest run tests/partage/niveaux.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/partage tests/partage` puis `git commit -m "feat(partage): niveaux neutres, groupes et dépassement"`.

### Task 4: Lecture côté élève et cache local

**Files:**
- Create: `src/partage/lecture.ts`
- Test: `tests/partage/lecture.test.ts`

**Interfaces:**
- Consumes: `Brouillon`, `formeBrouillonValide`, `completerBrouillon` de `src/atelier/` ; `StockageLocal` de `src/compte/invitation.ts` ; `ProfileId`.
- Produces: `interface ClientPartage { rpc(nom: 'game_get_shared_activity' | 'game_profile_for', args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> }` ; `type Mode = 'meme' | 'groupes' | 'par-code'` ; `interface ActivitePartagee { code: string; titre: string; brouillon: Brouillon; mode: Mode; profilDefaut: ProfileId; classCode: string; nbCodes: number }` ; `type Chargement = { etat: 'ok'; activite: ActivitePartagee; depuisCache: boolean } | { etat: 'retiree' } | { etat: 'echec' }` ; `chargerActivite(client: ClientPartage, stockage: StockageLocal | null, code: string): Promise<Chargement>` ; `profilPourCode(client: ClientPartage, classCode: string, studentCode: string): Promise<ProfileId | null>` ; `lireCache(s: StockageLocal | null, code: string): ActivitePartagee | null` ; `ecrireCache(s: StockageLocal | null, a: ActivitePartagee): void` (clé `gameactif.partage.v1.<code>`).

- [ ] **Step 1: Write the failing tests** : une réponse valide donne `{ etat: 'ok', depuisCache: false }` et écrit le cache ; une réponse `null` donne `{ etat: 'retiree' }` et efface le cache de ce code ; un réseau qui tombe avec cache valide donne `{ etat: 'ok', depuisCache: true }` ; un réseau qui tombe sans cache donne `{ etat: 'echec' }` ; une réponse dont le brouillon est invalide, ou un cache corrompu, ne lèvent pas (`echec` ou ignoré) ; `profilPourCode` renvoie le profil, ou `null` pour une réponse inattendue ou une erreur ; un code qui n'a pas la forme attendue ne contacte pas la base.
- [ ] **Step 2: Run** `npx vitest run tests/partage/lecture.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Le cache ne contient que la réponse de la base (déjà sans contexte).
- [ ] **Step 4: Run** le test, puis `npx tsc --noEmit`. Expected: PASS, typage propre.
- [ ] **Step 5: Commit** `git add src/partage tests/partage` puis `git commit -m "feat(partage): lecture côté élève, cache local"`.

### Task 5: Magasin de publication

**Files:**
- Create: `src/partage/magasin.ts`
- Test: `tests/partage/magasin.test.ts`

**Interfaces:**
- Consumes: `Mode`, `ActivitePartagee` (tâche 4) ; `Brouillon` ; `classer`, `ErreurStockage` de `src/compte/activites.ts` ; `Constructeur`, `Resultat` de `src/suivi/lecture.ts`.
- Produces: `interface Publication { code: string; titre: string; mode: Mode; profilDefaut: ProfileId; majLe: string }` ; `interface PartageStore { publier(classId: string, b: Brouillon, mode: Mode, profil: ProfileId, code?: string): Promise<string>; retirer(code: string): Promise<void>; publications(classId: string): Promise<Publication[]>; profils(classId: string): Promise<Record<string, ProfileId>>; definirProfil(classId: string, studentCode: string, profil: ProfileId): Promise<void>; retirerProfil(classId: string, studentCode: string): Promise<void> }` ; `ClientPartageEcriture` (sous-ensemble : `from('game_shared_activities' | 'game_class_profiles')`, `rpc('game_publish_activity' | 'game_unpublish_activity', ...)`) ; `magasinPartageSupabase(client: ClientPartageEcriture): PartageStore` ; `magasinPartageMemoire(): PartageStore`.

- [ ] **Step 1: Write the failing tests** (client factice, même patron que `tests/suivi/lecture.test.ts`) : `publier` appelle `game_publish_activity` avec `{ p_class_id, p_code: null, p_brouillon, p_mode, p_profil }` et renvoie le code ; republier passe `p_code` ; `retirer` appelle `game_unpublish_activity` ; `publications` lit `game_shared_activities` filtré par `class_id` ; `profils` renvoie un objet code vers profil et ignore une ligne mal formée ; `definirProfil` fait un `upsert`-équivalent (`insert` puis, si le code existe déjà, mise à jour) ; une erreur réseau devient une `ErreurStockage` de code `'reseau'` ; la version mémoire plafonne à 20 publications par classe et applique `Activité partagée à la classe` au contexte.
- [ ] **Step 2: Run** `npx vitest run tests/partage/magasin.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** (même patron d'erreurs et de pagination que `src/suivi/lecture.ts`).
- [ ] **Step 4: Run** le test, puis `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/partage tests/partage` puis `git commit -m "feat(partage): magasin de publication"`.

### Task 6: L'indicateur `above` dans la séance

**Files:**
- Modify: `src/suivi/types.ts`, `src/suivi/payload.ts`, `src/suivi/lecture.ts`
- Test: `tests/suivi/payload.test.ts`, `tests/suivi/lecture.test.ts`

**Interfaces:**
- Produces: `SessionPayload.above: boolean` ; `SessionEnregistree.above: boolean` ; `ContexteSession.auDessus?: boolean` (défaut faux) ; `versSession` lit `above` (booléen, absent = faux) et la requête de lecture de `game_sessions` demande la colonne `above`.

- [ ] **Step 1: Write the failing tests** : `construirePayload({ ...ctx(), auDessus: true }).above` vaut `true` ; sans l'option, `false` ; la liste des clés du payload devient `['above','cibles','endedAt','labels','mechanic','profile','results','sessionId','totalElements']` (mettre à jour le test existant) ; `sessions` relit `above: true` d'une ligne et `false` quand la colonne est absente ; la requête demande `above`.
- [ ] **Step 2: Run** `npx vitest run tests/suivi/payload.test.ts tests/suivi/lecture.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** les tests puis `npx vitest run` (tous les fichiers qui construisent une `SessionEnregistree` doivent recevoir `above: false` ; corriger les fixtures de test, pas le code). Expected: tout PASS.
- [ ] **Step 5: Commit** `git add src tests` puis `git commit -m "feat(suivi): indicateur above sur la séance"`.

### Task 7: Agrégats et tableau de bord : le dépassement

**Files:**
- Modify: `src/suivi/agregats.ts`, `src/ui/TableauDeBord.tsx`
- Test: `tests/suivi/agregats.test.ts`, `tests/ui/tableau-de-bord-couches.test.tsx`, `tests/ui/tableau-de-bord.test.tsx`

**Interfaces:**
- Produces: `LigneJeu.dontAuDessus: number` (nombre de séances au-dessus) ; `Fait.auDessus: boolean` ; `erreursParType`, `evolution` et la règle « confusion répétée » de `etatEleve` ignorent les séances `above` ; les séances `above` comptent toujours pour la réussite (jeux et jours de « Stabilisé ») ; `jeuxParCible` les compte comme les autres et indique `dontAuDessus`.

- [ ] **Step 1: Write the failing tests** (ajouter un paramètre `auDessus` à l'aide `s(...)` des tests) :
  - une confusion répétée dans deux jeux dont l'un est au-dessus : `'en-cours'` (et `'a-reprendre'` sans l'indicateur) ;
  - trois jeux réussis dont un au-dessus, sur deux jours : `'stabilise'` ;
  - `erreursParType` ignore les erreurs d'une séance `above` ;
  - `evolution` ignore les jours qui n'ont que des séances `above` ;
  - `jeuxParCible` renvoie `dontAuDessus: 1` pour une ligne qui contient une séance au-dessus ;
  - `faitsParEleve` marque `auDessus: true` ;
  - UI : le tableau « Le même attendu dans les autres jeux » affiche « dont 1 au niveau au-dessus » ; le tableau des faits affiche « niveau au-dessus » dans la colonne Origine pour ces séances.
- [ ] **Step 2: Run** `npx vitest run tests/suivi/agregats.test.ts tests/ui/tableau-de-bord.test.tsx tests/ui/tableau-de-bord-couches.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** les mêmes tests, puis `npx vitest run`. Expected: tout PASS.
- [ ] **Step 5: Commit** `git add src tests` puis `git commit -m "feat(suivi): le dépassement dans le tableau de bord"`.

### Task 8: `ActivityScreen` en vue élève

**Files:**
- Modify: `src/ui/ActivityScreen.tsx`
- Test: `tests/ui/activityscreen-eleve.test.tsx`

**Interfaces:**
- Consumes: `NOMS_NEUTRES`, `niveauAuDessus`, `estAuDessus` (tâche 3) ; `construirePayload` (`auDessus`, tâche 6).
- Produces: la propriété `eleve?: { profilDepart: ProfileId; resoudreProfil?: (codeEleve: string) => Promise<ProfileId | null> }` de `ActivityScreen`. Avec `eleve` : la carte « Profil / Nombre d'élèves », les fiches papier et le cadre « Autres jeux, avec votre IA » ne sont pas rendus ; seuls restent le titre, « Qui joue ? » et les jeux sur écran ; le profil joué part de `profilDepart` ; si `resoudreProfil` est fourni, choisir un code appelle `resoudreProfil(code)` et fixe le profil attribué à sa réponse (`profilDepart` si `null` ou erreur, avec le message « Niveau par défaut : le niveau de votre code n'a pas pu être chargé. ») ; après un tour terminé, si `niveauAuDessus(profil)` n'est pas nul, un bouton « Rejouer un niveau au-dessus » relance le jeu au niveau suivant et marque la séance `above` ; au nom neutre : le niveau joué est annoncé par `NOMS_NEUTRES`, jamais par `PROFILE_LABELS`.

- [ ] **Step 1: Write the failing tests** (`tests/ui/activityscreen-eleve.test.tsx`, même fixtures que `activityscreen-suivi.test.tsx`, cibles `M.P4.1.1.i1.a1`) :
  - avec `eleve`, ni le libellé « Profil » ni « Nombre d'élèves » ni « Autres jeux, avec votre IA » ni « En classe, sans écran » ne sont présents ; « Qui joue ? » et « Jouer : QCM libre » le sont ;
  - le tour part du `profilDepart` (le payload envoyé porte `profile: 'soutien'` et `above: false`) ;
  - après un tour à `soutien`, « Rejouer un niveau au-dessus » est affiché ; un clic relance le jeu ; le tour suivant envoie `profile: 'standard'` et `above: true` ; après un tour à `defi`, le bouton est absent ;
  - choisir `E02` avec `resoudreProfil` qui renvoie `'defi'` : le tour envoie `profile: 'defi'` et `above: false` ; `resoudreProfil` qui renvoie `null` ou lève : `profile` = `profilDepart` et le message « Niveau par défaut » est affiché ;
  - aucun texte visible ne contient « Soutien » ;
  - sans `eleve`, le comportement actuel est inchangé (les tests `activityscreen*.test.tsx` existants passent).
- [ ] **Step 2: Run** `npx vitest run tests/ui/activityscreen-eleve.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** dans `ActivityScreen.tsx` : état `profilAttribue` (profil décidé) et `profil` (profil joué) ; `auDessus = estAuDessus(profil, profilAttribue)` passé à `construirePayload`.
- [ ] **Step 4: Run** le test puis `npx vitest run`. Expected: tout PASS.
- [ ] **Step 5: Commit** `git add src tests` puis `git commit -m "feat(partage): ActivityScreen en vue élève, dépassement"`.

### Task 9: Ouvrir le lien : la vue élève dans le parcours

**Files:**
- Create: `src/ui/VueEleve.tsx`
- Modify: `src/ui/Parcours.tsx`
- Test: `tests/ui/vue-eleve.test.tsx`, `tests/ui/parcours-partage.test.tsx`

**Interfaces:**
- Consumes: `lireLienActivite` (tâche 2), `chargerActivite`, `profilPourCode`, `ClientPartage` (tâche 4), `construireActivite`, `profilDuGroupe`, `enregistrerClasse`, `ClientSuivi`.
- Produces: `VueEleve({ code, groupe, client, stockage }: { code: string; groupe: Groupe | null; client: ClientPartage & ClientSuivi; stockage: StockageLocal | null }): JSX.Element` ; `Parcours` reçoit `partage?: ClientPartage & ClientSuivi` (défaut : le client de la base) et, quand l'adresse contient un lien d'activité valide et que le suivi est actif, rend `VueEleve` à la place du parcours après avoir nettoyé l'adresse.

- [ ] **Step 1: Write the failing tests** :
  - `VueEleve` : un chargement réussi affiche le titre et les jeux ; le contexte de la base n'est jamais affiché (le texte « Activité partagée à la classe » n'est pas dans le DOM) ; l'appareil est associé à la classe (`gameactif.classe.v1` contient le code de classe et le nombre de codes) ; réponse `retiree` : « Cette activité n'est plus proposée. » ; échec sans cache : « L'activité n'a pas pu être chargée. Vérifiez la connexion et réessayez. » avec un bouton « Réessayer » ; échec avec cache : l'activité et « Activité ouverte sans connexion : vos résultats ne seront pas enregistrés tant que la connexion ne revient pas. » ;
  - modes : `meme` joue au `profilDefaut` ; `groupes` avec `groupe: 1` joue au profil soutien et avec `groupe: null` au profil standard ; `par-code` passe `resoudreProfil` à `ActivityScreen` ;
  - `Parcours` : adresse `/?activite=K7M2XQ9A` avec suivi actif : la vue élève s'affiche, l'adresse est nettoyée (`window.location.search` vide) et le parcours (« Étape 1 sur 5 ») est absent ; sans suivi actif ou avec un code mal formé, le parcours habituel s'affiche.
- [ ] **Step 2: Run** `npx vitest run tests/ui/vue-eleve.test.tsx tests/ui/parcours-partage.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Dans `VueEleve`, construire l'activité avec `construireActivite(activite.brouillon)` (le contexte de remplacement la valide) et passer `eleve={{ profilDepart, resoudreProfil }}` à `ActivityScreen`.
- [ ] **Step 4: Run** les tests puis `npx vitest run`, `npx tsc --noEmit`, `npx vite build`. Expected: tout PASS.
- [ ] **Step 5: Commit** `git add src tests` puis `git commit -m "feat(partage): la vue élève s'ouvre depuis le lien"`.

### Task 10: QR et publication côté enseignant

**Files:**
- Create: `src/ui/CodeQr.tsx`, `src/ui/PublierActivite.tsx`
- Modify: `src/ui/Parcours.tsx` (étape « Vos jeux » : bouton « Proposer à la classe »), `package.json` (`qrcode-generator` 1.4.4)
- Test: `tests/ui/code-qr.test.tsx`, `tests/ui/publier-activite.test.tsx`

**Interfaces:**
- Consumes: `PartageStore`, `Publication` (tâche 5) ; `SuiviStore`, `ClasseLue` (plan 8) ; `lienActivite`, `Groupe` (tâche 2) ; `NOMS_NEUTRES`, `COULEURS_GROUPES` (tâche 3) ; `Brouillon`.
- Produces: `CodeQr({ lien, libelle }: { lien: string; libelle: string }): JSX.Element` (SVG `role="img"` dont l'étiquette cite le libellé, taille réglable, contraste noir sur blanc, zone de silence de 4 modules) ; `PublierActivite({ brouillon, classes, partage, origine }: { brouillon: Brouillon; classes: ClasseLue[]; partage: PartageStore; origine: string }): JSX.Element`.

- [ ] **Step 1: Install** `npm i qrcode-generator@1.4.4` (licence MIT, annoncée par `transfertactif/vendor/LICENCES-TIERCES.md` ; la vérifier dans le paquet installé). Si le paquet n'a pas de types, ajouter `src/vendor/qrcode-generator.d.ts`.
- [ ] **Step 2: Write the failing tests** :
  - `CodeQr` : un lien de 50 caractères produit un `svg` avec au moins 21×21 modules sombres ou clairs et un `role="img"` ; le libellé est dans l'étiquette ; aucun appel réseau (`fetch` espionné, jamais appelé) ;
  - `PublierActivite` : sans classe, un message « Créez d'abord une classe dans Mes classes. » et aucun bouton de publication ; avec une classe, chaque champ a un label, un exemple et une aide (mode, profil par défaut) ; publier en mode `meme` appelle `partage.publier(classId, brouillon, 'meme', profil)` puis affiche le lien `https://gameactif.jfb4plai.com/?activite=<code>`, un QR, « Copier le lien » (copie le lien) et « Retirer le lien » (appelle `retirer`) ; en mode `groupes`, trois liens `&g=1`, `&g=2`, `&g=3` avec les couleurs neutres et sans le mot « Soutien » ; republier réutilise le code ; une erreur de publication affiche une alerte en français ; le contexte du brouillon n'apparaît dans aucun texte affiché ;
  - `Parcours` : le bouton « Proposer à la classe » n'apparaît que pour un enseignant connecté avec le suivi actif, à l'étape « Vos jeux ».
- [ ] **Step 3: Run** `npx vitest run tests/ui/code-qr.test.tsx tests/ui/publier-activite.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement.** Le mode `par-code` ne génère qu'un lien ; il renvoie vers la page « Niveaux par code » de la tâche 11.
- [ ] **Step 5: Run** les tests puis `npx vitest run`, `npx tsc --noEmit`, `npx vite build`. Expected: tout PASS.
- [ ] **Step 6: Commit** `git add package.json package-lock.json src tests` puis `git commit -m "feat(partage): QR et publication côté enseignant"`.

### Task 11: Niveaux par code (mode 3)

**Files:**
- Create: `src/ui/NiveauxParCode.tsx`
- Modify: `src/ui/MesClasses.tsx` (monter `NiveauxParCode` pour une classe dont l'utilisateur est propriétaire)
- Test: `tests/ui/niveaux-par-code.test.tsx`

**Interfaces:**
- Consumes: `PartageStore` (tâche 5), `ClasseLue`, `NOMS_NEUTRES` (côté élève) et les libellés enseignant `PROFILE_LABELS` (`src/engine/profiles.ts`), `afficher`, `lireRoster`.
- Produces: `NiveauxParCode({ classe, partage, stockage }: { classe: ClasseLue; partage: PartageStore; stockage: StockageLocal | null }): JSX.Element` : un profil par code (liste déroulante, défaut « Standard »), le prénom affiché à la place du code si la liste locale le connaît, rappel « Ce choix est le vôtre : il est enregistré sous le code, sans prénom, et supprimé le {date}. L'élève ne voit pas le nom de son niveau. »

- [ ] **Step 1: Write the failing tests** : 24 lignes pour une classe de 24 codes, défaut « Standard » ; changer le profil de `E07` appelle `partage.definirProfil(classId, 'E07', 'soutien')` ; remettre « Standard » appelle `retirerProfil` ; le prénom de la liste locale s'affiche sans jamais être envoyé au magasin ; chaque champ a un label et une aide ; la classe d'une personne invitée n'affiche pas ce composant.
- [ ] **Step 2: Run** `npx vitest run tests/ui/niveaux-par-code.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** le test puis `npx vitest run`, `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src tests` puis `git commit -m "feat(partage): niveaux par code élève"`.

### Task 12: Documents : dossier DPO et recette

**Files:**
- Modify: `docs/confidentialite/dossier-dpo-suivi.md`
- Create: `docs/recette-partage.md`

Pas de code.

- [ ] **Step 1: Compléter le dossier DPO** : nouvelle table `game_shared_activities` (titre, contenu de l'activité sans contexte, mode) et `game_class_profiles` (profil par code, pseudonyme, révèle un besoin d'accompagnement) ; fonction de lecture ouverte à `anon` ; risque du mode 3 (déduction du niveau d'un camarade en essayant d'autres codes) ; durée (même suppression que la classe) ; nouveau risque : le contenu partagé est lisible par quiconque connaît le code d'activité ; limite de 20 activités par classe ; question au DPO : le mode 3 peut-il être livré avec les autres ou après l'avis ? Chaque phrase factuelle cite un fichier ou est marquée « non vérifié ».
- [ ] **Step 2: Écrire `docs/recette-partage.md`** : pour JF, chemins complets et URL exactes, à faire sur de vrais appareils : publier depuis `https://gameactif.jfb4plai.com/` (après déploiement et accords) ; scanner le QR affiché au TBI avec un téléphone puis une tablette (Android, iPad) ; vérifier la lecture à 2 m ; ouvrir le lien, choisir un code, jouer un tour, voir la séance dans le tableau de bord ; mode 2 avec trois QR ; mode 3 avec trois profils ; bouton de dépassement ; lien retiré ; classe supprimée ; hors ligne. Une grille OK / pas OK / remarque. Rien n'est annoncé « vérifié » avant cette recette.
- [ ] **Step 3: Vérification.** Relire : aucune promesse (« sécurisé », « conforme »). Commit `git add docs` puis `git commit -m "docs: dossier DPO et recette de l'activité partagée"`.

### Task 13: Jalon JF (aucun code, chaque étape avec accord explicite)

- [ ] **Step 1:** Tâche 15 du plan 8 faite en premier (avis DPO, essai annulé, migration `20261107`).
- [ ] **Step 2: Essai en transaction annulée** de `20261108_game_partage.sql` (nouveau fichier `supabase/essai-rollback-game_partage.sql`, modèle `essai-rollback-game_acces.sql`), puis application avec un second accord.
- [ ] **Step 3: Noms neutres et couleurs** : JF fixe les trois noms et les trois couleurs (`src/partage/niveaux.ts`).
- [ ] **Step 4: Recette sur appareils** selon `docs/recette-partage.md`.

## Self-review

- **Couverture de la spec :** option A, code et lien (tâches 1, 2, 4, 5, 10) ; sans contexte, serveur (tâche 1, essai `(p2)`) ; vue élève épurée (tâches 8, 9) ; modes 1, 2 et 3 (tâches 1, 3, 8, 9, 10, 11) ; dépassement et sa visibilité (tâches 6, 7, 8) ; retrait et suppression de la classe (tâche 1, essais `(p5)`, `(p8)`, `(p9)`) ; plafond de 20 (tâche 1) ; cache hors ligne (tâche 4) ; QR dans le navigateur, sans service externe (tâche 10) ; noms neutres (tâches 3, 8) ; DPO et recette (tâche 12). TransfertActif non intégré : le lien se copie (tâche 10).
- **Cohérence des types :** `Groupe`, `Mode`, `ActivitePartagee`, `ClientPartage`, `PartageStore`, `Publication`, `SessionPayload.above`, `SessionEnregistree.above`, `Fait.auDessus`, `LigneJeu.dontAuDessus` sont définis une fois et réutilisés avec la même forme.
- **Limites assumées :** pas d'essai sur appareil réel ; la lisibilité d'un QR au TBI n'est pas mesurée ; la bibliothèque de QR est choisie par le plan (MIT, version de TransfertActif), sa conformité est vérifiée à l'installation ; le mode 3 reste discret, pas secret.
- **Proportion :** environ 4 800 mots pour les 1 800 de la spec, soit 2,6 fois ; aucun corps de fonction n'est écrit, seulement signatures, assertions et valeurs.

## Décisions

- 2026-11-06 : tâches 1 à 12 exécutées sur la branche `feat/activite-partagee` (coupée de `feat/suivi-par-code`, non poussée, migration `20261108_game_partage.sql` non appliquée, interrupteur `VITE_SUIVI_ACTIF` fermé par défaut). Suite complète : 85 fichiers, 877 tests ; `tsc` et `vite build` propres ; 49 tests SQL dont 17 mutations détectées. Revue finale : auto-revue de l'auteur, un correctif (le contexte de classe ne part plus vers la base) et deux textes d'aide corrigés.
- Tâche 13 (jalon JF) : non commencée, chaque étape attend un accord explicite.
- Écarts au plan assumés : l'adresse `?activite=` n'est PAS nettoyée (un rechargement de la tablette doit rouvrir l'activité, le code n'est pas un secret) ; `PublierActivite` reçoit `suivi` (magasin de classes) au lieu de `classes` et liste les activités déjà proposées ; garde `magasinPartageDuNavigateur()` ; `ErreurPartage` pour le plafond de 20 ; interface `RequetePartage` propre ; mouvement de la colonne `above` dans la migration du plan 8.
- Noms neutres et couleurs : provisoires, à fixer par JF dans `src/partage/niveaux.ts`.
