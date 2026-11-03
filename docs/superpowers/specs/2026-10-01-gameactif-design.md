# GameActif : spec de conception

Date : 2026-10-01. Statut : brouillon à relire par JF avant plan d'implémentation.
Nom : GameActif. Tables : préfixe `game_` (aucun conflit trouvé dans les migrations du workspace le 2026-10-01).

## 1. Objectif

Application d'activités interactives (type Wordwall) ancrée dans le contexte PLAI :
- FWB, Pôle Territorial de Liège, élèves en difficulté et/ou porteurs de troubles d'apprentissage ;
- adaptation au niveau par profils de réglages ;
- split 80/20 : l'IA propose, l'enseignant relit, corrige et valide chaque élément ;
- tableau de bord enseignant qui dit quoi réenseigner et quel niveau ajuster ;
- look ludique et engageant, sans compétition ni pression.

Public : enseignants FWB (création, suivi) et élèves (jeu, sans compte, code anonyme via HubActif).

## 2. Principes de conception

1. Inclusion : le ludique ne doit jamais coûter de la surcharge cognitive. Mode calme intégré dès le lot 1.
2. IA = amplificateur : aucune publication sans validation explicite élément par élément ; contexte de classe obligatoire.
3. Pas de décision automatique sur les élèves : l'appli suggère, l'enseignant décide.
4. Pas de classement, pas de chrono, pas de séries quotidiennes, pas de points perdus.
5. Exemples et vocabulaire FWB (école secondaire, CEB, CE1D, CESS), jamais « collège » ni « lycée ».
6. Toute justification scientifique affichée dans l'appli est vérifiée RISS (voir section 12).

## 3. Périmètre

### Lot 1 (cette spec)
- Trois mécaniques : Associer, Trier en catégories, Remettre en ordre.
- Création : thème libre, texte collé, ou .docx (extraction dans le navigateur, sans OCR).
- Trois profils de réglages : Soutien, Standard, Défi.
- Leviers d'engagement : retour immédiat bienveillant, parcours personnel visible, univers choisi par l'élève (thème + mascotte), défi coopératif de classe optionnel, mode calme.
- Branchement HubActif (assignation, code élève, fin de session).
- Tableau de bord : vue « quoi réenseigner » et vue « quel niveau ajuster ».

