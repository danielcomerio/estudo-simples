-- =====================================================================
-- Migration 0027 — Tracking de uso de IA (por user)
-- =====================================================================
-- Registra cada chamada ao /api/ai/chat pra dar visibilidade de custos
-- pro user (BYO key, mas user quer saber quantos tokens gastou).
--
-- Privacy: NÃO armazena prompt/resposta em claro. Só metadata
-- (provider, model, tamanhos, cache hit, timestamp).
--
-- Idempotente.

begin;

create table if not exists public.ai_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  -- Tamanhos em chars — proxy razoável de token count quando provider
  -- não retorna usage exata. Token ≈ chars/4 pra latim/pt-BR.
  prompt_chars int not null default 0,
  response_chars int not null default 0,
  -- Token counts reais (quando provider retorna)
  prompt_tokens int,
  completion_tokens int,
  -- True se servido do cache (não chamou provider)
  cached boolean not null default false,
  -- Tipo da operação pra agrupar (explain, discursiva-eval, generate, chat, rewrite)
  kind text,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_user_provider_idx
  on public.ai_usage (user_id, provider, created_at desc);

alter table public.ai_usage enable row level security;

-- User vê só o próprio uso. INSERT só service role (server-side).
drop policy if exists "ai_usage_own_select" on public.ai_usage;
create policy "ai_usage_own_select" on public.ai_usage
  for select to authenticated
  using (user_id = auth.uid());

insert into public.applied_migrations (id, applied_at)
values ('0027', now())
on conflict (id) do update set applied_at = excluded.applied_at;

commit;
