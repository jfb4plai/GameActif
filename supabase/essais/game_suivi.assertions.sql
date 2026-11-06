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
