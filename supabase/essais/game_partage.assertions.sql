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
