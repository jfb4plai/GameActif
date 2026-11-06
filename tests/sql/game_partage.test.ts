import { describe, it, expect } from 'vitest';
import { jouer, lire } from './supabaseSimule';

const ACCES = 'supabase/migrations/20261103_game_acces.sql';
const SUIVI = 'supabase/migrations/20261107_game_suivi.sql';
const PARTAGE = 'supabase/migrations/20261108_game_partage.sql';
const migrations = () => [lire(ACCES), lire(SUIVI), lire(PARTAGE)];
const essais = () => lire('supabase/essais/game_partage.assertions.sql');

const CAS = ['(p1)', '(p2)', '(p3)', '(p4)', '(p5)', '(p6)', '(p7)', '(p8)', '(p9)'];

describe('les essais détectent une migration de partage affaiblie (mutations)', () => {
  const mutations: [string, (sql: string) => string, RegExp][] = [
    [
      'le contexte de classe n’est pas remplacé',
      (sql) => sql.replace("to_jsonb('Activité partagée à la classe'::text)", "p_brouillon -> 'contexte'"),
      /ECHEC \(p2\)/,
    ],
    ['le plafond de 20 activités est retiré', (sql) => sql.replace('>= 20 then', '>= 2000 then'), /ECHEC \(p3\)/],
    ['anon peut lire les activités partagées', (sql) => `${sql}\ngrant select on public.game_shared_activities to anon;`, /ECHEC \(p5\)/],
    ['anon peut lire les profils par code', (sql) => `${sql}\ngrant select on public.game_class_profiles to anon;`, /ECHEC \(p5\)/],
    ['une classe échue est encore servie', (sql) => sql.replace(' and c.purge_on >= current_date', ''), /ECHEC \(p5\)/],
    ['un non-propriétaire retire une activité', (sql) => sql.replace(' and c.user_id = auth.uid() -- verif-proprietaire-retrait', ''), /ECHEC \(p6\)/],
    ['le profil par défaut disparaît', (sql) => sql.replace("coalesce(p.profile, 'standard')", 'p.profile'), /ECHEC \(p7\)/],
    [
      'un enseignant voit les profils des autres classes',
      (sql) => sql.replace('create policy game_class_profiles_select on public.game_class_profiles\n  for select to authenticated\n  using (public.game_owns_class(class_id));', 'create policy game_class_profiles_select on public.game_class_profiles\n  for select to authenticated\n  using (true);'),
      /ECHEC \(p7\)/,
    ],
  ];
  for (const [nom, muter, attendu] of mutations) {
    it(`échec attendu quand : ${nom}`, async () => {
      const [acces, suivi, partage] = migrations();
      const mute = muter(partage);
      expect(mute).not.toBe(partage);
      await expect(jouer([acces, suivi, mute], essais())).rejects.toThrow(attendu);
    }, 60_000);
  }
});

describe('migration game_partage et essais (Postgres en mémoire, sans toucher à la base partagée)', () => {
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

  it('la migration ne crée que des objets préfixés game_, reste non appliquée et n’a aucun prénom ni secret', () => {
    const sql = lire(PARTAGE);
    const creations = [...sql.matchAll(/create (?:or replace )?(?:table|function|trigger|policy|index)\s+(?:if not exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)].map((m) => m[1]);
    expect(creations.length).toBeGreaterThan(5);
    for (const nom of creations) expect(nom.startsWith('game_')).toBe(true);
    expect(sql).toMatch(/APPLIQUÉE le 2026-11-06/);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(sql).not.toMatch(/\b(prenom|firstname|first_name|student_name)\b/i);
  });

  it('chaque table active la sécurité par ligne et retire les droits de anon', () => {
    const sql = lire(PARTAGE);
    const tables = [...sql.matchAll(/create table public\.(game_[a-z_0-9]+)/gi)].map((m) => m[1]);
    expect(tables).toEqual(['game_shared_activities', 'game_class_profiles']);
    for (const t of tables) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, 'i'));
      expect(sql).toMatch(new RegExp(`revoke all on table public\\.${t} from[^;]*anon`, 'i'));
    }
  });

  it('le fichier d’essai de la base partagée est à jour, annule tout et échoue vite plutôt que de bloquer auth.users', () => {
    const fichier = lire('supabase/essai-rollback-game_partage.sql');
    const attendu = `begin;
set local lock_timeout = '3s';
${lire(ACCES)}
${lire(SUIVI)}
${lire(PARTAGE)}
${essais()}
rollback;
`;
    expect(fichier.slice(fichier.indexOf('begin;'))).toBe(attendu);
    expect(fichier).not.toMatch(/^\s*commit\s*;/im);
    expect(fichier.match(/^\s*begin\s*;/gim)).toHaveLength(1);
  });
});
