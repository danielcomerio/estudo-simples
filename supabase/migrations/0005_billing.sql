-- =====================================================================
-- Migration 0005 — Billing (profiles + planos + enforcement de limites)
-- =====================================================================
--
-- Esta migration é o coração da camada comercial. Estabelece:
--
--  1. Tabela `profiles` com plano do user, status de assinatura Stripe,
--     IDs externos e timestamps.
--  2. RLS em `profiles`: user lê só o próprio. NINGUÉM escreve do client
--     direto — só a service role (server-side via webhook do Stripe).
--  3. Trigger automático que cria `profiles` row no signup do user.
--  4. Função `enforce_question_limit()`: trigger BEFORE INSERT em
--     `questions` que rejeita inserções quando o user no plano `free`
--     atingiu o limite. Defesa final: cliente pode bypass UI hints,
--     mas DB rejeita. Não tem como contornar via devtools/curl.
--
-- Idempotente: pode rodar quantas vezes. Operações com IF NOT EXISTS /
-- DROP IF EXISTS / CREATE OR REPLACE.
--
-- Limite atual: 500 questões free. Ajustável editando a função e
-- re-aplicando a migration (a constante FREE_QUESTION_LIMIT está
-- inline na função pra simplicidade — sem tabela de configuração).

begin;

-- ---------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  -- Plano efetivo. Mantido em sync com Stripe via webhook.
  plan text not null default 'free' check (plan in ('free', 'pro')),
  -- Status da subscription (espelhando Stripe). null = nunca assinou.
  subscription_status text check (
    subscription_status in (
      'active', 'trialing', 'past_due', 'canceled',
      'incomplete', 'incomplete_expired', 'unpaid', 'paused'
    )
  ),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  -- Quando expira o ciclo atual. Útil pra mostrar "renova em X dias".
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Dados de perfil + billing por usuário. Sincronizado com Stripe via webhook server-side.';
comment on column public.profiles.plan is
  'Plano efetivo (free|pro). Único campo que controla acesso a features pagas.';
comment on column public.profiles.subscription_status is
  'Status do Stripe. plan=pro pode ser true mesmo com status=past_due (grace period).';

create index if not exists idx_profiles_stripe_customer
  on public.profiles(stripe_customer_id);
create index if not exists idx_profiles_stripe_subscription
  on public.profiles(stripe_subscription_id);

-- ---------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "user reads own profile" on public.profiles;
create policy "user reads own profile" on public.profiles
  for select using (auth.uid() = user_id);

-- IMPORTANTE: SEM policy de INSERT/UPDATE/DELETE pra usuários comuns.
-- Isso significa que cliente JS nunca consegue mexer em `plan` ou
-- `stripe_*` — apenas a service role (usada no webhook server-side)
-- consegue, porque service role bypassa RLS.

-- ---------------------------------------------------------------------
-- 3. Trigger: cria profile automaticamente no signup
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. Trigger: updated_at automático em profiles
-- ---------------------------------------------------------------------

create or replace function public.handle_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_profile_updated_at();

-- ---------------------------------------------------------------------
-- 5. Backfill: cria profile pra users que já existem (idempotente)
-- ---------------------------------------------------------------------

insert into public.profiles (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 5b. Grandfather: users com banco já estabelecido viram 'pro'
-- ---------------------------------------------------------------------
-- Sem isso, qualquer user com >500 questões fica BLOQUEADO de adicionar
-- novas após o trigger entrar em vigor (count >= 500 + plan='free' →
-- INSERT rejeitado). Pra não quebrar a app pra master/early users:
-- promove pra 'pro' qualquer user com >100 questões ativas no momento
-- da migration. Esse limite (100) é um proxy de "user real" que não vai
-- ser pego pelo upsell.
--
-- Esse status NÃO está atrelado a Stripe — é "pro grandfathered" sem
-- subscription_id. Webhook não vai sobrescrever (só atualiza profiles
-- com matching customer_id ou metadata.user_id).

update public.profiles p
   set plan = 'pro'
 where exists (
   select 1
     from public.questions q
    where q.user_id = p.user_id
      and q.deleted_at is null
   group by q.user_id
   having count(*) > 100
 )
   and p.plan = 'free'
   and p.stripe_subscription_id is null;

-- ---------------------------------------------------------------------
-- 6. Trigger de enforcement do limite
-- ---------------------------------------------------------------------

-- Rejeita INSERT em `questions` quando user free atingiu o limit. Roda
-- em SECURITY DEFINER pra ler `profiles` mesmo com RLS.
--
-- Importante: o trigger NÃO conta soft-deleted (where deleted_at is null).
-- Pra evitar bypass via "deletei pra criar nova".

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
  -- Lê o plano do user (default free se não tiver profile)
  select plan into user_plan
    from public.profiles
   where user_id = new.user_id;

  if user_plan is null then
    user_plan := 'free';
  end if;

  -- Pro: sem limite
  if user_plan = 'pro' then
    return new;
  end if;

  -- Free: conta questões ativas (não soft-deleted)
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

drop trigger if exists questions_enforce_limit on public.questions;
create trigger questions_enforce_limit
  before insert on public.questions
  for each row execute function public.enforce_question_limit();

-- ---------------------------------------------------------------------
-- 6b. Trigger pra limit de concursos (free = 1)
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

drop trigger if exists concursos_enforce_limit on public.concursos;
create trigger concursos_enforce_limit
  before insert on public.concursos
  for each row execute function public.enforce_concurso_limit();

-- ---------------------------------------------------------------------
-- 7. Tabela de eventos de webhook (idempotência)
-- ---------------------------------------------------------------------
-- Stripe pode enviar o mesmo event mais de uma vez. Salvar event_id
-- processado garante que não atualizamos profile duas vezes.

create table if not exists public.stripe_events (
  id text primary key,                  -- event.id do Stripe
  type text not null,
  received_at timestamptz not null default now()
);

comment on table public.stripe_events is
  'Idempotência de webhooks Stripe. Cada event_id só processa 1x.';

alter table public.stripe_events enable row level security;
-- SEM nenhuma policy → user comum não vê. Service role bypassa.

-- ---------------------------------------------------------------------
-- 8. View pública pra checagem de plano (lê só do user atual)
-- ---------------------------------------------------------------------
-- Em vez de expor `profiles` via RLS direto, uma view restrita ao user
-- atual mantém a interface limpa. Cliente chama:
--   supabase.from('my_plan').select('*').single();
--
-- Mais semântico que lendo profiles direto.

create or replace view public.my_plan as
  select user_id, plan, subscription_status, current_period_end,
         cancel_at_period_end
    from public.profiles
   where user_id = auth.uid();

-- Garante que a view roda como o user que invoca, não como o owner
-- (que é postgres). Sem isso, qualquer SELECT na view veria todos os
-- profiles. security_invoker é a opção correta pra SELECT scoped por
-- auth.uid() funcionar.
alter view public.my_plan set (security_invoker = true);

grant select on public.my_plan to authenticated;

commit;
