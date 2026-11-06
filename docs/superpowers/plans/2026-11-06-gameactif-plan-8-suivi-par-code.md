# GameActif plan 8 : suivi des élèves par code pseudonyme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Après une séance, l'enseignant voit la participation de sa classe, les erreurs par type, le lien entre jeux d'un même attendu et un indice d'acquisition, sous des codes élèves pseudonymes, sans qu'un prénom n'atteigne la base.

**Architecture:** Un élève joue avec un code choisi dans une liste (ou sans code, sans trace). À la fin d'un tour, le navigateur appelle une fonction Postgres `security definer` ouverte au rôle `anon` qui valide et écrit une séance ; aucune lecture n'est ouverte à `anon`. L'enseignant et une personne invitée lisent par RLS (fonctions `security definer`, jamais d'`EXISTS` auto-joint). Les prénoms, les seuils et la liste de codes restent dans le navigateur de l'enseignant. L'agrégation (états A, évolution C, faits B) est faite par des fonctions pures côté client à partir de `src/engine/signals.ts`. Suppression des résultats par fonction de purge au 30 août.

**Tech Stack:** React 18, TypeScript, Vite 5, Vitest + Testing Library, Supabase (supabase-js v2), PGlite pour tester le SQL (déjà en place dans `tests/sql/game_acces.test.ts`).

**Spec:** `docs/superpowers/specs/2026-11-06-suivi-par-code-design.md` (les huit choix [Claude] du §4 y sont à confirmer par JF ; ce plan les applique tels quels, plus les précisions marquées [Plan] ci-dessous).

## Global Constraints

- Tables, fonctions et index préfixés `game_` ; vérifier les conflits : `grep -rIn "create table" --include=*.sql --exclude-dir=node_modules .` depuis la racine du workspace.
- `GRANT` explicites dans la même migration que chaque `create table` ; RLS activé sur chaque table ; jamais d'`EXISTS` auto-joint sur la même table dans une politique (fonction `security definer`).
- Aucune table, colonne ou champ d'écriture ne reçoit un prénom ; `anon` ne lit rien ; `anon` n'écrit que par `game_record_session`.
- Aucune mesure de temps de réponse ni de temps passé ; aucun classement ; aucune décision automatique sur un élève.
- Pas de `git push`, pas d'application de la migration sur la base partagée, pas de variable Vercel sans accord explicite de JF. Essai de la migration en transaction annulée d'abord (méthode du plan 4b).
- Police 16 px minimum ; consignes élèves à l'infinitif, une action par puce ; zone d'observation avec label, placeholder concret et aide ; exemples FWB ; aucun tiret cadratin dans le dépôt.
- `npx tsc --noEmit`, `npx vitest run` et `npx vite build` passent avant chaque commit ; branche `main`.
- Contact des outils PLAI : `jeanfrancois.beguin@ens.ecl.be`.

## Décisions de plan [Plan] (à relire par JF, en plus du §4 de la spec)

- Fin d'année : `purge_on` = 30 août suivant la création, sauf création entre le 1er août et le 30 août inclus, où c'est le 30 août de l'année suivante (un enseignant qui prépare sa rentrée fin août ne perd pas sa classe quinze jours plus tard).
- Transport : écriture directe par fonction Postgres appelée avec la clé `anon` ; pas de Vercel function, pas de HubActif dans ce plan (le pont HubActif suppose des comptes élèves du hub, que ce choix évite). Raison : une fonction SQL se teste en PGlite comme le reste.
- Une séance est « réussie » pour un attendu si `r1 >= 0,75` (proposition, réglable).
- Une observation est invisible pour l'invité par défaut ; l'enseignant coche « Visible par la personne invitée » (case à cocher par observation). Cela remplace la question ouverte de la spec.
- Après chaque tour envoyé, le code « qui joue » repasse à « Jouer sans enregistrer » : sur un appareil partagé, le tour suivant ne doit jamais être attribué à l'élève précédent.
- Limite d'écriture : 60 séances par classe et par minute.
- Pas de file d'attente d'envoi : si l'envoi échoue, le jeu reste jouable et un message le dit ; le résultat de ce tour est perdu. Limite assumée.

## Review Focus

1. Code de classe inconnu ou expiré, code élève hors liste (`E25` dans une classe de 24, `e07`, `Léa`) : `game_record_session` renvoie `'invalide'` et n'écrit rien (tâche 2).
2. Même `sessionId` envoyé deux fois (réseau lent, double clic) : une seule ligne (tâche 2).
3. Envoi qui échoue ou appareil hors ligne : le tour reste affiché, le message est en français, pas d'erreur non gérée (tâche 8).
4. Observation contenant « Léa », « LEA », « léa » ou « Jean-Pierre » alors que la liste locale contient ces prénoms : bloquée avant envoi ; liste vide : aucun faux positif ; « Dea » ne déclenche pas « Léa » (tâche 7).
5. Un élève avec 1 seule séance, ou une classe de 40 codes sans aucune séance : couche C masquée, état « pas d'indice », aucune division par zéro (tâche 10).
6. Invité révoqué ou expiré pendant qu'il a la page ouverte : sa prochaine lecture renvoie 0 ligne (tâche 3).
7. Classe créée le 29 août ou le 31 août : `purge_on` conforme à la décision de plan ci-dessus (tâche 1).

---

### Task 1: Classes, création, droits et RLS

