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
