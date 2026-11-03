# GameActif, plan 4b : compte enseignant par lien d'invitation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un enseignant invité par un lien de créer un compte, de se connecter, d'enregistrer ses activités dans son espace et de les retrouver sur tout appareil, sans rien changer à l'usage anonyme du parcours ni au fichier d'échange.

**Architecture:** Une migration SQL (non appliquée sans l'accord de JF) crée trois tables `game_*` et deux fonctions serveur (utiliser une invitation, savoir si on est enseignant). Côté application : un client Supabase injectable, un contexte d'authentification, un « magasin d'activités » (interface + implémentation Supabase + version en mémoire pour les tests), la lecture du code d'invitation dans l'adresse, et l'interface « Mon espace ». Le parcours reste utilisable sans compte ; l'enregistrement dans l'espace est un geste en plus.

**Tech Stack:** React 18, TypeScript 5 strict, Vitest 2, @testing-library/react, jsdom, `@supabase/supabase-js` v2 (client public, clé anon seulement), SQL PostgreSQL (migration Supabase).

**Spec:** `gameactif/docs/superpowers/specs/2026-11-03-gameactif-avenant-referentiel.md` (sections 13 et 14) ; modèle de référence pour la connexion et les migrations : `ecritactif/src/auth/AuthContext.tsx`, `ecritactif/supabase/migrations/`.

## Global Constraints

- Table préfixée `game_` obligatoire ; avant tout `create table`, vérifier les conflits : `grep -rIn "create table" --include=*.sql --exclude-dir=node_modules .` depuis la racine du workspace. `profiles` et le trigger `updated_at` existent déjà : ne pas les recréer.
- `GRANT` explicites dans la même migration que chaque `create table` ; rien pour `anon`. RLS activé sur chaque table, règles `auth.uid() = user_id`.
- **Jamais de sous-requête sur la même table dans une règle RLS** : contrôle d'accès croisé par fonction `security definer` avec `set search_path = public` (incident AménagActif 2026-09-23).
- La migration **n'est jamais appliquée** sans l'accord explicite de JF ; elle est d'abord essayée dans une transaction annulée (`supabase/essai-rollback-game_acces.sql`).
- Clé service_role jamais dans le navigateur ni dans le dépôt ; seules `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (publiques) existent côté application. Aucun `console.log` d'e-mail, de mot de passe, de code ou de brouillon.
- `signUp` avec `emailRedirectTo` explicite (sans lui, le lien du courriel renvoie vers une autre app du projet partagé).
- Le code d'invitation ne figure jamais dans les journaux, ne reste pas dans l'adresse après lecture (retiré de la barre d'adresse), et n'est stocké en local que le temps de la confirmation par courriel.
- Aucun nom d'élève n'est stocké ; aucune table d'élèves, de séances ou de résultats n'est créée (plan C, plus tard).
- Messages en français, bienveillants, qui disent quoi faire ; chaque champ a un label, un placeholder réel et un texte d'aide ; pas de tiret cadratin.
- Le parcours et le fichier d'échange du plan 4a restent inchangés et utilisables sans compte.
- Claude ne crée pas de compte ni ne saisit de mot de passe : l'essai d'inscription réel est fait par JF.

## Review Focus

1. Code d'invitation invalide, expiré, épuisé ou révoqué : aucun accès, aucune place consommée, message « Ce lien d'invitation n'est plus valable. Demandez-en un nouveau. ». Tests SQL (tâche 0) et interface (tâche 3).
2. Compte existant d'une autre app PLAI, connecté sans invitation : aucun accès aux activités, message qui explique comment obtenir un lien. Tests tâches 0 et 4.
3. Deux enseignants : chacun ne lit, ne modifie et ne supprime que ses activités. Test SQL tâche 0.
4. Réseau coupé ou erreur serveur pendant un enregistrement : le brouillon local est intact, un message dit de réessayer. Tests tâches 2 et 5.
5. Même code utilisé deux fois par le même compte : une seule place consommée. Test SQL tâche 0.

---

## Actions de JF (hors de ce que Claude peut faire seul)

- Donner l'accord avant d'appliquer la migration sur le projet Supabase partagé, après l'essai en transaction annulée.
- Autoriser dans Supabase (Authentication, URL Configuration) les adresses de redirection `https://gameactif.jfb4plai.com/**` et `http://localhost:5196/**`.
- Fournir (ou autoriser la lecture de) l'URL du projet et la clé publique `anon` pour les variables Vercel ; Claude les ajoute avec `printf` (pas `echo`) et vérifie par `vercel env pull`.
- Créer le premier lien d'invitation (script `supabase/admin/creer-invitation.sql`) et faire lui-même le parcours d'inscription réel.

---

## Structure des fichiers

```
gameactif/
  supabase/migrations/20261103_game_acces.sql      tables, fonctions, droits, RLS (NON APPLIQUÉE)
  supabase/essai-rollback-game_acces.sql           essais dans une transaction annulée
  supabase/admin/creer-invitation.sql              pour JF : créer, lister, révoquer un code
  .env.example                                      VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (sans valeur)
  src/lib/supabase.ts                               client public, créé une seule fois
  src/compte/auth.tsx                               AuthProvider, useAuth
  src/compte/invitation.ts                          lire, conserver, effacer le code ; utiliser l'invitation
  src/compte/activites.ts                           interface ActivitesStore, version Supabase, version mémoire
  src/ui/EspaceEnseignant.tsx                       connexion, création de compte, état d'accès
  src/ui/MesActivites.tsx                           enregistrer, lister, ouvrir, supprimer
  tests/compte/*.test.ts(x), tests/ui/espace*.test.tsx
```

---

### Task 0: Migration SQL et essais dans une transaction annulée

**Files:**
- Create: `supabase/migrations/20261103_game_acces.sql`, `supabase/essai-rollback-game_acces.sql`, `supabase/admin/creer-invitation.sql`

**Interfaces (SQL) — Produces :**
- Tables : `game_invitations(id uuid pk, code_hash text unique not null, max_uses int not null check (max_uses between 1 and 1000), uses int not null default 0, expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz default now())` ; `game_teachers(user_id uuid pk references auth.users on delete cascade, invitation_id uuid references game_invitations, created_at timestamptz default now())` ; `game_activities(id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, titre text not null, niveau text not null, matiere text not null, brouillon jsonb not null, format_version int not null default 1, created_at timestamptz default now(), updated_at timestamptz default now())`.
- Fonctions : `game_is_teacher() returns boolean` (security definer, `set search_path = public`, vrai si `auth.uid()` est dans `game_teachers`) ; `game_redeem_invitation(code text) returns text` (security definer ; renvoie `'ok'`, `'deja'` si le compte est déjà enseignant, ou `'invalide'` pour tout code inconnu, expiré, épuisé ou révoqué, sans distinguer les cas) ; `game_create_invitation(p_max_uses int, p_jours int) returns text` (renvoie le code en clair une seule fois ; exécutable par `postgres` et `service_role` seulement).
- Droits : `authenticated` peut `select` sa ligne de `game_teachers`, `select, insert, update, delete` sur `game_activities` (RLS : `user_id = auth.uid() and game_is_teacher()`), exécuter `game_is_teacher` et `game_redeem_invitation` ; `anon` n'a aucun droit ; `game_invitations` n'a aucune règle ni droit pour `anon` et `authenticated`. Trigger `updated_at` : réutiliser la fonction existante du projet partagé (vérifier son nom avant de l'attacher, sinon colonne mise à jour par l'application).

- [ ] **Step 1: Vérifier les conflits de noms** avec la commande de contrainte, depuis la racine du workspace ; consigner le résultat dans l'en-tête de la migration. Expected : aucune table `game_*` existante autre que celles de ce plan.
- [ ] **Step 2: Écrire les essais d'abord** (`essai-rollback-game_acces.sql`, tout dans `begin; … rollback;`) : (a) un code valide passe de 0 à 1 utilisation et crée une ligne `game_teachers` ; (b) le même code réutilisé par le même compte renvoie `'deja'` et laisse `uses` à 1 (Review Focus 5) ; (c) un code inconnu, un code expiré, un code révoqué et un code dont `uses = max_uses` renvoient `'invalide'` et ne créent aucune ligne ni ne changent `uses` (Review Focus 1) ; (d) un compte sans ligne `game_teachers` ne peut ni insérer ni lire dans `game_activities` (Review Focus 2) ; (e) deux comptes enseignants : A insère, B ne lit pas, ne modifie pas, ne supprime pas la ligne de A (Review Focus 3) ; (f) `anon` ne lit rien dans les trois tables ; (g) `authenticated` ne peut pas lire `game_invitations` ni écrire dans `game_teachers` ; (h) `game_create_invitation` refusée à `authenticated` ; (i) le code en clair n'apparaît dans aucune colonne de `game_invitations`. Les essais simulent l'identité avec `set local role authenticated` et `set local request.jwt.claim.sub`.
- [ ] **Step 3: Écrire la migration** (`20261103_game_acces.sql`) avec les tables, les fonctions, les droits et la RLS décrits ci-dessus ; en-tête « NON APPLIQUÉ : l'application sur la base partagée exige l'accord explicite de JF ». L'empreinte du code est `encode(digest(code, 'sha256'), 'hex')` ; un code est `encode(gen_random_bytes(24), 'base64')` rendu sûr pour une adresse (caractères `A-Za-z0-9_-`, 32 caractères). `game_redeem_invitation` verrouille la ligne de l'invitation (`for update`) avant de compter, pour qu'un code limité à N places n'en donne jamais plus.
- [ ] **Step 4: Écrire `creer-invitation.sql`** : trois blocs commentés pour JF (créer : `select public.game_create_invitation(30, 90);` ; lister sans montrer de code ; révoquer : `update public.game_invitations set revoked_at = now() where id = …`).
- [ ] **Step 5: Relecture de sécurité** par un second regard : lire la migration ligne à ligne contre la liste « Global Constraints » et noter chaque point dans le ledger. **Ne pas appliquer.** Demander l'accord de JF pour l'essai en transaction annulée, puis pour l'application.
- [ ] **Step 6: Commit.** `git add supabase && git commit -m "feat(compte): migration game_acces (invitations, enseignants, activités), essais et script d'invitation, non appliquée"`.

---

### Task 1: Client Supabase et contexte d'authentification

**Files:**
- Create: `.env.example`, `src/lib/supabase.ts`, `src/compte/auth.tsx`
- Modify: `package.json` (dépendance `@supabase/supabase-js`)
- Test: `tests/compte/auth.test.tsx`

**Interfaces:**
- Produces :
  - `getSupabase(): SupabaseClient` (lève « Configuration Supabase manquante » sans les deux variables)
  - `interface Utilisateur { id: string; email?: string }`
  - `interface AuthClient` (sous-ensemble de `supabase.auth` : `getSession`, `onAuthStateChange`, `signInWithPassword`, `signUp`, `signOut`)
  - `AuthProvider({ client?: AuthClient; children })` et `useAuth(): { user: Utilisateur | null; chargement: boolean; disponible: boolean; seConnecter(email, mdp): Promise<void>; creerCompte(email, mdp): Promise<{ confirmationRequise: boolean }>; seDeconnecter(): Promise<void> }`
  - `traduireErreurAuth(message: string): string` (messages français pour : identifiants invalides, e-mail déjà utilisé, mot de passe trop court, adresse non confirmée, trop de tentatives ; message générique sinon, sans détail technique)

- [ ] **Step 1: Écrire les tests qui échouent** (client factice injecté) : sans client et sans variables, `disponible` est faux et `chargement` passe à faux (l'application reste utilisable) ; `seConnecter` réussi met `user` à jour via `onAuthStateChange` ; une erreur du client est traduite ; `creerCompte` appelle `signUp` avec `emailRedirectTo` égal à l'origine de la page et renvoie `confirmationRequise: true` quand la session n'est pas ouverte ; `seDeconnecter` vide `user` ; la session initiale est lue ; abonnement nettoyé au démontage ; `traduireErreurAuth` couvre les cinq cas et ne laisse passer aucun texte anglais brut inconnu.
- [ ] **Step 2: Lancer** `npx vitest run tests/compte/auth.test.tsx`. Expected : FAIL.
- [ ] **Step 3: Implémenter** sur le modèle d'`ecritactif/src/auth/AuthContext.tsx` (client injectable, repli propre sans configuration). `.env.example` liste les deux variables sans valeur.
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck && npm run build`. Expected : tout passe.
- [ ] **Step 5: Commit.**

---

### Task 2: Magasin d'activités

**Files:**
- Create: `src/compte/activites.ts`
- Test: `tests/compte/activites.test.ts`

**Interfaces:**
- Consumes : `Brouillon`, `formeBrouillonValide`, `lireActivite`/`exporterActivite` (plan 4a).
- Produces :
  - `interface ActiviteEnregistree { id: string; titre: string; niveau: string; matiere: string; misAJour: string; brouillon: Brouillon }`
  - `interface ActivitesStore { lister(): Promise<ActiviteEnregistree[]>; enregistrer(b: Brouillon, id?: string): Promise<ActiviteEnregistree>; supprimer(id: string): Promise<void> }`
  - `class ErreurStockage extends Error { code: 'reseau' | 'acces' | 'inconnue' }`
  - `function magasinSupabase(client: ClientActivites): ActivitesStore` (table `game_activities`, tri par `updated_at` décroissant, `user_id` rempli par l'identité de la session, jamais par l'appelant)
  - `function magasinMemoire(): ActivitesStore` (pour les tests et pour l'usage sans compte)

- [ ] **Step 1: Écrire les tests qui échouent.** Les deux implémentations passent la même série : enregistrer sans `id` crée, avec `id` met à jour sans dupliquer ; `lister` rend les plus récentes d'abord ; `supprimer` retire ; un brouillon de forme invalide renvoyé par la base est écarté de la liste sans faire échouer la liste entière ; le titre et le niveau de la ligne viennent du brouillon (pas d'une saisie séparée) ; un client dont l'appel lève (réseau) donne `ErreurStockage('reseau')` et **ne modifie rien** (Review Focus 4) ; une erreur de droits (`42501`, `PGRST301`) donne `'acces'` ; aucune clé `email`, `userId` ni mot de passe n'est écrite dans `brouillon`.
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter** avec un type `ClientActivites` minimal (`from('game_activities')` chaînable) injecté, pour tester sans réseau.
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.**

---

### Task 3: Invitation (lecture du lien et utilisation du code)

**Files:**
- Create: `src/compte/invitation.ts`
- Test: `tests/compte/invitation.test.ts`

**Interfaces:**
- Produces :
  - `function lireCodeDansAdresse(url: URL): { code: string | null; urlNettoyee: string }` (paramètre `invitation`, retiré de l'adresse rendue)
  - `function codePlausible(code: string): boolean` (32 caractères parmi `A-Za-z0-9_-` ; sert à refuser tôt une saisie absurde, jamais à décider de la validité)
  - `interface StockageLocal { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }`
  - `conserverCode(s: StockageLocal | null, code: string)`, `codeConserve(s): string | null`, `oublierCode(s)` (clé `gameactif.invitation`, erreurs de stockage avalées)
  - `type ResultatInvitation = 'ok' | 'deja' | 'invalide' | 'reseau'`
  - `function utiliserInvitation(rpc: (nom: string, args: { code: string }) => Promise<{ data: unknown; error: unknown }>, code: string): Promise<ResultatInvitation>`
  - `const MESSAGE_INVITATION_INVALIDE = 'Ce lien d’invitation n’est plus valable. Demandez-en un nouveau.'`

- [ ] **Step 1: Écrire les tests qui échouent.** `lireCodeDansAdresse` extrait le code et rend une adresse sans `invitation` (autres paramètres et fragment conservés) ; sans paramètre, `code` est null et l'adresse est inchangée ; `codePlausible` refuse trop court, trop long, espaces, caractères hors liste ; stockage absent, bloqué ou qui lève : aucune exception ; `utiliserInvitation` : `'ok'` et `'deja'` selon la réponse du serveur, `'invalide'` pour toute autre réponse y compris inattendue (Review Focus 1), `'reseau'` quand l'appel lève ou renvoie une erreur ; le code n'est jamais passé à `console` (espion sur `console.log`, `warn`, `error`).
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter** en fonctions pures.
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck`. Expected : PASS.
- [ ] **Step 5: Commit.**

---

### Task 4: Interface « Mon espace »

**Files:**
- Create: `src/ui/EspaceEnseignant.tsx`
- Modify: `src/ui/Parcours.tsx`, `src/App.tsx` (fournisseur d'authentification), `src/styles/gazette.css`
- Test: `tests/ui/espace-enseignant.test.tsx`

**Interfaces:**
- Consumes : `useAuth`, `traduireErreurAuth`, `lireCodeDansAdresse`, `conserverCode`, `codeConserve`, `oublierCode`, `utiliserInvitation`, `MESSAGE_INVITATION_INVALIDE`.
- Produces : `EspaceEnseignant` (props : `{ rpc: …; stockage: StockageLocal | null; adresse?: () => URL }`) et un hook `useAcces(): { etat: 'inconnu' | 'anonyme' | 'sans-acces' | 'enseignant'; … }` :
  - non connecté : formulaire « Se connecter » (e-mail, mot de passe) ; si un code d'invitation est présent (adresse ou stockage), formulaire « Créer mon compte » avec phrase « Vous avez reçu une invitation à GameActif. » ;
  - connecté sans code ni ligne `game_teachers` : « Ce compte n'a pas encore accès à GameActif. Ouvrez le lien d'invitation que vous avez reçu. » (Review Focus 2) ;
  - connecté avec un code conservé : l'utilise, puis l'oublie, puis affiche l'accès ; code invalide : `MESSAGE_INVITATION_INVALIDE` ;
  - enseignant : adresse e-mail, bouton « Se déconnecter ».
  - L'usage anonyme du parcours est inchangé : aucun écran de connexion n'est imposé.

- [ ] **Step 1: Écrire les tests qui échouent** (client d'auth et `rpc` factices) : sans configuration Supabase l'espace affiche « La connexion n'est pas disponible pour le moment. » et le parcours reste utilisable ; formulaire de connexion avec label, placeholder réel (« Exemple : prenom.nom@ecole.be »), aide ; mot de passe avec label et aide sur la longueur minimale ; avec `?invitation=` valide en forme, le formulaire de création apparaît et l'adresse affichée est nettoyée ; création de compte avec courriel de confirmation : message « Un courriel de confirmation vient de vous être envoyé. Cliquez sur le lien qu'il contient, puis revenez vous connecter. » et le code reste conservé ; connexion d'un compte sans invitation : message d'absence d'accès, aucun appel à `utiliserInvitation` ; connexion avec code conservé valide : `utiliserInvitation` appelé une fois, code oublié, état « enseignant » ; code invalide : message du plan, code oublié ; erreur réseau : message de réessai, code conservé ; erreurs d'authentification affichées en français ; « Se déconnecter » rend l'état anonyme ; aucun mot de passe n'apparaît dans le DOM ni dans le stockage.
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter**, brancher `AuthProvider` dans `App` et `EspaceEnseignant` dans le parcours (zone repliable « Mon espace », fermée par défaut pour ne pas alourdir l'usage anonyme).
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck && npm run build`. Expected : tout passe.
- [ ] **Step 5: Commit.**

---

### Task 5: Mes activités (enregistrer, lister, ouvrir, supprimer)

**Files:**
- Create: `src/ui/MesActivites.tsx`
- Modify: `src/ui/Parcours.tsx`
- Test: `tests/ui/mes-activites.test.tsx`

**Interfaces:**
- Consumes : `ActivitesStore`, `ErreurStockage`, `Brouillon`, événement `charger` (plan 4a).
- Produces : `MesActivites` (props : `{ store: ActivitesStore; brouillon: Brouillon; onOuvrir(b: Brouillon): void }`), visible seulement pour l'état « enseignant » :
  - « Enregistrer dans mon espace » (désactivé sans niveau et matière) : crée, puis met à jour la même activité aux enregistrements suivants de la session ;
  - liste « Mes activités » (titre, niveau, date), chacune avec « Ouvrir » et « Supprimer » (confirmation « Supprimer cette activité ? Cette action est définitive. » avec « Supprimer » et « Annuler ») ;
  - « Ouvrir » demande confirmation quand un brouillon est en cours (comme le fichier) et appelle `onOuvrir` ;
  - messages d'erreur : réseau « L'enregistrement n'a pas abouti. Votre saisie est conservée : réessayez. » (Review Focus 4), accès « Votre session a expiré. Reconnectez-vous. ».

- [ ] **Step 1: Écrire les tests qui échouent** (magasin en mémoire et magasin qui échoue) : enregistrer crée puis met à jour sans doublon ; la liste se rafraîchit ; ouvrir charge le brouillon via `onOuvrir` après confirmation si un brouillon est en cours ; supprimer demande confirmation et retire ; annuler ne supprime rien ; erreur réseau à l'enregistrement : message, brouillon du parcours intact, rien dans la liste ; erreur d'accès : message de reconnexion ; liste vide : « Vous n'avez pas encore enregistré d'activité. » ; le composant n'est pas rendu pour un utilisateur anonyme ou sans accès.
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter** et brancher dans `Parcours` (étapes 4 et 5, à côté de la barre de fichier).
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck && npm run build`. Expected : tout passe.
- [ ] **Step 5: Commit.**

---

### Task 6: Mise en service et vérification réelle (avec JF)

**Files:**
- Modify: `memory/gameactif-session-prompt.md` (workspace parent)

- [ ] **Step 1: Suite et build.** `npm test && npm run typecheck && npm run build`. Expected : tout au vert.
- [ ] **Step 2: Essai SQL dans une transaction annulée** (après l'accord de JF) : exécuter `essai-rollback-game_acces.sql` sur le projet partagé ; consigner chaque résultat. Expected : tous les essais de la tâche 0 passent et rien n'est conservé (`rollback`).
- [ ] **Step 3: Application de la migration** (après un second accord explicite de JF) ; vérifier ensuite que les trois tables existent et que `anon` n'a aucun droit ; consigner la commande et la sortie.
- [ ] **Step 4: Variables Vercel** (avec l'accord de JF) : ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` au projet `gameactif` avec `printf`, vérifier par `vercel env pull`, puis redéployer.
- [ ] **Step 5: Parcours réel par JF** : créer un lien d'invitation (`creer-invitation.sql`), l'ouvrir dans une fenêtre privée, créer un compte, confirmer le courriel, se connecter, enregistrer une activité, se déconnecter, se reconnecter depuis un autre appareil, retrouver et ouvrir l'activité, la supprimer. Essayer aussi : le même lien avec un second compte, un lien révoqué, un compte d'une autre app PLAI sans lien. Claude lit les résultats que JF rapporte et ne saisit aucun mot de passe. Chaque constat est noté avec sa preuve ; ce qui n'est pas vu reste « non vérifié ».
- [ ] **Step 6: Mettre à jour le fil conducteur** et demander l'accord de JF avant tout `git push`.

---

## Auto-revue contre la décision de JF

| Exigence | Tâche |
|---|---|
| Inscription pour toute personne à qui JF communique le lien | 0 (invitations), 3, 4 |
| Retrouver ses jeux sur tout appareil | 2, 5 |
| Partage entre collègues par fichier (inchangé) | Contrainte globale, plan 4a |
| Rien qui gêne le suivi des élèves par code | Aucune table d'élèves ; `game_activities.id` stable ; brouillon identique au fichier |
| Usage sans compte conservé | 1 (repli sans configuration), 4 (zone repliable) |
| Conventions PLAI (préfixe, droits, RLS, migration non appliquée, essais annulés) | 0 |

Hors de ce plan : pont HubActif, élèves par code, séances, résultats et tableau de bord (plan C) ; interface d'administration des invitations ; récupération de mot de passe (réutiliser le circuit du projet partagé si JF le demande) ; catalogue commun entre collègues (le partage se fait par fichier).

Noms utilisés d'une tâche à l'autre, vérifiés : `getSupabase`, `AuthProvider`, `useAuth`, `traduireErreurAuth`, `ActivitesStore`, `ActiviteEnregistree`, `ErreurStockage`, `magasinSupabase`, `magasinMemoire`, `lireCodeDansAdresse`, `codePlausible`, `conserverCode`, `codeConserve`, `oublierCode`, `utiliserInvitation`, `MESSAGE_INVITATION_INVALIDE`, `EspaceEnseignant`, `MesActivites`, `game_is_teacher`, `game_redeem_invitation`, `game_create_invitation`.
