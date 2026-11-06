-- GameActif : planification de la suppression des résultats de classe (30 août). EXÉCUTÉ le 2026-11-06 sur la base partagée, avec l'accord de JF (job actif dans cron.job).
-- À lancer par l'administrateur, avec son accord explicite, SEULEMENT après l'application de la migration
-- 20261107_game_suivi.sql (la fonction public.game_purge_expired() doit exister) : sinon le job échouerait chaque nuit.
--
-- Constaté le 2026-11-06 sur la base partagée (projet RetroActif, lecture seule) : pg_cron 1.6.4 installé et préchargé,
-- le rôle postgres peut planifier, trois jobs existent déjà (focusactif-send-reminders, ar_purge_archive,
-- sauvegarde_snapshot), aucun job « game_purge ». Précédent du même type : ar_purge_archive (AménagActif, 30 3 * * *).
-- pg_cron s'exécute en UTC : 03:15 UTC correspond à 04:15 ou 05:15 en Belgique, hors temps de classe.
--
-- Rejouable : l'ancien job est retiré d'abord, il n'y a jamais deux jobs « game_purge ».
-- Vérification après exécution : select jobname, schedule, active from cron.job where jobname = 'game_purge';
-- Retrait : select cron.unschedule('game_purge');

select cron.unschedule('game_purge')
where exists (select 1 from cron.job where jobname = 'game_purge');

select cron.schedule('game_purge', '15 3 * * *', $$select public.game_purge_expired()$$);
