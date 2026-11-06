// Assemble les fichiers d'essai pour la base partagée : migrations + essais, le tout dans une transaction annulée.
// Usage : node scripts/build-essai-sql.mjs
// Un test vérifie que chaque fichier produit est à jour ; la source de vérité reste les migrations et les essais.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const brut = (chemin) => readFileSync(join(racine, ...chemin.split('/')), 'utf-8');
/** Fins de ligne normalisées : un checkout Windows (core.autocrlf) peut les convertir en CRLF. */
const lire = (chemin) => brut(chemin).replace(/\r\n/g, '\n');

// 1. game_acces seule (essai déjà fait le 2026-11-04). Lecture brute, comme avant : le test existant compare tel quel.
{
  const migration = brut('supabase/migrations/20261103_game_acces.sql');
  const essais = brut('supabase/essais/game_acces.assertions.sql');
  const entete = `-- GameActif : ESSAI de la migration game_acces dans une transaction ANNULÉE (rien n'est conservé).
-- Fichier généré par scripts/build-essai-sql.mjs : ne pas le modifier à la main.
-- À coller dans l'éditeur SQL du projet Supabase partagé UNIQUEMENT après l'accord de JF.
-- Succès : des messages « OK (x) » pour chaque cas. Échec : une erreur « ECHEC (x) » et rien n'est conservé.
`;
  writeFileSync(join(racine, 'supabase', 'essai-rollback-game_acces.sql'), `${entete}begin;\n${migration}\n${essais}\nrollback;\n`, 'utf-8');
  console.log('OK : supabase/essai-rollback-game_acces.sql régénéré.');
}

// 2. game_suivi : elle dépend de game_acces (game_teachers, game_is_teacher), pas encore appliquée sur la base partagée :
//    l'essai rejoue donc les deux migrations dans la même transaction. `lock_timeout` : si un verrou (la clé étrangère
//    vers auth.users en prend un) doit attendre plus de 3 secondes, l'essai échoue plutôt que de bloquer les connexions.
{
  const acces = lire('supabase/migrations/20261103_game_acces.sql');
  const suivi = lire('supabase/migrations/20261107_game_suivi.sql');
  const essais = lire('supabase/essais/game_suivi.assertions.sql');
  const entete = `-- GameActif : ESSAI des migrations game_acces et game_suivi dans une transaction ANNULÉE (rien n'est conservé).
-- Fichier généré par scripts/build-essai-sql.mjs : ne pas le modifier à la main.
-- À lancer UNIQUEMENT après l'accord explicite de l'administrateur :
--   npx --no-install supabase db query --remote=<projet> --yes -f supabase/essai-rollback-game_suivi.sql
-- Succès : la commande se termine sans erreur et rien n'est conservé (la transaction est annulée). Échec : une erreur
-- « ECHEC (x) » ou SQL, et rien n'est conservé non plus.
`;
  writeFileSync(
    join(racine, 'supabase', 'essai-rollback-game_suivi.sql'),
    `${entete}begin;\nset local lock_timeout = '3s';\n${acces}\n${suivi}\n${essais}\nrollback;\n`,
    'utf-8',
  );
  console.log('OK : supabase/essai-rollback-game_suivi.sql généré.');
}

// 3. game_partage : dépend de game_acces et game_suivi, toutes deux non appliquées : l'essai rejoue les trois.
{
  const acces = lire('supabase/migrations/20261103_game_acces.sql');
  const suivi = lire('supabase/migrations/20261107_game_suivi.sql');
  const partage = lire('supabase/migrations/20261108_game_partage.sql');
  const essais = lire('supabase/essais/game_partage.assertions.sql');
  const entete = `-- GameActif : ESSAI des migrations game_acces, game_suivi et game_partage dans une transaction ANNULÉE (rien n'est conservé).
-- Fichier généré par scripts/build-essai-sql.mjs : ne pas le modifier à la main.
-- À lancer UNIQUEMENT après l'accord explicite de l'administrateur :
--   npx --no-install supabase db query --remote=<projet> --yes -f supabase/essai-rollback-game_partage.sql
-- Succès : la commande se termine sans erreur et rien n'est conservé (la transaction est annulée). Échec : une erreur
-- « ECHEC (x) » ou SQL, et rien n'est conservé non plus.
`;
  writeFileSync(
    join(racine, 'supabase', 'essai-rollback-game_partage.sql'),
    `${entete}begin;\nset local lock_timeout = '3s';\n${acces}\n${suivi}\n${partage}\n${essais}\nrollback;\n`,
    'utf-8',
  );
  console.log('OK : supabase/essai-rollback-game_partage.sql généré.');
}
