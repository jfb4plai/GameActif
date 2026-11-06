-- GameActif : ESSAI des migrations game_acces et game_suivi dans une transaction ANNULÉE (rien n'est conservé).
-- Fichier généré par scripts/build-essai-sql.mjs : ne pas le modifier à la main.
-- À lancer UNIQUEMENT après l'accord explicite de l'administrateur :
--   npx --no-install supabase db query --remote=<projet> --yes -f supabase/essai-rollback-game_suivi.sql
-- Succès : la commande se termine sans erreur et rien n'est conservé (la transaction est annulée). Échec : une erreur
-- « ECHEC (x) » ou SQL, et rien n'est conservé non plus.
begin;
set local lock_timeout = '3s';
-- GameActif : accès enseignant par lien d'invitation. NON APPLIQUÉE : l'application sur la base partagée exige
-- l'accord explicite de JF (essai d'abord dans une transaction annulée : supabase/essai-rollback-game_acces.sql).
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

-- GameActif : suivi des élèves par code pseudonyme. NON APPLIQUÉE : l'application sur la base partagée exige l'accord
-- explicite de JF, l'avis du DPO (docs/confidentialite/dossier-dpo-suivi.md) et un essai préalable dans une transaction
-- annulée. Dépend de 20261103_game_acces.sql (game_teachers, game_is_teacher).
--
-- Spec : docs/superpowers/specs/2026-11-06-suivi-par-code-design.md. Plan : plans/2026-11-06-gameactif-plan-8-suivi-par-code.md.
-- Tout objet est préfixé game_. `profiles` n'est pas recréé. Aucun prénom n'est stocké : les élèves n'existent que sous un
-- code « E01 » à « E40 », la correspondance avec le prénom reste dans le navigateur de l'enseignant.
-- Droits : anon n'a aucun droit de lecture ; l'élève n'écrit que par game_record_session (tâche 2).

-- ---------------------------------------------------------------------------------------------------------------
-- Classes
-- ---------------------------------------------------------------------------------------------------------------

create table public.game_classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  nb_codes int not null check (nb_codes between 1 and 40),
  class_code text not null unique check (class_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$'),
  purge_on date not null,
  created_at timestamptz not null default now()
);

create index game_classes_user_idx on public.game_classes (user_id, created_at desc);