**Files:**
- Create: `supabase/migrations/20261107_game_suivi.sql`
- Create: `supabase/essais/game_suivi.assertions.sql`
- Test: `tests/sql/game_suivi.test.ts` (même structure que `tests/sql/game_acces.test.ts` : `baseSupabase()`, applique `20261103_game_acces.sql` puis la nouvelle migration puis les assertions, dans une transaction annulée)

**Interfaces:**
- Produces (SQL) : table `public.game_classes(id uuid pk, user_id uuid, label text, nb_codes int, class_code text unique, purge_on date, created_at timestamptz)` ; `game_school_year_end(p_created date) returns date` ; `game_create_class(p_label text, p_nb_codes int) returns table(id uuid, class_code text)` (réservée aux comptes `game_is_teacher()`) ; `game_owns_class(p_class_id uuid) returns boolean` (security definer, `user_id = auth.uid()`).
- `label` : 1 à 80 caractères ; `nb_codes` : 1 à 40 ; `class_code` : 8 caractères de l'alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.

- [ ] **Step 1: Écrire les assertions** dans `supabase/essais/game_suivi.assertions.sql` : un enseignant (ligne dans `game_teachers`) crée `('P4 B', 24)` et reçoit un `class_code` de forme `^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$` ; un compte sans ligne `game_teachers` obtient une exception ; `nb_codes` à 0 et à 41 lèvent une exception ; `label` vide et de 81 caractères lèvent une exception ; un second enseignant ne voit aucune ligne de `game_classes` du premier ; `anon` obtient `permission denied` sur `select` de `game_classes` ; `game_school_year_end` vaut `2027-08-30` pour `2027-07-31`, `2028-08-30` pour `2027-08-01`, pour `2027-08-30` et pour `2027-08-31`, `2027-08-30` pour `2027-01-15`.
- [ ] **Step 2: Run** `npx vitest run tests/sql/game_suivi.test.ts`. Expected: FAIL (migration absente).
- [ ] **Step 3: Implement** la migration (en-tête de style `20261103_game_acces.sql`) : table, `revoke all from anon, authenticated`, `grant all to service_role`, `grant select on game_classes to authenticated`, RLS, politique `game_classes_select` `using (user_id = (select auth.uid()))`, `game_school_year_end`, `game_owns_class`, `game_create_class` (génère le code avec `gen_random_bytes`, réessaie en cas de collision, `purge_on = game_school_year_end(current_date)`).
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add supabase/migrations/20261107_game_suivi.sql supabase/essais/game_suivi.assertions.sql tests/sql/game_suivi.test.ts` puis `git commit -m "feat(suivi): classes, création et droits (migration non appliquée)"`.

### Task 2: Écriture des séances par l'élève (rôle anon)

**Files:**
- Modify: `supabase/migrations/20261107_game_suivi.sql`, `supabase/essais/game_suivi.assertions.sql`

**Interfaces:**
- Consumes: `game_classes` (tâche 1).
- Produces (SQL) : table `game_sessions(id uuid pk, class_id uuid references game_classes on delete cascade, student_code text check (student_code ~ '^E[0-9]{2}$'), mechanic text, profile text, cibles text[], total_elements int, ended_at timestamptz, labels jsonb, results jsonb, created_at timestamptz default now())`, index `(class_id, ended_at desc)` ; `game_class_info(p_class_code text) returns int` (nb_codes, `null` si inconnu ou expiré) ; `game_record_session(p_class_code text, p_student_code text, p_payload jsonb) returns text` valeurs `'ok' | 'invalide' | 'limite'`, `grant execute` à `anon, authenticated, service_role`.
- Forme de `p_payload` (jsonb) : `{ sessionId: uuid, mechanic, profile, cibles: string[1..3], totalElements: int, endedAt: iso, labels: {id: string<=80, <=100 entrées}, results: [{ elementId, correct, firstTry, tries, hintUsed, revealed, wrongChoices: string[<=10 de <=80] }] (<=50) }`.

- [ ] **Step 1: Assertions** : `game_class_info` vaut 24 pour le code valide et `null` pour `'AAAAAAAA'` ; une séance valide pour `E07` renvoie `'ok'` et crée 1 ligne ; le même `sessionId` renvoyé deux fois laisse 1 ligne et renvoie `'ok'` ; `E25` dans une classe de 24, `e07`, `Léa`, `E7` renvoient `'invalide'` ; 51 résultats, un label de 81 caractères, `mechanic = 'foo'`, 4 cibles, une cible `Léa` (forme attendue `^M\.P[1-6](\.[A-Za-z0-9]+)+$`) renvoient `'invalide'` ; après insertion directe de 60 séances à `created_at = now()` pour la classe, un appel valide renvoie `'limite'` ; une classe dont `purge_on < current_date` renvoie `'invalide'` ; `anon` obtient `permission denied` sur `select` de `game_sessions` et sur `insert` direct.
- [ ] **Step 2: Run** `npx vitest run tests/sql/game_suivi.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** table, droits (aucun droit table pour `anon`/`authenticated` en écriture ; `select` à `authenticated` borné par la politique de la tâche 3), fonctions. Mécaniques admises : `associer, trier, ordre, placer, comparer, memo, qcm` ; profils : `soutien, standard, defi`. `insert ... on conflict (id) do nothing`.
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add supabase tests/sql/game_suivi.test.ts` puis `git commit -m "feat(suivi): écriture des séances par fonction anon"`.

### Task 3: Observations, résultats saisis à la main, invitation d'une personne

**Files:**
- Modify: `supabase/migrations/20261107_game_suivi.sql`, `supabase/essais/game_suivi.assertions.sql`

**Interfaces:**
- Produces (SQL) :
  - `game_observations(id uuid pk, class_id, student_code text null check (student_code is null or student_code ~ '^E[0-9]{2}$'), texte text check (char_length(btrim(texte)) between 1 and 1000), visible_invites boolean default false, created_at, updated_at)` ; écriture réservée au propriétaire de la classe (`game_owns_class`).
  - `game_manual_results(id uuid pk, class_id, student_code text, cible text, resultat text check (resultat in ('reussi','partiel','a_reprendre')), created_at)` ; mêmes règles.
  - `game_guest_invitations(id uuid pk, class_id, code_hash text unique, expires_at, revoked_at, used_at)` et `game_class_guests(id uuid pk, class_id, guest_user_id uuid, expires_at, revoked_at)`.
  - `game_create_guest_invitation(p_class_id uuid) returns text` (propriétaire ; code de 32 caractères base64url ; usage unique ; expire à `least(now() + 30 jours, purge_on)`) ; `game_redeem_guest_invitation(p_code text) returns text` `'ok' | 'deja' | 'invalide'` (tout compte connecté, `game_teachers` non requis) ; `game_revoke_guest(p_guest_id uuid) returns void` (propriétaire) ; `game_can_read_class(p_class_id uuid) returns boolean` (propriétaire OU invité actif : non révoqué, `expires_at > now()`).
  - Politiques `select` de `game_classes`, `game_sessions`, `game_manual_results` : `game_can_read_class(class_id)` ; `select` de `game_observations` : `game_owns_class(class_id) or (visible_invites and game_can_read_class(class_id))`. Aucune écriture pour un invité.

- [ ] **Step 1: Assertions** : le propriétaire insère une observation de 1000 caractères (OK) et de 1001 (exception) ; `student_code = 'Léa'` rejeté ; un invité qui a utilisé un code valide (`'ok'`) lit les séances de la classe mais pas celles d'une autre classe ; il lit une observation avec `visible_invites = true` et ne voit pas celle à `false` ; après `game_revoke_guest`, ses `select` renvoient 0 ligne, même session ouverte ; une invitation expirée renvoie `'invalide'` ; un second compte qui rejoue le même code obtient `'invalide'` ; un code de 31 caractères renvoie `'invalide'` ; l'invité reçoit `permission denied` ou 0 ligne affectée sur `insert`, `update` et `delete` d'observations, de résultats saisis et de séances.
- [ ] **Step 2: Run** `npx vitest run tests/sql/game_suivi.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** (même style que `game_redeem_invitation` : `security definer`, `search_path` figé, verrou `for update`).
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add supabase tests/sql/game_suivi.test.ts` puis `git commit -m "feat(suivi): observations, résultats saisis, invité par code"`.

### Task 4: Suppression au 30 août

**Files:**
- Modify: `supabase/migrations/20261107_game_suivi.sql`, `supabase/essais/game_suivi.assertions.sql`

**Interfaces:**
- Produces (SQL) : `game_purge_expired(p_today date default current_date) returns int` (nombre de classes supprimées), `security definer`, `grant execute` à `service_role` seulement.

- [ ] **Step 1: Assertions** : trois classes (`purge_on` = veille, jour même, lendemain), avec séances, observations, résultats saisis et invités ; après `game_purge_expired(current_date)`, les deux premières et tout ce qui leur est rattaché ont disparu, la troisième est intacte, la fonction renvoie 2, `game_teachers` et `game_activities` n'ont pas bougé ; `authenticated` et `anon` obtiennent `permission denied` à l'appel.
- [ ] **Step 2: Run** le test. Expected: FAIL.
- [ ] **Step 3: Implement** (`delete from game_classes where purge_on <= p_today` ; les `on delete cascade` des tâches 2 et 3 font le reste).
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add supabase tests/sql/game_suivi.test.ts` puis `git commit -m "feat(suivi): purge des résultats au 30 août"`.

