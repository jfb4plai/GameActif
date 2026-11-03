-- GameActif : gérer les liens d'invitation. À exécuter dans l'éditeur SQL du projet Supabase, en tant qu'administrateur.
-- Ce fichier ne contient aucun code : le code en clair n'est affiché qu'une fois, à la création.

-- 1. Créer une invitation : 30 places, valable 90 jours (réglez les deux nombres).
--    Le résultat est un code de 32 caractères. Le lien à envoyer est :
--      https://gameactif.jfb4plai.com/?invitation=<le code>
--    Copiez-le tout de suite : il ne pourra plus être retrouvé.
select public.game_create_invitation(30, 90);

-- 2. Lister les invitations (sans aucun code) : places utilisées, date limite, révocation.
select id, uses, max_uses, expires_at, revoked_at, created_at
from public.game_invitations
order by created_at desc;

-- 3. Révoquer une invitation (remplacez l'identifiant par celui de la liste ci-dessus).
--    Les enseignants déjà inscrits gardent leur accès ; plus personne ne peut s'inscrire avec ce lien.
-- update public.game_invitations set revoked_at = now() where id = '00000000-0000-0000-0000-000000000000';

-- 4. Qui a accès ? (identifiants de compte seulement)
-- select user_id, invitation_id, created_at from public.game_teachers order by created_at desc;

-- 5. Retirer l'accès d'un enseignant (ses activités sont conservées mais ne lui sont plus accessibles).
-- delete from public.game_teachers where user_id = '00000000-0000-0000-0000-000000000000';
