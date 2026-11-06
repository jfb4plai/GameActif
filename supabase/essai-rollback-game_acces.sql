-- GameActif : ESSAI de la migration game_acces dans une transaction ANNULÉE (rien n'est conservé).
-- Fichier généré par scripts/build-essai-sql.mjs : ne pas le modifier à la main.
-- À coller dans l'éditeur SQL du projet Supabase partagé UNIQUEMENT après l'accord de JF.
-- Succès : des messages « OK (x) » pour chaque cas. Échec : une erreur « ECHEC (x) » et rien n'est conservé.
begin;
-- GameActif : accès enseignant par lien d'invitation. APPLIQUÉE le 2026-11-06 sur la base partagée, avec l'accord
-- explicite de JF, après essai dans une transaction annulée (supabase/essai-rollback-game_suivi.sql).
--
-- Vérification des noms au 2026-11-03 : aucune table game_* n'existe dans les migrations du workspace.
-- Tout objet créé ici est préfixé game_. `profiles` et le trigger updated_at du projet partagé ne sont pas recréés ;
-- une fonction propre (game_touch_updated_at) évite de dépendre du nom de celle du projet.
-- Les élèves n'ont aucune table ici : séances, résultats et accès par code viennent avec le suivi (plan C) et
-- référenceront game_activities.id. Aucun nom d'élève n'est stocké.
--
-- Modèle : un lien d'invitation contient un code long et aléatoire ; seule son empreinte sha256 est conservée.
-- Un compte n'a accès à GameActif qu'après avoir utilisé un code valide (ligne dans game_teachers).
-- Droits : explicites et minimaux. Les anciens droits par défaut du schéma public (tout aux rôles API) sont retirés.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create table public.game_invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  max_uses int not null check (max_uses between 1 and 1000),
  uses int not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.game_teachers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  invitation_id uuid references public.game_invitations (id),
  created_at timestamptz not null default now()
);

create table public.game_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titre text not null check (char_length(btrim(titre)) between 1 and 200),
  niveau text not null check (char_length(niveau) between 1 and 40),
  matiere text not null check (char_length(matiere) between 1 and 40),
  brouillon jsonb not null check (octet_length(brouillon::text) <= 200000),
  format_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_activities_user_idx on public.game_activities (user_id, updated_at desc);

create function public.game_touch_updated_at() returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger game_activities_touch before update on public.game_activities
  for each row execute function public.game_touch_updated_at();

-- ---------------------------------------------------------------------------------------------------------------
-- Droits : retirer tout, puis accorder le strict nécessaire (aucun droit pour anon)
-- ---------------------------------------------------------------------------------------------------------------

alter table public.game_invitations enable row level security;
alter table public.game_teachers enable row level security;
alter table public.game_activities enable row level security;

revoke all on table public.game_invitations from anon, authenticated;
revoke all on table public.game_teachers from anon, authenticated;
revoke all on table public.game_activities from anon, authenticated;

grant all on table public.game_invitations to service_role;
grant all on table public.game_teachers to service_role;
grant all on table public.game_activities to service_role;

grant select on table public.game_teachers to authenticated;
grant select, insert, update, delete on table public.game_activities to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Fonctions (security definer : le contrôle d'accès croisé ne passe jamais par une sous-requête dans une règle RLS).
-- search_path figé avec pg_catalog en premier et pg_temp en dernier : un objet créé ailleurs ne peut pas masquer
-- digest(), gen_random_bytes() ni une table (précaution classique des fonctions security definer).
-- ---------------------------------------------------------------------------------------------------------------

create function public.game_is_teacher() returns boolean
language sql
stable
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
  select exists (select 1 from public.game_teachers where user_id = auth.uid());
$$;

revoke all on function public.game_is_teacher() from public, anon, authenticated;
grant execute on function public.game_is_teacher() to authenticated, service_role;

-- Utiliser un code d'invitation. Renvoie 'ok', 'deja' (le compte a déjà accès) ou 'invalide' (code inconnu,
-- expiré, épuisé, révoqué ou mal formé : les cas ne sont pas distingués). Une place n'est consommée qu'une fois.
create function public.game_redeem_invitation(code text) returns text
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.game_invitations%rowtype;
begin
  if v_uid is null then
    return 'invalide';
  end if;
  if exists (select 1 from public.game_teachers where user_id = v_uid) then
    return 'deja';
  end if;
  if code is null or code !~ '^[A-Za-z0-9_-]{32}$' then
    return 'invalide';
  end if;

  -- Verrou sur la ligne : un code limité à N places n'en donne jamais plus, même en cas d'appels simultanés.
  select * into v_inv from public.game_invitations
    where code_hash = encode(digest(code, 'sha256'), 'hex')
    for update;
  if not found or v_inv.revoked_at is not null or v_inv.expires_at <= now() or v_inv.uses >= v_inv.max_uses then
    return 'invalide';
  end if;

  begin
    update public.game_invitations set uses = uses + 1 where id = v_inv.id;
    insert into public.game_teachers (user_id, invitation_id) values (v_uid, v_inv.id);
  exception when unique_violation then
    -- Deux appels simultanés du même compte : le second ne consomme rien.
    return 'deja';
  end;
  return 'ok';
