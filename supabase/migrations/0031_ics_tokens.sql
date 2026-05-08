-- =====================================================================
-- Migration 0031 — Tokens ICS pra subscribe public feed
-- =====================================================================
-- User gera URL pública (com token) que aplicativos de calendário
-- (Google, Outlook, Apple) assinam. Feed retorna eventos próximos:
--  - Eventos de concurso (concurso_events)
--  - Revisões SRS dos próximos 30 dias
--
-- Token é único por user, regenerável (invalida o anterior). Acesso
-- ANÔNIMO via token (cal apps não autenticam) — daí endpoint usa
-- service role pra resolver user_id.
--
-- Idempotente.

begin;

create table if not exists public.ics_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- 32 hex chars (UUID v4 sem hífens)
  token text not null unique check (token ~ '^[a-f0-9]{32}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  -- Track de uso (incrementado pelo endpoint anônimo via RPC)
  fetch_count int not null default 0,
  last_fetched_at timestamptz
);

create index if not exists ics_tokens_token_idx on public.ics_tokens (token)
  where enabled = true;

alter table public.ics_tokens enable row level security;

drop policy if exists "ics_tokens_own_all" on public.ics_tokens;
create policy "ics_tokens_own_all" on public.ics_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RPC pra incrementar fetch_count via service role (anônimo)
create or replace function public.ics_token_record_fetch(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_user uuid;
begin
  update public.ics_tokens
  set fetch_count = fetch_count + 1, last_fetched_at = now()
  where token = p_token and enabled = true
  returning user_id into found_user;
  return found_user;
end;
$$;

revoke all on function public.ics_token_record_fetch(text) from public;
-- Service role usa direto (bypass)

insert into public.applied_migrations (id, applied_at)
values ('0031', now())
on conflict (id) do update set applied_at = excluded.applied_at;

commit;