### Task 5: Construire la séance envoyée

**Files:**
- Create: `src/suivi/types.ts`, `src/suivi/payload.ts`
- Test: `tests/suivi/payload.test.ts`

**Interfaces:**
- Consumes: `RoundState`, `ElementResult` de `src/engine/round.ts` ; `MechanicId`, `ProfileId` de `src/engine/types.ts` ; `SessionResults` de `src/engine/signals.ts`.
- Produces: `interface SessionPayload { sessionId: string; mechanic: MechanicId; profile: ProfileId; cibles: string[]; totalElements: number; endedAt: string; labels: Record<string, string>; results: ResultatEnvoye[] }` ; `interface ResultatEnvoye extends ElementResult { correct: string }` ; `interface SessionEnregistree extends SessionResults { cibles: string[]; mechanic: MechanicId; origine: 'ecran' }` ; `construirePayload(c: { sessionId: string; round: RoundState; results: ElementResult[]; profile: ProfileId; cibles: string[]; maintenant: Date }): SessionPayload`.

- [ ] **Step 1: Write the failing test** : avec un `RoundState` de 2 éléments (`correct` `'devant'` et `'derriere'`) et des résultats dont un `wrongChoices: ['derriere']`, `construirePayload(...)` renvoie `results[0].correct === 'devant'`, `labels` ne contient que les ids cités (corrects et `wrongChoices`), `endedAt === maintenant.toISOString()`, `totalElements === 2`, et la sortie sérialisée (`JSON.stringify`) ne contient aucune clé `prenom`, `nom`, `name`.
- [ ] **Step 2: Run** `npx vitest run tests/suivi/payload.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `construirePayload` dans `src/suivi/payload.ts` (un seul appel de sérialisation ; aucun champ libre hors ids et étiquettes de la consigne enseignant).
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/suivi tests/suivi/payload.test.ts` puis `git commit -m "feat(suivi): séance à envoyer"`.