### Hors lot 1
- Vue « qui accompagne » (signaux d'engagement par code) : écartée pour l'instant.
- Vue v2 (comparaison avant/après, export dossier d'élève/PIA) : retenue pour la v2.
- Autres mécaniques (texte à trous, mots mêlés, anagramme, roue).
- PDF scannés et images en entrée (pas d'OCR).
- Contenu réellement différent par niveau généré dans l'appli : c'est ProgressActif qui produit les ressources différenciées, importées ici en .docx.
- Classement, chrono, séries, badges de rapidité : écartés.

## 4. Architecture

Stack : React 18, Vite 5, Tailwind 3, Supabase partagé, fonctions Vercel `api/*.ts` autonomes (pas d'import entre fichiers d'`api/` ; code partagé recopié par script, comme le `hub-bridge` de LexiActif). Haiku (`claude-haiku-4-5-20251001`) côté serveur uniquement. Test de la génération avec `vercel dev`, pas `vite dev`. Branche `main`.

Unités, chacune avec une interface claire :
1. Modèle d'activité : schéma typé (éléments, relations, contexte, état de validation).
2. Moteurs de mécanique (associer, trier, ordre) : fonctions pures (état, action) vers (nouvel état, retour pédagogique). Testables sans interface.
3. Profils : paramètres appliqués aux moteurs.
4. Rendu élève : thèmes, mascotte, carte de progression, animations, mode calme.
5. Création : sources, extraction .docx, appel IA, zone éditable, validation.
6. Pont HubActif : jeton, élève par code, événements, bouton « Assigner via HubActif ».
7. Tableau de bord : lecture de `game_attempts`, deux vues.

## 5. Modèle de contenu

Une activité = un ensemble d'éléments + des relations :
- appariement (élément ↔ élément) ;
- appartenance (élément → catégorie) ;
- rang (élément → position).

Chaque élément : texte ou image, marqueur de difficulté (facile, moyen, difficile), état de validation.

Limite assumée : un même contenu ne se prête pas toujours aux trois mécaniques. Après génération, l'appli indique les mécaniques disponibles selon les relations renseignées et propose de compléter ce qui manque.

## 6. Mécaniques et profils

Les trois mécaniques se jouent au glisser-déposer, au « toucher puis toucher » et au clavier.

Profils (paramètres, pas de contenu différent) : nombre d'éléments affichés, nombre de groupes ou de distracteurs, indices disponibles, lecture à voix haute, aides visuelles, essais illimités ou non. Assignation par code élève ou pour la classe. Le marqueur de difficulté par élément permet, plus tard, de filtrer les éléments selon le profil sans changer le modèle de données.

Un .docx à trois niveaux (cas ProgressActif) est détecté par ses intitulés ; l'enseignant confirme le découpage et obtient trois activités liées.

## 7. Création et split 80/20

1. Source : thème, texte collé ou .docx. Champs : année FWB, discipline, contexte de classe (obligatoire, placeholder FWB concret, aide expliquant l'effet sur le vocabulaire et les exemples), termes à éviter ou imposer.
2. .docx : extraction du texte et des tableaux dans le navigateur. Avertissement avant envoi à l'IA si le texte semble contenir des noms ou prénoms d'élèves (avertissement seul, l'enseignant décide ; pas de passage par l'Anonymiseur FWB au lot 1). PDF scannés et images refusés avec message clair.
3. Proposition IA : JSON strict via structured outputs. Prompt déclaudisé (jamais de « Voici », « Bien sûr »). Éléments mélangés, pas d'indice de surface entre élément et réponse.
4. Zone éditable : une carte par élément, modifiable, ajoutable, supprimable, réordonnable.
5. Validation : publication impossible tant que chaque élément n'est pas validé. Pas d'option « tel quel ». Compteur discret « n modifiés, m inchangés » (miroir, non bloquant). L'état « proposé par l'IA » n'est jamais visible par l'élève.
6. Choix des mécaniques disponibles, profil par défaut, défi coopératif optionnel, puis assignation via HubActif.

Limites annoncées dans l'interface : l'outil ne juge pas la qualité pédagogique d'un contenu, ne remplace pas une évaluation, ne traite pas les documents scannés.

Mesure d'usage (anonyme) : taux de modification des éléments par activité, pour vérifier que les enseignants personnalisent réellement.

## 8. Données et tableau de bord

Tables (RLS actif, `GRANT` explicites dans la même migration, fonctions `security definer` pour tout contrôle d'accès croisé, aucun `EXISTS` auto-joint) : `game_activities`, `game_items`, `game_sessions`, `game_attempts`. Pas de nouvelle table `profiles`. Accès enseignant : `auth.uid() = user_id`. Accès élève : uniquement via fonctions serveur qui vérifient le jeton du hub.

`game_attempts` (une ligne par élément résolu dans une session, voir `ElementResult` du plan 1) : activité, session, élément, code élève anonyme, profil actif, réussite au 1er essai, nombre d'essais, indices utilisés, choix erroné (élément ou groupe). Pas de durée par élément, pas de texte libre, pas de nom.

Vue 1, quoi réenseigner (non nominative) : éléments classés par taux d'échec au 1er essai, confusions fréquentes, phrase d'aide à l'interprétation.

Vue 2, quel niveau ajuster (par code) : trois signaux descriptifs (réussite au 1er essai, essais par élément, recours aux indices), suggestion « à alléger », « adapté » ou « à relever » avec les chiffres. L'enseignant décide d'un clic ; aucun changement automatique.

### Seuils initiaux (valeurs par défaut, réglables par l'enseignant, affichées en clair)

Ce sont des heuristiques de départ, non validées scientifiquement, présentées comme telles dans l'interface. Elles seront revues après les premiers usages réels.

Sessions prises en compte : une session compte seulement si l'élève a joué au moins 50 % des éléments (une session abandonnée est ignorée). Fenêtre : les 2 dernières sessions comptées sur cette activité, jamais moins de 2.

Signaux calculés par session : R1 = part des éléments réussis au 1er essai ; E = nombre moyen d'essais par élément ; I = part des éléments pour lesquels un indice a été utilisé.

Vue 2, suggestion par élève :
- « Profil à alléger » : R1 < 50 % dans les 2 sessions de la fenêtre.
- « Profil à relever » : R1 ≥ 90 % et I ≤ 10 % et E ≤ 1,1, dans les 2 sessions de la fenêtre.
- « Profil adapté » : tous les autres cas (R1 entre 50 % et 89 %).
- Moins de 2 sessions comptées : aucun libellé, chiffres bruts seulement.
- Les chiffres (R1, E, I) sont toujours affichés à côté du libellé. Le profil Soutien offre plus d'indices par conception : pour un élève en Soutien, I n'entre pas dans la règle « à alléger ».

Vue 1, éléments à réenseigner :
- Un élément est signalé quand au moins 40 % des élèves qui l'ont joué échouent au 1er essai ; il passe en « à reprendre en priorité » à partir de 60 %.
- Une confusion (élément rangé dans un mauvais groupe, ou apparié à un mauvais élément) est affichée quand elle est produite par au moins 3 élèves.
- Seuil minimal de données : au moins 5 élèves ont joué l'élément. En dessous, les chiffres bruts sont affichés avec la mention « peu de données » et sans libellé.

Ces valeurs sont stockées dans un objet de configuration unique, modifiable par l'enseignant par activité, avec retour aux valeurs par défaut en un clic.

HubActif : deux libellés d'indicateurs déclarés (par exemple `éléments réussis`, `éléments repris`) et événement de fin de session idempotent calculé côté serveur. Aucun score global. Purge annuelle alignée sur le hub (août, pas avant le 15).

## 9. Intégration HubActif

Modèle de LexiActif : bouton « Assigner via HubActif » (`/enseignant/assigner?app=<slug>&title&link&type&domain`), lecture et retrait du jeton `?t=` (ES256, 120 h), rangement par tâche, vérification serveur avec `HUB_SIGNING_PUBLIC_KEY`, élève retrouvé ou créé par son code, `POST /api/events` du hub avec `x-app-key`, `event_id` = id de session, timeout 5 s, échec silencieux. Enregistrement de l'app dans le hub (script `register-app.mjs`). Contrat : `hubactif/docs/CONTRAT-API.md`.

## 10. Look, accessibilité, mode calme

- Élève : 3 ou 4 univers (par exemple forêt, mer, espace) avec mascotte et palette, contraste AA minimum. Arial, 16 px minimum, cibles de 44 px minimum, une idée par écran.
- Enseignant : style guide PLAI (teal #0a9370, orange #f97316, logo en hauteur fixe 32 px, largeur automatique).
- Animations de moins de 500 ms, sans clignotement ; `prefers-reduced-motion` respecté.
- Mode calme : pas d'animations, pas de sons, décor uni, mascotte statique ; activable par l'élève ou imposé par l'enseignant pour un code.
- Lecture à voix haute par synthèse vocale du navigateur ; voix fr-BE non garantie, repli sur une voix française, à tester sur les tablettes réelles.
- Retours : formulation bienveillante (« Pas tout à fait. Regarde l'indice. »), jamais de « Faux » rouge, pas de score chiffré en échec, pas de perte de points.
- Fin de session : progression personnelle, sans comparaison.
- Annonces d'état pour lecteurs d'écran.

## 11. Sécurité, erreurs, tests

Sécurité : clé Anthropic côté serveur uniquement ; rate limiting et authentification sur `/api/generate` (pattern `_auth.js`, leçon de l'audit ProgressActif) ; aucun `console.log` de données utilisateur ; variables dans Vercel uniquement.

Erreurs : échec IA, bascule en saisie manuelle sans perte ; hub injoignable, échec silencieux ; .docx illisible ou scanné, message clair.

Tests : moteurs, profils et signaux du tableau de bord en tests unitaires ; test de non-régression sur le mélange et l'absence d'indice de surface ; parcours complet en navigateur sous `vercel dev` (création, validation, assignation, jeu, tableau de bord) ; navigation clavier seul ; vérification visuelle du branding ; revue globale finale après la dernière tâche.

## 12. Vérification RISS (effectuée le 2026-10-01)

Méthode : recherche plein texte dans le corpus et lecture des extraits. Les textes intégraux n'ont pas tous été relus : relire avant toute citation publique dans l'appli. Beaucoup de sources sont des mémoires universitaires (préfixe `dumas-`), de qualité variable ; les thèses (`tel-`) et articles (`hal-`, `edutice-`) pèsent davantage.

| Levier de conception | Sources RISS trouvées | Force du soutien |
|---|---|---|
| Retour ciblé après erreur | hal-05361521 (Fouchet-Isambard, Millon Faure, 2025, typologie des erreurs pour feedbacks adaptatifs) ; dumas-03138797 (Collion, 2020) | Modérée pour le feedback ciblé par type d'erreur (maths). Mémoire pour le reste. |
| Éviter compétition et classement | tel-04496255 (Meddeb, 2023, thèse, cite Dupont et al. : feedbacks positifs et précis, absence de comparaison sociale et de compétition) ; hal-05524385 (Gouzi et al., 2023, critique de la mise en compétition) ; dumas-01401819 (Challain, 2016) | Indirecte : contextes EPS et notation, pas jeux numériques. Aucune preuve directe trouvée sur le classement dans un jeu numérique pour élèves en difficulté. |
| Leviers au choix, ludification adaptée | tel-01255382 (Monterrat, 2015, thèse, ludification adaptative selon profils de joueur) | Modérée : un seul type de mécanique ne convient pas à tous. |
| Choix et autonomie | hal-01880040 (Claudon, Kugler, 2011, structures contrôlantes et autodétermination) ; dumas-04495949 (Delbès, 2023). Deci et Ryan : réel, hors corpus RISS en source primaire (cité via mémoires) | Modérée à faible, source secondaire. |
| Sobriété visuelle, mode calme | edutice-00000145 (Le Bohec, Jamet, 2003, charge cognitive et théorie générative) ; tel-03597992 (Porte, 2021, principe de cohérence, guidage et feedback). Contrepoint : tel-04216656 (Brazey, 2023, design émotionnel) et tel-05290947 (Perche, 2024, détails séduisants et intérêt situationnel) | Tension réelle : cohérence (éviter le superflu) contre intérêt situationnel. Notre choix (décor sobre par défaut, animations ancrées sur le retour, mode calme) est une hypothèse de conception, à tester. |
| Pratique de récupération | dumas-03052674 (Keller, 2020, TDAH, étude observationnelle, mémoire) ; dumas-03830991 (Jestin, 2022, reconnaissance contre rappel libre) | Faible à modérée. Associer et trier relèvent de la reconnaissance, pas du rappel libre : ne pas promettre un fort effet-test. |

Conséquence : au lot 1, l'interface n'affiche aucune référence scientifique sauf éventuelle page « à propos » limitée aux références relues en texte intégral. Le reste sert de justification interne.

## 13. Réponses aux questions challengeantes PLAI

- Élève en difficulté : bénéfice direct par les profils, le retour sans pénalité et le mode calme ; le bénéfice enseignant (tableau de bord) est secondaire.
- Singularité de l'enseignant : contexte de classe obligatoire, validation par carte, édition libre. Efficacité non garantie, à mesurer par le taux de modification.
- Formulations répétitives de l'IA : risque réel ; atténué par le texte source de l'enseignant et le champ « termes à éviter ou imposer ».
- Ce que l'outil ne fait pas bien : voir section 7.
- Confiance de l'enseignant dans son jugement : les suggestions du tableau de bord affichent leurs chiffres et leurs seuils réglables ; elles ne prescrivent pas.

## 14. Décisions et points restants

Décidé le 2026-10-01 :
- Anonymisation des .docx : simple avertissement avant envoi à l'IA (pas de passage par l'Anonymiseur FWB au lot 1).
- Supabase : même projet que HubActif (`dfoaumjleqtxjeaplnna`), tables `game_*` à côté de `hub_*`.
- Dépôt GitHub : https://github.com/jfb4plai/GameActif (créé par JF, branche `main`).
- Voix fr-BE : à tester sur tablettes, repli sur voix française générique.
- Seuils du tableau de bord : valeurs initiales fixées en section 8, réglables.

Dépendance à signaler : unicité des codes élèves dans HubActif. Les codes y sont uniques globalement aujourd'hui et la décision d'unicité reste à prendre côté hub (alternative envisagée : `sid` dans le jeton + `unique(class_id, code)`). GameActif identifie l'élève par son code via le jeton du hub : si le hub change de règle, `game_sessions` et `game_attempts` doivent suivre (clé d'élève = identifiant stable fourni par le hub, jamais le code seul). À traiter avant la mise en production, pas bloquant pour le développement.

Restants :
1. Sous-domaine `gameactif.jfb4plai.com` à configurer sur Vercel.
2. Test des voix de synthèse sur les tablettes réelles.
3. Vignette portail-plai (`apps.ts`, `devBanner: true`) à ajouter après déploiement.
