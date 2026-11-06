import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

/** Lit un fichier du dépôt (chemin relatif à `gameactif/`), fins de ligne normalisées : un checkout Windows peut les convertir en CRLF. */
export const lire = (chemin: string) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf-8').replace(/\r\n/g, '\n');

/**
 * Simule ce que Supabase fournit : rôles, schéma auth, auth.uid() lu dans les claims, schéma public ouvert,
 * et les anciens droits par défaut (tout accorder aux rôles API sur les nouvelles tables et fonctions) :
 * une migration doit donc retirer explicitement ce qu'elle ne veut pas accorder.
 */
export async function baseSupabase(): Promise<PGlite> {
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

/** Joue les migrations puis les essais dans une transaction annulée ; une exception SQL est remontée. */
export async function jouer(sqlMigrations: string[], sqlEssais: string): Promise<void> {
  const db = await baseSupabase();
  try {
    await db.exec(`begin;\n${sqlMigrations.join('\n')}\n${sqlEssais}\nrollback;`);
  } finally {
    await db.close();
  }
}
