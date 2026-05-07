-- =====================================================================
-- Reverter Daniel (ou outro master) pra plano pro/free
-- =====================================================================
-- Aplicar manualmente no SQL Editor SE quiser tirar a conta de master.
--
-- IMPORTANTE: a trigger protect_master_plan (criada pela migration 0009)
-- BLOQUEIA UPDATE em master.plan vindo de PostgREST normal. Pra
-- bypassar, usa SET LOCAL app.allow_master_change = 'true' DENTRO de
-- uma transação. O setting some no COMMIT/ROLLBACK — não persiste
-- entre sessões.
--
-- Substitui o email abaixo (e o destino target_plan se quiser pro
-- ou free).

begin;

-- 1. Habilita override só desta transação
set local app.allow_master_change = 'true';

-- 2. Rebaixa pra 'free' (default seguro). Pra deixar pro:
--    troque 'free' por 'pro' abaixo.
with target_user as (
  select id as user_id from auth.users
   where email = 'danielhcomerio@gmail.com'
   limit 1
)
update public.profiles p
   set plan = 'free',
       subscription_status = null,
       cancel_at_period_end = false,
       current_period_end = null,
       stripe_subscription_id = null
  from target_user t
 where p.user_id = t.user_id
   and p.plan = 'master';

-- 3. Verifica
select u.email,
       p.plan,
       p.subscription_status,
       p.current_period_end,
       p.stripe_subscription_id,
       p.stripe_customer_id
  from auth.users u
  join public.profiles p on p.user_id = u.id
 where u.email = 'danielhcomerio@gmail.com';

-- 4. Confirma. ROLLBACK aqui em vez de COMMIT pra desistir.
commit;
