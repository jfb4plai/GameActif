# GameActif, plan 4a : export et import d'une activité par fichier

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un enseignant de télécharger son activité dans un fichier, de la rouvrir plus tard ou sur un autre appareil, et de l'envoyer à un collègue, sans compte ni serveur.

**Architecture:** Un module pur (`src/atelier/fichier.ts`) écrit et lit un format versionné qui contient le brouillon (pas l'activité construite), donc l'activité reste modifiable après import. La validation de forme du brouillon est partagée avec le stockage local. L'interface ajoute deux gestes : « Télécharger mon activité » et « Ouvrir une activité ».

**Tech Stack:** TypeScript 5 strict, React 18, Vitest 2, @testing-library/react, jsdom (déjà en place).

**Spec:** `gameactif/docs/superpowers/specs/2026-11-03-gameactif-avenant-referentiel.md` (sections 4, 13) ; décisions de JF du 2026-11-03 : export puis compte, partage par fichier, rien qui gêne le suivi des élèves par code plus tard.

## Global Constraints

- Le fichier ne contient **aucune identité** (ni e-mail, ni nom, ni identifiant de compte) : il devra pouvoir être rangé tel quel dans une base plus tard (format = brouillon versionné).
- Un fichier reçu d'un collègue est une **donnée non fiable** : taille limitée, forme vérifiée, aucun texte interprété comme du code ou du HTML.
- Le contexte de classe est inclus dans le fichier : l'interface le dit avant le téléchargement et rappelle de n'y mettre aucun nom d'élève.
- Messages en français, bienveillants, qui disent quoi faire ; jamais de détail technique brut.
- Guidage de champ : le champ de fichier a un label, un texte d'aide.
- Pas de tiret cadratin dans les textes d'interface.

## Review Focus

1. Fichier qui n'est pas du JSON, ou JSON d'un autre outil : message clair, aucun changement du brouillon en cours. Test en tâche 0.
2. Fichier trop gros ou aux champs démesurés : refusé avant toute analyse coûteuse. Test en tâche 0.
3. Fichier d'une version plus récente que celle de l'application : message dédié, pas de lecture hasardeuse. Test en tâche 0.
4. Fichier dont des compétences n'existent plus dans les données : elles sont retirées avec un avertissement, le reste est importé. Test en tâche 0.
5. Import qui écraserait un brouillon en cours : l'enseignant le sait avant de confirmer. Test en tâche 1.

---

### Task 0: Format de fichier (module pur)

**Files:**
- Create: `src/atelier/fichier.ts`
- Modify: `src/parcours/stockage.ts` (utiliser la validation de forme partagée), `src/atelier/brouillon.ts` (export de `formeBrouillonValide`)
- Test: `tests/atelier/fichier.test.ts`

**Interfaces:**
- Consumes : `Brouillon`, `niveaux`, `matieres`, `REFERENTIEL`.
- Produces :
  - `const FORMAT = 'gameactif-activite'`, `const VERSION_FICHIER = 1`, `const TAILLE_MAX_OCTETS = 200_000`
  - `function formeBrouillonValide(x: unknown): x is Brouillon` (déplacée de `stockage.ts`, exportée par `brouillon.ts`)
  - `function nomDeFichier(b: Brouillon, date: Date): string` (forme `gameactif-<titre-sans-accents-en-minuscules-avec-tirets>-AAAA-MM-JJ.json` ; `gameactif-activite-AAAA-MM-JJ.json` si le titre est vide ; titre tronqué à 40 caractères)
  - `function exporterActivite(b: Brouillon, maintenant: Date): { nom: string; contenu: string }` (JSON indenté de 2 espaces : `{ format, version, exporteLe, brouillon }`)
  - `type Lecture = { ok: true; brouillon: Brouillon; avertissements: string[] } | { ok: false; message: string }`
  - `function lireActivite(texte: string): Lecture`

- [ ] **Step 1: Écrire les tests qui échouent.** Aller-retour : `lireActivite(exporterActivite(b).contenu)` rend un brouillon égal et aucun avertissement. Forme : le fichier contient exactement les clés `format`, `version`, `exporteLe`, `brouillon` et aucune clé d'identité (ni `email`, ni `userId`). `nomDeFichier` : accents retirés, apostrophes et espaces en tirets, titre vide, titre de plus de 40 caractères tronqué, date au bon format. Refus avec message exact : texte vide (« Le fichier est vide. »), JSON invalide (« Ce fichier n'est pas une activité GameActif : il n'est pas lisible. ») (Review Focus 1), JSON d'un autre outil `{ "a": 1 }` (« Ce fichier n'est pas une activité GameActif. »), `format` correct mais `version` 2 (« Ce fichier vient d'une version plus récente de GameActif. Mettez l'application à jour ou demandez un nouvel envoi. ») (Review Focus 3), taille supérieure à `TAILLE_MAX_OCTETS` (« Ce fichier est trop gros pour être une activité GameActif. ») sans appeler `JSON.parse` (le test passe un texte de 300 000 caractères qui ferait échouer l'analyse), brouillon de forme invalide (« Ce fichier est abîmé : l'activité n'a pas pu être relue. »), niveau ou matière absents des données (« Ce niveau ou cette matière n'existe pas encore dans GameActif. »), champ de texte de plus de 20 000 caractères refusé comme trop gros (Review Focus 2). Compétence inconnue : retirée, avertissement « 1 compétence(s) du fichier n'existent plus dans le programme chargé et ont été retirées. » (Review Focus 4). Compétence d'un autre niveau que celui du fichier : traitée comme inconnue. Texte dangereux (`<script>alert(1)</script>` dans un élément) : lu tel quel comme du texte, sans transformation. Familles : le fichier doit en contenir exactement trois (forme du brouillon).
- [ ] **Step 2: Lancer** `npx vitest run tests/atelier/fichier.test.ts`. Expected : FAIL, module introuvable.
- [ ] **Step 3: Implémenter** le module. L'ordre des contrôles : taille, parse, format, version, forme, niveau et matière, tailles de champs, compétences. Déplacer `brouillonValide` de `stockage.ts` vers `brouillon.ts` sous le nom `formeBrouillonValide` et le réutiliser dans les deux endroits (aucun changement de comportement du stockage : ses tests restent verts).
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck`. Expected : tout passe.
- [ ] **Step 5: Commit.** `git commit -m "feat(atelier): format de fichier versionné pour exporter et importer une activité"`.

---

### Task 1: Gestes dans l'interface

**Files:**
- Create: `src/ui/BarreFichier.tsx`
- Modify: `src/ui/Parcours.tsx`, `src/parcours/etapes.ts` (événement `charger`), `src/styles/gazette.css`
- Test: `tests/parcours/etapes.test.ts` (événement `charger`), `tests/ui/barre-fichier.test.tsx`, `tests/ui/parcours.test.tsx`

**Interfaces:**
- Consumes : `exporterActivite`, `lireActivite`, `Brouillon`, `EtatParcours`, `Evenement`.
- Produces :
  - Événement `{ type: 'charger'; brouillon: Brouillon }` : remplace le brouillon et place l'étape sur `elements`.
  - `BarreFichier` (props : `{ brouillon: Brouillon; enCours: boolean; onCharger(b: Brouillon): void; telecharger?: (nom: string, contenu: string) => void; maintenant?: () => Date }`) : bouton « Télécharger mon activité », champ « Ouvrir une activité (fichier) » avec aide, messages dans une région `role="status"`.

- [ ] **Step 1: Écrire les tests qui échouent.**
  - `etapes.test.ts` : `charger` remplace le brouillon et met l'étape à `elements` ; un brouillon chargé reste modifiable.
  - `barre-fichier.test.tsx` : « Télécharger mon activité » appelle `telecharger` avec le nom attendu et un contenu relisible par `lireActivite` ; l'avertissement « Le fichier contient votre contexte de classe. Relisez-le avant de l'envoyer et n'y mettez aucun nom d'élève. » est affiché à côté du bouton ; le bouton est désactivé quand le brouillon n'a ni niveau ni matière ; choisir un fichier valide appelle `onCharger` avec le brouillon lu et affiche « Activité ouverte : <titre>. » ; un fichier invalide affiche le message de `lireActivite` et n'appelle pas `onCharger` (Review Focus 1) ; des avertissements de lecture sont affichés ; quand `enCours` est vrai (un brouillon est déjà commencé), un fichier valide demande d'abord « Remplacer votre activité en cours ? » avec « Remplacer » et « Annuler », et ne charge rien avant « Remplacer » (Review Focus 5) ; « Annuler » ne change rien ; le champ de fichier a un label et un texte d'aide reliés.
  - `parcours.test.tsx` : un brouillon exporté depuis un parcours complet puis importé dans un parcours neuf (autre stockage) rend l'étape « Vos éléments » avec le titre et les paires ; la barre est visible à l'étape 1 (ouvrir) et aux étapes 4 et 5 (télécharger).
- [ ] **Step 2: Lancer.** Expected : FAIL.
- [ ] **Step 3: Implémenter.** `enCours` = le brouillon courant a un niveau choisi ou un texte saisi. Téléchargement par défaut : `Blob` + lien `download` temporaire, libéré après usage. Lecture du fichier avec `File.text()`. Le bouton « Recommencer » n'est pas modifié.
- [ ] **Step 4: Lancer** `npx vitest run && npm run typecheck && npm run build`. Expected : tout passe.
- [ ] **Step 5: Commit.** `git commit -m "feat(ui): télécharger et ouvrir une activité par fichier"`.

---

### Task 2: Vérification réelle et sauvegarde

- [ ] **Step 1: Suite et build.** `npm test && npm run typecheck && npm run build`. Expected : tout au vert.
- [ ] **Step 2: Dans le navigateur** (`npm run dev`, port 5196) : parcours complet jusqu'aux jeux, « Télécharger mon activité », vérifier le nom et le contenu du fichier produit, « Recommencer », rouvrir le fichier, retrouver titre, compétences et saisie. Essayer un fichier JSON quelconque, un fichier texte, un fichier modifié à la main avec `version: 2`. Noter chaque constat avec sa preuve ; ce qui n'est pas vu reste « non vérifié ».
- [ ] **Step 3: Mettre à jour le fil conducteur** et demander l'accord de JF avant tout `git push`.

---

## Auto-revue contre la décision de JF

| Exigence | Tâche |
|---|---|
| Récupérer ses jeux sans compte | 0, 1 |
| Partage entre collègues par fichier | 0, 1 (avertissement sur le contexte, fichier non fiable) |
| Ne rien construire qui gêne le suivi des élèves plus tard | Contraintes globales : fichier sans identité, format = brouillon versionné |
| Fichier reçu = donnée non fiable | 0 (taille, forme, texte inerte) |

Hors de ce plan : compte enseignant et enregistrement en base (plan 4b), pont HubActif et suivi des élèves (plan suivant), plusieurs activités rangées dans l'application.
