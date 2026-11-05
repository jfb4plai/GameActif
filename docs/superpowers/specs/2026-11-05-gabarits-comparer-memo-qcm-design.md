# GameActif : trois nouveaux gabarits intégrés (Comparer, Mémo, QCM libre)

Date : 2026-11-05. Statut : conception, en attente de validation de JF. Aucun code écrit.

## 1. Pourquoi

Les jeux sur écran de GameActif reprennent presque tous la forme « ranger des éléments dans des cases » (Trier, Associer, Placer). Cette forme ne convient pas à toutes les compétences. Exemple donné par JF : « plus grand que / plus petit que ». L'élève doit voir deux nombres séparés par un espace et indiquer le bon symbole ; il doit aussi pouvoir relier le nom d'un symbole à son signe, ou le faire en mémo.

Objectif : élargir le catalogue des jeux intégrés avec trois mécaniques de forme différente, et faciliter l'ajout d'autres mécaniques plus tard (demande de JF).

## 2. Décisions de JF (2026-11-05)

- Trois gabarits intégrés à l'app : **Comparer**, **Mémo**, **QCM libre**.
- « Relier » : l'Associer actuel suffit, pas de nouveau jeu avec traits tracés.
- Le mode IA libre (prompt singulier collé dans le Claude de l'enseignant, webapp autonome, catalogue large type Wordwall, style GameActif imposé, section « Autres jeux, avec votre IA (Claude recommandé) ») est un **projet séparé**, à traiter après celui-ci, avec sa propre conception. Il ne fait pas partie de ce document. Tir aux bulles et Casse-briques restent tels quels.

## 3. Buts, non-buts, anti-buts

Buts
- Comparer, Mémo et QCM jouables sur écran, saisis dans « Vos éléments », listés dans « Vos jeux » comme les quatre jeux actuels.
- Chacun a son jeu physique en regard (règle du 2026-11-03 : un jeu physique par mécanique, calme, matériel listé).
- Chacun respecte le split 80/20 (contenu tapé par l'enseignant), le mode calme, la lecture au clavier et au lecteur d'écran.
- Ajouter une mécanique plus tard coûte un module et une ligne d'inscription, pas une retouche de dix fichiers.

Non-buts
- Pas de génération par l'IA dans ces trois gabarits (contenu tapé par l'enseignant).
- Pas de traits tracés pour Relier.
- Pas de suivi des élèves par code (projet C), mais rien qui l'empêche : chaque gabarit produit des `ElementResult` comme les autres.
- Pas de phrases « lien avec le programme » écrites à l'avance pour les nouveaux jeux (voir 6.5).

Anti-buts (échec même si ça marche techniquement)
- Un jeu où la bonne réponse se devine par la forme (toujours le même symbole, bonne réponse toujours en première position).
- Un jeu avec chronomètre, classement ou points perdus (écartés depuis 2026-10-01).
- Une saisie qui permet à l'enseignant de fabriquer une réponse fausse (le symbole de Comparer est calculé, jamais tapé).

## 4. Ce qui existe (constaté dans le code le 2026-11-05)

- `MechanicId = 'associer' | 'trier' | 'ordre' | 'placer'` (`src/engine/types.ts`). Chaque mécanique est répétée dans `availability.ts`, `setup.ts`, `physical/templates.ts`, `physical/programme.ts`, `ActivityScreen.tsx` (ORDER, LABEL), `EtapeElements.tsx` (NOMS_JEUX), `brouillon.ts` (`statutsJeux` typé sur trois jeux), `PhysicalKitView.tsx`.
- Un tour est un `RoundState` : éléments, une liste d'options **commune à tous les éléments**, `step()` pour choisir ou demander un indice, résultats `ElementResult` (`src/engine/round.ts`).
- Associer exploite déjà des paires `gauche | droite` et fait choisir ou glisser chaque élément vers sa case.
- L'enseignant saisit un `Brouillon` de texte brut (familles, paires, étapes) ; `assembler()` le convertit en `Activity` (`src/atelier/brouillon.ts`).
- Le fichier d'échange est versionné (`VERSION_FICHIER = 1`) ; `lireActivite` reconstruit le brouillon champ par champ (`src/atelier/fichier.ts`) : un champ nouveau serait donc **perdu à l'import** s'il n'y est pas ajouté.
- Profils : Soutien/Standard/Défi règlent `maxItems` (4/6/8), indices, essais (`src/engine/profiles.ts`).
- `programmeLinks` affiche « À compléter par l'enseignant » quand aucune phrase n'existe pour la mécanique (`src/physical/programme.ts`).
- Les prompts arcade ne lisent que `dispo.trier` et `dispo.associer` : ils ne sont pas touchés.

## 5. Les trois gabarits

### 5.1 Comparer

Écran : « 12 ▢ 8 » avec trois boutons : > (plus grand que), < (plus petit que), = (égal à). Le nom est lu aux lecteurs d'écran (`aria-label`). Un seul élément à l'écran à la fois ; retour bienveillant du moteur, indice possible selon le profil.

Saisie : une comparaison par ligne, `12 | 8`. L'app **calcule** le symbole juste ; l'enseignant ne le tape pas. Nombres acceptés : entiers, décimaux (virgule ou point), fractions simples `a/b` (mon choix, voir 8).

Contrôles à la saisie, en français :
- ligne mal formée, valeur non numérique, dénominateur nul ;
- deux nombres identiques répétés dans deux lignes ;
- avertissement si toutes les comparaisons donnent le même symbole, ou si le plus grand est toujours à gauche (indice de surface) ;
- minimum 3 comparaisons pour que le jeu soit disponible.

Jeu physique : « Les cartons-symboles ». Deux cartes-nombres posées côte à côte avec un espace ; l'équipe pose le carton >, < ou = entre elles. Manipulation seulement, sur table, à voix basse. Matériel : cartes-nombres (2 par comparaison), 3 cartons-symboles par équipe.

### 5.2 Mémo

Écran : grille de cartes face cachée. L'élève en retourne deux ; si elles forment une paire, elles restent visibles, sinon elles se retournent après un temps de pause (sans chronomètre ni compte à rebours). Les cartes viennent des **paires déjà saisies pour Associer** (`nom | symbole`) : deux cartes par paire. Aucune nouvelle saisie.

Règles :
- le nombre de paires suit `maxItems` du profil (4/6/8) ; pas de cartes sans partenaire (les `distractors` du profil sont ignorés pour Mémo) ;
- l'ordre des cartes est mélangé une fois par le moteur (graine), jamais au rendu ;
- indice : montre une carte de la bonne paire pendant un instant, dans la limite des indices du profil ;
- chaque paire produit un `ElementResult` : `firstTry` vrai si, à la première carte retournée de cette paire, la deuxième retournée était son partenaire ; une erreur est attribuée à la paire de la **première** carte retournée (mon choix) ;
- mode calme : pas d'animation de retournement, la carte change simplement d'état ; clavier : chaque carte est un bouton avec un nom accessible (« Carte 3, face cachée » puis le texte de la carte) ; annonce dans une zone `aria-live`.

Jeu physique : « Les cartes qui se retrouvent ». Cartes face cachée sur la table ; à tour de rôle, un élève de l'équipe en retourne deux. Même cartes que sur écran (même tour). Manipulation seulement.

### 5.3 QCM libre

Écran : une question, 2 à 4 réponses, une seule juste. L'élève choisit ; le moteur répond comme pour les autres jeux.

Saisie : une question par ligne, `question | bonne réponse | fausse 1 | fausse 2 | fausse 3`. La **première** réponse tapée est toujours la bonne ; l'app mélange l'ordre à l'affichage. Au minimum une fausse réponse, au maximum trois.

Nombre de réponses affichées selon le profil (mon choix) : Soutien 2, Standard 3, Défi 4 (dans la limite de ce que l'enseignant a saisi). Les fausses réponses retenues sont tirées dans celles saisies.

Contrôles à la saisie : question vide, bonne réponse vide, deux réponses identiques dans une même question, une seule colonne, plus de quatre réponses, minimum 3 questions.

Garde-fou contre l'indice de surface : la position de la bonne réponse est tirée au hasard et non alignée sur l'ordre de saisie (même principe que `arrangeAgainst`).

Jeu physique : « Les cartons A, B, C ». Chaque question sur une carte avec ses réponses en lettres ; l'équipe lève le carton de la lettre choisie ; corrigé sur la fiche. Pas de déplacement.

## 6. Conception technique

### 6.1 Registre des mécaniques

Une table unique (`src/engine/mecaniques.ts` ou équivalent) décrit chaque mécanique : identifiant, libellé, ordre d'affichage, disponibilité, préparation du tour, gabarit physique, composant d'affichage. `ActivityScreen`, `EtapeElements`, `statutsJeux`, `kit.ts` la lisent au lieu de dupliquer des `switch`. Les quatre mécaniques actuelles y sont migrées (même comportement, tests inchangés). Un ajout futur = un module + une ligne dans la table.

### 6.2 Moteur

- `MechanicId` gagne `comparer`, `memo`, `qcm`.
- `ElementState` gagne `choices?: string[]` (sous-ensemble des options proposées à cet élément ; absent = toutes). `choose` refuse une option hors `choices`, l'indice ne choisit que dans `choices`. Nécessaire au QCM, dont les réponses changent par question. Rétrocompatible : les quatre mécaniques actuelles n'y touchent pas.
- `RoundState` gagne `deck?: string[]` (ordre des cartes, Mémo seulement).
- Nouveaux modules purs `comparer.ts`, `memo.ts`, `qcm.ts` avec `setupX(activity, profile, rng, overrides)`, enregistrés dans `setup.ts`.
- Comparer : éléments = comparaisons, options = `>`, `<`, `=` (non exclusives). QCM : options = toutes les réponses des questions retenues, `choices` par question. Mémo : le tour a la forme d'un tour Associer sans distracteurs, plus `deck`.
- `Activity` gagne `comparisons: { id: string; left: string; right: string }[]` et `questions: { itemId: string; correctId: string; distractorIds: string[] }[]` ; les réponses de QCM sont des `Item` (texte tapé, validé). `validateActivity` contrôle les références.
- `availability.ts` : trois nouvelles entrées avec leur message « Il faut au moins… ».

### 6.3 Saisie et fichier

- `Brouillon` gagne `comparaisons: string` et `qcm: string` (texte brut, une ligne par entrée), comme `paires` et `etapes`.
- `EtapeElements` : deux nouvelles sections (Comparer, QCM), chacune avec les trois éléments de guidage obligatoires (label précis, placeholder réel, aide sous le champ). La section Paires devient « Paires pour les jeux Associer et Mémo ». La liste « Jeux disponibles » passe de 3 à 6 lignes.
- Fichier : `VERSION_FICHIER` passe à 2 ; `lireActivite` accepte 1 et 2 ; un fichier v1 donne `comparaisons` et `qcm` vides ; `formeBrouillonValide` tolère l'absence des nouveaux champs ; `CHAMP_MAX` s'applique aussi à eux. Le stockage local du brouillon reçoit la même tolérance.

### 6.4 Écrans

- `ComparerBoard`, `MemoBoard`, `QcmBoard` : composants dédiés qui n'affichent que l'état et traduisent clic, clavier ou toucher en actions du moteur. `RoundBoard` n'est pas réutilisé (sa forme « éléments à glisser vers des cases » ne convient à aucun des trois).
- Style gazette existant (papier crème, mots de l'élève en Arial, 16 px minimum, contrastes), mode calme respecté.

### 6.5 Jeux physiques et lien programme

- Trois nouveaux gabarits dans `physical/templates.ts`, validés par `templateProblems` (un seul groupe qui se déplace, signal d'arrêt, matériel sûr, voix chuchotée, aucun chronomètre, aucune compétition). Ils calculent leur fiche depuis le **même tour** que le jeu sur écran (règle de `kit.ts`).
- `PhysicalKitView` : une présentation des cartes pour chacun (paires de cartes-nombres, deck de mémo, questions avec lettres).
- Lien programme : aucune phrase n'est écrite à l'avance. L'interface affiche « À compléter par l'enseignant : en quoi ce jeu travaille cet attendu » (comportement existant quand `PHRASES_PILOTE` n'a pas d'entrée). Raison : les phrases actuelles ont été écrites pour le pilote maths P4 1.1 et relues par JF ; en inventer pour des jeux sans attendu précis serait présenter une hypothèse comme un fait.

## 7. Vérifications attendues

- Tests unitaires purs pour chaque `setupX`, la disponibilité, le calcul des symboles (entiers, décimaux, fractions, égalité, dénominateur nul), la graine déterministe, les garde-fous d'indice de surface, la lecture de fichiers v1 et v2.
- Tests d'interface : clavier, nom accessible des boutons, annonce `aria-live`, mode calme.
- Les 459 tests actuels restent au vert ; `tsc` et `vite build` passent.
- Essai dans le navigateur, parcours réel : saisir une activité contenant les trois nouveaux jeux, jouer chacun, exporter puis réimporter le fichier, ouvrir la fiche physique.
- Non vérifiable ici et à dire comme tel : tablette réelle, lecteur d'écran réel, impression PDF, essai avec des élèves.

## 8. Mes choix à relire (pas validés par JF)

1. Comparer accepte aussi les fractions `a/b`, pas seulement les nombres entiers et décimaux (utile à partir de P5). Retrait facile si JF préfère limiter.
2. Les trois symboles `>`, `<`, `=` sont toujours proposés, même pour des activités sans égalité.
3. QCM : première réponse = bonne ; 2/3/4 réponses affichées selon le profil ; max 3 fausses.
4. Mémo : un échec est attribué à la paire de la première carte retournée ; les distracteurs du profil sont ignorés.
5. Version de fichier 2 plutôt que champs optionnels en version 1 : une ancienne version de l'app refuse proprement un fichier récent au lieu de perdre des données en silence.
6. Pas de phrases « lien programme » écrites pour les nouveaux jeux.
7. Un jeu physique par nouveau gabarit, conformément à la règle du 2026-11-03 ; coût : trois gabarits et trois présentations de cartes en plus.

## 9. Laissé au constructeur

Noms de fichiers et de composants, mise en page exacte des écrans, textes de retour des nouveaux jeux (dans le ton existant), durée de la pause des cartes de Mémo, découpage des tâches, forme exacte du registre du 6.1.
