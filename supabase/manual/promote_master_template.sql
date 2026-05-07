-- =====================================================================
-- Template reutilizável: promove user pra master
-- =====================================================================
-- Uso: copia, troca <EMAIL_AQUI> pelo email do user, cola no SQL Editor.
-- Ou usa psql:  psql ... -v target_email='outroemail@x.com' -f este.sql
--
-- Idempotente. Se user já é master, no-op silencioso.

-- Pra rodar no Supabase Dashboard SQL Editor, troca <EMAIL_AQUI> manualmente:
do $$
declare
  v_target_email text := '<EMAIL_AQUI>';  -- <<< TROCAR AQUI
  v_user_id uuid;
  v_current_plan text;
begin
  if v_target_email = '<EMAIL_AQUI>' then
    raise exception 'Substitua <EMAIL_AQUI> pelo email do user a promover.';
  end if;

  select id into v_user_id from auth.users where email = v_target_email limit 1;
  if v_user_id is null then
    raise exception 'Usuário não encontrado: %', v_target_email;
  end if;

  select plan into v_current_plan from public.profiles where user_id = v_user_id;

  -- Garante profile existe
  insert into public.profiles (user_id, plan)
    values (v_user_id, 'master')
    on conflict (user_id) do nothing;

  -- Promove (limpa campos Stripe — master não passa por Stripe)
  update public.profiles
     set plan = 'master',
         subscription_status = null,
         cancel_at_period_end = false,
         current_period_end = null,
         stripe_subscription_id = null
   where user_id = v_user_id;

  raise notice 'Usuário % promovido pra master (era: %)',
    v_target_email, coalesce(v_current_plan, '(sem profile)');
end $$;

-- Verifica
select u.email,
       p.plan,
       p.subscription_status,
       p.current_period_end,
       p.stripe_subscription_id,
       p.stripe_customer_id
  from auth.users u
  join public.profiles p on p.user_id = u.id
 where u.email = '<EMAIL_AQUI>';  -- <<< MESMO EMAIL DO TOPO
