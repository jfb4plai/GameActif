# GameActif : suivi des élèves par code pseudonyme, dossier pour le DPO

Date : 2026-11-06. Statut : brouillon de JF et Claude, à soumettre avant toute application de la migration `supabase/migrations/20261107_game_suivi.sql`. Rien n'est appliqué sur la base partagée ni déployé avec l'interrupteur ouvert.
Statuts : constaté (code du dépôt, fichier cité), non vérifié (à confirmer par JF ou le DPO).

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

## 4. Pseudonymat

Un code est un pseudonyme, pas un anonymat : l'enseignant peut relier E07 à un enfant grâce à sa liste locale. Les résultats restent donc des données personnelles. La liste de prénoms ne quitte pas l'appareil de l'enseignant ; le tableau de bord remplace le code par le prénom à l'affichage seulement.

## 5. Accès (constaté : politiques `row level security` du même fichier)

- L'élève, sans compte, écrit une séance par la seule fonction `game_record_session` (rôle `anon`). Il ne lit rien (`anon` n'a aucun droit de lecture, essai `(s6)`, `(s15)`).
- L'enseignant propriétaire lit et modifie sa classe, ses observations et ses résultats saisis ; il supprime sa classe (essais `(s20)`, `(s22)`).
- Une personne invitée lit la classe en lecture seule, ne voit que les codes (jamais les prénoms) et seulement les observations que l'enseignant a rendues visibles ; l'accès est révocable et échoit au plus tard à la date de suppression de la classe (essais `(s19)` à `(s21)`).
- Limite d'écriture : 60 séances par classe et par minute (essai `(s13)`).

## 6. Durée de conservation

Les résultats d'une classe sont supprimés à la date de fin d'année : le 30 août suivant la création, ou le 30 août de l'année suivante pour une classe créée entre le 1er et le 30 août (fonction `game_school_year_end`, essai `(s7)`). La suppression est faite par `game_purge_expired`, réservée à `service_role` (essais `(s23)`, `(s24)`). **Non vérifié : la planification automatique de cette fonction.** L'extension `pg_cron` n'a pas été vérifiée sur la base partagée ; sans planification, la suppression n'a pas lieu toute seule. L'enseignant peut supprimer sa classe plus tôt d'un geste.

## 7. Risques connus (constaté, sauf mention)

1. **Écriture sous un code d'autrui.** Quiconque connaît le code de classe peut enregistrer des résultats sous n'importe quel code élève de cette classe. Le tableau de bord n'est donc pas une preuve ; l'interface le dit (bandeau « Indice, pas une preuve »).
2. **Prénom dans une observation libre.** Un enseignant peut taper un prénom malgré l'information du champ. Le navigateur compare le texte à la liste locale de prénoms avant l'envoi et refuse en cas de correspondance ; un prénom absent de cette liste n'est pas détecté.
3. **Pas d'effacement d'un seul élève.** Aucune fonction ne supprime les données d'un seul code : seules la suppression de la classe entière et une intervention d'administration sont possibles. Une demande d'effacement d'un parent pour un seul enfant demande donc une intervention manuelle. À trancher avec le DPO : faut-il une fonction de suppression par code ?
4. **Pas de suppression d'une observation dans l'interface.** La base l'autorise au propriétaire, l'interface ne l'offre pas.
5. **Perte d'un envoi.** Il n'y a pas de file d'attente : un tour dont l'envoi échoue est perdu, avec un message à l'écran.
6. **Une personne invitée lit des données de classe.** Limitée aux codes et aux observations cochées ; l'enseignant est responsable du choix de la personne invitée.
7. **Code de classe deviné par force brute.** Un code de classe compte 8 caractères parmi 31 (environ 8,5 · 10^11 possibilités). `game_class_info` et `game_record_session` n'ont pas de limite par appelant ; la seule limite (60 séances par classe et par minute) ne joue qu'une fois un code juste trouvé. Un tiers qui trouverait un code actif pourrait y écrire des résultats, jamais en lire. Une limitation de débit côté API Supabase est **non vérifiée**.
8. **Sous-traitant.** Supabase héberge la base ; Vercel héberge l'application. La région d'hébergement, le contrat et les journaux techniques (adresses IP) de chacun sont **non vérifiés**.

## 8. Droits des personnes

Accès et effacement : par écrit à `jeanfrancois.beguin@ens.ecl.be`, traitement manuel (voir risque 3). Les parents s'adressent d'abord à l'enseignant de leur enfant, qui détient la correspondance entre le code et l'élève. Base légale, responsable du traitement (l'école, le Pôle ou JF), registre des traitements : **non établis**, à décider avec le DPO.

## 9. Ce qu'on demande au DPO

- Avis avant toute application de la migration.
- Base légale et responsable du traitement.
- Faut-il une suppression par code (risque 3) et une suppression d'observation dans l'interface (risque 4) avant l'ouverture ?
- Durée : le 30 août convient-il, y compris pour les classes créées en cours d'année ?
- Le texte de la page Confidentialité du plan 7 (tâche 1) : relecture avant publication.

## 10. Ce que ce dossier ne prétend pas

Aucune conformité n'est affirmée. Les essais cités tournent dans un Postgres en mémoire (PGlite) et dans les tests du dépôt, pas sur la base partagée.