end;
$$;

revoke all on function public.game_redeem_invitation(text) from public, anon, authenticated;
grant execute on function public.game_redeem_invitation(text) to authenticated, service_role;

-- Créer une invitation : réservé à l'administrateur (éditeur SQL, rôle postgres) et à service_role.
-- Renvoie le code en clair UNE SEULE FOIS ; seule son empreinte est conservée.
create function public.game_create_invitation(p_max_uses int, p_jours int) returns text
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_code text;
begin
  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 1000 then
    raise exception 'Nombre de places invalide (1 à 1000).';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 365 then
    raise exception 'Durée invalide (1 à 365 jours).';
  end if;
  v_code := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.game_invitations (code_hash, max_uses, expires_at)
    values (encode(digest(v_code, 'sha256'), 'hex'), p_max_uses, now() + make_interval(days => p_jours));
  return v_code;
end;
$$;

revoke all on function public.game_create_invitation(int, int) from public, anon, authenticated;
grant execute on function public.game_create_invitation(int, int) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Règles par ligne
-- ---------------------------------------------------------------------------------------------------------------

-- game_invitations : aucune règle, donc aucun accès pour les rôles API (seules les fonctions ci-dessus y touchent).

create policy game_teachers_select on public.game_teachers
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy game_activities_select on public.game_activities
  for select to authenticated
  using (user_id = (select auth.uid()) and public.game_is_teacher());

create policy game_activities_insert on public.game_activities
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.game_is_teacher());

create policy game_activities_update on public.game_activities
  for update to authenticated
  using (user_id = (select auth.uid()) and public.game_is_teacher())
  with check (user_id = (select auth.uid()) and public.game_is_teacher());

create policy game_activities_delete on public.game_activities
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.game_is_teacher());

-- GameActif : essais de la migration 20261103_game_acces. À exécuter APRÈS la migration, dans une transaction annulée.
-- Chaque bloc lève une exception « ECHEC (x) » si un contrôle échoue ; un NOTICE « OK (x) » sinon.
-- Identités simulées : u1, u2, u3 (enseignants ou non selon l'essai), u4 (jamais d'accès).
--   u1 = 00000000-0000-4000-8000-000000000001   u2 = ...0002   u3 = ...0003   u4 = ...0004

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000004');

-- Codes d'essai : A (2 places), B (expiré), C (révoqué), D (épuisé).
select set_config('essai.code_a', public.game_create_invitation(2, 30), true);
select set_config('essai.code_b', public.game_create_invitation(5, 30), true);
select set_config('essai.code_c', public.game_create_invitation(5, 30), true);
select set_config('essai.code_d', public.game_create_invitation(1, 30), true);
update public.game_invitations set expires_at = now() - interval '1 day'
  where code_hash = encode(digest(current_setting('essai.code_b'), 'sha256'), 'hex');
update public.game_invitations set revoked_at = now()
  where code_hash = encode(digest(current_setting('essai.code_c'), 'sha256'), 'hex');
update public.game_invitations set uses = 1
  where code_hash = encode(digest(current_setting('essai.code_d'), 'sha256'), 'hex');

-- (i) Le code en clair n'est dans aucune colonne ; l'empreinte fait 64 caractères hexadécimaux.
do $$
declare n int;
begin
  select count(*) into n from public.game_invitations
    where code_hash in (current_setting('essai.code_a'), current_setting('essai.code_b'), current_setting('essai.code_c'), current_setting('essai.code_d'));
  if n <> 0 then raise exception 'ECHEC (i) : un code en clair est stocké'; end if;
  select count(*) into n from public.game_invitations where code_hash !~ '^[0-9a-f]{64}$';
  if n <> 0 then raise exception 'ECHEC (i) : une empreinte n''a pas la forme attendue'; end if;
  if current_setting('essai.code_a') !~ '^[A-Za-z0-9_-]{32}$' then raise exception 'ECHEC (i) : forme du code'; end if;
  raise notice 'OK (i) : seules les empreintes sont stockées';
end $$;

