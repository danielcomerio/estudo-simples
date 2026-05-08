-- =====================================================================
-- Migration 0029 — Personas IA customizáveis
-- =====================================================================
-- User cria "professores" customizados (system prompt + tom + foco).
-- Usados pelo AI Coach (chat global) e podem ser vinculados a um
-- concurso específico ou globais.
--
-- Owner-only edição. Compartilhamento público virá na próxima migration
-- (extensão pra marketplace).
--
-- Idempotente.

begin;

create table if not exists public.ai_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Vinculação opcional a concurso (filtra qual persona usar quando
  -- concurso_ativo muda). Null = persona global do user.
  concurso_id uuid references public.concursos(id) on delete set null,
  name text not null check (length(name) between 1 and 80),
  description text check (description is null or length(description) <= 500),
  system_prompt text not null check (length(system_prompt) between 10 and 4000),
  -- Avatar emoji
  emoji text default '🤖' check (length(emoji) <= 8),
  -- Provider/model preferidos (se setado, override do default do user)
  preferred_provider text check (preferred_provider in ('openai', 'anthropic', 'gemini')),
  preferred_model text,
  -- Sharing (Fase próxima)
  is_public boolean not null default false,
  -- Quantas vezes foi usado em chat
  use_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_personas_user_idx
  on public.ai_personas (user_id, created_at desc);
create index if not exists ai_personas_concurso_idx
  on public.ai_personas (concurso_id) where concurso_id is not null;
create index if not exists ai_personas_public_idx
  on public.ai_personas (is_public, use_count desc) where is_public = true;

-- Trigger updated_at
create or replace function public.ai_personas_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ai_personas_updated_at on public.ai_personas;
create trigger ai_personas_updated_at
  before update on public.ai_personas
  for each row execute function public.ai_personas_set_updated_at();

alter table public.ai_personas enable row level security;

drop policy if exists "ai_personas_own_all" on public.ai_personas;
create policy "ai_personas_own_all" on public.ai_personas
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Personas públicas — qualquer authenticated pode SELECT (pra
-- marketplace futuro). UPDATE/DELETE continua só do owner.
drop policy if exists "ai_personas_public_select" on public.ai_personas;
create policy "ai_personas_public_select" on public.ai_personas
  for select to authenticated
  using (is_public = true);

insert into public.applied_migrations (id, applied_at)
values ('0029', now())
on conflict (id) do update set applied_at = excluded.applied_at;

commit;
