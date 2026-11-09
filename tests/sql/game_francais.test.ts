import { describe, it, expect } from 'vitest';
import { jouer, lire } from './supabaseSimule';

const ACCES = 'supabase/migrations/20261103_game_acces.sql';
const SUIVI = 'supabase/migrations/20261107_game_suivi.sql';
const PARTAGE = 'supabase/migrations/20261108_game_partage.sql';
const FRANCAIS = 'supabase/migrations/20261109_game_codes_francais.sql';
const migrations = () => [lire(ACCES), lire(SUIVI), lire(PARTAGE), lire(FRANCAIS)];
const essais = () => lire('supabase/essais/game_francais.assertions.sql');

const CAS = ['(f1)', '(f2)', '(f3)', '(f4)', '(f5)', '(f6)'];
const NOUVELLE = "'^[MF]\\.P[1-6](\\.[A-Za-z0-9]+)+$'";
const ANCIENNE = "'^M\\.P[1-6](\\.[A-Za-z0-9]+)+$'";

describe('les essais détectent une migration de codes français affaiblie (mutations)', () => {
  const mutations: [string, (sql: string) => string, RegExp][] = [
    ['la fonction refuse encore les codes F.', (sql) => sql.replace(`(c #>> '{}') !~ ${NOUVELLE}`, () => `(c #>> '{}') !~ ${ANCIENNE}`), /ECHEC \(f1\)/],
    ['la contrainte des résultats saisis refuse encore les codes F.', (sql) => sql.replace(`check (cible ~ ${NOUVELLE})`, () => `check (cible ~ ${ANCIENNE})`), /violates check constraint/],
    ['la fonction accepte n’importe quel code', (sql) => sql.replace(`(c #>> '{}') !~ ${NOUVELLE}`, 'false'), /ECHEC \(f3\)/],
    ['anon peut lire les séances', (sql) => `${sql}\ngrant select on public.game_sessions to anon;`, /ECHEC \(f6\)/],
  ];
  for (const [nom, muter, attendu] of mutations) {
    it(`échec attendu quand : ${nom}`, async () => {
      const [acces, suivi, partage, francais] = migrations();
      const mute = muter(francais);
      expect(mute).not.toBe(francais);
      await expect(jouer([acces, suivi, partage, mute], essais())).rejects.toThrow(attendu);
    }, 60_000);
  }
});

describe('migration game_codes_francais et essais (Postgres en mémoire, sans toucher à la base partagée)', () => {
  it('la migration et tous les essais passent', async () => {
    await expect(jouer(migrations(), essais())).resolves.toBeUndefined();
  }, 60_000);

  it('une erreur dans les essais est bien remontée (contrôle que les essais ne passent pas à vide)', async () => {
    const piege = `${essais()}\ndo $$ begin raise exception 'ECHEC canari'; end $$;`;
    await expect(jouer(migrations(), piege)).rejects.toThrow(/ECHEC canari/);
  }, 60_000);

  it('les essais comptent tous leurs cas', () => {
    for (const cas of CAS) expect(essais()).toContain(`OK ${cas}`);
  });

  it('la migration ne crée que des objets préfixés game_, est marquée appliquée et n’a aucun prénom ni secret', () => {
    const sql = lire(FRANCAIS);
    const creations = [...sql.matchAll(/create (?:or replace )?(?:table|function|trigger|policy|index)\s+(?:if not exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)].map((m) => m[1]);
    expect(creations.length).toBeGreaterThan(0);
    for (const nom of creations) expect(nom.startsWith('game_')).toBe(true);
    expect(sql).toMatch(/APPLIQUÉE le 2026-11-09/);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(sql).not.toMatch(/\b(prenom|firstname|first_name|nom_eleve|student_name)\b/i);
  });

  it('le fichier d’essai de la base partagée est à jour, annule tout et échoue vite plutôt que de bloquer', () => {
    const fichier = lire('supabase/essai-rollback-game_francais.sql');
    const attendu = `begin;\nset local lock_timeout = '3s';\n${lire(FRANCAIS)}\n${essais()}\nrollback;\n`;
    expect(fichier.endsWith('rollback;\n')).toBe(true);
    expect(fichier.slice(fichier.indexOf('begin;'))).toBe(attendu);
    expect(fichier).not.toMatch(/^\s*commit\s*;/im);
    expect(fichier.match(/^\s*begin\s*;/gim)).toHaveLength(1);
  });
});
