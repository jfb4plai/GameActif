-- GameActif : ESSAI des migrations game_acces, game_suivi et game_partage dans une transaction ANNULÉE (rien n'est conservé).
-- Fichier généré par scripts/build-essai-sql.mjs : ne pas le modifier à la main.
-- À lancer UNIQUEMENT après l'accord explicite de l'administrateur :
--   npx --no-install supabase db query --remote=<projet> --yes -f supabase/essai-rollback-game_partage.sql
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

-- GameActif : activité partagée par lien et QR, profils par code élève. NON APPLIQUÉE : l'application sur la base partagée
-- exige l'accord explicite de JF, l'avis du DPO (docs/confidentialite/dossier-dpo-suivi.md) et un essai préalable dans une
-- transaction annulée. Dépend de 20261103_game_acces.sql (game_touch_updated_at) et de 20261107_game_suivi.sql (game_classes).
--
-- Spec : docs/superpowers/specs/2026-11-06-activite-partagee-design.md. Plan : plans/2026-11-06-gameactif-plan-9-activite-partagee.md.
-- Le contexte de classe de l'enseignant n'est jamais stocké : il est remplacé par un texte fixe à la publication.
-- Aucun prénom. anon ne lit aucune table : il n'appelle que game_get_shared_activity et game_profile_for.

-- ---------------------------------------------------------------------------------------------------------------
-- Activités partagées (une ligne par lien), rattachées à une classe : supprimées avec elle
-- ---------------------------------------------------------------------------------------------------------------

create table public.game_shared_activities (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.game_classes (id) on delete cascade,
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$'),
  titre text not null check (char_length(btrim(titre)) between 1 and 200),
  brouillon jsonb not null check (jsonb_typeof(brouillon) = 'object' and octet_length(brouillon::text) <= 200000),
  mode text not null check (mode in ('meme', 'groupes', 'par-code')),
  profil_defaut text not null check (profil_defaut in ('soutien', 'standard', 'defi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_shared_activities_class_idx on public.game_shared_activities (class_id, updated_at desc);

create trigger game_shared_activities_touch before update on public.game_shared_activities
  for each row execute function public.game_touch_updated_at();

-- ---------------------------------------------------------------------------------------------------------------
-- Profil par code élève (mode « par code ») : décision de l'enseignant, supprimée avec la classe
-- ---------------------------------------------------------------------------------------------------------------

create table public.game_class_profiles (
  class_id uuid not null references public.game_classes (id) on delete cascade,
  student_code text not null check (student_code ~ '^E[0-9]{2}$'),
  profile text not null check (profile in ('soutien', 'standard', 'defi')),
  primary key (class_id, student_code)
);

alter table public.game_shared_activities enable row level security;
alter table public.game_class_profiles enable row level security;

revoke all on table public.game_shared_activities from anon, authenticated;
revoke all on table public.game_class_profiles from anon, authenticated;
grant all on table public.game_shared_activities to service_role;
grant all on table public.game_class_profiles to service_role;

-- Les activités partagées s'écrivent par fonction seulement ; le propriétaire les lit (liste, retrait).
grant select on table public.game_shared_activities to authenticated;
grant select, insert, update, delete on table public.game_class_profiles to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Fonctions
-- ---------------------------------------------------------------------------------------------------------------

-- Publier (p_code nul) ou republier (p_code d'une activité de cette classe) : propriétaire de la classe seulement.
-- Au plus 20 activités par classe. Le contexte est remplacé ici, côté serveur : on ne fait pas confiance au navigateur.
create function public.game_publish_activity(p_class_id uuid, p_code text, p_brouillon jsonb, p_mode text, p_profil text) returns text
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  v_titre text;
  v_brouillon jsonb;
  i int;
begin
  if not exists (select 1 from public.game_classes where id = p_class_id and user_id = auth.uid()) then
    raise exception 'Classe introuvable.';
  end if;
  if p_mode is null or p_mode not in ('meme', 'groupes', 'par-code') then
    raise exception 'Mode invalide.';
  end if;
  if p_profil is null or p_profil not in ('soutien', 'standard', 'defi') then
    raise exception 'Profil invalide.';
  end if;
  if p_brouillon is null or jsonb_typeof(p_brouillon) is distinct from 'object' then
    raise exception 'Activité invalide.';
  end if;
  v_titre := btrim(coalesce(p_brouillon ->> 'titre', ''));
  if v_titre = '' or char_length(v_titre) > 200 then
    raise exception 'Titre invalide (1 à 200 caractères).';
  end if;
  v_brouillon := jsonb_set(p_brouillon, '{contexte}', to_jsonb('Activité partagée à la classe'::text));
  if octet_length(v_brouillon::text) > 200000 then
    raise exception 'Activité trop volumineuse.';
  end if;

  if p_code is null then
    if (select count(*) from public.game_shared_activities where class_id = p_class_id) >= 20 then
      raise exception 'Vingt activités partagées au plus par classe.';
    end if;
    loop
      v_bytes := gen_random_bytes(8);
      v_code := '';
      for i in 0..7 loop
        v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
      end loop;
      begin
        insert into public.game_shared_activities (class_id, code, titre, brouillon, mode, profil_defaut)
          values (p_class_id, v_code, v_titre, v_brouillon, p_mode, p_profil);
        exit;
      exception when unique_violation then
        -- Collision de code : un autre tirage.
        null;
      end;
    end loop;
  else
    update public.game_shared_activities
      set titre = v_titre, brouillon = v_brouillon, mode = p_mode, profil_defaut = p_profil
      where code = p_code and class_id = p_class_id
      returning code into v_code;
    if v_code is null then
      raise exception 'Activité introuvable.';
    end if;
  end if;
  return v_code;
end;
$$;

revoke all on function public.game_publish_activity(uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.game_publish_activity(uuid, text, jsonb, text, text) to authenticated, service_role;

-- Retirer le lien : propriétaire de la classe seulement.
create function public.game_unpublish_activity(p_code text) returns void
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_id uuid;
begin
  select a.id into v_id
    from public.game_shared_activities a join public.game_classes c on c.id = a.class_id
    where a.code = p_code and c.user_id = auth.uid() -- verif-proprietaire-retrait
  ;
  if v_id is null then
    raise exception 'Activité introuvable.';
  end if;
  delete from public.game_shared_activities where id = v_id;
end;
$$;

revoke all on function public.game_unpublish_activity(text) from public, anon, authenticated;
grant execute on function public.game_unpublish_activity(text) to authenticated, service_role;

-- Lire une activité par son code (anon). null : code inconnu, mal formé, retiré ou classe échue.
-- Renvoie aussi le code de classe et le nombre de codes : la tablette s'associe à la classe toute seule.
create function public.game_get_shared_activity(p_code text) returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
  select jsonb_build_object(
    'titre', a.titre, 'brouillon', a.brouillon, 'mode', a.mode, 'profilDefaut', a.profil_defaut,
    'classCode', c.class_code, 'nbCodes', c.nb_codes
  )
  from public.game_shared_activities a join public.game_classes c on c.id = a.class_id
  where a.code = p_code and c.purge_on >= current_date;
$$;

revoke all on function public.game_get_shared_activity(text) from public, anon, authenticated;
grant execute on function public.game_get_shared_activity(text) to anon, authenticated, service_role;

-- Profil d'un code élève (anon) : le profil assigné par l'enseignant, sinon « standard ». null : classe inconnue ou
-- échue, code mal formé ou hors liste. Discret, pas secret : quiconque connaît le code de classe peut essayer d'autres codes.
create function public.game_profile_for(p_class_code text, p_student_code text) returns text
language sql
stable
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
  select coalesce(p.profile, 'standard')
  from public.game_classes c
  left join public.game_class_profiles p on p.class_id = c.id and p.student_code = p_student_code
  where c.class_code = p_class_code and c.purge_on >= current_date
    and p_student_code ~ '^E[0-9]{2}$'
    and (case when p_student_code ~ '^E[0-9]{2}$' then substr(p_student_code, 2)::int else 0 end) between 1 and c.nb_codes;
$$;

revoke all on function public.game_profile_for(text, text) from public, anon, authenticated;
grant execute on function public.game_profile_for(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Règles par ligne
-- ---------------------------------------------------------------------------------------------------------------

create policy game_shared_activities_select on public.game_shared_activities
  for select to authenticated
  using (public.game_owns_class(class_id));

create policy game_class_profiles_select on public.game_class_profiles
  for select to authenticated
  using (public.game_owns_class(class_id));

create policy game_class_profiles_insert on public.game_class_profiles
  for insert to authenticated
  with check (public.game_owns_class(class_id));

create policy game_class_profiles_update on public.game_class_profiles
  for update to authenticated
  using (public.game_owns_class(class_id))
  with check (public.game_owns_class(class_id));

create policy game_class_profiles_delete on public.game_class_profiles
  for delete to authenticated
  using (public.game_owns_class(class_id));

-- GameActif : essais de la migration 20261108_game_partage. À exécuter APRÈS 20261103, 20261107 et 20261108, dans une
-- transaction annulée. Chaque bloc lève « ECHEC (x) » si un contrôle échoue ; un NOTICE « OK (x) » sinon.
-- Identités : u1 et u2 sont enseignants, u3 n'a aucun accès.
--   u1 = 00000000-0000-4000-8000-000000000001   u2 = ...0002   u3 = ...0003

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');
insert into public.game_teachers (user_id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

-- Classe A (u1, 24 codes) et classe B (u2, 10 codes).
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_id uuid; v_code text;
begin
  select c.id, c.class_code into v_id, v_code from public.game_create_class('Classe A', 24) c;
  perform set_config('essai.a', v_id::text, true);
  perform set_config('essai.acode', v_code, true);
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

-- Brouillon d'essai : le contexte contient un prénom, qui ne doit jamais arriver dans la base.
select set_config('essai.brouillon', '{"niveau":"P4","matiere":"mathematiques","cibles":["M.P4.1.1.i1.a1"],"titre":"Les positions","contexte":"Classe de Léa, 24 élèves","familles":[],"paires":"","etapes":"","comparaisons":"","qcm":""}', true);

-- (p1) Le propriétaire publie ; un autre enseignant et un compte sans accès n'y arrivent pas.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_code text;
begin
  v_code := public.game_publish_activity(current_setting('essai.a')::uuid, null, current_setting('essai.brouillon')::jsonb, 'meme', 'standard');
  if v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$' then raise exception 'ECHEC (p1) : forme du code : %', v_code; end if;
  perform set_config('essai.pcode', v_code, true);
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare ok boolean := false;
begin
  begin perform public.game_publish_activity(current_setting('essai.a')::uuid, null, current_setting('essai.brouillon')::jsonb, 'meme', 'standard'); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (p1) : un autre enseignant a publié dans la classe de u1'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare ok boolean := false;
begin
  begin perform public.game_publish_activity(current_setting('essai.a')::uuid, null, current_setting('essai.brouillon')::jsonb, 'meme', 'standard'); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (p1) : un compte sans accès a publié'; end if;
  raise notice 'OK (p1) : publication réservée au propriétaire';
end $$;
reset role;

-- (p2) Lecture par anon : le contexte est le texte fixe, la classe est donnée ; aucun prénom dans les tables.
set local role anon;
do $$
declare r jsonb;
begin
  r := public.game_get_shared_activity(current_setting('essai.pcode'));
  if r is null then raise exception 'ECHEC (p2) : activité introuvable'; end if;
  if r -> 'brouillon' ->> 'contexte' <> 'Activité partagée à la classe' then raise exception 'ECHEC (p2) : contexte renvoyé : %', r -> 'brouillon' ->> 'contexte'; end if;
  if r ->> 'titre' <> 'Les positions' or r ->> 'mode' <> 'meme' or r ->> 'profilDefaut' <> 'standard' then raise exception 'ECHEC (p2) : champs renvoyés : %', r; end if;
  if r ->> 'classCode' <> current_setting('essai.acode') or (r ->> 'nbCodes')::int <> 24 then raise exception 'ECHEC (p2) : classe renvoyée : %', r; end if;
  raise notice 'OK (p2) : lecture par anon, contexte remplacé';
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.game_shared_activities where brouillon::text like '%Léa%' or titre like '%Léa%';
  if n <> 0 then raise exception 'ECHEC (p2) : un prénom est stocké dans game_shared_activities'; end if;
end $$;

-- (p3) Republier garde le code et met à jour ; au plus 20 activités par classe.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_code text; v_titre text; ok boolean := false; i int;
begin
  v_code := public.game_publish_activity(current_setting('essai.a')::uuid, current_setting('essai.pcode'), jsonb_set(current_setting('essai.brouillon')::jsonb, '{titre}', '"Les positions 2"'), 'groupes', 'soutien');
  if v_code <> current_setting('essai.pcode') then raise exception 'ECHEC (p3) : le code a changé : %', v_code; end if;
  select titre into v_titre from public.game_shared_activities where code = v_code;
  if v_titre <> 'Les positions 2' then raise exception 'ECHEC (p3) : titre non mis à jour : %', v_titre; end if;
  for i in 2..20 loop
    perform public.game_publish_activity(current_setting('essai.a')::uuid, null, current_setting('essai.brouillon')::jsonb, 'meme', 'standard');
  end loop;
  begin perform public.game_publish_activity(current_setting('essai.a')::uuid, null, current_setting('essai.brouillon')::jsonb, 'meme', 'standard'); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (p3) : la 21e activité a été acceptée'; end if;
  -- Republier une des 20 reste possible.
  perform public.game_publish_activity(current_setting('essai.a')::uuid, current_setting('essai.pcode'), current_setting('essai.brouillon')::jsonb, 'meme', 'defi');
  raise notice 'OK (p3) : republier et plafond de 20';
end $$;

-- (p4) Entrées refusées.
do $$
declare ok boolean; cas jsonb[]; i int; b jsonb := current_setting('essai.brouillon')::jsonb;
begin
  cas := array['[]'::jsonb, b - 'titre', jsonb_set(b, '{titre}', '""'), jsonb_build_object('titre', 't', 'pad', repeat('a', 200001))];
  for i in 1..array_length(cas, 1) loop
    ok := false;
    begin perform public.game_publish_activity(current_setting('essai.b')::uuid, null, cas[i], 'meme', 'standard'); exception when others then ok := true; end;
    if not ok then raise exception 'ECHEC (p4) : brouillon refusé attendu, cas %', i; end if;
  end loop;
  raise notice 'OK (p4) : entrées invalides refusées (brouillon)';
end $$;
reset role;
-- Les refus de mode et de profil se jouent dans la classe de u2, propriétaire de B.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare ok boolean;
begin
  ok := false; begin perform public.game_publish_activity(current_setting('essai.b')::uuid, null, current_setting('essai.brouillon')::jsonb, 'x', 'standard'); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (p4) : mode « x » accepté'; end if;
  ok := false; begin perform public.game_publish_activity(current_setting('essai.b')::uuid, null, current_setting('essai.brouillon')::jsonb, 'meme', 'x'); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (p4) : profil « x » accepté'; end if;
  perform set_config('essai.pcodeb', public.game_publish_activity(current_setting('essai.b')::uuid, null, current_setting('essai.brouillon')::jsonb, 'par-code', 'standard'), true);
end $$;
reset role;

-- (p6) Retirer : réservé au propriétaire (u2 ne retire pas l'activité de u1).
set local role authenticated;
do $$
declare ok boolean := false;
begin
  begin perform public.game_unpublish_activity(current_setting('essai.pcode')); exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC (p6) : un non-propriétaire a retiré une activité'; end if;
  raise notice 'OK (p6) : retrait réservé au propriétaire';
end $$;
reset role;

-- (p5) Lecture : null pour un code inconnu, mal formé, retiré, ou d'une classe échue ; anon ne lit aucune table.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.game_unpublish_activity(current_setting('essai.pcode'));
end $$;
reset role;
update public.game_classes set purge_on = current_date - 1 where id = current_setting('essai.b')::uuid;
set local role anon;
do $$
declare ok boolean := false; ok2 boolean := false; n int;
begin
  if public.game_get_shared_activity('AAAAAAAA') is not null then raise exception 'ECHEC (p5) : code inconnu servi'; end if;
  if public.game_get_shared_activity('abc') is not null then raise exception 'ECHEC (p5) : code mal formé servi'; end if;
  if public.game_get_shared_activity(current_setting('essai.pcode')) is not null then raise exception 'ECHEC (p5) : activité retirée servie'; end if;
  if public.game_get_shared_activity(current_setting('essai.pcodeb')) is not null then raise exception 'ECHEC (p5) : activité d''une classe échue servie'; end if;
  begin select count(*) into n from public.game_shared_activities; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (p5) : anon lit game_shared_activities'; end if;
  begin select count(*) into n from public.game_class_profiles; exception when insufficient_privilege then ok2 := true; end;
  if not ok2 then raise exception 'ECHEC (p5) : anon lit game_class_profiles'; end if;
  raise notice 'OK (p5) : lecture bornée';
end $$;
reset role;

-- (p7) Profils par code : le propriétaire gère, la fonction de lecture donne un défaut, un autre enseignant ne voit rien.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  insert into public.game_class_profiles (class_id, student_code, profile) values (current_setting('essai.a')::uuid, 'E07', 'soutien');
  update public.game_class_profiles set profile = 'defi' where class_id = current_setting('essai.a')::uuid and student_code = 'E07';
  select count(*) into n from public.game_class_profiles where profile = 'defi';
  if n <> 1 then raise exception 'ECHEC (p7) : modification de profil'; end if;
  update public.game_class_profiles set profile = 'soutien' where class_id = current_setting('essai.a')::uuid and student_code = 'E07';
end $$;
reset role;
set local role anon;
do $$
begin
  if public.game_profile_for(current_setting('essai.acode'), 'E07') is distinct from 'soutien' then raise exception 'ECHEC (p7) : profil assigné non servi'; end if;
  if public.game_profile_for(current_setting('essai.acode'), 'E08') is distinct from 'standard' then raise exception 'ECHEC (p7) : défaut standard absent'; end if;
  if public.game_profile_for('AAAAAAAA', 'E07') is not null then raise exception 'ECHEC (p7) : classe inconnue servie'; end if;
  if public.game_profile_for(current_setting('essai.acode'), 'Léa') is not null then raise exception 'ECHEC (p7) : code mal formé servi'; end if;
  if public.game_profile_for(current_setting('essai.acode'), 'E25') is not null then raise exception 'ECHEC (p7) : code hors liste servi'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int; ok boolean := false;
begin
  select count(*) into n from public.game_class_profiles;
  if n <> 0 then raise exception 'ECHEC (p7) : u2 voit % profil(s) de la classe de u1', n; end if;
  begin insert into public.game_class_profiles (class_id, student_code, profile) values (current_setting('essai.a')::uuid, 'E09', 'defi'); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (p7) : u2 a écrit un profil dans la classe de u1'; end if;
  raise notice 'OK (p7) : profils par code';
end $$;
reset role;

-- (p8) Supprimer une classe supprime ses activités partagées et ses profils.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  delete from public.game_classes where id = current_setting('essai.a')::uuid; get diagnostics n = row_count;
  if n <> 1 then raise exception 'ECHEC (p8) : classe non supprimée'; end if;
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.game_shared_activities where class_id = current_setting('essai.a')::uuid;
  if n <> 0 then raise exception 'ECHEC (p8) : activités partagées restantes'; end if;
  select count(*) into n from public.game_class_profiles where class_id = current_setting('essai.a')::uuid;
  if n <> 0 then raise exception 'ECHEC (p8) : profils restants'; end if;
  raise notice 'OK (p8) : suppression de classe en cascade';
end $$;

-- (p9) La purge du 30 août emporte aussi les activités partagées et les profils des classes échues.
insert into public.game_classes (id, user_id, label, nb_codes, class_code, purge_on)
  values ('d0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Échue', 5, 'PURGEDDD', current_date - 1);
insert into public.game_shared_activities (class_id, code, titre, brouillon, mode, profil_defaut)
  values ('d0000000-0000-4000-8000-000000000001', 'SHAREDDD', 'x', '{"titre":"x"}', 'meme', 'standard');
insert into public.game_class_profiles (class_id, student_code, profile) values ('d0000000-0000-4000-8000-000000000001', 'E01', 'defi');
do $$
declare n int;
begin
  perform public.game_purge_expired(current_date);
  select count(*) into n from public.game_shared_activities where class_id = 'd0000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'ECHEC (p9) : activités partagées restantes après la purge'; end if;
  select count(*) into n from public.game_class_profiles where class_id = 'd0000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'ECHEC (p9) : profils restants après la purge'; end if;
  raise notice 'OK (p9) : purge des activités partagées et des profils';
end $$;

rollback;
