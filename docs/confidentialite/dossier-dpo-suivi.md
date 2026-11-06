# GameActif : suivi des élèves par code pseudonyme, dossier pour le DPO

Date : 2026-11-06. Statut : brouillon de JF et Claude, à soumettre avant toute application de la migration `supabase/migrations/20261107_game_suivi.sql`. Rien n'est appliqué sur la base partagée ni déployé avec l'interrupteur ouvert.
Statuts : constaté (code du dépôt, fichier cité), non vérifié (à confirmer par JF ou le DPO).

## Avis du DPO du Pôle (2026-11-06)

Avis rendu par JF, dans son rôle de DPO au sein du Pôle, après lecture du résumé des points sensibles. Les réponses ci-dessous sont les siennes, reprises sans les interpréter.

| Point | Réponse du DPO | Traduction dans l'outil |
|---|---|---|
| Données de mineurs sous pseudonyme | Sous la responsabilité de l'enseignant, qui peut détenir ces données ; à effacer chaque 30 août. | Suppression au 30 août (`game_purge_expired`) ; la page Confidentialité le dit (`src/ui/PageLegale.tsx`). |
| Responsable du traitement | L'administrateur de l'application (Jean-François Beguin) et l'enseignant qui l'utilise. | Nommés sur la page Confidentialité quand le suivi est ouvert. La qualification juridique (responsabilité conjointe ou non) n'est **pas établie** ici. |
| Évaluation des élèves (états, niveaux) | « C'est aussi le cas pour toute tâche assignée à des élèves » : pas de traitement particulier. | Aucune AIPD n'est réalisée ; c'est une décision du DPO. |
| Niveau par code | « Cela reste dans l'environnement classe. » | Le mode « niveau par code » est accepté. Le risque de déduction par un camarade qui connaît le code de classe reste documenté (§7, risque 10). |
| Observations libres | À rappeler à l'enseignant : ne pas écrire de prénom ni de nom. | Rappel « ni prénom ni nom » sur chaque saisie libre (observations, nom de classe, contexte, activité partagée, fichier exporté), dans l'aide de chaque écran et sur la page Confidentialité. |

**Conclusion du DPO :** « si tout cela est mis en place, c'est OK pour moi ». Avis favorable **sous ces conditions**.

