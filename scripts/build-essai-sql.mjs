// Assemble le fichier d'essai pour la base partagée : migration + essais, le tout dans une transaction annulée.
// Usage : node scripts/build-essai-sql.mjs
// Un test vérifie que le fichier produit est à jour ; la source de vérité reste la migration et les essais.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const migration = readFileSync(join(racine, 'supabase', 'migrations', '20261103_game_acces.sql'), 'utf-8');
const essais = readFileSync(join(racine, 'supabase', 'essais', 'game_acces.assertions.sql'), 'utf-8');

const entete = `-- GameActif : ESSAI de la migration game_acces dans une transaction ANNULÉE (rien n'est conservé).
-- Fichier généré par scripts/build-essai-sql.mjs : ne pas le modifier à la main.
-- À coller dans l'éditeur SQL du projet Supabase partagé UNIQUEMENT après l'accord de JF.
-- Succès : des messages « OK (x) » pour chaque cas. Échec : une erreur « ECHEC (x) » et rien n'est conservé.
`;

writeFileSync(join(racine, 'supabase', 'essai-rollback-game_acces.sql'), `${entete}begin;\n${migration}\n${essais}\nrollback;\n`, 'utf-8');
console.log('OK : supabase/essai-rollback-game_acces.sql régénéré.');
