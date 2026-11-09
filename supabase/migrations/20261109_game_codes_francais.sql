-- ---------------------------------------------------------------------------------------------------------------
-- GameActif : codes d'attendus du français. APPLIQUÉE le 2026-11-09 sur la base partagée, avec l'accord explicite de JF,
-- après un essai dans une transaction annulée (supabase/essai-rollback-game_francais.sql).
-- Dépend de 20261103, 20261107 et 20261108 (déjà appliquées). Plan : plans/2026-11-09-gameactif-plan-11-francais.md.
--
-- Les codes de maths valent M.P4.1.1.i1.a1 ; ceux du français valent F.P3.r1.i1.a1 (rubrique, item, attendu, par rang).
-- La migration 20261107 n'acceptait que « M. » : on remplace l'expression régulière des cibles à deux endroits
-- (game_record_session, qui reprend à l'identique la fonction de 20261107, et la contrainte de game_manual_results).
-- Rien d'autre ne change : mêmes droits, mêmes limites, aucun prénom.
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.game_record_session(p_class_code text, p_student_code text, p_payload jsonb) returns text
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
      if jsonb_typeof(c) is distinct from 'string' or (c #>> '{}') !~ '^[MF]\.P[1-6](\.[A-Za-z0-9]+)+$' then
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

-- La contrainte de la colonne a été créée sans nom : Postgres l'a nommée game_manual_results_cible_check.
alter table public.game_manual_results drop constraint game_manual_results_cible_check;
alter table public.game_manual_results add constraint game_manual_results_cible_check
  check (cible ~ '^[MF]\.P[1-6](\.[A-Za-z0-9]+)+$');
