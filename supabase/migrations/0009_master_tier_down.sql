-- Down de 0009 — remove tier 'master', reverte funções pra versão da 0007.
--
-- Aplicar SÓ se quiser remover o conceito de master. Rebaixa todos os
-- masters pra pro antes (CHECK do 0007 não aceita master).

begin;

drop trigger if exists profiles_protect_master on public.profiles;
drop function if exists public.protect_master_plan();

update public.profiles set plan = 'pro' where plan = 'master';

alter table public.profiles
  drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'estudante', 'pro'));

-- Restaura funções da 0007 (master é tratado como free dentro do CASE).
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
  select plan into user_plan from public.profiles where user_id = new.user_id;
  if user_plan is null then user_plan := 'free'; end if;
  if user_plan = 'pro' then return new; end if;
  plan_limit := case user_plan when 'estudante' then 2000 else 200 end;
  select count(*) into current_count
    from public.questions where user_id = new.user_id and deleted_at is null;
  if current_count >= plan_limit then
    raise exception 'plan_question_limit_reached: limite de % questões atingido no plano %.',
      plan_limit, user_plan using errcode = 'P0001';
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
  if user_plan = 'pro' then return new; end if;
  plan_limit := case user_plan when 'estudante' then 3 else 1 end;
  select count(*) into current_count
    from public.concursos where user_id = new.user_id and deleted_at is null;
  if current_count >= plan_limit then
    raise exception 'plan_concurso_limit_reached: limite de % concurso(s) no plano %.',
      plan_limit, user_plan using errcode = 'P0001';
  end if;
  return new;
end;
$$;

commit;