### Task 6: Liste locale de prénoms et garde-fou

**Files:**
- Create: `src/suivi/roster.ts`
- Test: `tests/suivi/roster.test.ts`

**Interfaces:**
- Produces: `type Roster = Record<string, string>` (code vers prénom) ; `lireRoster(s: StockageLocal | null, classId: string): Roster` ; `ecrireRoster(s: StockageLocal | null, classId: string, r: Roster): void` (clé `gameactif.roster.v1.<classId>`, stockage absent ou qui refuse ignoré) ; `exporterRoster(r: Roster, libelleClasse: string): string` (JSON `{ format: 'gameactif-roster', version: 1, classe, prenoms }`) ; `importerRoster(texte: string): Roster | null` (null si forme invalide, taille > 20 000 octets, codes hors `^E[0-9]{2}$`) ; `afficher(code: string, r: Roster): string` (prénom sinon code) ; `contientPrenom(texte: string, r: Roster): string | null` (premier prénom trouvé).
- Consumes: `StockageLocal` de `src/compte/invitation.ts`.

- [ ] **Step 1: Write the failing tests** : `contientPrenom('E04 a corrigé seul', {E04: 'Léa'})` vaut `null` ; `contientPrenom('Léa a corrigé', {E04: 'Léa'})`, `'LEA a corrigé'`, `'léa'` valent `'Léa'` ; `contientPrenom('Dea a corrigé', {E04: 'Léa'})` vaut `null` ; `contientPrenom('Jean-Pierre est resté', {E02: 'Jean-Pierre'})` vaut `'Jean-Pierre'` ; roster vide ne trouve rien ; `importerRoster(exporterRoster(r, 'P4 B'))` redonne `r` ; `importerRoster('{"x":1}')` et un code `'Léa'` donnent `null` ; `afficher('E09', {})` vaut `'E09'`.
- [ ] **Step 2: Run** `npx vitest run tests/suivi/roster.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** (normalisation `NFD` sans diacritiques, minuscules, découpe en mots entiers sur tout ce qui n'est pas lettre ou tiret ; prénoms de moins de 2 lettres ignorés).
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/suivi/roster.ts tests/suivi/roster.test.ts` puis `git commit -m "feat(suivi): liste locale de prénoms et garde-fou"`.

### Task 7: Appareil, classe et envoi

**Files:**
- Create: `src/suivi/classeAppareil.ts`, `src/suivi/envoi.ts`
- Test: `tests/suivi/classeAppareil.test.ts`, `tests/suivi/envoi.test.ts`

**Interfaces:**
- Produces: `interface ClasseAppareil { code: string; nbCodes: number }` ; `lireClasse(s: StockageLocal | null): ClasseAppareil | null` ; `enregistrerClasse(s, c: ClasseAppareil): void` ; `oublierClasse(s): void` (clé `gameactif.classe.v1`) ; `interface ClientSuivi { rpc(nom: 'game_class_info' | 'game_record_session', args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> }` ; `type ResultatEnvoi = 'ok' | 'invalide' | 'limite' | 'echec'` ; `envoyerSession(client: ClientSuivi, classCode: string, studentCode: string, payload: SessionPayload): Promise<ResultatEnvoi>` ; `chercherClasse(client: ClientSuivi, classCode: string): Promise<ClasseAppareil | null>` ; `MESSAGES_ENVOI: Record<ResultatEnvoi, string>` (français, sans détail technique, par ex. `echec` : « Le résultat de ce tour n’a pas été enregistré. Le jeu reste jouable. »).

