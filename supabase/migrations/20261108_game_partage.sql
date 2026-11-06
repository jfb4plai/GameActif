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
