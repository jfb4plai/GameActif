-- GameActif : essais de la migration 20261103_game_acces. À exécuter APRÈS la migration, dans une transaction annulée.
-- Chaque bloc lève une exception « ECHEC (x) » si un contrôle échoue ; un NOTICE « OK (x) » sinon.
-- Identités simulées : u1, u2, u3 (enseignants ou non selon l'essai), u4 (jamais d'accès).
--   u1 = 00000000-0000-4000-8000-000000000001   u2 = ...0002   u3 = ...0003   u4 = ...0004

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000004');

-- Codes d'essai : A (2 places), B (expiré), C (révoqué), D (épuisé).
select set_config('essai.code_a', public.game_create_invitation(2, 30), true);
select set_config('essai.code_b', public.game_create_invitation(5, 30), true);
select set_config('essai.code_c', public.game_create_invitation(5, 30), true);
select set_config('essai.code_d', public.game_create_invitation(1, 30), true);
update public.game_invitations set expires_at = now() - interval '1 day'
  where code_hash = encode(digest(current_setting('essai.code_b'), 'sha256'), 'hex');
update public.game_invitations set revoked_at = now()
  where code_hash = encode(digest(current_setting('essai.code_c'), 'sha256'), 'hex');
update public.game_invitations set uses = 1
  where code_hash = encode(digest(current_setting('essai.code_d'), 'sha256'), 'hex');

-- (i) Le code en clair n'est dans aucune colonne ; l'empreinte fait 64 caractères hexadécimaux.
do $$
declare n int;
begin
  select count(*) into n from public.game_invitations
    where code_hash in (current_setting('essai.code_a'), current_setting('essai.code_b'), current_setting('essai.code_c'), current_setting('essai.code_d'));
  if n <> 0 then raise exception 'ECHEC (i) : un code en clair est stocké'; end if;
  select count(*) into n from public.game_invitations where code_hash !~ '^[0-9a-f]{64}$';
  if n <> 0 then raise exception 'ECHEC (i) : une empreinte n''a pas la forme attendue'; end if;
  if current_setting('essai.code_a') !~ '^[A-Za-z0-9_-]{32}$' then raise exception 'ECHEC (i) : forme du code'; end if;
  raise notice 'OK (i) : seules les empreintes sont stockées';
end $$;

-- (a) u1 utilise le code A : ok, une place consommée, ligne game_teachers créée.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text;
begin
  r := public.game_redeem_invitation(current_setting('essai.code_a'));
  if r <> 'ok' then raise exception 'ECHEC (a) : attendu ok, obtenu %', r; end if;
  if not public.game_is_teacher() then raise exception 'ECHEC (a) : u1 devrait être enseignant'; end if;
  raise notice 'OK (a) : code valide accepté';
end $$;

-- (b) u1 réutilise le même code : « deja », aucune place de plus.
do $$
declare r text;
begin
  r := public.game_redeem_invitation(current_setting('essai.code_a'));
  if r <> 'deja' then raise exception 'ECHEC (b) : attendu deja, obtenu %', r; end if;
  raise notice 'OK (b) : le même compte ne consomme qu''une place';
end $$;
reset role;
do $$
declare n int;
begin
  select uses into n from public.game_invitations where code_hash = encode(digest(current_setting('essai.code_a'), 'sha256'), 'hex');
  if n <> 1 then raise exception 'ECHEC (b) : uses = % au lieu de 1', n; end if;
end $$;

-- (c) Codes invalides pour u4 : inconnu, expiré, révoqué, épuisé, trop court, nul. Rien ne change.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text; c text;
begin
  foreach c in array array[repeat('Z', 32), current_setting('essai.code_b'), current_setting('essai.code_c'), current_setting('essai.code_d'), 'court', ''] loop
    r := public.game_redeem_invitation(c);
    if r <> 'invalide' then raise exception 'ECHEC (c) : le code % devrait être invalide, obtenu %', left(c, 4), r; end if;
  end loop;
  r := public.game_redeem_invitation(null);
  if r <> 'invalide' then raise exception 'ECHEC (c) : un code nul devrait être invalide'; end if;
  if public.game_is_teacher() then raise exception 'ECHEC (c) : u4 ne devrait pas être enseignant'; end if;
  raise notice 'OK (c) : codes invalides refusés';
