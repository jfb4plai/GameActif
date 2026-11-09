# Pages Confidentialité et Mentions : d'où vient chaque phrase

Source des pages : `src/ui/PageLegale.tsx`. Le texte change selon deux réglages : un compte enseignant est possible (base configurée) et le suivi est ouvert (`VITE_SUIVI_ACTIF=1`, `src/suivi/interrupteur.ts`).
Statuts : constaté (code cité), à confirmer par JF, non vérifié.

| Phrase de la page | Source | Statut |
|---|---|---|
| Ce que vous saisissez est gardé dans le stockage local du navigateur | `src/parcours/stockage.ts` (`gameactif.brouillon.v1`) | constaté |
| Le fichier d'activité contient le contexte de classe : n'y mettez aucun nom d'élève | `src/ui/BarreFichier.tsx` (avertissement de l'export) | constaté |
| L'application n'appelle aucun service d'IA ; les fiches « Autres jeux » sont copiées par l'enseignant | `src/ui/AutresJeux.tsx`, `src/prompts/` : aucun appel réseau ; aucune clé d'API dans le dépôt | constaté pour le dépôt ; le déploiement n'a pas été relu |
| L'application est servie par Vercel | `docs` du projet, déploiement du 2026-11-03 (mémoire de session) | constaté ; localisation **à confirmer** par JF |
| Compte : adresse e-mail et activités enregistrées dans la base partagée PLAI (Supabase) | `src/compte/auth.tsx`, `src/compte/activites.ts`, table `game_activities` | constaté ; hébergeur et région de la base **non vérifiés** |
| Suppression d'une activité enregistrée depuis « Mes activités » | `src/ui/MesActivites.tsx` (`supprimer`) | constaté |
| Sans suivi : aucune donnée d'élève n'est enregistrée | aucune table d'élève avant `20261107_game_suivi.sql`, non appliquée | constaté pour le dépôt, **sous réserve** que la migration ne soit pas appliquée quand `VITE_SUIVI_ACTIF` est fermé |
| Élèves sans compte, code E01 à E40 choisi dans une liste, résultat enregistré sous ce code | `src/ui/QuiJoue.tsx`, `supabase/migrations/20261107_game_suivi.sql` (`game_record_session`) | constaté (essais PGlite, pas la base partagée) |
| Aucun temps de réponse n'est mesuré | `src/suivi/types.ts` (`SessionPayload` sans champ de temps) | constaté |
| Codes = pseudonymes ; prénoms ne quittent jamais l'appareil | `src/suivi/roster.ts`, `docs/confidentialite/dossier-dpo-suivi.md` §4 | constaté |
| Observations libres, résultats saisis, personne invitée en lecture seule | `20261107_game_suivi.sql` (`game_observations`, `game_manual_results`, `game_class_guests`) | constaté |
| Activité partagée : enregistrée sans contexte ; niveau par code ; dépassement enregistré | `20261108_game_partage.sql`, `src/partage/magasin.ts`, colonne `game_sessions.above` | constaté (migration non appliquée) |
| Responsables : l'administrateur de l'application et l'enseignant ; l'enseignant est responsable des données qu'il détient, supprimées au plus tard le 30 août | avis du DPO du Pôle du 2026-11-06 (`dossier-dpo-suivi.md`, première section) | décision du DPO ; qualification juridique **non établie** |
| Rappel : ne jamais écrire de prénom ni de nom d'élève | `src/ui/ObservationLibre.tsx`, `MesClasses.tsx`, `EtapeElements.tsx`, `PublierActivite.tsx`, `BarreFichier.tsx`, `src/aide/textes.json` | constaté (tests) |
| Suppression au 30 août, ou à la suppression de la classe | `game_school_year_end`, `game_purge_expired` | constaté ; `pg_cron` est disponible (vérifié le 2026-11-06) et **la purge est planifiée** : job `game_purge` actif, chaque jour à 03:15 UTC (`supabase/admin/planifier-purge.sql`, exécuté le 2026-11-06, contrôlé dans `cron.job`) ; **aucune exécution réelle n'est encore constatée** (`cron.job_run_details`) |
| Quiconque connaît le code de classe peut écrire un résultat sous un code élève | `game_record_session` (écriture ouverte à `anon`) | constaté |
| Contact `jeanfrancois.beguin@ens.ecl.be` | règle PLAI : modes d'emploi et outils | à confirmer par JF |
| Mentions : éditeur, Pôle Territorial de la Ville de Liège, référentiels FWB | `CLAUDE.md` du projet, `scripts/build-referentiel.mjs` | constaté |
| Licence du code : à préciser | aucun fichier `LICENSE` dans le dépôt (`git ls-files`, `origin/main`, 2026-11-06) alors que d'autres dépôts PLAI en ont un | constaté ; **JF décide** s'il pose PolyForm Noncommercial 1.0.0 |
| Pictogramme ARASAAC 23763 sur « Associer », attribution dans Mentions | `public/arasaac/LISEZMOI.txt`, conditions lues sur arasaac.org/terms-of-use le 2026-11-09 (CC BY-NC-SA, formulation d'attribution reprise) | constaté pour le texte d'attribution ; effet juridique sur la licence du code **non qualifié** |

Rien dans les pages n'affirme une conformité ni une sécurité.
