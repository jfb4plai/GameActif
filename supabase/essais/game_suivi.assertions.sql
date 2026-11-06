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