-- (a) u1 utilise le code A : ok, une place consommée, ligne game_teachers créée.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text;
begin
  r := public.game_redeem_invitation(current_setting('essai.code_a'));
  if r <> 'ok' then raise exception 'ECHEC (a) : attendu ok, obtenu %', r; end if;
  if not public.game_is_teacher() then raise exception 'ECHEC (a) : u1 devrait être enseignant'; end if;
  raise notice 'OK (a) : code valide accepté';
end $$;

-- (b) u1 réutilise le même code : « deja », aucune place de plus.
do $$
declare r text;
begin
  r := public.game_redeem_invitation(current_setting('essai.code_a'));
  if r <> 'deja' then raise exception 'ECHEC (b) : attendu deja, obtenu %', r; end if;
  raise notice 'OK (b) : le même compte ne consomme qu''une place';
end $$;
reset role;
do $$
declare n int;
begin
  select uses into n from public.game_invitations where code_hash = encode(digest(current_setting('essai.code_a'), 'sha256'), 'hex');
  if n <> 1 then raise exception 'ECHEC (b) : uses = % au lieu de 1', n; end if;
end $$;

-- (c) Codes invalides pour u4 : inconnu, expiré, révoqué, épuisé, trop court, nul. Rien ne change.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text; c text;
begin
  foreach c in array array[repeat('Z', 32), current_setting('essai.code_b'), current_setting('essai.code_c'), current_setting('essai.code_d'), 'court', ''] loop
    r := public.game_redeem_invitation(c);
    if r <> 'invalide' then raise exception 'ECHEC (c) : le code % devrait être invalide, obtenu %', left(c, 4), r; end if;
  end loop;
  r := public.game_redeem_invitation(null);
  if r <> 'invalide' then raise exception 'ECHEC (c) : un code nul devrait être invalide'; end if;
  if public.game_is_teacher() then raise exception 'ECHEC (c) : u4 ne devrait pas être enseignant'; end if;
  raise notice 'OK (c) : codes invalides refusés';
end $$;
reset role;
do $$
declare n int; total int;
begin
  select count(*) into n from public.game_teachers where user_id = '00000000-0000-4000-8000-000000000004';
  if n <> 0 then raise exception 'ECHEC (c) : une ligne game_teachers a été créée pour u4'; end if;
  select coalesce(sum(uses), 0) into total from public.game_invitations;
  if total <> 2 then raise exception 'ECHEC (c) : total des places consommées = % au lieu de 2 (A:1, D:1)', total; end if;
end $$;

-- (c2) Le code A a 2 places : u2 prend la deuxième, u3 est refusé (épuisé), jamais plus de places que prévu.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text;
begin
  r := public.game_redeem_invitation(current_setting('essai.code_a'));
  if r <> 'ok' then raise exception 'ECHEC (c2) : u2 devrait obtenir la deuxième place, obtenu %', r; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text;
begin
  r := public.game_redeem_invitation(current_setting('essai.code_a'));
  if r <> 'invalide' then raise exception 'ECHEC (c2) : u3 devrait être refusé (code épuisé), obtenu %', r; end if;
  if public.game_is_teacher() then raise exception 'ECHEC (c2) : u3 ne devrait pas être enseignant'; end if;
  raise notice 'OK (c2) : un code à 2 places n''en donne jamais 3';
end $$;
reset role;

-- (d) u3 (sans accès) : ne peut ni insérer, ni lire dans game_activities.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare refuse boolean := false;
begin
  begin
    insert into public.game_activities (user_id, titre, niveau, matiere, brouillon)
      values ('00000000-0000-4000-8000-000000000003', 'Essai', 'P4', 'mathematiques', '{}'::jsonb);
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (d) : un compte sans accès a pu insérer une activité'; end if;
  raise notice 'OK (d) : compte sans accès refusé à l''insertion';
end $$;
reset role;

-- (e) u1 insère ; u2 (enseignant aussi) ne voit, ne modifie, ne supprime rien ; u1 ne peut pas écrire au nom de u2.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int; refuse boolean := false;
begin
  insert into public.game_activities (id, user_id, titre, niveau, matiere, brouillon)
    values ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'Activité de u1', 'P4', 'mathematiques', '{"titre":"x"}'::jsonb);
  select count(*) into n from public.game_activities;
  if n <> 1 then raise exception 'ECHEC (e) : u1 devrait voir 1 activité, en voit %', n; end if;
  begin
    insert into public.game_activities (user_id, titre, niveau, matiere, brouillon)
      values ('00000000-0000-4000-8000-000000000002', 'Au nom de u2', 'P4', 'mathematiques', '{}'::jsonb);
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (e) : u1 a pu écrire au nom de u2'; end if;
  raise notice 'OK (e) : u1 écrit pour lui seul';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.game_activities;
  if n <> 0 then raise exception 'ECHEC (e) : u2 voit % activité(s) de u1', n; end if;
  update public.game_activities set titre = 'Piratée' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ECHEC (e) : u2 a modifié une activité de u1'; end if;
  delete from public.game_activities where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ECHEC (e) : u2 a supprimé une activité de u1'; end if;
  raise notice 'OK (e) : isolation entre enseignants';
