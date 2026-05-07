-- =====================================================================
-- Estado das assinaturas — financeiro & churn debug
-- =====================================================================

-- Resumo por plano
select
  plan,
  subscription_status,
  count(*) as users
from public.profiles
group by plan, subscription_status
order by plan, subscription_status;

-- Assinaturas ativas com vencimento próximo (próximos 30d)
select
  u.email,
  p.plan,
  p.subscription_status,
  p.current_period_end,
  (p.current_period_end::date - current_date) as days_until_renewal,
  p.cancel_at_period_end
from public.profiles p
join auth.users u on u.id = p.user_id
where p.subscription_status in ('active', 'trialing', 'past_due')
  and p.current_period_end is not null
  and p.current_period_end < now() + interval '30 days'
order by p.current_period_end;

-- Trials que expiram em próximos 7d (cobrança automática)
select
  u.email,
  p.plan,
  p.current_period_end,
  (p.current_period_end::date - current_date) as days_until_charge
from public.profiles p
join auth.users u on u.id = p.user_id
where p.subscription_status = 'trialing'
  and p.current_period_end < now() + interval '7 days'
order by p.current_period_end;

-- Churn: cancelados nos últimos 30d
select
  date_trunc('day', updated_at) as day,
  count(*) as canceled
from public.profiles
where subscription_status = 'canceled'
  and updated_at > now() - interval '30 days'
group by day
order by day desc;