- [ ] **Step 1: Write the failing tests** : `envoyerSession` avec un client factice qui rejette (`throw new TypeError('Failed to fetch')`) renvoie `'echec'` sans lever ; une réponse `'ok'` renvoie `'ok'` ; `'limite'` renvoie `'limite'` ; une réponse `error` renvoie `'echec'` ; `chercherClasse` renvoie `null` quand la fonction renvoie `null` ; `lireClasse` avec stockage qui lève renvoie `null`.
- [ ] **Step 2: Run** `npx vitest run tests/suivi`. Expected: FAIL.
- [ ] **Step 3: Implement** (aucune donnée du stockage n'est envoyée ailleurs que le code de classe et le code élève ; aucun `console.log`).
- [ ] **Step 4: Run** `npx vitest run tests/suivi`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/suivi tests/suivi` puis `git commit -m "feat(suivi): classe de l'appareil et envoi"`.

### Task 8: « Qui joue ? » dans l'écran d'activité

**Files:**
- Create: `src/ui/QuiJoue.tsx`
- Modify: `src/ui/ActivityScreen.tsx:104` (le `onDone` du tour) et l'en-tête de contrôles (lignes 100 à 112)
- Test: `tests/ui/quijoue.test.tsx`, `tests/ui/activityscreen-suivi.test.tsx`

**Interfaces:**
- Consumes: `ClasseAppareil`, `lireClasse`, `enregistrerClasse`, `chercherClasse`, `envoyerSession`, `MESSAGES_ENVOI` (tâche 7) ; `construirePayload` (tâche 5) ; `ClientSuivi`.
- Produces: `QuiJoue({ classe, valeur, onChange, onAssocier }: { classe: ClasseAppareil | null; valeur: string; onChange: (code: string) => void; onAssocier: (codeClasse: string) => Promise<string | null> }): JSX.Element` ; `ActivityScreen` reçoit une prop optionnelle `suivi?: ClientSuivi` (absente : aucun bloc suivi, comportement actuel inchangé).
- Comportement : sans classe, un lien « Associer cet appareil à une classe » ouvre un champ « Code de la classe » (placeholder concret, aide expliquant la portée : « Le code est donné par votre enseignant. Rien d’autre que votre code élève n’est envoyé. ») ; avec classe, une liste « Qui joue ? » propose « Jouer sans enregistrer » (valeur `''`, défaut) puis `E01` à `E<nbCodes>` ; à la fin d'un tour, si `valeur !== ''`, envoi puis retour de la liste à `''` ; message de retour dans une région `role="status"`.

- [ ] **Step 1: Write the failing tests** : (a) `QuiJoue` avec `nbCodes: 3` propose exactement « Jouer sans enregistrer », `E01`, `E02`, `E03`, valeur par défaut `''` ; (b) dans `ActivityScreen` avec un client factice, jouer un tour complet avec `E02` appelle `envoyerSession` une fois avec `studentCode = 'E02'` et `cibles` égales à `activity.cibles`, puis la liste revient à « Jouer sans enregistrer » ; (c) un tour joué sans code ne fait aucun appel ; (d) un client qui échoue affiche le message `MESSAGES_ENVOI.echec` et le tour reste affiché ; (e) sans prop `suivi`, aucun élément « Qui joue ? ».
- [ ] **Step 2: Run** `npx vitest run tests/ui/quijoue.test.tsx tests/ui/activityscreen-suivi.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `QuiJoue` ; dans `ActivityScreen`, étendre `onDone` pour appeler `construirePayload` (avec `crypto.randomUUID()` pour `sessionId`, `round` déjà en portée, `playing.mechanic`, `profile`, `activity.cibles`) puis `envoyerSession`. Le `finished` existant et le texte « Tour terminé » ne changent pas.
- [ ] **Step 4: Run** les deux tests puis `npx vitest run`. Expected: PASS, aucune régression (`tests/ui/activityscreen*.test.tsx`).
- [ ] **Step 5: Commit** `git add src/ui tests/ui` puis `git commit -m "feat(suivi): qui joue, envoi en fin de tour"`.

### Task 9: Agrégats du tableau de bord (fonctions pures)

**Files:**
- Create: `src/suivi/agregats.ts`
- Test: `tests/suivi/agregats.test.ts`

**Interfaces:**
- Consumes: `SessionEnregistree` (tâche 5), `elementStats`, `sessionSignals`, `DEFAULT_THRESHOLDS` de `src/engine/signals.ts`.
- Produces:
  - `interface ResultatManuel { studentCode: string; cible: string; resultat: 'reussi' | 'partiel' | 'a_reprendre'; date: string }`
  - `interface SeuilsEtats { reussite: number; jeuxDifferents: number; jours: number; erreurRepetee: number }` ; `SEUILS_ETATS_DEFAUT = { reussite: 0.75, jeuxDifferents: 3, jours: 2, erreurRepetee: 2 }`
  - `type Etat = 'stabilise' | 'en-cours' | 'a-reprendre' | 'pas-d-indice'`
  - `participation(codes: string[], sessions: SessionEnregistree[], manuels: ResultatManuel[], cible?: string): { joues: string[]; absents: string[] }`
  - `erreursParType(sessions: SessionEnregistree[], cible?: string): { juste: string; choisi: string; eleves: string[]; mecaniques: MechanicId[] }[]` (trié par nombre d'élèves décroissant ; `juste` et `choisi` sont les étiquettes de `labels`, ou l'id à défaut)
  - `jeuxParCible(sessions: SessionEnregistree[], manuels: ResultatManuel[], cible: string): { jeu: MechanicId | 'physique'; joueurs: number; r1Moyen: number | null; derniere: string }[]`
  - `etatEleve(code: string, cible: string, sessions: SessionEnregistree[], manuels: ResultatManuel[], s?: SeuilsEtats): Etat`
  - `evolution(sessions: SessionEnregistree[], cible: string, code?: string): { jour: string; r1: number }[] | null` (`null` sous 3 jours distincts de séance)
  - `faitsParEleve(code: string, sessions: SessionEnregistree[], manuels: ResultatManuel[]): { date: string; jeu: string; r1: number | null; erreurs: string[]; origine: 'ecran' | 'enseignant' }[]`

- [ ] **Step 1: Write the failing tests** (données construites dans le test, une cible `M.P4.1.1.i1.a1`) : `participation(['E01','E02','E03'], [séance E01, séance E03], [])` donne `joues: ['E01','E03']` et `absents: ['E02']` ; un résultat saisi pour `E02` le fait passer dans `joues` ; deux élèves choisissant `derriere` pour `devant` donnent une ligne `{ juste: 'devant', choisi: 'derriere', eleves: ['E01','E02'] }` ; `etatEleve` donne `'stabilise'` pour 3 jeux différents à `r1 >= 0,75` sur 2 jours, `'en-cours'` pour 1 jeu réussi, `'a-reprendre'` pour la même confusion dans 2 mécaniques différentes, `'pas-d-indice'` sans séance ni résultat saisi ; un `resultat: 'reussi'` saisi compte comme un jeu `'physique'` ; `evolution(...)` renvoie `null` pour 2 jours, un tableau de 3 points pour 3 jours ; classe de 40 codes sans aucune séance : `participation` renvoie 40 absents, `evolution` `null`, pas de `NaN` (`jeuxParCible` renvoie `[]`, `r1Moyen` null quand il n'y a pas de séance).
- [ ] **Step 2: Run** `npx vitest run tests/suivi/agregats.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** sans lecture du temps de réponse ; `r1` d'une séance = `sessionSignals(results).r1`. Aucune dépendance à React ou à Supabase.
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/suivi/agregats.ts tests/suivi/agregats.test.ts` puis `git commit -m "feat(suivi): agrégats du tableau de bord"`.

### Task 10: Lecture des données de la classe

**Files:**
- Create: `src/suivi/lecture.ts`
- Test: `tests/suivi/lecture.test.ts`

**Interfaces:**
- Produces: `interface ClasseLue { id: string; label: string; nbCodes: number; classCode: string; purgeLe: string; proprietaire: boolean }` ; `interface SuiviStore { classes(): Promise<ClasseLue[]>; sessions(classId: string): Promise<SessionEnregistree[]>; manuels(classId: string): Promise<ResultatManuel[]>; observations(classId: string): Promise<Observation[]>; creerClasse(label: string, nbCodes: number): Promise<ClasseLue>; supprimerClasse(classId: string): Promise<void>; saisirManuel(classId: string, r: Omit<ResultatManuel, 'date'>): Promise<void>; enregistrerObservation(classId: string, o: { studentCode: string | null; texte: string; visibleInvites: boolean }): Promise<Observation>; inviter(classId: string): Promise<string>; rejoindre(code: string): Promise<'ok' | 'deja' | 'invalide'>; revoquer(guestId: string): Promise<void> }` ; `magasinSuiviSupabase(client, userId): SuiviStore` et `magasinSuiviMemoire(): SuiviStore` (même patron que `src/compte/activites.ts`, erreurs classées par `ErreurStockage` de ce fichier).
- `interface Observation { id: string; studentCode: string | null; texte: string; visibleInvites: boolean; creeLe: string }`

- [ ] **Step 1: Write the failing tests** (client factice) : `sessions` convertit une ligne en `SessionEnregistree` avec `origine: 'ecran'` ; une ligne dont `results` n'a pas la forme attendue est ignorée sans lever ; `enregistrerObservation` envoie uniquement `student_code`, `texte`, `visible_invites`, `class_id` ; une erreur réseau lève `ErreurStockage` de code `'reseau'`.
- [ ] **Step 2: Run** `npx vitest run tests/suivi/lecture.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** les deux magasins.
- [ ] **Step 4: Run** le test. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/suivi/lecture.ts tests/suivi/lecture.test.ts` puis `git commit -m "feat(suivi): lecture des données de classe"`.

### Task 11: Tableau de bord, couche A (états), participation, erreurs, liens

**Files:**
- Create: `src/ui/TableauDeBord.tsx`
- Modify: `src/ui/EspaceEnseignant.tsx` (lire d'abord ce fichier ; ajouter l'entrée « Mes classes » et le choix de classe ; ne rien changer au comportement actuel des activités)
- Test: `tests/ui/tableau-de-bord.test.tsx`

**Interfaces:**
- Consumes: `SuiviStore`, `ClasseLue` (tâche 10), `participation`, `erreursParType`, `jeuxParCible`, `etatEleve`, `SEUILS_ETATS_DEFAUT` (tâche 9), `lireRoster`, `afficher` (tâche 6).
- Produces: `TableauDeBord({ classe, store, stockage }: { classe: ClasseLue; store: SuiviStore; stockage: StockageLocal | null }): JSX.Element`.
- Contenu : sélecteur d'attendu (parmi les `cibles` des séances reçues) ; barre « N codes sur M ont joué » ; liste des absents ; tableau des erreurs par type avec le nombre d'élèves ; tableau « même attendu dans les autres jeux » ; tableau des quatre états avec la règle affichée à côté de chaque état et le bandeau « Indice, pas une preuve » ; les codes sont remplacés par les prénoms de la liste locale à l'affichage seulement ; un volet « Seuils » (4 nombres, enregistrés localement par classe, valeurs de départ marquées « proposition, non validée scientifiquement »).

- [ ] **Step 1: Write the failing tests** : avec un store mémoire de 3 séances sur 24 codes, le texte « 2 codes sur 24 ont joué » (adapter les nombres aux données du test) ; avec un roster `{E01: 'Léa'}` le tableau affiche « Léa » et le DOM ne contient jamais `E01` à côté d'un envoi réseau (le store factice ne reçoit aucun prénom) ; le bandeau « Indice, pas une preuve » est présent ; sans séance, texte « Aucune séance reçue pour cette classe. » et aucun `NaN` dans le DOM ; changer un seuil modifie l'état affiché.
- [ ] **Step 2: Run** `npx vitest run tests/ui/tableau-de-bord.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** ; accessibilité : tableaux avec `<caption>`, entêtes `<th scope>`, états non codés par la seule couleur (pictogramme et mot).
- [ ] **Step 4: Run** le test puis `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/ui tests/ui/tableau-de-bord.test.tsx` puis `git commit -m "feat(suivi): tableau de bord, couche des états"`.

### Task 12: Couches évolution (C) et faits (B)

**Files:**
- Modify: `src/ui/TableauDeBord.tsx`
- Test: `tests/ui/tableau-de-bord-couches.test.tsx`

**Interfaces:**
- Consumes: `evolution`, `faitsParEleve` (tâche 9).
- Contenu : un élève sélectionné (liste de codes) ouvre « Évolution » (courbe SVG avec alternative texte : tableau jour et r1) puis « Faits » (tableau date, jeu, r1, erreurs, origine) ; « Évolution » affiche « Pas assez de séances pour une tendance (3 jours minimum). » quand `evolution` renvoie `null` ; couche A reste l'ouverture par défaut.

- [ ] **Step 1: Write the failing tests** : 2 jours de séances : le message de minimum est affiché et aucune courbe ; 3 jours : 3 points ; une ligne de faits saisie par l'enseignant porte « saisi par l'enseignant » ; ordre des couches dans le DOM : états, évolution, faits.
- [ ] **Step 2: Run** `npx vitest run tests/ui/tableau-de-bord-couches.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** le test puis `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/ui tests/ui` puis `git commit -m "feat(suivi): évolution et faits par élève"`.

### Task 13: Observations, saisie manuelle, classes, liste de prénoms, invité

**Files:**
- Create: `src/ui/MesClasses.tsx`, `src/ui/ObservationLibre.tsx`
- Modify: `src/ui/EspaceEnseignant.tsx`, `src/ui/TableauDeBord.tsx`
- Test: `tests/ui/observation-libre.test.tsx`, `tests/ui/mes-classes.test.tsx`

**Interfaces:**
- Consumes: `SuiviStore` (tâche 10), `contientPrenom`, `lireRoster`, `ecrireRoster`, `exporterRoster`, `importerRoster` (tâche 6).
- Produces: `ObservationLibre({ classId, codes, store, stockage }: { classId: string; codes: string[]; store: SuiviStore; stockage: StockageLocal | null }): JSX.Element` ; `MesClasses({ store, stockage }: { store: SuiviStore; stockage: StockageLocal | null }): JSX.Element`.
- Zone d'observation : label « Observation sur la classe ou sur un code », placeholder « E04 a corrigé seul devant/derrière en rejouant la fiche physique », aide « Écrivez le code, jamais le prénom. Ce texte est enregistré avec les résultats de la classe et supprimé le {purgeLe}. » ; case « Visible par la personne invitée » décochée par défaut ; si `contientPrenom(texte, roster)` trouve un prénom, l'enregistrement est refusé avec le message « Ce texte contient « {prénom} ». Remplacez-le par son code. » et `store.enregistrerObservation` n'est pas appelé.
- `MesClasses` : création (label avec aide « Pas de prénom : par exemple « P4 B, 2026-2027 » », nombre de codes 1 à 40), affichage du code de classe à donner aux élèves, date de suppression, liste locale de prénoms (saisie, import, export `.json`), saisie manuelle d'un résultat (code, attendu, `reussi | partiel | a_reprendre`, jamais envoyé avec un prénom), invitation d'une personne (affiche le code une seule fois), révocation, suppression de la classe avec confirmation, champ « J'ai un code d'invitation » visible pour tout compte connecté.

- [ ] **Step 1: Write the failing tests** : une observation avec « Léa » et roster `{E04: 'Léa'}` n'appelle pas le store et affiche le message ; la même sans prénom l'appelle une fois avec `visibleInvites: false` ; case cochée : `true` ; classe créée avec 24 codes : le code de classe est affiché ; l'export de la liste de prénoms ne passe jamais par `store` (store factice sans méthode de ce nom, appelé seulement sur `creerClasse`) ; suppression de classe demande une confirmation avant `store.supprimerClasse`.
- [ ] **Step 2: Run** `npx vitest run tests/ui/observation-libre.test.tsx tests/ui/mes-classes.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** ; lire `src/ui/EspaceEnseignant.tsx` avant d'ajouter l'accès (si l'espace refuse un compte sans ligne `game_teachers`, placer le champ « J'ai un code d'invitation » avant ce contrôle).
- [ ] **Step 4: Run** les tests puis `npx vitest run`, `npx tsc --noEmit`, `npx vite build`. Expected: tout vert.
- [ ] **Step 5: Commit** `git add src/ui tests/ui` puis `git commit -m "feat(suivi): classes, observations, saisie manuelle, invité"`.

### Task 14: Dossier pour le DPO et textes de confidentialité

**Files:**
- Create: `docs/confidentialite/dossier-dpo-suivi.md`

Pas de code.

- [ ] **Step 1: Écrire le dossier** : finalités ; données par table (`game_classes`, `game_sessions`, `game_observations`, `game_manual_results`, `game_guest_invitations`, `game_class_guests`) avec, pour chaque colonne, ce qu'elle peut contenir ; ce qui n'est jamais envoyé (prénoms, liste locale, seuils, temps de réponse) ; pseudonymat et risque de ré-identification par l'enseignant ; durée (30 août, `game_purge_expired`) ; rôles (enseignant responsable de sa classe ; invité lecture seule) ; risques connus : écriture ouverte à qui connaît le code de classe, observation libre qui contiendrait un prénom malgré l'information et le garde-fou, invité qui lit des données, perte de l'envoi sans file d'attente ; sous-traitant : Supabase (région et contrat à confirmer par JF, **non vérifiés**) ; questions posées au DPO (nom et date non connus).
- [ ] **Step 2: Vérification.** Relire : chaque phrase factuelle renvoie à un fichier du dépôt ou est étiquetée « non vérifié » ; aucune promesse (« sécurisé », « conforme »). Si la tâche 1 du plan 7 (pages légales) est exécutée, y reporter les phrases ; sinon les laisser dans ce dossier.
- [ ] **Step 3: Commit** `git add docs/confidentialite/dossier-dpo-suivi.md` puis `git commit -m "docs: dossier DPO du suivi par code"`.

### Task 15: Jalon JF (aucun code, chaque étape avec accord explicite)

**Files:**
- Modify: `docs/superpowers/plans/2026-11-06-gameactif-plan-8-suivi-par-code.md` (cocher les étapes faites, noter dates et sorties)

- [ ] **Step 1: Avis du DPO** sur le dossier de la tâche 14. Sans réponse, rien ci-dessous ne s'applique.
- [ ] **Step 2: Vérifier l'état du plan 4b.** Commande en lecture seule (accord de JF) : `npx --no-install supabase db query --remote=dfoaumjleqtxjeaplnna --yes "select to_regclass('public.game_teachers')"`. Si `null`, la migration `20261103_game_acces.sql` doit être appliquée avant `20261107_game_suivi.sql`, avec son propre accord.
- [ ] **Step 3: Essai en transaction annulée** de `20261107_game_suivi.sql` sur la base partagée, sur le modèle de `supabase/essai-rollback-game_acces.sql` (nouveau fichier `supabase/essai-rollback-game_suivi.sql`) ; constater l'absence de conflit de noms et que rien n'est conservé.
- [ ] **Step 4: Application de la migration** (second accord, distinct).
- [ ] **Step 5: Planification de la purge.** Lire d'abord `select extname from pg_extension where extname = 'pg_cron'`. Présent : `supabase/admin/planifier-purge.sql` avec `select cron.schedule('game_purge', '15 3 * * *', $$select public.game_purge_expired()$$)`. Absent : arrêter et revenir devant JF (la purge est une exigence de la spec, aucun substitut n'est improvisé). La disponibilité de `pg_cron` est **non vérifiée** à ce jour.
- [ ] **Step 6: Variables Vercel** `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (déjà listées dans le plan 4b) ; passer `suivi` à `ActivityScreen` seulement quand la configuration existe (« Mon espace » et « Qui joue ? » restent cachés sans clé).
- [ ] **Step 7: Essai réel** avec 2 ou 3 enseignants selon `docs/essais-classe/protocole.md` (plan 7, tâche 3). Rien n'est annoncé « validé » avant.

## Self-review

- **Couverture de la spec :** §2 point 1 participation (tâches 9, 11), point 2 erreurs (9, 11), point 3 autres jeux (9, 11), point 4 indice d'acquisition (9, 11), point 5 observations et saisie manuelle (13) ; couches A, C, B dans l'ordre (11, 12) ; liste locale de prénoms, affichage seulement, export (6, 11, 13) ; suppression au 30 août (1, 4, 15) ; information sur la zone d'observation et garde-fou (6, 13) ; invitation par code, lecture seule, révocable, expiration (3, 13) ; jouer sans code sans trace (8) ; aucun rappel à distance (aucun envoi de rappel n'existe dans le plan, voir tâche 11) ; contraintes DPO, RLS, `game_`, grants, essai annulé (Global Constraints, 1 à 4, 14, 15) ; anti-objectifs : aucun temps de réponse (aucun champ de temps dans `SessionPayload`), aucun prénom (tests des tâches 2, 5, 11, 13), aucune décision automatique (la couche A est un indice, tâche 11).
- **Cohérence des types :** `SessionPayload`, `ResultatEnvoye`, `SessionEnregistree` (tâche 5) sont utilisés tels quels aux tâches 7, 8, 9, 10 ; `ResultatManuel` (tâche 9) à la tâche 10 ; `SuiviStore` (tâche 10) aux tâches 11 à 13 ; `StockageLocal` vient de `src/compte/invitation.ts` ; `participation`, `etatEleve` et les autres gardent la même signature de la définition à l'usage.
- **Limites assumées :** pas de file d'attente d'envoi ; `axe-core` et accessibilité réelle des nouveaux écrans à passer par le protocole du plan 7 ; un prénom absent de la liste locale n'est pas détecté ; qui connaît le code de classe peut écrire sous le code d'un autre élève.
- **Proportion :** plan plus court que le code qu'il décrit (SQL, composants et tests non écrits) ; signatures, assertions et valeurs seulement.

## Décisions

- 2026-11-06 : tâches 1 à 14 exécutées sur la branche `feat/suivi-par-code` (non poussée, migration non appliquée, interrupteur `VITE_SUIVI_ACTIF` fermé par défaut). Suite complète : 73 fichiers, 760 tests ; `tsc` et `vite build` propres. Revue finale : auto-revue de l'auteur, deux correctifs (plafonds du payload, liste de prénoms relue partout).
- Tâche 15 (jalon JF) : non commencée, chaque étape attend un accord explicite (avis DPO, essai en transaction annulée, migration, `pg_cron`, variables Vercel, essai réel).
- Écarts au plan assumés : fichiers en plus (`formats.ts`, `PrenomsClasse`, `SaisieManuelle`, `InvitationClasse`, `seuils.ts`), `invites()` dans `SuiviStore`, `note` dans `Fait`, `peutCreer` et `lectureSeule`, interrupteur d'environnement.
- Constat hors plan : aucun lien d'activité pour les élèves ; une tablette ne joue l'activité que si elle ouvre le fichier exporté.