Où en sont les conditions :
- **Rappel « ni prénom ni nom » partout :** fait dans le code (testé : `tests/ui/observation-libre.test.tsx`, `mes-classes.test.tsx`, `publier-activite.test.tsx`, `pages-legales.test.tsx`, `tests/aide/textes.test.ts`).
- **Responsables nommés et effacement au 30 août annoncés :** fait sur la page Confidentialité.
- **Effacement automatique au 30 août :** la fonction existe et est testée en mémoire. **`pg_cron` est disponible sur la base partagée** (constaté le 2026-11-06, lecture seule : version 1.6.4 installée et préchargée, le rôle `postgres` peut planifier, trois jobs existent déjà dont `ar_purge_archive` d'AménagActif, aucun job `game_purge`). Le script `supabase/admin/planifier-purge.sql` planifie la purge chaque jour à 03:15 UTC ; **il n'est pas exécuté** : il ne peut l'être qu'après l'application de la migration `20261107`, avec l'accord de l'administrateur. Tant qu'il n'est pas exécuté, la condition « effacer chaque 30 août » repose sur l'enseignant seul.
- **Migrations `20261107` et `20261108` :** non appliquées ; leur application et l'ouverture du suivi (`VITE_SUIVI_ACTIF`) restent à décider par l'administrateur.

Points non traités par l'avis, donc toujours des limites documentées : pas de suppression d'un seul code ni d'une observation depuis l'écran (risques 3 et 4), pas de contrôle automatique des noms propres dans les activités (risque 9), région d'hébergement et contrats des sous-traitants non vérifiés (risque 8), information des parents et des écoles non prévue.

## 1. Finalité

Après une séance de jeu, l'enseignant voit quelle partie de sa classe a joué, quelles erreurs reviennent, ce qui a déjà été réussi sur le même attendu dans d'autres jeux, et un indice d'acquisition, pour décider lui-même d'une remédiation. Aucune décision n'est prise automatiquement sur un élève. Source : `docs/superpowers/specs/2026-11-06-suivi-par-code-design.md`, §1 et §3.

## 2. Qui est concerné

Des élèves de l'enseignement fondamental (P1 à P6 : `src/data/referentiel.ts`), sous un code `E01` à `E40` choisi dans une liste. Des enseignants (compte Supabase). Des personnes invitées par un enseignant (compte Supabase, lecture seule).

## 3. Données par table (constaté : `supabase/migrations/20261107_game_suivi.sql`)

| Table | Ce qu'elle contient | Ce qu'elle ne contient pas |
|---|---|---|
| `game_classes` | identifiant, compte propriétaire, nom de la classe (1 à 80 caractères, texte libre de l'enseignant), nombre de codes, code de classe, date de suppression | aucun prénom : le champ nom est libre, l'aide de saisie demande de n'y mettre aucun prénom (`src/ui/MesClasses.tsx`) |
| `game_sessions` | code élève `E01` à `E40`, mécanique, profil, attendus visés, étiquettes et résultats par élément (réussite au premier essai, nombre d'essais, indice utilisé, mauvais choix), date de fin du tour | aucune identité, aucun temps de réponse, aucun texte écrit par l'élève |
| `game_observations` | code élève ou rien, texte libre de l'enseignant (1 à 1000 caractères), case « visible par l'invité » | rien d'imposé : c'est du texte libre (voir risques) |
| `game_manual_results` | code élève, attendu, résultat (réussi, en partie, à reprendre) saisi par l'enseignant | aucune identité |
| `game_guest_invitations` | empreinte (sha256) du code d'invitation, échéance, état | le code en clair n'est jamais stocké |
| `game_class_guests` | compte invité, classe, échéance, révocation | |

Dans le navigateur de l'enseignant seulement (jamais envoyé à la base) : la liste code vers prénom (`src/suivi/roster.ts`), les seuils des états (`src/suivi/seuils.ts`), le code de classe associé à un appareil (`src/suivi/classeAppareil.ts`).

### 3 bis. Activité partagée et niveaux par code (plan 9, migration `supabase/migrations/20261108_game_partage.sql`, non appliquée)

| Table | Ce qu'elle contient | Ce qu'elle ne contient pas |
|---|---|---|
| `game_shared_activities` | code d'activité (8 caractères), titre, contenu de l'activité (consignes, éléments, attendus), mode de niveau, niveau de départ, dates | le contexte de classe : la fonction `game_publish_activity` le remplace par un texte fixe côté serveur (essai `(p2)`) ; aucun prénom n'est demandé |
| `game_class_profiles` | code élève et niveau (soutien, standard, défi) fixé par l'enseignant | aucun prénom |

La table `game_sessions` gagne une colonne `above` : le tour a été joué au niveau au-dessus de celui de l'élève (dépassement volontaire). Les tablettes lisent une activité par `game_get_shared_activity` et un niveau par `game_profile_for`, deux fonctions ouvertes à `anon` ; `anon` ne lit aucune table (essai `(p5)`). La tablette garde une copie de l'activité dans le stockage local de son navigateur (`src/partage/lecture.ts`), sans contexte. Les activités partagées et les niveaux sont supprimés avec la classe (essais `(p8)`, `(p9)`) ; au plus 20 activités partagées par classe (essai `(p3)`).

## 4. Pseudonymat

Un code est un pseudonyme, pas un anonymat : l'enseignant peut relier E07 à un enfant grâce à sa liste locale. Les résultats restent donc des données personnelles. La liste de prénoms ne quitte pas l'appareil de l'enseignant ; le tableau de bord remplace le code par le prénom à l'affichage seulement.

## 5. Accès (constaté : politiques `row level security` du même fichier)

- L'élève, sans compte, écrit une séance par la seule fonction `game_record_session` (rôle `anon`). Il ne lit rien (`anon` n'a aucun droit de lecture, essai `(s6)`, `(s15)`).
- L'enseignant propriétaire lit et modifie sa classe, ses observations et ses résultats saisis ; il supprime sa classe (essais `(s20)`, `(s22)`).
- Une personne invitée lit la classe en lecture seule, ne voit que les codes (jamais les prénoms) et seulement les observations que l'enseignant a rendues visibles ; l'accès est révocable et échoit au plus tard à la date de suppression de la classe (essais `(s19)` à `(s21)`).
- Limite d'écriture : 60 séances par classe et par minute (essai `(s13)`).

## 6. Durée de conservation

Les résultats d'une classe sont supprimés à la date de fin d'année : le 30 août suivant la création, ou le 30 août de l'année suivante pour une classe créée entre le 1er et le 30 août (fonction `game_school_year_end`, essai `(s7)`). La suppression est faite par `game_purge_expired`, réservée à `service_role` (essais `(s23)`, `(s24)`). L'extension `pg_cron` est disponible sur la base partagée (constaté le 2026-11-06, lecture seule) et un script de planification est prêt (`supabase/admin/planifier-purge.sql`), **mais il n'est pas exécuté** : sans planification, la suppression n'a pas lieu toute seule. Le bon fonctionnement du job, une fois planifié, n'est pas encore vérifié (première exécution et trace dans `cron.job_run_details` à contrôler). L'enseignant peut supprimer sa classe plus tôt d'un geste.

## 7. Risques connus (constaté, sauf mention)

1. **Écriture sous un code d'autrui.** Quiconque connaît le code de classe peut enregistrer des résultats sous n'importe quel code élève de cette classe. Le tableau de bord n'est donc pas une preuve ; l'interface le dit (bandeau « Indice, pas une preuve »).
2. **Prénom dans une observation libre.** Un enseignant peut taper un prénom malgré l'information du champ. Le navigateur compare le texte à la liste locale de prénoms avant l'envoi et refuse en cas de correspondance ; un prénom absent de cette liste n'est pas détecté.
3. **Pas d'effacement d'un seul élève.** Aucune fonction ne supprime les données d'un seul code : seules la suppression de la classe entière et une intervention d'administration sont possibles. Une demande d'effacement d'un parent pour un seul enfant demande donc une intervention manuelle. À trancher avec le DPO : faut-il une fonction de suppression par code ?
4. **Pas de suppression d'une observation dans l'interface.** La base l'autorise au propriétaire, l'interface ne l'offre pas.
5. **Perte d'un envoi.** Il n'y a pas de file d'attente : un tour dont l'envoi échoue est perdu, avec un message à l'écran.
6. **Une personne invitée lit des données de classe.** Limitée aux codes et aux observations cochées ; l'enseignant est responsable du choix de la personne invitée.
7. **Code de classe deviné par force brute.** Un code de classe compte 8 caractères parmi 31 (environ 8,5 · 10^11 possibilités). `game_class_info` et `game_record_session` n'ont pas de limite par appelant ; la seule limite (60 séances par classe et par minute) ne joue qu'une fois un code juste trouvé. Un tiers qui trouverait un code actif pourrait y écrire des résultats, jamais en lire. Une limitation de débit côté API Supabase est **non vérifiée**.
8. **Sous-traitant.** Supabase héberge la base ; Vercel héberge l'application. La région d'hébergement, le contrat et les journaux techniques (adresses IP) de chacun sont **non vérifiés**.
9. **Contenu partagé lisible par quiconque connaît le code d'activité.** Aucune donnée d'élève, mais le titre et le contenu sont rédigés par l'enseignant. Le garde-fou « prénom » (liste locale) s'applique aux observations, pas aux éléments de l'activité : un nom propre saisi dans un élément serait publié sans contrôle.
10. **Niveau par code : une information sur l'élève.** Le niveau fixé par l'enseignant révèle un besoin d'accompagnement, même sous pseudonyme. Comme `game_profile_for` est ouverte à `anon`, quiconque connaît le code de classe peut essayer d'autres codes et déduire par le comportement du jeu le niveau d'un camarade : le mode est discret, pas secret.
11. **Copie locale sur la tablette.** L'activité reste dans le navigateur de la tablette jusqu'à son vidage ; elle ne contient ni contexte ni donnée d'élève.
12. **Dépassement.** L'indicateur `above` dit qu'un élève a choisi de jouer plus haut : une donnée de comportement, enregistrée sous son code.

## 8. Droits des personnes

Accès et effacement : par écrit à `jeanfrancois.beguin@ens.ecl.be`, traitement manuel (voir risque 3). Les parents s'adressent d'abord à l'enseignant de leur enfant, qui détient la correspondance entre le code et l'élève. Base légale, responsable du traitement (l'école, le Pôle ou JF), registre des traitements : **non établis**, à décider avec le DPO.

## 9. Ce qu'on demande au DPO

- Avis avant toute application de la migration.
- Base légale et responsable du traitement.
- Faut-il une suppression par code (risque 3) et une suppression d'observation dans l'interface (risque 4) avant l'ouverture ?
- Durée : le 30 août convient-il, y compris pour les classes créées en cours d'année ?
- Le mode « niveau par code » (risque 10) peut-il être livré avec les autres, ou seulement après votre avis ?
- Faut-il un contrôle serveur ou client des noms propres dans le contenu d'une activité partagée (risque 9) ?
- Le texte de la page Confidentialité du plan 7 (tâche 1) : relecture avant publication.

## 10. Ce que ce dossier ne prétend pas

Aucune conformité n'est affirmée. Les essais cités tournent dans un Postgres en mémoire (PGlite) et dans les tests du dépôt, pas sur la base partagée.
