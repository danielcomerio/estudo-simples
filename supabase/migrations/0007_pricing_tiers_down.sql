-- =====================================================================
-- Down de 0007 — Reverte tier "Estudante", restaura free/pro
-- =====================================================================
-- Aplicar manualmente no SQL Editor SÓ se quiser reverter a 0007.
-- Idempotente.
--
-- DEGRADAÇÃO de dados: usuários com plan='estudante' são REBAIXADOS
-- pra 'free' antes do CHECK ser revertido (senão a constraint falha
-- ao reaplicar). Isso significa perda de acesso a features estudante
-- pra esses users — comunicar antes de rodar este down em produção.
--
-- As funções enforce_question_limit/enforce_concurso_limit são
-- restauradas pra versão da 0005 (free=500 questões / 1 concurso,
-- pro=ilimitado, sem tier intermediário).

begin;

-- 1. Rebaixa users 'estudante' pra 'free' (CHECK do 0005 só aceita free/pro)
update public.profiles set plan = 'free' where plan = 'estudante';

-- 2. Reverte CHECK pra free/pro
alter table public.profiles
  drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro'));

-- 3. Restaura função de question limit (versão da 0005: free=500)
create or replace function public.enforce_question_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  current_count int;
  free_limit constant int := 500;
begin
  select plan into user_plan
    from public.profiles
   where user_id = new.user_id;

  if user_plan is null then user_plan := 'free'; end if;
  if user_plan = 'pro' then return new; end if;

  select count(*) into current_count
    from public.questions
   where user_id = new.user_id
     and deleted_at is null;

  if current_count >= free_limit then
    raise exception
      'free_plan_limit_reached: limite de % questões atingido no plano grátis. Atualize pra Pro.',
      free_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- 4. Restaura função de concurso limit (versão da 0005: free=1)
create or replace function public.enforce_concurso_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  current_count int;
  free_limit constant int := 1;
begin
  select plan into user_plan from public.profiles where user_id = new.user_id;
  if user_plan is null then user_plan := 'free'; end if;
  if user_plan = 'pro' then return new; end if;
  select count(*) into current_count
    from public.concursos
   where user_id = new.user_id
     and deleted_at is null;
  if current_count >= free_limit then
    raise exception
      'free_plan_concurso_limit: limite de % concurso(s) no plano grátis. Atualize pra Pro.',
      free_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

commit;
