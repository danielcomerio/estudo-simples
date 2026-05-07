-- =====================================================================
-- Migration 0024 — Audit log de ações sensíveis
-- =====================================================================
-- Trilha auditável de operações críticas: mudança de plano, deleção
-- de conta, sharing público de deck, mudança de senha, etc.
--
-- Privacy-aware:
--  - user_id REFERENCES auth.users com ON DELETE SET NULL — preserva
--    log mesmo após user excluir conta (audit > privacy nesse caso).
--  - actor_user_id pode ser != user_id (admin/master atuando).
--  - meta jsonb com props sem PII (ex: { plan_from, plan_to }).
--
-- RLS: SELECT só admin (service role). User não vê próprio log.
--
-- Idempotente.

begin;

create table if not exists public.audit_log (
  id bigserial primary key,
  -- Quem foi afetado (usually = quem agiu, mas pode diferir pra
  -- ações administrativas)
  user_id uuid references auth.users(id) on delete set null,
  -- Quem disparou a ação (== user_id se foi self-service)
  actor_user_id uuid references auth.users(id) on delete set null,
  -- Tipo de ação (string convencionada — não enum pra extensibilidade)
  action text not null check (length(action) <= 64),
  -- Metadata estruturada
  meta jsonb not null default '{}' check (length(meta::text) <= 4000),
  -- IP e UA pra forensics (opt-in via app)
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_user_created_idx
  on public.audit_log (user_id, created_at desc);
create index if not exists audit_action_created_idx
  on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

-- INSERT: só service role (server-side via app helpers).
-- SEM policy de SELECT — service role bypass.

commit;
