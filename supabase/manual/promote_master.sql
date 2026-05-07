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
--   - Limpa campos de subscription Stripe (current_period_end,
--     stripe_subscription_id, cancel_at_period_end) pra higiene de
--     dados — master não passa por Stripe. stripe_customer_id é
--     mantido (caso futuramente rebaixar pra pro, reusa o customer
--     ao invés de criar duplicado).
--
-- Pra reverter, ver promote_master_down.sql.

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
       cancel_at_period_end = false,
       current_period_end = null,
       stripe_subscription_id = null
       -- stripe_customer_id mantido — barato, e útil se o user voltar
       -- a ser pro futuramente (Stripe reusa o customer).
  from target_user t
 where p.user_id = t.user_id
   -- Reseta SEMPRE pra master (não só quando muda plan), pra limpar
   -- subscription_status legado (ex: 'canceled' caído pelo webhook
   -- antes do skip-master ficar em vigor).
   ;

-- Garante profile existe (caso tenha logado antes da migration de
-- billing — trigger handle_new_user cobre signups novos, mas users
-- pré-existentes podem não ter linha em profiles).
insert into public.profiles (user_id, plan)
  select id, 'master' from auth.users where email = 'danielhcomerio@gmail.com'
  on conflict (user_id) do nothing;

-- Verifica — esperado:
--   plan = 'master'
--   subscription_status = null
--   current_period_end = null
--   stripe_subscription_id = null
select u.email,
       p.plan,
       p.subscription_status,
       p.current_period_end,
       p.stripe_subscription_id,
       p.stripe_customer_id
  from auth.users u
  join public.profiles p on p.user_id = u.id
 where u.email = 'danielhcomerio@gmail.com';
