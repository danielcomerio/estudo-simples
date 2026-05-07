-- =====================================================================
-- Promover usuário pra tier 'master' (admin / dono do app)
-- =====================================================================
-- Aplicar manualmente no SQL Editor do Supabase. Pré-requisito:
-- migration 0009 já aplicada.
--
-- Substitui o email abaixo. Idempotente.
--
-- Comportamento pós-update:
--   - Plan permanente. enforce_*_limit ignoram master (sem limit).
--   - protect_master_plan trigger bloqueia rebaixamento por webhook.
--   - Stripe webhook não sobrescreve master.plan.
--
-- Pra reverter um master pra pro/free, é preciso bypassar a trigger:
--   begin;
--     set local app.allow_master_change = 'true';
--     update public.profiles set plan = 'pro' where user_id = '<uuid>';
--   commit;

-- ---------------------------------------------------------------------
-- Daniel (dono)
-- ---------------------------------------------------------------------

with target_user as (
  select id as user_id from auth.users
   where email = 'danielhcomerio@gmail.com'
   limit 1
)
update public.profiles p
   set plan = 'master',
       subscription_status = null,
       cancel_at_period_end = false
  from target_user t
 where p.user_id = t.user_id
   and p.plan != 'master';

-- Garante profile existe (caso tenha logado antes da migration de
-- billing — trigger handle_new_user cobre signups novos, mas users
-- pré-existentes podem não ter linha em profiles).
insert into public.profiles (user_id, plan)
  select id, 'master' from auth.users where email = 'danielhcomerio@gmail.com'
  on conflict (user_id) do nothing;

-- Verifica
select u.email, p.plan, p.subscription_status, p.current_period_end
  from auth.users u
  join public.profiles p on p.user_id = u.id
 where u.email = 'danielhcomerio@gmail.com';
