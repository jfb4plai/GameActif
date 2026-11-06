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
