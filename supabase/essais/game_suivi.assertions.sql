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