end $$;
reset role;
do $$
declare n int; total int;
begin
  select count(*) into n from public.game_teachers where user_id = '00000000-0000-4000-8000-000000000004';
  if n <> 0 then raise exception 'ECHEC (c) : une ligne game_teachers a été créée pour u4'; end if;
  select coalesce(sum(uses), 0) into total from public.game_invitations;
  if total <> 2 then raise exception 'ECHEC (c) : total des places consommées = % au lieu de 2 (A:1, D:1)', total; end if;
end $$;

-- (c2) Le code A a 2 places : u2 prend la deuxième, u3 est refusé (épuisé), jamais plus de places que prévu.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text;
begin
  r := public.game_redeem_invitation(current_setting('essai.code_a'));
  if r <> 'ok' then raise exception 'ECHEC (c2) : u2 devrait obtenir la deuxième place, obtenu %', r; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r text;
begin
  r := public.game_redeem_invitation(current_setting('essai.code_a'));
  if r <> 'invalide' then raise exception 'ECHEC (c2) : u3 devrait être refusé (code épuisé), obtenu %', r; end if;
  if public.game_is_teacher() then raise exception 'ECHEC (c2) : u3 ne devrait pas être enseignant'; end if;
  raise notice 'OK (c2) : un code à 2 places n''en donne jamais 3';
end $$;
reset role;

-- (d) u3 (sans accès) : ne peut ni insérer, ni lire dans game_activities.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare refuse boolean := false;
begin
  begin
    insert into public.game_activities (user_id, titre, niveau, matiere, brouillon)
      values ('00000000-0000-4000-8000-000000000003', 'Essai', 'P4', 'mathematiques', '{}'::jsonb);
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (d) : un compte sans accès a pu insérer une activité'; end if;
  raise notice 'OK (d) : compte sans accès refusé à l''insertion';
end $$;
reset role;

-- (e) u1 insère ; u2 (enseignant aussi) ne voit, ne modifie, ne supprime rien ; u1 ne peut pas écrire au nom de u2.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int; refuse boolean := false;
begin
  insert into public.game_activities (id, user_id, titre, niveau, matiere, brouillon)
    values ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'Activité de u1', 'P4', 'mathematiques', '{"titre":"x"}'::jsonb);
  select count(*) into n from public.game_activities;
  if n <> 1 then raise exception 'ECHEC (e) : u1 devrait voir 1 activité, en voit %', n; end if;
  begin
    insert into public.game_activities (user_id, titre, niveau, matiere, brouillon)
      values ('00000000-0000-4000-8000-000000000002', 'Au nom de u2', 'P4', 'mathematiques', '{}'::jsonb);
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (e) : u1 a pu écrire au nom de u2'; end if;
  raise notice 'OK (e) : u1 écrit pour lui seul';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.game_activities;
  if n <> 0 then raise exception 'ECHEC (e) : u2 voit % activité(s) de u1', n; end if;
  update public.game_activities set titre = 'Piratée' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ECHEC (e) : u2 a modifié une activité de u1'; end if;
  delete from public.game_activities where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ECHEC (e) : u2 a supprimé une activité de u1'; end if;
  raise notice 'OK (e) : isolation entre enseignants';
end $$;
reset role;
do $$
declare t text;
begin
  select titre into t from public.game_activities where id = '11111111-1111-4111-8111-111111111111';
  if t <> 'Activité de u1' then raise exception 'ECHEC (e) : l''activité de u1 a été changée (%)', t; end if;
end $$;

