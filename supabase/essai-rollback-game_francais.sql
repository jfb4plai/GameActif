-- GameActif : ESSAI de la migration game_codes_francais dans une transaction ANNULÉE (rien n'est conservé).
-- Fichier généré par scripts/build-essai-sql.mjs : ne pas le modifier à la main.
-- Suppose game_acces, game_suivi et game_partage déjà appliquées (c'est le cas en production depuis le 2026-11-06).
-- À lancer UNIQUEMENT après l'accord explicite de l'administrateur :
--   npx --no-install supabase db query --remote=<projet> --yes -f supabase/essai-rollback-game_francais.sql
-- Succès : la commande se termine sans erreur et rien n'est conservé (la transaction est annulée). Échec : une erreur
-- « ECHEC (x) » ou SQL, et rien n'est conservé non plus.
begin;
set local lock_timeout = '3s';
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

-- GameActif : essais de la migration 20261109_game_codes_francais. À exécuter APRÈS 20261103, 20261107 et 20261108,
-- dans une transaction annulée. Chaque bloc lève « ECHEC (x) » si un contrôle échoue ; un NOTICE « OK (x) » sinon.
-- Identité : u1 est enseignant (00000000-0000-4000-8000-000000000001).

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001');
insert into public.game_teachers (user_id) values ('00000000-0000-4000-8000-000000000001');

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

-- (f4) L'enseignant propriétaire enregistre un résultat saisi sur un attendu de français ; (f5) un code d'une autre forme est refusé.
do $$
declare ok boolean;
begin
  insert into public.game_manual_results (class_id, student_code, cible, resultat) values (current_setting('essai.cid')::uuid, 'E04', 'F.P3.r1.i1.a1', 'reussi');
  raise notice 'OK (f4) : résultat saisi sur un attendu de français accepté';
  ok := false; begin insert into public.game_manual_results (class_id, student_code, cible, resultat) values (current_setting('essai.cid')::uuid, 'E04', 'X.P3.r1', 'reussi'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC (f5) : code X.P3.r1 accepté en résultat saisi'; end if;
  ok := false; begin insert into public.game_manual_results (class_id, student_code, cible, resultat) values (current_setting('essai.cid')::uuid, 'E04', 'F.P7.r1', 'reussi'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC (f5) : code F.P7.r1 accepté en résultat saisi'; end if;
  insert into public.game_manual_results (class_id, student_code, cible, resultat) values (current_setting('essai.cid')::uuid, 'E04', 'M.P4.1.1.i1.a1', 'reussi');
  raise notice 'OK (f5) : codes d''une autre forme refusés, code de maths encore accepté';
end $$;
reset role;

-- (f1) Une séance dont la cible est un attendu de français est acceptée ; (f2) un attendu de maths l'est encore ;
-- (f3) un code d'une autre forme, un niveau hors P1 à P6, ou un mélange avec un mauvais code sont refusés.
set local role anon;
do $$
declare r text; base text;
begin
  base := '{"sessionId":"SID","mechanic":"trier","profile":"standard","cibles":CIBLES,"totalElements":2,"endedAt":"2026-11-12T10:00:00Z","labels":{"devant":"devant","derriere":"derrière"},"results":[{"elementId":"e1","correct":"devant","firstTry":false,"tries":2,"hintUsed":false,"revealed":false,"wrongChoices":["derriere"]},{"elementId":"e2","correct":"derriere","firstTry":true,"tries":1,"hintUsed":false,"revealed":false,"wrongChoices":[]}]}';
  r := public.game_record_session(current_setting('essai.cc'), 'E07', replace(replace(base, 'SID', '21111111-1111-4111-8111-111111111111'), 'CIBLES', '["F.P3.r1.i1.a1"]')::jsonb);
  if r <> 'ok' then raise exception 'ECHEC (f1) : attendu ok pour un attendu de français, obtenu %', r; end if;
  raise notice 'OK (f1) : séance sur un attendu de français acceptée';
  r := public.game_record_session(current_setting('essai.cc'), 'E07', replace(replace(base, 'SID', '31111111-1111-4111-8111-111111111111'), 'CIBLES', '["M.P4.1.1.i1.a1"]')::jsonb);
  if r <> 'ok' then raise exception 'ECHEC (f2) : attendu ok pour un attendu de maths, obtenu %', r; end if;
  raise notice 'OK (f2) : séance sur un attendu de maths encore acceptée';
  r := public.game_record_session(current_setting('essai.cc'), 'E07', replace(replace(base, 'SID', '41111111-1111-4111-8111-111111111111'), 'CIBLES', '["X.P3.r1"]')::jsonb);
  if r <> 'invalide' then raise exception 'ECHEC (f3) : code X.P3.r1 accepté, obtenu %', r; end if;
  r := public.game_record_session(current_setting('essai.cc'), 'E07', replace(replace(base, 'SID', '51111111-1111-4111-8111-111111111111'), 'CIBLES', '["F.P7.r1"]')::jsonb);
  if r <> 'invalide' then raise exception 'ECHEC (f3) : niveau P7 accepté, obtenu %', r; end if;
  r := public.game_record_session(current_setting('essai.cc'), 'E07', replace(replace(base, 'SID', '61111111-1111-4111-8111-111111111111'), 'CIBLES', '["F.P3.r1.i1.a1","Z.P3.r1"]')::jsonb);
  if r <> 'invalide' then raise exception 'ECHEC (f3) : un mauvais code parmi de bons est accepté, obtenu %', r; end if;
  raise notice 'OK (f3) : codes d''une autre forme refusés';
end $$;

-- (f6) Les droits sont inchangés : anon a pu exécuter game_record_session (ci-dessus) mais ne lit pas les séances.
do $$
declare ok boolean := false;
begin
  begin perform count(*) from public.game_sessions; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC (f6) : anon peut lire game_sessions'; end if;
  raise notice 'OK (f6) : anon écrit par la fonction seulement, ne lit pas les séances';
end $$;
reset role;

rollback;
