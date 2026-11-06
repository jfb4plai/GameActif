import { describe, it, expect } from 'vitest';
import { jouer, lire } from './supabaseSimule';

const ACCES = 'supabase/migrations/20261103_game_acces.sql';
const SUIVI = 'supabase/migrations/20261107_game_suivi.sql';
const migrations = () => [lire(ACCES), lire(SUIVI)];
const essais = () => lire('supabase/essais/game_suivi.assertions.sql');

const CAS = ['(s1)', '(s2)', '(s3)', '(s4)', '(s5)', '(s6)', '(s7)', '(s8)', '(s9)', '(s10)', '(s11)', '(s12)', '(s13)', '(s14)', '(s15)', '(s16)', '(s17)', '(s18)', '(s19)', '(s20)', '(s21)', '(s22)', '(s23)', '(s24)', '(s25)'];

describe('les essais détectent une migration affaiblie (mutations)', () => {
  const mutations: [string, (sql: string) => string, RegExp][] = [
    [
      'tout enseignant voit les classes des autres',
      (sql) => sql.replace('using (public.game_can_read_class(id));', 'using (true);'),
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
    [
      'anon peut lire les séances',
      (sql) => `${sql}\ngrant select on public.game_sessions to anon;`,
      /ECHEC \(s15\)/,
    ],
    [
      'un code élève hors liste est accepté',
      (sql) => sql.replace('if v_num < 1 or v_num > v_class.nb_codes then', 'if false then'),
      /ECHEC \(s11\)/,
    ],
    [
      'plus de limite de débit',
      (sql) => sql.replace('>= 60 then', '>= 60000 then'),
      /ECHEC \(s13\)/,
    ],
    [
      'une classe expirée accepte encore des séances',
      (sql) => sql.replaceAll(' and purge_on >= current_date', ''),
      /ECHEC \(s14\)/,
    ],
    [
      'un code d’invitation sert plusieurs fois',
      (sql) => sql.replace(' or v_inv.used_at is not null', ''),
      /ECHEC \(s18\)/,
    ],
    [
      'l’invité lit aussi les observations privées',
      (sql) => sql.replace('(visible_invites and public.game_can_read_class(class_id))', 'public.game_can_read_class(class_id)'),
      /ECHEC \(s19\)/,
    ],
    [
      'l’invité peut écrire des observations',
      (sql) =>
        sql.replace(
          'create policy game_observations_insert on public.game_observations\n  for insert to authenticated\n  with check (public.game_owns_class(class_id));',
          'create policy game_observations_insert on public.game_observations\n  for insert to authenticated\n  with check (public.game_can_read_class(class_id));',
        ),
      /ECHEC \(s20\)/,
    ],
    [
      'un invité révoqué lit encore',
      (sql) => sql.replace('guest_user_id = auth.uid() and revoked_at is null and expires_at > now()', 'guest_user_id = auth.uid() and expires_at > now()'),
      /ECHEC \(s21\)/,
    ],
    [
      'un invité échu lit encore',
      (sql) => sql.replace('guest_user_id = auth.uid() and revoked_at is null and expires_at > now()', 'guest_user_id = auth.uid() and revoked_at is null'),
      /ECHEC \(s21\)/,
    ],
    [
      'un non-propriétaire révoque un invité',
      (sql) => sql.replace(' or not exists (select 1 from public.game_classes where id = v_class and user_id = auth.uid())', ''),
      /ECHEC \(s21\)/,
    ],
    [
      'la purge supprime aussi les classes du lendemain',
      (sql) => sql.replace('delete from public.game_classes where purge_on <= p_today;', 'delete from public.game_classes where purge_on <= p_today + 1;'),
      /ECHEC \(s23\)/,
    ],
    [
      'authenticated peut lancer la purge',
      (sql) => `${sql}\ngrant execute on function public.game_purge_expired(date) to authenticated;`,
      /ECHEC \(s24\)/,
    ],
    [
      'une séance rejouée double la ligne',
      (sql) => sql.replace('on conflict (id) do nothing', 'on conflict (id) do update set created_at = now()').replace('id uuid primary key,\n  class_id uuid not null references public.game_classes (id) on delete cascade,\n  student_code', 'id uuid not null,\n  class_id uuid not null references public.game_classes (id) on delete cascade,\n  student_code'),
      /ECHEC \(s9\/s10\)|ON CONFLICT/i,
    ],
    [
      'above accepte n’importe quel type',
      (sql) => sql.replace("jsonb_typeof(p_payload -> 'above') is distinct from 'boolean'", 'false'),
      // Sans la validation, le refus « invalide » devient une exception de conversion : la détection reste valable.
      /ECHEC \(s25\)|invalid input syntax for type boolean/,
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

  it('le fichier d’essai de la base partagée est à jour, annule tout et échoue vite plutôt que de bloquer auth.users', () => {
    const fichier = lire('supabase/essai-rollback-game_suivi.sql');
    const attendu = `begin;\nset local lock_timeout = '3s';\n${lire(ACCES)}\n${lire(SUIVI)}\n${essais()}\nrollback;\n`;
    expect(fichier.endsWith('rollback;\n')).toBe(true);
    expect(fichier.slice(fichier.indexOf('begin;'))).toBe(attendu);
    expect(fichier).not.toMatch(/^\s*commit\s*;/im);
    expect(fichier.match(/^\s*begin\s*;/gim)).toHaveLength(1);
  });

  it('aucun prénom, nom ou secret dans la migration', () => {
    const sql = lire(SUIVI);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(sql).not.toMatch(/\b(prenom|firstname|first_name|nom_eleve|student_name)\b/i);
  });
});
