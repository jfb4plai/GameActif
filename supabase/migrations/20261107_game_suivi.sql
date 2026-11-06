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

create policy game_classes_select on public.game_classes
  for select to authenticated
  using (user_id = (select auth.uid()));
