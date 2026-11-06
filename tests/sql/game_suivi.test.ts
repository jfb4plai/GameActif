import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const lire = (chemin: string) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf-8');
const ACCES = 'supabase/migrations/20261103_game_acces.sql';
const SUIVI = 'supabase/migrations/20261107_game_suivi.sql';
const migrations = () => [lire(ACCES), lire(SUIVI)];
const essais = () => lire('supabase/essais/game_suivi.assertions.sql');

/** Même simulation de Supabase que tests/sql/game_acces.test.ts : rôles, auth.uid(), anciens droits par défaut. */
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

async function jouer(sqlMigrations: string[], sqlEssais: string): Promise<void> {
  const db = await baseSupabase();
  try {
    await db.exec(`begin;\n${sqlMigrations.join('\n')}\n${sqlEssais}\nrollback;`);
  } finally {
    await db.close();
  }
}

const CAS = ['(s1)', '(s2)', '(s3)', '(s4)', '(s5)', '(s6)', '(s7)'];

describe('les essais détectent une migration affaiblie (mutations)', () => {
  const mutations: [string, (sql: string) => string, RegExp][] = [
    [
      'tout enseignant voit les classes des autres',
      (sql) => sql.replace('using (user_id = (select auth.uid()));', 'using (true);'),
      /ECHEC \(s4\)/,
    ],
    [
      'un compte sans accès enseignant crée des classes',
      (sql) => sql.replace("if not public.game_is_teacher() then", 'if false then'),
      /ECHEC \(s5\)/,
    ],
    [
      'anon peut lire les classes',
      (sql) => `${sql}\ngrant select on public.game_classes to anon;`,
      /ECHEC \(s6\)/,
    ],
  ];
  for (const [nom, muter, attendu] of mutations) {
    it(`échec attendu quand : ${nom}`, async () => {
      const [acces, suivi] = migrations();
      const mute = muter(suivi);
      expect(mute).not.toBe(suivi);
      await expect(jouer([acces, mute], essais())).rejects.toThrow(attendu);
    }, 60_000);
  }
});

describe('migration game_suivi et essais (Postgres en mémoire, sans toucher à la base partagée)', () => {
  it('la migration et tous les essais passent', async () => {
    await expect(jouer(migrations(), essais())).resolves.toBeUndefined();
  }, 60_000);

  it('une erreur dans les essais est bien remontée (contrôle que les essais ne passent pas à vide)', async () => {
    const piege = `${essais()}\ndo $$ begin raise exception 'ECHEC canari'; end $$;`;
    await expect(jouer(migrations(), piege)).rejects.toThrow(/ECHEC canari/);
  }, 60_000);

  it('les essais comptent tous leurs cas', () => {
    const texte = essais();
    for (const cas of CAS) expect(texte).toContain(`OK ${cas}`);
  });

  it('la migration ne crée que des objets préfixés game_, ne recrée pas profiles et reste non appliquée', () => {
    const sql = lire(SUIVI);
    const creations = [...sql.matchAll(/create (?:or replace )?(?:table|function|trigger|policy|index)\s+(?:if not exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)].map((m) => m[1]);
    expect(creations.length).toBeGreaterThan(3);
    for (const nom of creations) expect(nom.startsWith('game_')).toBe(true);
    expect(sql).not.toMatch(/create table[^;]*profiles/i);
    expect(sql).toMatch(/NON APPLIQUÉE/);
  });

  it('chaque table active la sécurité par ligne et retire les droits de anon', () => {
    const sql = lire(SUIVI);
    const tables = [...sql.matchAll(/create table public\.(game_[a-z_0-9]+)/gi)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(0);
    for (const t of tables) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, 'i'));
      expect(sql).toMatch(new RegExp(`revoke all on table public\\.${t} from[^;]*anon`, 'i'));
    }
  });

  it('aucun prénom, nom ou secret dans la migration', () => {
    const sql = lire(SUIVI);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(sql).not.toMatch(/\b(prenom|firstname|first_name|nom_eleve|student_name)\b/i);
  });
});
