-- =====================================================================
-- Migration 0026 — Cache de respostas IA determinísticas
-- =====================================================================
-- Cache compartilhado de respostas IA pra evitar gastar tokens em
-- prompts idênticos repetidos (ex: explicação de uma questão pública
-- pedida por vários users).
--
-- Privacy: o `cache_key` é hash determinístico do prompt + provider +
-- model. Não armazenamos prompt em claro nem identificamos quem pediu.
-- A response em si pode ser reaproveitada por qualquer user logado.
--
-- Política:
--  - Cliente envia `cache_key?: string` opcional. Se ausente, sem cache.
--  - GET cache → hit, retorna na hora; miss, gera e armazena.
--  - TTL 90 dias (cron housekeeping limpa). Conteúdo educacional não
--    muda muito; se mudar, user pode forçar refresh.
--
-- Idempotente.

begin;

create table if not exists public.ai_response_cache (
  cache_key text primary key,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  response text not null,
  -- Métricas pra observabilidade
  hits int not null default 0,
  tokens_estimated int,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz
);

create index if not exists ai_cache_created_idx
  on public.ai_response_cache (created_at desc);
create index if not exists ai_cache_provider_idx
  on public.ai_response_cache (provider, model);

alter table public.ai_response_cache enable row level security;

-- SELECT: qualquer authenticated. INSERT/UPDATE: só service role
-- (server-side via /api/ai/chat).
drop policy if exists "ai_cache_public_select" on public.ai_response_cache;
create policy "ai_cache_public_select" on public.ai_response_cache
  for select to authenticated
  using (true);

-- Função RPC pra incrementar hit + atualizar last_hit_at sem race.
create or replace function public.ai_cache_record_hit(p_cache_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_response_cache
  set hits = hits + 1, last_hit_at = now()
  where cache_key = p_cache_key;
$$;

revoke all on function public.ai_cache_record_hit(text) from public;
grant execute on function public.ai_cache_record_hit(text) to authenticated;

insert into public.applied_migrations (id, applied_at)
values ('0026', now())
on conflict (id) do update set applied_at = excluded.applied_at;

commit;
