# GameActif : avenant 1, ancrage sur les référentiels FWB

Date : 2026-11-03. Statut : brouillon à relire par JF. Complète `2026-10-01-gameactif-design.md` (la spec reste valable ; cet avenant ajoute, il ne remplace pas).

## 1. Décisions de JF (2026-11-03)

- On étend GameActif plutôt que de créer une app concurrente.
- Option A d'abord (gabarits : Associer, Trier, Remettre en ordre), puis option C (voie libre) seulement après validation de A.
- Pilote : une seule compétence, P3-P4, français ou maths.
- Contenu : l'enseignant le fournit OU l'IA l'extrait de sa ressource, avec validation élément par élément dans les deux cas (déjà la règle de la spec, section 7).
- Référentiels : dossier `referentiels-fwb/`.

## 2. Pourquoi

Le jeu généré par une IA est souvent un habillage ludique sur un exercice. Sans lien avec ce que le programme demande d'apprendre, ni l'enseignant ni le tableau de bord ne peuvent dire ce que l'élève a travaillé. L'ancrage répond à une question simple : « ce jeu travaille quel attendu du programme ? ». Ce que l'ancrage ne garantit pas : que le contenu des éléments soit juste, ni que le jeu produise un apprentissage (voir section 8).

## 3. Sources de référentiel (constaté le 2026-11-03)

| Source | Contenu | Usage proposé |
|---|---|---|
| `referentiels-fwb/maths/P3.json`, `P4.json` | champs > sous-points (codes 1.1 à 4.1) > items (Savoir / Savoir-faire / Compétence) > attendus (liste de phrases). P3 : 150 attendus, P4 : 173 (compte relu sur P4 par script) | Source principale du pilote maths |
| `referentiels-fwb/francais/P3.json`, `P4.json` | structure différente : descripteurs transversaux, rubriques, compétences de réception et de production | Après le pilote maths, avec un adaptateur dédié |
| `referentiels-fwb/P3/`, `P4/` (par discipline) | version riche (séquences, activités, preuve) ; `P4/mathematiques.json` pèse 594 Ko | Hors lot : trop lourd pour le navigateur, utile à un script de préparation |
| `referentiels-fwb/cecp officiel/*.pdf` | PDF officiels CECP | Référence de contrôle, pas chargés par l'app |
| CPEONS | Hors périmètre : JF (2026-11-03) précise que CPEONS concerne le secondaire ; le pilote est primaire (CECP). Aucun fichier CPEONS dans le dossier | À reprendre si GameActif s'étend au secondaire |

