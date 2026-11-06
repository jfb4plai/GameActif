-- GameActif : suivi des élèves par code pseudonyme. APPLIQUÉE le 2026-11-06 sur la base partagée, avec l'accord
-- explicite de JF, après l'avis du DPO (docs/confidentialite/dossier-dpo-suivi.md) et un essai dans une transaction
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
