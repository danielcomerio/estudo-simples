-- =====================================================================
-- Migration 0009 — Tier "master" (admin / owner do app)
-- =====================================================================
-- Adiciona um tier acima de Pro pro próprio dono do app e (futuramente)
-- staff/suporte. Diferenças:
--   - Nunca expira (sem subscription_status, sem current_period_end).
--   - Sem limites de questões/concursos (ignora enforce_*_limit).
--   - Não chega via Stripe — só via UPDATE manual ou trigger admin.
--   - Reportado em planLabel como "👑 Master".
--
-- Por que separado de pro: pra distinguir contas comerciais (paid) de
-- contas operacionais (free pra mim, sem custo Stripe nem entry em
-- subscription). Métricas e relatórios ficam mais limpos sem a conta
-- do dono inflando MRR ou churn.
--
-- Idempotente. Aditiva (CHECK aceita um valor a mais; comportamento
-- pra free/estudante/pro intacto).

begin;

-- ---------------------------------------------------------------------
-- 1. CHECK profiles.plan aceita 'master'
-- ---------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'estudante', 'pro', 'master'));

-- ---------------------------------------------------------------------
-- 2. Funções enforce_*_limit ignoram master (sem limit)
-- ---------------------------------------------------------------------

create or replace function public.enforce_question_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  current_count int;
  plan_limit int;
begin
  select plan into user_plan
    from public.profiles
   where user_id = new.user_id;

  if user_plan is null then user_plan := 'free'; end if;

  -- Master e Pro: sem limit
  if user_plan in ('master', 'pro') then return new; end if;

  plan_limit := case user_plan
    when 'estudante' then 2000
    else 200  -- free (ou desconhecido — mais restritivo)
  end;

  select count(*) into current_count
    from public.questions
   where user_id = new.user_id
     and deleted_at is null;

  if current_count >= plan_limit then
    raise exception
      'plan_question_limit_reached: limite de % questões atingido no plano %. Atualize de plano.',
      plan_limit, user_plan
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_concurso_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  current_count int;
  plan_limit int;
begin
  select plan into user_plan from public.profiles where user_id = new.user_id;
  if user_plan is null then user_plan := 'free'; end if;

  -- Master e Pro: sem limit
  if user_plan in ('master', 'pro') then return new; end if;

  plan_limit := case user_plan
    when 'estudante' then 3
    else 1  -- free
  end;

  select count(*) into current_count
    from public.concursos
   where user_id = new.user_id
     and deleted_at is null;

  if current_count >= plan_limit then
    raise exception
      'plan_concurso_limit_reached: limite de % concurso(s) no plano %. Atualize de plano.',
      plan_limit, user_plan
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Trigger que protege a coluna `plan` do auto-rebaixamento por webhook
--    quando o user é 'master'. Stripe webhook NUNCA deve rebaixar master
--    pra free (ex: se admin testou checkout e cancelou).
-- ---------------------------------------------------------------------

create or replace function public.protect_master_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Se o registro atual é master e a tentativa de update tira de master
  -- sem ser admin explícito (via service role com flag), bloqueia.
  -- Detectamos "admin explícito" via setting customizado:
  --   set local app.allow_master_change = 'true';
  if old.plan = 'master' and new.plan != 'master' then
    if coalesce(current_setting('app.allow_master_change', true), 'false') != 'true' then
      raise exception 'cannot downgrade master plan without explicit admin override'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_master on public.profiles;
create trigger profiles_protect_master
  before update on public.profiles
  for each row execute function public.protect_master_plan();

commit;
