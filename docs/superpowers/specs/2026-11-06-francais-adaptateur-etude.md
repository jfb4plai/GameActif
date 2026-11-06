# Étude : adaptateur de référentiel pour le français (P1 à P6)

Date : 2026-11-06. Statut : étude, rien n'est construit. Elle chiffre l'effort et pose les décisions à prendre avant un plan.
Statuts : constaté (commande ou fichier cité), déduit (raisonnement), non vérifié.

## 1. Pourquoi

GameActif ne charge que les mathématiques (`data/referentiel-maths.json`, 861 attendus, `scripts/build-referentiel.mjs`). La comparaison avec pinpon.uno du 2026-11-06 montre que le français pèse autant que les maths dans l'offre de ce concurrent (54 jeux de français pour 54 de maths, chiffres affichés par leur page). Un outil limité aux maths passe à côté d'une grande part du besoin des enseignants du fondamental (déduit).

## 2. Structure du français (constaté)

Source : `../referentiels-fwb/francais/P1.json` à `P6.json`, un fichier par année. Commande : `node scripts/etude-referentiel-francais.mjs ../referentiels-fwb` (lecture seule, testée par `tests/data/etude-francais.test.ts`).

Forme d'un fichier : `annee`, `matiere`, `source`, `descripteurs_transversaux`, `rubriques[]` (10 par année, chacune avec `rubrique`, `sous_rubrique`, `items[]`), puis `competences_reception` (`ecouter`, `lire`) et `competences_production` (`ecrire`, `parler`). Un item porte `type` (Savoir ou Savoir-faire), `contenu`, `visees` (PARLER, ÉCOUTER, LIRE, ÉCRIRE) et `attendus[]` (textes).

| Année | Attendus des rubriques | Attendus des compétences |
|---|---|---|
| P1 | 116 | 17 |
| P2 | 131 | 17 |
| P3 | 168 | 18 |
| P4 | 191 | 20 |
| P5 | 212 | 20 |
| P6 | 210 | 20 |
| Total | 1 028 | 112 |

Comparaison : les maths comptent 861 attendus (73, 122, 150, 173, 176, 167 par année). Le français en a donc environ 19 % de plus dans les seules rubriques.

## 3. Écart avec les maths (constaté)

- Les maths ont des codes dans le fichier source (`sous_points[].code`, qui donnent `M.P4.1.1.i1.a1`). **Le français n'a aucun code** : `rubrique` et `item` n'ont pas d'identifiant. Il faut en fabriquer, par exemple `F.P4.r3.i2.a1` (rubrique, item, attendu, par rang). Un code par rang change si l'extraction est refaite : à figer avec un test de comptage, comme `ATTENDUS_ATTENDUS` dans `scripts/build-referentiel.mjs`.
- Les maths regroupent en 3 ou 4 sous-points par année ; le français en 10 rubriques, chacune de 10 à 25 attendus (déduit des comptes ci-dessus). L'étape « Compétences visées » du parcours devra rester lisible avec 10 groupes.
- Le français distingue `visees` (parler, écouter, lire, écrire), absent des maths : une dimension de plus à proposer pour filtrer (déduit).

## 4. Endroits du code qui supposent des maths (constaté par `grep`)

| Endroit | Hypothèse |
|---|---|
| `scripts/build-referentiel.mjs:25` | matière codée en dur `'mathematiques'`, lit `referentiels-fwb/maths/` |
| `src/data/referentiel.ts` | charge un seul JSON, `referentiel-maths.json` |
| `src/data/catalogue.ts:14` | `LIBELLES_MATIERES` ne connaît que `mathematiques` |
| `src/ui/SaisieManuelle.tsx:7` | `FORME_ATTENDU = /^M\.P[1-6](\.[A-Za-z0-9]+)+$/` |
| `supabase/migrations/20261107_game_suivi.sql` (lignes 215 et 321) | même expression régulière sur les attendus, dans `game_record_session` et dans `game_manual_results` : **un code `F.` serait refusé par la base** |
| `src/physical/programme.ts` | phrases « lien programme » du pilote écrites pour des codes `M.P4...` ; les autres codes retombent sur « À compléter par l'enseignant » (déduit de `A_COMPLETER` dans `ActivityScreen.tsx`) |

La migration `20261107` n'étant pas appliquée, la généraliser en place (`^[MF]\.P[1-6]...`) ne coûte rien ; une fois appliquée, il faudra une nouvelle migration.

## 5. Mécaniques utilisables telles quelles (déduit)

Les mécaniques choisissent leur disponibilité d'après les données de l'activité (`availableMechanics`). Les attendus ne sont que des étiquettes ; le contenu vient de l'enseignant.
- **Utilisables** : Associer (mot et classe, mot et définition), Trier (mots par catégorie), Remettre en ordre (étapes, phrases), Mémo, QCM libre.
- **Non utilisables** : Comparer (nombres et symboles) et Placer dans une scène (bibliothèque de scènes pensée pour les positions).
Aucun jeu spécifique au français (dictée, accord, lecture chronométrée) n'existe ; le principe « sans chrono » interdit d'ailleurs la dernière.

## 6. Effort (déduit, en tâches de plan)

1. **Données** : généraliser le script de construction (second jeu `data/referentiel-francais.json`, codes `F.P#.r#.i#.a#`, garde de comptage par année : 116, 131, 168, 191, 212, 210).
2. **Chargement** : `src/data/referentiel.ts` fusionne les deux jeux ; le libellé « Français » dans `catalogue.ts` ; l'étape « Matière » propose les deux.
3. **Codes d'attendus** : l'expression régulière en trois endroits (TypeScript, SQL deux fois) et ses tests.
4. **Parcours** : étape « Compétences visées » pour 10 rubriques ; éventuellement le filtre par visée.
5. **Liens programme** : repli propre pour les codes `F.` (le texte officiel est repris du référentiel, la phrase est « à compléter »).
6. **Pilote** : une activité d'exemple de français (sous-point choisi par JF) et son essai.

Estimation : 6 tâches, du même ordre que le plan 3 (parcours niveau-matière-compétences, 8 tâches). C'est une estimation, pas une mesure.

## 7. Poids sur le site

`data/referentiel-maths.json` pèse 500 232 octets (constaté, `ls -l`). Le français en ajouterait environ autant (déduit : 1 028 attendus de longueur comparable), ce qui double la donnée embarquée. L'alerte de taille de `vite build` existe déjà ; charger le français à la demande est une option du plan.

## 8. Décisions pour JF

- Faut-il le français avant le suivi des élèves, avant l'essai en classe, ou après ? (recommandation : après l'essai du pilote P4, pour ne pas disperser.)
- Quel sous-point pour le pilote de français ?
- Le filtre par visée (parler, écouter, lire, écrire) est-il voulu ?
- Le secondaire est hors périmètre (décision du 2026-11-03).
