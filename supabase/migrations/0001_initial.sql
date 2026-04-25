-- =====================================================================
-- Estudo Simples — schema inicial
-- Tabela única `questions` com RLS por user_id
-- Híbrido: colunas indexadas para filtros + jsonb para o resto do conteúdo
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in ('objetiva', 'discursiva')),
  disciplina_id   text,
  tema            text,
  banca_estilo    text,
  dificuldade     smallint check (dificuldade between 1 and 5),
  payload         jsonb not null default '{}'::jsonb,
  srs             jsonb not null default jsonb_build_object(
                    'easeFactor', 2.5,
                    'interval', 0,
                    'repetitions', 0,
                    'dueDate', extract(epoch from now()) * 1000,
                    'lastReviewed', null
                  ),
  stats           jsonb not null default jsonb_build_object(
                    'attempts', 0,
                    'correct', 0,
                    'wrong', 0,
                    'history', '[]'::jsonb
                  ),
  dedup_hash      text generated always as (
                    md5(coalesce(disciplina_id, '') || '||' ||
                        coalesce(payload->>'enunciado', payload->>'enunciado_completo', ''))
                  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Índices
create index if not exists questions_user_active_idx
  on public.questions (user_id) where deleted_at is null;

create index if not exists questions_user_type_idx
  on public.questions (user_id, type) where deleted_at is null;

create index if not exists questions_user_disciplina_idx
  on public.questions (user_id, disciplina_id) where deleted_at is null;

create index if not exists questions_user_updated_idx
  on public.questions (user_id, updated_at);

create unique index if not exists questions_user_dedup_idx
  on public.questions (user_id, dedup_hash) where deleted_at is null;

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_trg on public.questions;
create trigger set_updated_at_trg
  before update on public.questions
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.questions enable row level security;

drop policy if exists "users select own" on public.questions;
create policy "users select own"
  on public.questions for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own" on public.questions;
create policy "users insert own"
  on public.questions for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own" on public.questions;
create policy "users update own"
  on public.questions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own" on public.questions;
create policy "users delete own"
  on public.questions for delete
  using (auth.uid() = user_id);
