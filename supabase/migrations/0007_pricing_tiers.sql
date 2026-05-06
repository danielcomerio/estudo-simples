-- =====================================================================
-- Migration 0007 — Adiciona tier intermediário "Estudante"
-- =====================================================================
-- Antes: 2 tiers (free / pro). Agora 3 (free / estudante / pro) pra
-- atender mercado brasileiro de concursos com preço mais acessível.
--
-- Limites:
--   free:      200 questões, 1 concurso
--   estudante: 2000 questões, 3 concursos
--   pro:       ilimitado
--
-- Idempotente. Alteração é só do CHECK + funções de enforcement —
-- a coluna `plan` é text, então valores antigos ('free', 'pro')
-- continuam válidos.

begin;

-- ---------------------------------------------------------------------
-- Atualiza CHECK constraint pra aceitar 'estudante'
-- ---------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'estudante', 'pro'));

-- ---------------------------------------------------------------------
-- Função de limit de questões — tier-aware
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

  -- Pro: sem limit
  if user_plan = 'pro' then return new; end if;

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

-- ---------------------------------------------------------------------
-- Função de limit de concursos — tier-aware
-- ---------------------------------------------------------------------

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
  if user_plan = 'pro' then return new; end if;

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

commit;
