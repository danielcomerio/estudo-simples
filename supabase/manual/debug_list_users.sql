-- =====================================================================
-- Lista usuários com info útil pra debug
-- =====================================================================
-- Pra rodar no SQL Editor — exige service role (pra ler auth.users).
-- Use pra investigar problemas de signup, conta master, conversão etc.

select
  u.id as user_id,
  u.email,
  u.created_at as signed_up_at,
  u.last_sign_in_at,
  p.plan,
  p.subscription_status,
  p.current_period_end,
  p.stripe_customer_id is not null as has_stripe_customer,
  -- Volume real do banco do user
  (select count(*) from public.questions q
    where q.user_id = u.id and q.deleted_at is null) as questoes_ativas,
  (select count(*) from public.concursos c
    where c.user_id = u.id and c.deleted_at is null) as concursos,
  (select count(*) from public.disciplinas d
    where d.user_id = u.id and d.deleted_at is null) as disciplinas,
  -- Atividade recente
  (select max(created_at) from public.analytics_events
    where user_id = u.id) as last_event_at
from auth.users u
left join public.profiles p on p.user_id = u.id
order by u.created_at desc
limit 50;