-- (e2) u1 peut modifier et supprimer la sienne ; updated_at est tenu par le serveur ; la taille du brouillon est bornée.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int; u timestamptz; refuse boolean := false;
begin
  update public.game_activities set titre = 'Renommée', updated_at = '2000-01-01' where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ECHEC (e2) : u1 devrait pouvoir modifier la sienne'; end if;
  select updated_at into u from public.game_activities where id = '11111111-1111-4111-8111-111111111111';
  if u < now() - interval '1 minute' then raise exception 'ECHEC (e2) : updated_at n''est pas tenu par le serveur (%)', u; end if;
  begin
    insert into public.game_activities (user_id, titre, niveau, matiere, brouillon)
      values ('00000000-0000-4000-8000-000000000001', 'Énorme', 'P4', 'mathematiques', to_jsonb(repeat('x', 200001)));
  exception when check_violation then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (e2) : un brouillon de plus de 200000 caractères a été accepté'; end if;
  refuse := false;
  begin
    insert into public.game_activities (user_id, titre, niveau, matiere, brouillon)
      values ('00000000-0000-4000-8000-000000000001', '', 'P4', 'mathematiques', '{}'::jsonb);
  exception when check_violation then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (e2) : un titre vide a été accepté'; end if;
  delete from public.game_activities where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ECHEC (e2) : u1 devrait pouvoir supprimer la sienne'; end if;
  raise notice 'OK (e2) : modifier, supprimer, updated_at, bornes';
end $$;
reset role;

-- (f) anon : aucun droit sur les trois tables ni sur les fonctions.
set local role anon;
do $$
declare t text; refuse boolean;
begin
  foreach t in array array['game_invitations', 'game_teachers', 'game_activities'] loop
    refuse := false;
    begin
      execute format('select count(*) from public.%I', t);
    exception when insufficient_privilege then refuse := true;
    end;
    if not refuse then raise exception 'ECHEC (f) : anon peut lire %', t; end if;
  end loop;
  refuse := false;
  begin
    perform public.game_redeem_invitation(repeat('Z', 32));
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (f) : anon peut appeler game_redeem_invitation'; end if;
  refuse := false;
  begin
    perform public.game_is_teacher();
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (f) : anon peut appeler game_is_teacher'; end if;
  raise notice 'OK (f) : anon n''a aucun droit';
end $$;
reset role;

-- (g) authenticated : ne lit pas game_invitations, n'écrit pas dans game_teachers, ne lit que sa propre ligne.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int; refuse boolean := false;
begin
  begin
    perform count(*) from public.game_invitations;
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (g) : authenticated peut lire game_invitations'; end if;
  refuse := false;
  begin
    insert into public.game_teachers (user_id) values ('00000000-0000-4000-8000-000000000004');
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (g) : authenticated peut s''ajouter ou ajouter quelqu''un dans game_teachers'; end if;
  refuse := false;
  begin
    delete from public.game_teachers;
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (g) : authenticated peut supprimer dans game_teachers'; end if;
  select count(*) into n from public.game_teachers;
  if n <> 1 then raise exception 'ECHEC (g) : u1 devrait voir sa seule ligne, en voit %', n; end if;
  raise notice 'OK (g) : game_teachers en lecture de sa propre ligne seulement';
end $$;

-- (h) authenticated ne peut pas créer d'invitation.
do $$
declare refuse boolean := false;
begin
  begin
    perform public.game_create_invitation(5, 30);
  exception when insufficient_privilege then refuse := true;
  end;
  if not refuse then raise exception 'ECHEC (h) : authenticated peut créer une invitation'; end if;
  raise notice 'OK (h) : création d''invitation réservée à l''administrateur';
end $$;
reset role;

-- (j) game_is_teacher : vrai pour u1, faux pour u4.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if public.game_is_teacher() then raise exception 'ECHEC (j) : u4 ne devrait pas être enseignant'; end if;
  raise notice 'OK (j) : game_is_teacher';
end $$;
reset role;