Anomalie connue (rapport d'extraction maths) : les fractions sont reconstituées en notation « a/b » à partir d'une mise en page verticale. À recontrôler contre le PDF avant tout jeu sur les fractions.

## 4. Modèle de données ajouté

Un **jeu de données de référentiel** unique, produit par script à partir des JSON, et embarqué dans l'app sous forme de fichier statique léger (pas la version riche de 594 Ko). Une entrée :

- `code` : `M.P4.1.1.i3.a2` = matière, année, sous-point, rang de l'item, rang de l'attendu ;
- `texte` : l'attendu mot pour mot ;
- `type` : Savoir, Savoir-faire ou Compétence ;
- `sous_point_titre`, `champ_titre` ;
- `version_source` : nom du fichier et date d'extraction.

Le code par rang est fragile si une extraction est refaite. Mitigation : chaque activité stocke aussi le `texte` de l'attendu visé au moment de la création (instantané), et le script de génération échoue si le nombre d'attendus d'un sous-point change sans mise à jour de la version.

Dans le modèle d'activité (spec section 5), ajout du champ **`cibles`** : liste de 1 à 3 codes d'attendus, obligatoire à la publication. Chaque élément peut porter une seule cible parmi celles de l'activité. Table `game_activities` : colonne `targets jsonb` ; `game_attempts` : colonne `target_code text` (lecture des échecs par attendu). Migration avec `GRANT` explicites et RLS, comme la section 8 de la spec.

## 5. Création : deux entrées, une seule validation

1. L'enseignant choisit **année, discipline, sous-point, puis 1 à 3 attendus** (liste filtrable, texte officiel affiché en entier).
2. Entrée A, « j'ai mon contenu » : il saisit ou colle les éléments (ou un .docx). L'IA ne fait que structurer.
3. Entrée B, « extrais de ma ressource » : il colle un texte ou un .docx ; l'IA propose des éléments **en citant l'extrait source de chacun**. Un élément sans extrait source retrouvable dans le texte fourni est rejeté par le code, pas par l'IA.
4. Zone éditable, validation carte par carte, contexte de classe obligatoire : inchangés (spec section 7).
5. Nouveau contrôle : si le contenu proposé ne correspond visiblement pas aux attendus choisis (l'IA est interrogée en JSON strict, réponse oui / non / incertain avec motif), l'interface affiche un avertissement non bloquant « ce contenu semble hors des attendus choisis ». C'est une heuristique, pas une validation pédagogique, et l'interface le dit.

Prompt déclaudisé, Haiku, JSON par structured outputs, `api/generate` autonome : comme la spec.

## 6. Tableau de bord par attendu

La vue 1 (quoi réenseigner) regroupe en plus les échecs par `target_code` : « sur l'attendu X, n % d'échecs au 1er essai ». Mêmes seuils et même minimum de 5 élèves que la spec section 8. Libellé d'aide : « signal à interpréter avec votre connaissance de la classe ». Pas de couverture « du programme » affichée : un jeu ne couvre pas un attendu.

## 7. Pilote (sous-point confirmé par JF le 2026-11-03 ; critère de réussite encore à fixer)

Maths P4, sous-point 1.1 « (Se) repérer et communiquer des positionnements ou des déplacements », item Savoir « Les visions de l'espace ». Ses attendus (lus dans `maths/P4.json`) :
- vocabulaire des positions absolues : à côté de, contre, à l'intérieur, entre, sous, sur…
- vocabulaire des positions relatives : devant, derrière, à droite, à gauche, au-dessus, en face de…
- vocabulaire des positions ordinales : premier, deuxième… dernier ; au début, à la fin, avant, après.

Adéquation aux mécaniques (déduit, non testé) : Trier (classer des mots ou des phrases en absolu / relatif / ordinal), Remettre en ordre (ordinaux). Pas de fractions, donc pas touché par l'anomalie de la section 3.

Critère de réussite du pilote, à fixer avec JF avant de coder : par exemple « 3 enseignants créent un jeu de ce sous-point, et chacun retouche au moins un élément » (mesure : taux de modification déjà prévu à la spec section 7). Le seuil est une proposition.

## 8. Ce que l'avenant ne fait pas bien

- Ne vérifie pas la justesse des éléments : l'enseignant reste responsable de chaque carte.
- Le contrôle de correspondance aux attendus est une heuristique de l'IA.
- Trois mécaniques reconnaissent, elles ne font pas rappeler librement : pas de promesse d'effet-test fort (spec section 12).
- Un élève peut réussir le jeu sans maîtriser l'attendu : le signal reste un indice.

## 9. Points ouverts

1. ~~CPEONS~~ : sans objet pour le primaire (JF, 2026-11-03).
2. ~~Sous-point pilote~~ : maths P4 1.1, confirmé par JF le 2026-11-03.
3. Critère de réussite du pilote (section 7).
4. Adaptateur français : à concevoir après le pilote maths.
5. Références RISS : aucune ajoutée par cet avenant. Toute affirmation sur le jeu et l'apprentissage affichée dans l'app passe d'abord par `mcp__RISS__search_articles`.

## 10. Impact sur les plans

- Plan 1 (moteur pur) : une tâche courte pour le champ `cibles` dans `types.ts` et la validation (publication refusée sans cible).
- Plan 3 (création) : écran de choix du référentiel, entrée B avec extraits sources, contrôle de correspondance.
- Plan 4 (Supabase) : colonnes `targets` et `target_code`.
- Plan 5 (tableau de bord) : regroupement par attendu.
- Nouvelle tâche hors plans : script de génération du jeu de données de référentiel, avec test de comptage (173 attendus pour maths P4).
- Option C (voie libre) : à spécifier après le pilote, pas avant.

## 11. Quatrième mécanique : Placer dans une scène (décidée par JF le 2026-11-03)

Origine : l'aperçu `previsualisation/index.html` (onglet 3, « Place le chat »). JF a jugé les mécaniques de tri peu engageantes et sans mouvement, puis a demandé d'ajouter celle-ci.

Principe : une scène dessinée contient des zones nommées ; l'élève déplace un objet (glisser, ou flèches puis Entrée) vers la zone que la consigne désigne (« Pose le chat sous la table »).

Modèle proposé (déduit, non testé hors maquette) :
- `scene` : identifiant, dessin (SVG), liste de zones `{ id, rectangle, repos }`, objet à déplacer.
- `consigne` : texte + zone attendue + attendu visé (`cibles`). Une consigne sans zone attendue est invalide.
- Ce n'est qu'un choix parmi des zones : l'engine générique `round.ts` du plan 1 peut le porter, avec un fichier de mise en place `placer.ts` comme `associer.ts` et `trier.ts`. La conversion position à l'écran vers zone relève du rendu, pas du moteur.
- Profils : Soutien = cadre indice dès la première erreur ; Standard = après 2 erreurs (comme la maquette) ; Défi = pas d'indice.

Attendus que cette mécanique peut viser (sous-point 1.1 P4) : vocabulaire de position absolue ; « Placer un ensemble d'objets selon des consignes données, en 2D ». Les positions relatives (devant, à gauche) sont exclues : elles dépendent du point de vue, la consigne serait ambiguë.

Limites et points ouverts :
1. Source des scènes : DÉCIDÉ par JF (2026-11-03). Bibliothèque de 3 à 5 scènes fixes dessinées par PLAI ; l'IA propose seulement des consignes et la zone attendue, jamais le dessin.
2. Coût : à chiffrer, c'est-à-dire séparer (a) un coût unique : un rendu de scène qui lit une scène décrite en données (la maquette a une scène codée en dur) ; (b) un coût par scène : dessin SVG, zones, 4 à 6 consignes relues, test souris + clavier + description. Les durées ne sont pas mesurées : à noter la durée réelle de la première scène avant d'extrapoler.
3. Accessibilité, explicite : (a) clavier prévu (flèches + Entrée) ; (b) voix de la consigne prévue ; (c) chaque scène porte une description accessible écrite (objets présents et leur disposition générale, sans nommer la zone attendue) ; (d) limite assumée : cette mécanique évalue le lien entre un mot de position et une image. Pour un élève qui ne voit pas l'image, elle ne mesure pas la même chose, et décrire la position du chat avec les mots de la consigne donnerait la réponse. Pour ces élèves, l'activité reste proposée en Trier ou Associer ; la mécanique scène n'est pas présentée comme équivalente.
4. Un glisser lancé pendant le retour animé de l'objet a été ignoré une fois en essai : traité au développement (reproduire d'abord, puis corriger). Pris comme accepté par JF.
5. Mouvement contre sobriété : tension relevée en spec section 12 ; animations courtes sans clignotement, mode calme obligatoire, à tester avec des élèves dont des élèves TDAH.
6. Effet sur l'apprentissage : aucune preuve ajoutée ; l'engagement visé n'est pas un résultat d'apprentissage.