alter table public.game_classes enable row level security;
revoke all on table public.game_classes from anon, authenticated;
grant all on table public.game_classes to service_role;
grant select on table public.game_classes to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Fonctions (security definer : le contrôle d'accès croisé ne passe jamais par une sous-requête dans une règle RLS)
-- ---------------------------------------------------------------------------------------------------------------

-- Date de suppression des résultats : 30 août suivant la création ; pour une création du 1er au 30 août, le 30 août de
-- l'année suivante (un enseignant qui prépare sa rentrée fin août ne perd pas sa classe quinze jours plus tard).
create function public.game_school_year_end(p_created date) returns date
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select case
    when extract(month from p_created) < 8 then make_date(extract(year from p_created)::int, 8, 30)
    else make_date(extract(year from p_created)::int + 1, 8, 30)
  end;
$$;

revoke all on function public.game_school_year_end(date) from public, anon, authenticated;
grant execute on function public.game_school_year_end(date) to authenticated, service_role;

create function public.game_owns_class(p_class_id uuid) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
  select exists (select 1 from public.game_classes where id = p_class_id and user_id = auth.uid());
$$;

revoke all on function public.game_owns_class(uuid) from public, anon, authenticated;
grant execute on function public.game_owns_class(uuid) to authenticated, service_role;

-- Créer une classe : réservé aux enseignants. Le code de classe (8 caractères sans I, L, O, 0, 1) est généré ici ;
-- une collision est réessayée.
create function public.game_create_class(p_label text, p_nb_codes int) returns table (id uuid, class_code text)
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
#variable_conflict use_column
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  v_id uuid;
  i int;
begin
  if not public.game_is_teacher() then
    raise exception 'Accès réservé aux enseignants.';
  end if;
  if p_label is null or char_length(btrim(p_label)) < 1 or char_length(btrim(p_label)) > 80 then
    raise exception 'Libellé invalide (1 à 80 caractères).';
  end if;
  if p_nb_codes is null or p_nb_codes < 1 or p_nb_codes > 40 then
    raise exception 'Nombre de codes invalide (1 à 40).';
  end if;

  loop
    v_bytes := gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
    end loop;
    begin
      insert into public.game_classes (user_id, label, nb_codes, class_code, purge_on)
        values (auth.uid(), btrim(p_label), p_nb_codes, v_code, public.game_school_year_end(current_date))
        returning game_classes.id into v_id;
      exit;
    exception when unique_violation then
      -- Collision de code : un autre tirage.
      null;
    end;
  end loop;

  return query select v_id, v_code;
end;
$$;

revoke all on function public.game_create_class(text, int) from public, anon, authenticated;
grant execute on function public.game_create_class(text, int) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Règles par ligne
-- ---------------------------------------------------------------------------------------------------------------

-- Les règles de lecture et de suppression de game_classes sont définies plus bas, après game_can_read_class.

-- ---------------------------------------------------------------------------------------------------------------
-- Séances jouées (écriture par l'élève, sans compte, uniquement par game_record_session)
-- ---------------------------------------------------------------------------------------------------------------

create table public.game_sessions (
  id uuid primary key,
  class_id uuid not null references public.game_classes (id) on delete cascade,
  student_code text not null check (student_code ~ '^E[0-9]{2}$'),
  mechanic text not null check (mechanic in ('associer', 'trier', 'ordre', 'placer', 'comparer', 'memo', 'qcm')),
  profile text not null check (profile in ('soutien', 'standard', 'defi')),
  cibles text[] not null check (array_length(cibles, 1) between 1 and 3),
  total_elements int not null check (total_elements between 1 and 50),
  ended_at timestamptz not null,
  labels jsonb not null check (jsonb_typeof(labels) = 'object'),
  results jsonb not null check (jsonb_typeof(results) = 'array'),
  -- Tour joué au niveau au-dessus du profil de l'élève (dépassement volontaire) : exclu des signaux négatifs du tableau de bord.
  above boolean not null default false,
  created_at timestamptz not null default now()
);

create index game_sessions_class_idx on public.game_sessions (class_id, ended_at desc);
create index game_sessions_rate_idx on public.game_sessions (class_id, created_at desc);

alter table public.game_sessions enable row level security;
revoke all on table public.game_sessions from anon, authenticated;
grant all on table public.game_sessions to service_role;
-- Lecture par authenticated : accordée ici, bornée par la règle de lecture ajoutée avec les invités (aucune règle = aucune ligne).
grant select on table public.game_sessions to authenticated;

-- Nombre de codes d'une classe, pour construire la liste « Qui joue ? ». null si le code est inconnu ou la classe expirée.
create function public.game_class_info(p_class_code text) returns int
language sql
stable
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
  select nb_codes from public.game_classes where class_code = p_class_code and purge_on >= current_date;
$$;

revoke all on function public.game_class_info(text) from public, anon, authenticated;
grant execute on function public.game_class_info(text) to anon, authenticated, service_role;

-- Enregistrer une séance. Renvoie 'ok', 'invalide' (classe, code élève ou charge utile refusés : les cas ne sont pas
-- distingués) ou 'limite' (60 séances par classe et par minute). Rejouer le même sessionId renvoie 'ok' sans doublon.
create function public.game_record_session(p_class_code text, p_student_code text, p_payload jsonb) returns text
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_class public.game_classes%rowtype;
  v_num int;
  v_sid uuid;
  v_ended timestamptz;
  v_total int;
  v_nb int;
  c jsonb;
  el jsonb;
  w jsonb;
  k text;
  val jsonb;
begin
  if p_class_code is null or p_student_code is null or p_payload is null then
    return 'invalide';
  end if;
  select * into v_class from public.game_classes where class_code = p_class_code and purge_on >= current_date;
  if not found then
    return 'invalide';
  end if;
  if p_student_code !~ '^E[0-9]{2}$' then
    return 'invalide';
  end if;
  v_num := substr(p_student_code, 2)::int;
  if v_num < 1 or v_num > v_class.nb_codes then
    return 'invalide';
  end if;

  begin
    if octet_length(p_payload::text) > 60000 or jsonb_typeof(p_payload) is distinct from 'object' then
      return 'invalide';
    end if;
    if jsonb_typeof(p_payload -> 'sessionId') is distinct from 'string' then
      return 'invalide';
    end if;
    v_sid := (p_payload ->> 'sessionId')::uuid;
    if coalesce(p_payload ->> 'mechanic', '') <> all (array['associer', 'trier', 'ordre', 'placer', 'comparer', 'memo', 'qcm']) then
      return 'invalide';
    end if;
    if coalesce(p_payload ->> 'profile', '') <> all (array['soutien', 'standard', 'defi']) then
      return 'invalide';
    end if;

    if jsonb_typeof(p_payload -> 'cibles') is distinct from 'array'
       or jsonb_array_length(p_payload -> 'cibles') not between 1 and 3 then
      return 'invalide';
    end if;
    for c in select * from jsonb_array_elements(p_payload -> 'cibles') loop
      if jsonb_typeof(c) is distinct from 'string' or (c #>> '{}') !~ '^M\.P[1-6](\.[A-Za-z0-9]+)+$' then
        return 'invalide';
      end if;
    end loop;

    if jsonb_typeof(p_payload -> 'totalElements') is distinct from 'number'
       or (p_payload ->> 'totalElements') !~ '^[0-9]{1,2}$' then
      return 'invalide';
    end if;
    v_total := (p_payload ->> 'totalElements')::int;
    if v_total not between 1 and 50 then
      return 'invalide';
    end if;

    if jsonb_typeof(p_payload -> 'endedAt') is distinct from 'string' then
      return 'invalide';
    end if;
    v_ended := (p_payload ->> 'endedAt')::timestamptz;

    -- « above » : facultatif (faux par défaut) ; s'il est présent, il doit être un booléen.
    if p_payload ? 'above' and jsonb_typeof(p_payload -> 'above') is distinct from 'boolean' then
      return 'invalide';
    end if;

    if jsonb_typeof(p_payload -> 'labels') is distinct from 'object' then
      return 'invalide';
    end if;
    select count(*) into v_nb from jsonb_object_keys(p_payload -> 'labels');
    if v_nb > 100 then
      return 'invalide';
    end if;
    for k, val in select key, value from jsonb_each(p_payload -> 'labels') loop
      if char_length(k) > 80 or jsonb_typeof(val) is distinct from 'string' or char_length(val #>> '{}') > 80 then
        return 'invalide';
      end if;
    end loop;

    if jsonb_typeof(p_payload -> 'results') is distinct from 'array'
       or jsonb_array_length(p_payload -> 'results') not between 1 and 50 then
      return 'invalide';
    end if;
    for el in select * from jsonb_array_elements(p_payload -> 'results') loop
      if jsonb_typeof(el) is distinct from 'object'
         or jsonb_typeof(el -> 'elementId') is distinct from 'string' or char_length(el ->> 'elementId') not between 1 and 80
         or jsonb_typeof(el -> 'correct') is distinct from 'string' or char_length(el ->> 'correct') not between 1 and 80
         or jsonb_typeof(el -> 'firstTry') is distinct from 'boolean'
         or jsonb_typeof(el -> 'hintUsed') is distinct from 'boolean'
         or jsonb_typeof(el -> 'revealed') is distinct from 'boolean'
         or jsonb_typeof(el -> 'tries') is distinct from 'number' or (el ->> 'tries') !~ '^[0-9]{1,3}$'
         or jsonb_typeof(el -> 'wrongChoices') is distinct from 'array'
         or jsonb_array_length(el -> 'wrongChoices') > 10 then
        return 'invalide';
      end if;
      for w in select * from jsonb_array_elements(el -> 'wrongChoices') loop
        if jsonb_typeof(w) is distinct from 'string' or char_length(w #>> '{}') not between 1 and 80 then
          return 'invalide';
        end if;
      end loop;
    end loop;
  exception when others then
    -- Conversion impossible (identifiant, date) ou forme inattendue : refus, rien n'est écrit.
    return 'invalide';
  end;

  if (select count(*) from public.game_sessions where class_id = v_class.id and created_at > now() - interval '1 minute') >= 60 then
    return 'limite';
  end if;

  insert into public.game_sessions (id, class_id, student_code, mechanic, profile, cibles, total_elements, ended_at, labels, results, above)
    values (
      v_sid, v_class.id, p_student_code, p_payload ->> 'mechanic', p_payload ->> 'profile',
      array(select jsonb_array_elements_text(p_payload -> 'cibles')),
      v_total, v_ended, p_payload -> 'labels', p_payload -> 'results',
      coalesce((p_payload ->> 'above')::boolean, false)
    )
    on conflict (id) do nothing;
  return 'ok';
end;
$$;

revoke all on function public.game_record_session(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.game_record_session(text, text, jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Observations de l'enseignant, résultats saisis à la main
-- ---------------------------------------------------------------------------------------------------------------

create table public.game_observations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.game_classes (id) on delete cascade,
  student_code text check (student_code is null or student_code ~ '^E[0-9]{2}$'),
  texte text not null check (char_length(btrim(texte)) between 1 and 1000),
  visible_invites boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_observations_class_idx on public.game_observations (class_id, created_at desc);

create trigger game_observations_touch before update on public.game_observations
  for each row execute function public.game_touch_updated_at();

create table public.game_manual_results (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.game_classes (id) on delete cascade,
  student_code text not null check (student_code ~ '^E[0-9]{2}$'),
  cible text not null check (cible ~ '^M\.P[1-6](\.[A-Za-z0-9]+)+$'),
  resultat text not null check (resultat in ('reussi', 'partiel', 'a_reprendre')),
  created_at timestamptz not null default now()
);

create index game_manual_results_class_idx on public.game_manual_results (class_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------------------
-- Invitation d'une personne à lire une classe (lecture seule)
-- ---------------------------------------------------------------------------------------------------------------

create table public.game_guest_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.game_classes (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.game_class_guests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.game_classes (id) on delete cascade,
  guest_user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, guest_user_id)
);

alter table public.game_observations enable row level security;
alter table public.game_manual_results enable row level security;
alter table public.game_guest_invitations enable row level security;
alter table public.game_class_guests enable row level security;

revoke all on table public.game_observations from anon, authenticated;
revoke all on table public.game_manual_results from anon, authenticated;
revoke all on table public.game_guest_invitations from anon, authenticated;
revoke all on table public.game_class_guests from anon, authenticated;

grant all on table public.game_observations to service_role;
grant all on table public.game_manual_results to service_role;
grant all on table public.game_guest_invitations to service_role;
grant all on table public.game_class_guests to service_role;

grant select, insert, update, delete on table public.game_observations to authenticated;
grant select, insert, update, delete on table public.game_manual_results to authenticated;
grant select on table public.game_class_guests to authenticated;
grant delete on table public.game_classes to authenticated;
-- game_guest_invitations : aucun droit pour les rôles API (seules les fonctions ci-dessous y touchent).

-- Lecture d'une classe : son propriétaire, ou une personne invitée dont l'accès n'est ni révoqué ni échu.
create function public.game_can_read_class(p_class_id uuid) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
  select exists (select 1 from public.game_classes where id = p_class_id and user_id = auth.uid())
      or exists (
        select 1 from public.game_class_guests
        where class_id = p_class_id and guest_user_id = auth.uid() and revoked_at is null and expires_at > now()
      );
$$;

revoke all on function public.game_can_read_class(uuid) from public, anon, authenticated;
grant execute on function public.game_can_read_class(uuid) to authenticated, service_role;

-- Créer une invitation : réservé au propriétaire de la classe. Le code est rendu UNE SEULE FOIS ; seule son empreinte
-- est conservée. Usage unique ; échéance : 30 jours ou la date de suppression de la classe, la plus proche.
create function public.game_create_guest_invitation(p_class_id uuid) returns text
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_class public.game_classes%rowtype;
  v_code text;
begin
  select * into v_class from public.game_classes where id = p_class_id and user_id = auth.uid();
  if not found then
    raise exception 'Classe introuvable.';
  end if;
  v_code := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.game_guest_invitations (class_id, code_hash, expires_at)
    values (p_class_id, encode(digest(v_code, 'sha256'), 'hex'), least(now() + interval '30 days', v_class.purge_on::timestamptz));
  return v_code;
end;
$$;

revoke all on function public.game_create_guest_invitation(uuid) from public, anon, authenticated;
grant execute on function public.game_create_guest_invitation(uuid) to authenticated, service_role;

-- Utiliser une invitation (tout compte connecté). 'ok', 'deja' (propriétaire ou déjà invité) ou 'invalide' (inconnue,
-- échue, révoquée, déjà utilisée ou mal formée : les cas ne sont pas distingués).
create function public.game_redeem_guest_invitation(p_code text) returns text
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.game_guest_invitations%rowtype;
begin
  if v_uid is null then
    return 'invalide';
  end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{32}$' then
    return 'invalide';
  end if;
  select * into v_inv from public.game_guest_invitations
    where code_hash = encode(digest(p_code, 'sha256'), 'hex')
    for update;
  if not found then
    return 'invalide';
  end if;
  if exists (select 1 from public.game_classes where id = v_inv.class_id and user_id = v_uid)
     or exists (
       select 1 from public.game_class_guests
       where class_id = v_inv.class_id and guest_user_id = v_uid and revoked_at is null and expires_at > now()
     ) then
    return 'deja';
  end if;
  if v_inv.revoked_at is not null or v_inv.used_at is not null or v_inv.expires_at <= now() then
    return 'invalide';
  end if;

  -- Une personne dont l'accès avait été révoqué ou avait pris fin retrouve l'accès avec une nouvelle invitation.
  insert into public.game_class_guests (class_id, guest_user_id, expires_at)
    values (v_inv.class_id, v_uid, v_inv.expires_at)
    on conflict (class_id, guest_user_id) do update set revoked_at = null, expires_at = excluded.expires_at;
  update public.game_guest_invitations set used_at = now() where id = v_inv.id;
  return 'ok';
end;
$$;

revoke all on function public.game_redeem_guest_invitation(text) from public, anon, authenticated;
grant execute on function public.game_redeem_guest_invitation(text) to authenticated, service_role;

-- Révoquer un invité : réservé au propriétaire de la classe.
create function public.game_revoke_guest(p_guest_id uuid) returns void
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_class uuid;
begin
  select class_id into v_class from public.game_class_guests where id = p_guest_id;
  if v_class is null or not exists (select 1 from public.game_classes where id = v_class and user_id = auth.uid()) then
    raise exception 'Invité introuvable.';
  end if;
  update public.game_class_guests set revoked_at = now() where id = p_guest_id;
end;
$$;

revoke all on function public.game_revoke_guest(uuid) from public, anon, authenticated;
grant execute on function public.game_revoke_guest(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Règles par ligne : le propriétaire écrit ; l'invité lit seulement
-- ---------------------------------------------------------------------------------------------------------------

create policy game_classes_select on public.game_classes
  for select to authenticated
  using (public.game_can_read_class(id));

create policy game_classes_delete on public.game_classes
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.game_is_teacher());

create policy game_sessions_select on public.game_sessions
  for select to authenticated
  using (public.game_can_read_class(class_id));

create policy game_manual_results_select on public.game_manual_results
  for select to authenticated
  using (public.game_can_read_class(class_id));

create policy game_manual_results_insert on public.game_manual_results
  for insert to authenticated
  with check (public.game_owns_class(class_id));

create policy game_manual_results_update on public.game_manual_results
  for update to authenticated
  using (public.game_owns_class(class_id))
  with check (public.game_owns_class(class_id));

create policy game_manual_results_delete on public.game_manual_results
  for delete to authenticated
  using (public.game_owns_class(class_id));

create policy game_observations_select on public.game_observations
  for select to authenticated
  using (public.game_owns_class(class_id) or (visible_invites and public.game_can_read_class(class_id)));

create policy game_observations_insert on public.game_observations
  for insert to authenticated
  with check (public.game_owns_class(class_id));

create policy game_observations_update on public.game_observations
  for update to authenticated
  using (public.game_owns_class(class_id))
  with check (public.game_owns_class(class_id));

create policy game_observations_delete on public.game_observations
  for delete to authenticated
  using (public.game_owns_class(class_id));

create policy game_class_guests_select on public.game_class_guests
  for select to authenticated
  using (public.game_owns_class(class_id));

-- game_guest_invitations : aucune règle, donc aucun accès pour les rôles API.

-- ---------------------------------------------------------------------------------------------------------------
-- Suppression des résultats à la date de fin d'année de chaque classe (30 août, voir game_school_year_end)
-- ---------------------------------------------------------------------------------------------------------------

-- Supprime les classes dont la date est atteinte ; séances, observations, résultats saisis, invités et invitations
-- partent avec elles (on delete cascade). Les comptes enseignants et leurs activités ne sont pas touchés.
-- Réservée à service_role et à l'administrateur ; la planification est faite à part (supabase/admin/planifier-purge.sql).
create function public.game_purge_expired(p_today date default current_date) returns int
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_n int;
begin
  delete from public.game_classes where purge_on <= p_today;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.game_purge_expired(date) from public, anon, authenticated;
grant execute on function public.game_purge_expired(date) to service_role;

-- GameActif : essais de la migration 20261107_game_suivi. À exécuter APRÈS 20261103_game_acces et 20261107_game_suivi,
-- dans une transaction annulée. Chaque bloc lève « ECHEC (x) » si un contrôle échoue ; un NOTICE « OK (x) » sinon.
-- Identités : u1 et u2 sont enseignants, u3 n'a aucun accès.
--   u1 = 00000000-0000-4000-8000-000000000001   u2 = ...0002   u3 = ...0003

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');
insert into public.game_teachers (user_id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

-- (s1) u1 crée une classe : le code de classe a la forme attendue ; la ligne existe et appartient à u1.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_code text; v_id uuid; n int;
begin
  select c.class_code, c.id into v_code, v_id from public.game_create_class('P4 B', 24) c;
  if v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$' then raise exception 'ECHEC (s1) : forme du code de classe : %', v_code; end if;
  select count(*) into n from public.game_classes where id = v_id and user_id = '00000000-0000-4000-8000-000000000001' and nb_codes = 24 and label = 'P4 B';
  if n <> 1 then raise exception 'ECHEC (s1) : la classe n''existe pas ou n''appartient pas à u1'; end if;
  raise notice 'OK (s1) : classe créée avec un code de forme attendue';
end $$;

-- (s2) Entrées refusées : nombre de codes hors 1 à 40, libellé vide ou de 81 caractères.
do $$
declare ok boolean;
begin
  ok := false; begin perform public.game_create_class('P4 B', 0); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (s2) : 0 code accepté'; end if;
  ok := false; begin perform public.game_create_class('P4 B', 41); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (s2) : 41 codes acceptés'; end if;
  ok := false; begin perform public.game_create_class('', 10); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (s2) : libellé vide accepté'; end if;
  ok := false; begin perform public.game_create_class(repeat('x', 81), 10); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (s2) : libellé de 81 caractères accepté'; end if;
  perform public.game_create_class(repeat('x', 80), 40);
  raise notice 'OK (s2) : entrées hors limites refusées, bornes acceptées';
end $$;

-- (s3) Une écriture directe dans la table est refusée à un enseignant (seule la fonction crée).
do $$
declare ok boolean := false;
begin
  begin
    insert into public.game_classes (user_id, label, nb_codes, class_code, purge_on)
      values ('00000000-0000-4000-8000-000000000001', 'x', 1, 'AAAAAAAA', current_date + 10);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (s3) : insertion directe acceptée'; end if;
  raise notice 'OK (s3) : insertion directe refusée';
end $$;
reset role;

-- (s4) u2 (autre enseignant) ne voit aucune classe de u1.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.game_classes;
  if n <> 0 then raise exception 'ECHEC (s4) : u2 voit % classe(s) de u1', n; end if;
  raise notice 'OK (s4) : une classe n''est visible que de son propriétaire';
end $$;
reset role;

-- (s5) Un compte sans accès enseignant ne peut pas créer de classe.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare ok boolean := false;
begin
  begin perform public.game_create_class('P4 C', 20); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (s5) : un compte sans accès a créé une classe'; end if;
  raise notice 'OK (s5) : création réservée aux enseignants';
end $$;
reset role;

-- (s6) Le rôle anon ne lit rien et ne peut pas appeler la création.
set local role anon;
do $$
declare ok boolean := false; ok2 boolean := false; n int;
begin
  begin select count(*) into n from public.game_classes; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (s6) : anon lit game_classes'; end if;
  begin perform public.game_create_class('P4 D', 20); exception when insufficient_privilege then ok2 := true; end;
  if not ok2 then raise exception 'ECHEC (s6) : anon appelle game_create_class'; end if;
  raise notice 'OK (s6) : anon sans lecture ni création';
end $$;
reset role;

-- (s7) Date de suppression : 30 août suivant, sauf création du 1er au 30 août, où c'est le 30 août de l'année suivante.
do $$
begin
  if public.game_school_year_end(date '2027-07-31') <> date '2027-08-30' then raise exception 'ECHEC (s7) : 2027-07-31'; end if;
  if public.game_school_year_end(date '2027-01-15') <> date '2027-08-30' then raise exception 'ECHEC (s7) : 2027-01-15'; end if;
  if public.game_school_year_end(date '2027-08-01') <> date '2028-08-30' then raise exception 'ECHEC (s7) : 2027-08-01'; end if;
  if public.game_school_year_end(date '2027-08-29') <> date '2028-08-30' then raise exception 'ECHEC (s7) : 2027-08-29'; end if;
  if public.game_school_year_end(date '2027-08-30') <> date '2028-08-30' then raise exception 'ECHEC (s7) : 2027-08-30'; end if;
  if public.game_school_year_end(date '2027-08-31') <> date '2028-08-30' then raise exception 'ECHEC (s7) : 2027-08-31'; end if;
  raise notice 'OK (s7) : date de suppression';
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Écriture des séances par l'élève (rôle anon). Classe d'essai : u1, 24 codes.
-- ---------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_code text; v_id uuid;
begin
  select c.class_code, c.id into v_code, v_id from public.game_create_class('Classe d''essai', 24) c;
  perform set_config('essai.cc', v_code, true);
  perform set_config('essai.cid', v_id::text, true);
end $$;
reset role;

-- (s8) game_class_info : le nombre de codes pour un code valide, null sinon.
set local role anon;
do $$
declare n int;
begin
  n := public.game_class_info(current_setting('essai.cc'));
  if n is distinct from 24 then raise exception 'ECHEC (s8) : attendu 24, obtenu %', n; end if;
  if public.game_class_info('AAAAAAAA') is not null then raise exception 'ECHEC (s8) : code inconnu accepté'; end if;
  if public.game_class_info('abc') is not null then raise exception 'ECHEC (s8) : code mal formé accepté'; end if;
  raise notice 'OK (s8) : information de classe';
end $$;

-- (s9) Une séance valide pour E07 est acceptée ; (s10) rejouée avec le même identifiant, elle ne double pas.
do $$
declare v jsonb; r text;
begin
  v := '{"sessionId":"11111111-1111-4111-8111-111111111111","mechanic":"trier","profile":"standard","cibles":["M.P4.1.1.i1.a1"],"totalElements":2,"endedAt":"2026-11-12T10:00:00Z","labels":{"devant":"devant","derriere":"derrière"},"results":[{"elementId":"e1","correct":"devant","firstTry":false,"tries":2,"hintUsed":false,"revealed":false,"wrongChoices":["derriere"]},{"elementId":"e2","correct":"derriere","firstTry":true,"tries":1,"hintUsed":false,"revealed":false,"wrongChoices":[]}]}'::jsonb;
  r := public.game_record_session(current_setting('essai.cc'), 'E07', v);
  if r <> 'ok' then raise exception 'ECHEC (s9) : attendu ok, obtenu %', r; end if;
  r := public.game_record_session(current_setting('essai.cc'), 'E07', v);
  if r <> 'ok' then raise exception 'ECHEC (s10) : la répétition devrait renvoyer ok, obtenu %', r; end if;
  perform set_config('essai.payload', v::text, true);
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.game_sessions where student_code = 'E07' and class_id = current_setting('essai.cid')::uuid;
  if n <> 1 then raise exception 'ECHEC (s9/s10) : % ligne(s) au lieu de 1', n; end if;
  raise notice 'OK (s9) : séance valide enregistrée';
  raise notice 'OK (s10) : séance rejouée sans doublon';
end $$;

-- (s11) Codes élèves refusés : hors liste, minuscule, prénom, un seul chiffre, zéro. Rien n'est écrit.
set local role anon;
do $$
declare v jsonb := current_setting('essai.payload')::jsonb; c text; r text;
begin
  v := jsonb_set(v, '{sessionId}', '"22222222-2222-4222-8222-222222222222"');
  foreach c in array array['E25', 'e07', 'Léa', 'E7', 'E00', '', 'E070'] loop
    r := public.game_record_session(current_setting('essai.cc'), c, v);
    if r <> 'invalide' then raise exception 'ECHEC (s11) : code élève « % » : %', c, r; end if;
  end loop;
  r := public.game_record_session('AAAAAAAA', 'E07', v);
  if r <> 'invalide' then raise exception 'ECHEC (s11) : classe inconnue : %', r; end if;
  r := public.game_record_session(current_setting('essai.cc'), null, v);
  if r <> 'invalide' then raise exception 'ECHEC (s11) : code élève null : %', r; end if;
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.game_sessions where id = '22222222-2222-4222-8222-222222222222';
  if n <> 0 then raise exception 'ECHEC (s11) : une séance refusée a été écrite'; end if;
  raise notice 'OK (s11) : codes élèves et classe refusés sans écriture';
end $$;

-- (s12) Charges utiles refusées.
set local role anon;
do $$
declare base jsonb := current_setting('essai.payload')::jsonb; v jsonb; r text; nom text;
  cas jsonb[];
begin
  base := jsonb_set(base, '{sessionId}', '"33333333-3333-4333-8333-333333333333"');
  cas := array[
    jsonb_set(base, '{results}', (select jsonb_agg(base->'results'->0) from generate_series(1, 51))),
    jsonb_set(base, '{labels,devant}', to_jsonb(repeat('x', 81))),
    jsonb_set(base, '{mechanic}', '"foo"'),
    jsonb_set(base, '{profile}', '"x"'),
    jsonb_set(base, '{cibles}', '["M.P4.1.1.i1.a1","M.P4.1.1.i1.a2","M.P4.1.1.i1.a3","M.P4.1.1.i1.a4"]'),
    jsonb_set(base, '{cibles}', '["Léa"]'),
    jsonb_set(base, '{cibles}', '[]'),
    base - 'results',
    jsonb_set(base, '{results,0,tries}', '"deux"'),
    jsonb_set(base, '{results,0,wrongChoices}', (select jsonb_agg('x' || g) from generate_series(1, 11) g)),
    jsonb_set(base, '{sessionId}', '"pas-un-uuid"'),
    jsonb_set(base, '{totalElements}', '0')
  ];
  for i in 1..array_length(cas, 1) loop
    r := public.game_record_session(current_setting('essai.cc'), 'E08', cas[i]);
    if r <> 'invalide' then raise exception 'ECHEC (s12) : cas % : %', i, r; end if;
  end loop;
  -- Bornes acceptées : 50 résultats, label de 80 caractères.
  v := jsonb_set(base, '{results}', (select jsonb_agg(base->'results'->0) from generate_series(1, 50)));
  v := jsonb_set(v, '{totalElements}', '50');
  v := jsonb_set(v, '{labels,devant}', to_jsonb(repeat('x', 80)));
  r := public.game_record_session(current_setting('essai.cc'), 'E08', v);
  if r <> 'ok' then raise exception 'ECHEC (s12) : bornes valides refusées : %', r; end if;
  raise notice 'OK (s12) : charges utiles hors limites refusées, bornes acceptées';
end $$;
reset role;

-- (s13) Limite : 60 séances de la classe dans la dernière minute, la suivante renvoie « limite ».
insert into public.game_sessions (id, class_id, student_code, mechanic, profile, cibles, total_elements, ended_at, labels, results)
  select gen_random_uuid(), current_setting('essai.cid')::uuid, 'E01', 'trier', 'standard', array['M.P4.1.1.i1.a1'], 1, now(), '{}'::jsonb, '[]'::jsonb
  from generate_series(1, 60);
set local role anon;
do $$
declare v jsonb := current_setting('essai.payload')::jsonb; r text;
begin
  v := jsonb_set(v, '{sessionId}', '"44444444-4444-4444-8444-444444444444"');
  r := public.game_record_session(current_setting('essai.cc'), 'E09', v);
  if r <> 'limite' then raise exception 'ECHEC (s13) : attendu limite, obtenu %', r; end if;
  raise notice 'OK (s13) : limite de débit';
end $$;
reset role;

-- (s15) anon ne lit rien dans game_sessions et n'y écrit pas directement.
set local role anon;
do $$
declare ok boolean := false; ok2 boolean := false; n int;
begin
  begin select count(*) into n from public.game_sessions; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (s15) : anon lit game_sessions'; end if;
  begin
    insert into public.game_sessions (id, class_id, student_code, mechanic, profile, cibles, total_elements, ended_at, labels, results)
      values (gen_random_uuid(), current_setting('essai.cid')::uuid, 'E01', 'trier', 'standard', array['M.P4.1.1.i1.a1'], 1, now(), '{}', '[]');
  exception when insufficient_privilege then ok2 := true; end;
  if not ok2 then raise exception 'ECHEC (s15) : anon écrit directement dans game_sessions'; end if;
  raise notice 'OK (s15) : anon sans lecture ni écriture directe';
end $$;
reset role;

-- (s14) Classe expirée : la séance et l'information sont refusées.
update public.game_classes set purge_on = current_date - 1 where id = current_setting('essai.cid')::uuid;
delete from public.game_sessions where class_id = current_setting('essai.cid')::uuid and student_code = 'E01';
set local role anon;
do $$
declare v jsonb := current_setting('essai.payload')::jsonb; r text;
begin
  v := jsonb_set(v, '{sessionId}', '"55555555-5555-4555-8555-555555555555"');
  r := public.game_record_session(current_setting('essai.cc'), 'E09', v);
  if r <> 'invalide' then raise exception 'ECHEC (s14) : classe expirée : %', r; end if;
  if public.game_class_info(current_setting('essai.cc')) is not null then raise exception 'ECHEC (s14) : information d''une classe expirée'; end if;
  raise notice 'OK (s14) : classe expirée refusée';
end $$;
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- Observations, résultats saisis, invité par code. Deux classes neuves : A (u1) et B (u2). u3 n'a aucun accès enseignant.
-- ---------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_id uuid;
begin
  select c.id into v_id from public.game_create_class('Classe A', 10) c;
  perform set_config('essai.a', v_id::text, true);
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_id uuid;
begin
  select c.id into v_id from public.game_create_class('Classe B', 10) c;
  perform set_config('essai.b', v_id::text, true);
end $$;
reset role;

-- Séances de A et de B, ajoutées sans passer par la fonction.
insert into public.game_sessions (id, class_id, student_code, mechanic, profile, cibles, total_elements, ended_at, labels, results) values
  ('a0000000-0000-4000-8000-000000000001', current_setting('essai.a')::uuid, 'E01', 'trier', 'standard', array['M.P4.1.1.i1.a1'], 1, now(), '{}', '[]'),
  ('b0000000-0000-4000-8000-000000000001', current_setting('essai.b')::uuid, 'E02', 'trier', 'standard', array['M.P4.1.1.i1.a1'], 1, now(), '{}', '[]');

-- (s16) Observations : 1000 caractères acceptés, 1001 refusés, code élève mal formé refusé, invisibles pour l'invité par défaut.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare ok boolean; v boolean;
begin
  insert into public.game_observations (class_id, student_code, texte) values (current_setting('essai.a')::uuid, 'E04', repeat('a', 1000));
  ok := false; begin insert into public.game_observations (class_id, texte) values (current_setting('essai.a')::uuid, repeat('a', 1001)); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC (s16) : observation de 1001 caractères acceptée'; end if;
  ok := false; begin insert into public.game_observations (class_id, student_code, texte) values (current_setting('essai.a')::uuid, 'Léa', 'x'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC (s16) : code élève « Léa » accepté'; end if;
  ok := false; begin insert into public.game_observations (class_id, texte) values (current_setting('essai.a')::uuid, '   '); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC (s16) : observation vide acceptée'; end if;
  select visible_invites into v from public.game_observations where student_code = 'E04';
  if v is distinct from false then raise exception 'ECHEC (s16) : visible_invites devrait valoir false par défaut'; end if;
  insert into public.game_observations (class_id, student_code, texte, visible_invites) values (current_setting('essai.a')::uuid, 'E05', 'partagée', true);
  -- Une classe qui n'est pas la sienne : refusé.
  ok := false;
  begin insert into public.game_observations (class_id, texte) values (current_setting('essai.b')::uuid, 'intrus'); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (s16) : écriture dans la classe d''un autre enseignant'; end if;
  raise notice 'OK (s16) : observations';
end $$;

-- (s17) Résultats saisis : valeurs admises seulement.
do $$
declare ok boolean;
begin
  insert into public.game_manual_results (class_id, student_code, cible, resultat) values (current_setting('essai.a')::uuid, 'E04', 'M.P4.1.1.i1.a1', 'reussi');
  ok := false; begin insert into public.game_manual_results (class_id, student_code, cible, resultat) values (current_setting('essai.a')::uuid, 'E04', 'M.P4.1.1.i1.a1', 'foo'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC (s17) : résultat « foo » accepté'; end if;
  ok := false; begin insert into public.game_manual_results (class_id, student_code, cible, resultat) values (current_setting('essai.a')::uuid, 'E04', 'Léa', 'reussi'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC (s17) : cible « Léa » acceptée'; end if;
  ok := false; begin insert into public.game_manual_results (class_id, student_code, cible, resultat) values (current_setting('essai.a')::uuid, 'Léa', 'M.P4.1.1.i1.a1', 'reussi'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC (s17) : code élève « Léa » accepté'; end if;
  raise notice 'OK (s17) : résultats saisis';
end $$;

-- (s18) Invitation : seul le propriétaire en crée ; usage unique ; expirée refusée ; code mal formé refusé.
do $$
declare v_code text; ok boolean;
begin
  v_code := public.game_create_guest_invitation(current_setting('essai.a')::uuid);
  if v_code !~ '^[A-Za-z0-9_-]{32}$' then raise exception 'ECHEC (s18) : forme du code d''invitation'; end if;
  perform set_config('essai.ia', v_code, true);
  perform set_config('essai.ib', public.game_create_guest_invitation(current_setting('essai.a')::uuid), true);
  perform set_config('essai.ic', public.game_create_guest_invitation(current_setting('essai.a')::uuid), true);
end $$;
do $$
declare ok boolean := false;
begin
  begin perform public.game_create_guest_invitation(current_setting('essai.b')::uuid); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (s18) : invitation créée pour la classe d''un autre'; end if;
end $$;
reset role;
-- Le code en clair n'est stocké nulle part.
do $$
declare n int;
begin
  select count(*) into n from public.game_guest_invitations where code_hash in (current_setting('essai.ia'), current_setting('essai.ib'), current_setting('essai.ic'));
  if n <> 0 then raise exception 'ECHEC (s18) : un code d''invitation est stocké en clair'; end if;
end $$;
-- L'invitation « ic » expire.
update public.game_guest_invitations set expires_at = now() - interval '1 day'
  where code_hash = encode(digest(current_setting('essai.ic'), 'sha256'), 'hex');

-- u3 (sans accès enseignant) utilise « ia » : ok, puis deja ; u2 rejoue le même code : invalide.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text;
begin
  r := public.game_redeem_guest_invitation(current_setting('essai.ia'));
  if r <> 'ok' then raise exception 'ECHEC (s18) : attendu ok, obtenu %', r; end if;
  r := public.game_redeem_guest_invitation(current_setting('essai.ia'));
  if r <> 'deja' then raise exception 'ECHEC (s18) : attendu deja, obtenu %', r; end if;
  r := public.game_redeem_guest_invitation(substr(current_setting('essai.ib'), 1, 31));
  if r <> 'invalide' then raise exception 'ECHEC (s18) : code de 31 caractères : %', r; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text;
begin
  r := public.game_redeem_guest_invitation(current_setting('essai.ia'));
  if r <> 'invalide' then raise exception 'ECHEC (s18) : code déjà utilisé par un autre compte : %', r; end if;
  r := public.game_redeem_guest_invitation(current_setting('essai.ic'));
  if r <> 'invalide' then raise exception 'ECHEC (s18) : invitation expirée : %', r; end if;
  raise notice 'OK (s18) : invitation par code';
end $$;
reset role;
-- Sans identité (auth.uid() null) : invalide.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text;
begin
  r := public.game_redeem_guest_invitation(current_setting('essai.ib'));
  if r <> 'invalide' then raise exception 'ECHEC (s18) : sans identité : %', r; end if;
end $$;
reset role;

-- (s19) L'invité u3 lit la classe A, ses séances et ses seules observations partagées ; rien de la classe B.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int; t text;
begin
  select count(*) into n from public.game_classes;
  if n <> 1 then raise exception 'ECHEC (s19) : u3 voit % classes au lieu de 1', n; end if;
  select count(*) into n from public.game_sessions;
  if n <> 1 then raise exception 'ECHEC (s19) : u3 voit % séances au lieu de 1', n; end if;
  select count(*) into n from public.game_sessions where class_id = current_setting('essai.b')::uuid;
  if n <> 0 then raise exception 'ECHEC (s19) : u3 voit une séance de la classe B'; end if;
  select count(*) into n from public.game_observations;
  select min(texte) into t from public.game_observations;
  if n <> 1 or t <> 'partagée' then raise exception 'ECHEC (s19) : u3 voit % observation(s), « % »', n, t; end if;
  select count(*) into n from public.game_manual_results;
  if n <> 1 then raise exception 'ECHEC (s19) : u3 voit % résultat(s) saisi(s) au lieu de 1', n; end if;
  raise notice 'OK (s19) : lecture de l''invité bornée à sa classe et aux observations partagées';
end $$;

-- (s20) L'invité n'écrit, ne modifie et ne supprime rien.
do $$
declare ok boolean; n int;
begin
  ok := false; begin insert into public.game_observations (class_id, texte) values (current_setting('essai.a')::uuid, 'intrus'); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (s20) : insertion d''observation par l''invité'; end if;
  ok := false; begin insert into public.game_manual_results (class_id, student_code, cible, resultat) values (current_setting('essai.a')::uuid, 'E01', 'M.P4.1.1.i1.a1', 'reussi'); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (s20) : insertion de résultat par l''invité'; end if;
  -- Modifier ou supprimer : soit « permission refusée », soit 0 ligne touchée ; jamais une ligne modifiée.
  begin update public.game_observations set texte = 'modifié'; get diagnostics n = row_count;
    if n <> 0 then raise exception 'ECHEC (s20) : % observation(s) modifiée(s) par l''invité', n; end if;
  exception when insufficient_privilege then null; end;
  begin delete from public.game_observations; get diagnostics n = row_count;
    if n <> 0 then raise exception 'ECHEC (s20) : % observation(s) supprimée(s) par l''invité', n; end if;
  exception when insufficient_privilege then null; end;
  begin delete from public.game_manual_results; get diagnostics n = row_count;
    if n <> 0 then raise exception 'ECHEC (s20) : résultat supprimé par l''invité'; end if;
  exception when insufficient_privilege then null; end;
  begin delete from public.game_sessions; get diagnostics n = row_count;
    if n <> 0 then raise exception 'ECHEC (s20) : séance supprimée par l''invité'; end if;
  exception when insufficient_privilege then null; end;
  begin delete from public.game_classes; get diagnostics n = row_count;
    if n <> 0 then raise exception 'ECHEC (s20) : classe supprimée par l''invité'; end if;
  exception when insufficient_privilege then null; end;
  raise notice 'OK (s20) : l''invité est en lecture seule';
end $$;
reset role;

-- (s21) Révocation et expiration : la prochaine lecture renvoie 0 ligne. Un non-propriétaire ne révoque pas.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare ok boolean := false; g uuid;
begin
  select id into g from public.game_class_guests limit 1;
  if g is not null then raise exception 'ECHEC (s21) : u2 voit les invités de la classe de u1'; end if;
end $$;
reset role;
do $$
declare ok boolean := false; g uuid;
begin
  select id into g from public.game_class_guests where guest_user_id = '00000000-0000-4000-8000-000000000003' and class_id = current_setting('essai.a')::uuid;
  perform set_config('essai.g', g::text, true);
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare ok boolean := false;
begin
  begin perform public.game_revoke_guest(current_setting('essai.g')::uuid); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (s21) : un non-propriétaire a révoqué un invité'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.game_class_guests where class_id = current_setting('essai.a')::uuid;
  if n <> 1 then raise exception 'ECHEC (s21) : le propriétaire voit % invité(s) au lieu de 1', n; end if;
  perform public.game_revoke_guest(current_setting('essai.g')::uuid);
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.game_sessions;
  if n <> 0 then raise exception 'ECHEC (s21) : invité révoqué voit encore % séance(s)', n; end if;
  select count(*) into n from public.game_classes;
  if n <> 0 then raise exception 'ECHEC (s21) : invité révoqué voit encore % classe(s)', n; end if;
end $$;
reset role;
-- Expiration : u2 devient invité de A avec « ib », puis l'invitation est échue.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text; n int;
begin
  r := public.game_redeem_guest_invitation(current_setting('essai.ib'));
  if r <> 'ok' then raise exception 'ECHEC (s21) : u2 devrait pouvoir rejoindre A : %', r; end if;
  select count(*) into n from public.game_sessions where class_id = current_setting('essai.a')::uuid;
  if n <> 1 then raise exception 'ECHEC (s21) : u2 invité devrait voir 1 séance de A, voit %', n; end if;
end $$;
reset role;
update public.game_class_guests set expires_at = now() - interval '1 second'
  where guest_user_id = '00000000-0000-4000-8000-000000000002' and class_id = current_setting('essai.a')::uuid;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.game_sessions where class_id = current_setting('essai.a')::uuid;
  if n <> 0 then raise exception 'ECHEC (s21) : invité expiré voit encore % séance(s)', n; end if;
  raise notice 'OK (s21) : révocation et expiration';
end $$;
reset role;

-- (s22) Suppression d'une classe par son propriétaire : tout ce qui s'y rattache disparaît ; un autre enseignant n'y touche pas.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  delete from public.game_classes where id = current_setting('essai.a')::uuid; get diagnostics n = row_count;
  if n <> 0 then raise exception 'ECHEC (s22) : u2 a supprimé la classe de u1'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  delete from public.game_classes where id = current_setting('essai.a')::uuid; get diagnostics n = row_count;
  if n <> 1 then raise exception 'ECHEC (s22) : u1 n''a pas pu supprimer sa classe (%)', n; end if;
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.game_sessions where class_id = current_setting('essai.a')::uuid;
  if n <> 0 then raise exception 'ECHEC (s22) : séances restantes'; end if;
  select count(*) into n from public.game_observations where class_id = current_setting('essai.a')::uuid;
  if n <> 0 then raise exception 'ECHEC (s22) : observations restantes'; end if;
  select count(*) into n from public.game_manual_results where class_id = current_setting('essai.a')::uuid;
  if n <> 0 then raise exception 'ECHEC (s22) : résultats saisis restants'; end if;
  select count(*) into n from public.game_class_guests where class_id = current_setting('essai.a')::uuid;
  if n <> 0 then raise exception 'ECHEC (s22) : invités restants'; end if;
  select count(*) into n from public.game_guest_invitations where class_id = current_setting('essai.a')::uuid;
  if n <> 0 then raise exception 'ECHEC (s22) : invitations restantes'; end if;
  select count(*) into n from public.game_sessions where class_id = current_setting('essai.b')::uuid;
  if n <> 1 then raise exception 'ECHEC (s22) : la classe B a perdu des données'; end if;
  raise notice 'OK (s22) : suppression de classe en cascade';
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Suppression au 30 août : trois classes dont la date de suppression est la veille, le jour même, le lendemain.
-- ---------------------------------------------------------------------------------------------------------------
insert into public.game_activities (user_id, titre, niveau, matiere, brouillon)
  values ('00000000-0000-4000-8000-000000000001', 'Activité à conserver', 'P4', 'mathematiques', '{}');
insert into public.game_classes (id, user_id, label, nb_codes, class_code, purge_on) values
  ('c0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Veille', 5, 'PURGEAAA', current_date - 1),
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Jour même', 5, 'PURGEBBB', current_date),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Lendemain', 5, 'PURGECCC', current_date + 1);
insert into public.game_sessions (id, class_id, student_code, mechanic, profile, cibles, total_elements, ended_at, labels, results)
  select gen_random_uuid(), id, 'E01', 'trier', 'standard', array['M.P4.1.1.i1.a1'], 1, now(), '{}', '[]'
  from public.game_classes where class_code in ('PURGEAAA', 'PURGEBBB', 'PURGECCC');
insert into public.game_observations (class_id, texte)
  select id, 'obs' from public.game_classes where class_code in ('PURGEAAA', 'PURGEBBB', 'PURGECCC');
insert into public.game_manual_results (class_id, student_code, cible, resultat)
  select id, 'E01', 'M.P4.1.1.i1.a1', 'reussi' from public.game_classes where class_code in ('PURGEAAA', 'PURGEBBB', 'PURGECCC');
insert into public.game_class_guests (class_id, guest_user_id, expires_at)
  select id, '00000000-0000-4000-8000-000000000003', now() + interval '1 day' from public.game_classes where class_code in ('PURGEAAA', 'PURGEBBB', 'PURGECCC');
insert into public.game_guest_invitations (class_id, code_hash, expires_at)
  select id, encode(digest(class_code, 'sha256'), 'hex'), now() + interval '1 day' from public.game_classes where class_code in ('PURGEAAA', 'PURGEBBB', 'PURGECCC');

-- (s23) La purge supprime les deux premières et tout ce qui s'y rattache ; la troisième, les comptes et les activités restent.
do $$
declare avant int; n int; teachers_avant int; r int;
begin
  select count(*) into avant from public.game_classes where purge_on <= current_date;
  select count(*) into teachers_avant from public.game_teachers;
  r := public.game_purge_expired(current_date);
  if r <> avant then raise exception 'ECHEC (s23) : % classe(s) supprimée(s) au lieu de %', r, avant; end if;
  select count(*) into n from public.game_classes where class_code in ('PURGEAAA', 'PURGEBBB');
  if n <> 0 then raise exception 'ECHEC (s23) : classes échues non supprimées'; end if;
  select count(*) into n from public.game_classes where class_code = 'PURGECCC';
  if n <> 1 then raise exception 'ECHEC (s23) : la classe du lendemain a été supprimée'; end if;
  select count(*) into n from public.game_sessions where class_id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');
  if n <> 0 then raise exception 'ECHEC (s23) : séances restantes'; end if;
  select count(*) into n from public.game_observations where class_id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');
  if n <> 0 then raise exception 'ECHEC (s23) : observations restantes'; end if;
  select count(*) into n from public.game_manual_results where class_id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');
  if n <> 0 then raise exception 'ECHEC (s23) : résultats saisis restants'; end if;
  select count(*) into n from public.game_class_guests where class_id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');
  if n <> 0 then raise exception 'ECHEC (s23) : invités restants'; end if;
  select count(*) into n from public.game_guest_invitations where class_id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');
  if n <> 0 then raise exception 'ECHEC (s23) : invitations restantes'; end if;
  select count(*) into n from public.game_sessions where class_id = 'c0000000-0000-4000-8000-000000000003';
  if n <> 1 then raise exception 'ECHEC (s23) : les séances du lendemain ont disparu'; end if;
  select count(*) into n from public.game_teachers;
  if n <> teachers_avant then raise exception 'ECHEC (s23) : des comptes enseignants ont été touchés'; end if;
  select count(*) into n from public.game_activities where titre = 'Activité à conserver';
  if n <> 1 then raise exception 'ECHEC (s23) : une activité a été supprimée'; end if;
  raise notice 'OK (s23) : suppression au 30 août';
end $$;

-- (s24) Ni anon ni authenticated n'appellent la purge.
set local role authenticated;
do $$
declare ok boolean := false;
begin
  begin perform public.game_purge_expired(current_date + 4000); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (s24) : authenticated appelle la purge'; end if;
end $$;
reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  begin perform public.game_purge_expired(current_date + 4000); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (s24) : anon appelle la purge'; end if;
  raise notice 'OK (s24) : purge réservée à service_role';
end $$;
reset role;

-- (s25) Indicateur « above » (tour joué au niveau au-dessus du profil) : booléen facultatif, faux par défaut.
do $$
begin
  perform set_config('essai.ccb', (select class_code from public.game_classes where id = current_setting('essai.b')::uuid), true);
end $$;
set local role anon;
do $$
declare base jsonb := current_setting('essai.payload')::jsonb; v jsonb; r text;
begin
  v := jsonb_set(jsonb_set(base, '{sessionId}', '"66666666-6666-4666-8666-666666666661"'), '{above}', 'true');
  r := public.game_record_session(current_setting('essai.ccb'), 'E02', v);
  if r <> 'ok' then raise exception 'ECHEC (s25) : above vrai refusé : %', r; end if;
  v := jsonb_set(base, '{sessionId}', '"66666666-6666-4666-8666-666666666662"');
  r := public.game_record_session(current_setting('essai.ccb'), 'E02', v);
  if r <> 'ok' then raise exception 'ECHEC (s25) : sans above refusé : %', r; end if;
  v := jsonb_set(jsonb_set(base, '{sessionId}', '"66666666-6666-4666-8666-666666666663"'), '{above}', '"oui"');
  r := public.game_record_session(current_setting('essai.ccb'), 'E02', v);
  if r <> 'invalide' then raise exception 'ECHEC (s25) : above « oui » accepté : %', r; end if;
  v := jsonb_set(jsonb_set(base, '{sessionId}', '"66666666-6666-4666-8666-666666666664"'), '{above}', '1');
  r := public.game_record_session(current_setting('essai.ccb'), 'E02', v);
  if r <> 'invalide' then raise exception 'ECHEC (s25) : above 1 accepté : %', r; end if;
end $$;
reset role;
do $$
declare a boolean; b boolean; n int;
begin
  select above into a from public.game_sessions where id = '66666666-6666-4666-8666-666666666661';
  select above into b from public.game_sessions where id = '66666666-6666-4666-8666-666666666662';
  select count(*) into n from public.game_sessions where id in ('66666666-6666-4666-8666-666666666663', '66666666-6666-4666-8666-666666666664');
  if a is distinct from true then raise exception 'ECHEC (s25) : above vrai non enregistré'; end if;
  if b is distinct from false then raise exception 'ECHEC (s25) : above absent devrait valoir faux'; end if;
  if n <> 0 then raise exception 'ECHEC (s25) : une séance au above invalide a été écrite'; end if;
  raise notice 'OK (s25) : indicateur above';
end $$;

rollback;
