import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const lire = (chemin: string) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf-8');
const MIGRATION = 'supabase/migrations/20261103_game_acces.sql';
const migration = () => lire(MIGRATION);
const essais = () => lire('supabase/essais/game_acces.assertions.sql');

/**
 * Simule ce que Supabase fournit : rôles, schéma auth, auth.uid() lu dans les claims, schéma public ouvert,
 * et les anciens droits par défaut (tout accorder aux rôles API sur les nouvelles tables et fonctions) :
 * la migration doit donc retirer explicitement ce qu'elle ne veut pas accorder.
 */
async function baseSupabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create extension if not exists pgcrypto;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public to anon, authenticated, service_role;
    grant usage on schema auth to anon, authenticated, service_role;
    grant select on auth.users to authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  return db;
}

async function jouer(sqlMigration: string, sqlEssais: string): Promise<void> {
  const db = await baseSupabase();
  try {
    await db.exec(`begin;\n${sqlMigration}\n${sqlEssais}\nrollback;`);
  } finally {
    await db.close();
  }
}

describe('migration game_acces et essais (Postgres en mémoire, sans toucher à la base partagée)', () => {
  it('la migration et tous les essais passent', async () => {
    await expect(jouer(migration(), essais())).resolves.toBeUndefined();
  }, 60_000);

  it('une erreur dans les essais est bien remontée (contrôle que les essais ne passent pas à vide)', async () => {
    const piege = `${essais()}\ndo $$ begin raise exception 'ECHEC canari'; end $$;`;
    await expect(jouer(migration(), piege)).rejects.toThrow(/ECHEC canari/);
  }, 60_000);

  it('les essais comptent tous leurs cas : chaque lettre de la liste a son bloc', () => {
    const texte = essais();
    for (const cas of ['(a)', '(b)', '(c)', '(c2)', '(d)', '(e)', '(e2)', '(f)', '(g)', '(h)', '(i)', '(j)']) {
      expect(texte).toContain(`OK ${cas}`);
    }
  });

  it('la migration ne crée que des objets préfixés game_ et jamais de table profiles', () => {
    const sql = migration();
    const creations = [...sql.matchAll(/create (?:table|function|trigger|policy|index)\s+(?:if not exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)].map((m) => m[1]);
    expect(creations.length).toBeGreaterThan(5);
    for (const nom of creations) expect(nom.startsWith('game_')).toBe(true);
    expect(sql).not.toMatch(/create table[^;]*profiles/i);
    expect(sql).toMatch(/NON APPLIQUÉE/);
  });

  it('chaque table de la migration active la sécurité par ligne et donne des droits explicites', () => {
    const sql = migration();
    for (const t of ['game_invitations', 'game_teachers', 'game_activities']) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, 'i'));
      expect(sql).toMatch(new RegExp(`revoke all on table public\\.${t} from[^;]*anon`, 'i'));
    }
  });

  it('aucune clé service_role, aucun secret et aucune table d’élèves dans la migration', () => {
    const sql = migration();
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(sql).not.toMatch(/game_(eleves|sessions|attempts|items)/i);
  });
});

describe('les essais détectent une migration affaiblie (mutations)', () => {
  const mutations: [string, (sql: string) => string, RegExp][] = [
    [
      'un compte sans accès peut lire et écrire les activités',
      (sql) => sql.replaceAll('and public.game_is_teacher()', ''),
      /ECHEC \(d\)/,
    ],
    [
      'authenticated peut créer des invitations',
      (sql) => sql.replace(/revoke all on function public\.game_create_invitation\(int, int\) from[^;]*;/i, ''),
      /ECHEC \(h\)/,
    ],
    [
      'authenticated peut lire les invitations',
      (sql) => `${sql}\ngrant select on public.game_invitations to authenticated;`,
      /ECHEC \(g\)/,
    ],
    [
      'anon peut lire les activités',
      (sql) => `${sql}\ngrant select on public.game_activities to anon;`,
      /ECHEC \(f\)/,
    ],
    [
      'un code est stocké en clair',
      (sql) => sql.replace(/encode\(digest\(([^,]+), 'sha256'\), 'hex'\)/g, '$1'),
      // Double défense : la contrainte sur code_hash (64 caractères hexadécimaux) refuse déjà un code en clair.
      /ECHEC \((i|a)\)|violates check constraint/,
    ],
  ];
  for (const [nom, muter, attendu] of mutations) {
    it(`échec attendu quand : ${nom}`, async () => {
      const sql = migration();
      const mute = muter(sql);
      expect(mute).not.toBe(sql);
      await expect(jouer(mute, essais())).rejects.toThrow(attendu);
    }, 60_000);
  }
});

describe('script d’administration et essai prêt pour la base partagée', () => {
  it('le script de création d’invitation existe et ne contient aucun code ni secret', () => {
    expect(existsSync(new URL('../../supabase/admin/creer-invitation.sql', import.meta.url))).toBe(true);
    const sql = lire('supabase/admin/creer-invitation.sql');
    expect(sql).toContain('game_create_invitation');
    expect(sql).toContain('revoked_at');
    expect(sql).not.toMatch(/[A-Za-z0-9_-]{32}(?![A-Za-z0-9_-])(?<=[A-Z][a-z0-9])/);
  });

  it('le fichier d’essai de la base partagée est à jour et annule tout', () => {
    const attendu = `begin;\n${migration()}\n${essais()}\nrollback;\n`;
    const fichier = lire('supabase/essai-rollback-game_acces.sql');
    expect(fichier.endsWith('rollback;\n')).toBe(true);
    expect(fichier.slice(fichier.indexOf('begin;'))).toBe(attendu);
  });
});