end $$;
reset role;
do $$
declare t text;
begin
  select titre into t from public.game_activities where id = '11111111-1111-4111-8111-111111111111';
  if t <> 'Activité de u1' then raise exception 'ECHEC (e) : l''activité de u1 a été changée (%)', t; end if;
end $$;

-- (e2) u1 peut modifier et supprimer la sienne ; updated_at est tenu par le serveur ; la taille du brouillon est bornée.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int; u timestamptz; refuse boolean := false;
begin
  update public.game_activities set titre = 'Renommée', updated_at = '2000-01-01' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ECHEC (e2) : u1 devrait pouvoir modifier la sienne'; end if;
  select updated_at into u from public.game_activities where id = '11111111-1111-4111-8111-111111111111';
  if u < now() - interval '1 minute' then raise exception 'ECHEC (e2) : updated_at n''est pas tenu par le serveur (%)', u; end if;
  begin
    insert into public.game_activities (user_id, titre, niveau, matiere, brouillon)
      values ('00000000-0000-4000-8000-000000000001', 'Énorme', 'P4', 'mathematiques', to_jsonb(repeat('x', 200001)));
  exception when check_violation then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (e2) : un brouillon de plus de 200000 caractères a été accepté'; end if;
  refuse := false;
  begin
    insert into public.game_activities (user_id, titre, niveau, matiere, brouillon)
      values ('00000000-0000-4000-8000-000000000001', '', 'P4', 'mathematiques', '{}'::jsonb);
  exception when check_violation then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (e2) : un titre vide a été accepté'; end if;
  delete from public.game_activities where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ECHEC (e2) : u1 devrait pouvoir supprimer la sienne'; end if;
  raise notice 'OK (e2) : modifier, supprimer, updated_at, bornes';
end $$;
reset role;

-- (f) anon : aucun droit sur les trois tables ni sur les fonctions.
set local role anon;
do $$
declare t text; refuse boolean;
begin
  foreach t in array array['game_invitations', 'game_teachers', 'game_activities'] loop
    refuse := false;
    begin
      execute format('select count(*) from public.%I', t);
    exception when insufficient_privilege then refuse := true;
    end;
    if not refuse then raise exception 'ECHEC (f) : anon peut lire %', t; end if;
  end loop;
  refuse := false;
  begin
    perform public.game_redeem_invitation(repeat('Z', 32));
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (f) : anon peut appeler game_redeem_invitation'; end if;
  refuse := false;
  begin
    perform public.game_is_teacher();
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (f) : anon peut appeler game_is_teacher'; end if;
  raise notice 'OK (f) : anon n''a aucun droit';
end $$;
reset role;

-- (g) authenticated : ne lit pas game_invitations, n'écrit pas dans game_teachers, ne lit que sa propre ligne.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int; refuse boolean := false;
begin
  begin
    perform count(*) from public.game_invitations;
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (g) : authenticated peut lire game_invitations'; end if;
  refuse := false;
  begin
    insert into public.game_teachers (user_id) values ('00000000-0000-4000-8000-000000000004');
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (g) : authenticated peut s''ajouter ou ajouter quelqu''un dans game_teachers'; end if;
  refuse := false;
  begin
    delete from public.game_teachers;
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (g) : authenticated peut supprimer dans game_teachers'; end if;
  select count(*) into n from public.game_teachers;
  if n <> 1 then raise exception 'ECHEC (g) : u1 devrait voir sa seule ligne, en voit %', n; end if;
  raise notice 'OK (g) : game_teachers en lecture de sa propre ligne seulement';
end $$;

-- (h) authenticated ne peut pas créer d'invitation.
do $$
declare refuse boolean := false;
begin
  begin
    perform public.game_create_invitation(5, 30);
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (h) : authenticated peut créer une invitation'; end if;
  raise notice 'OK (h) : création d''invitation réservée à l''administrateur';
end $$;
reset role;

-- (j) game_is_teacher : vrai pour u1, faux pour u4.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if public.game_is_teacher() then raise exception 'ECHEC (j) : u4 ne devrait pas être enseignant'; end if;
  raise notice 'OK (j) : game_is_teacher';
end $$;
reset role;

rollback;
