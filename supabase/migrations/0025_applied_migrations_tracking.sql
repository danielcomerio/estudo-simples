-- =====================================================================
-- Migration 0025 — Tabela de tracking de migrations aplicadas
-- =====================================================================
-- Resolve o problema de "quais migrations foram aplicadas?" pra fluxo
-- manual via SQL Editor (que NÃO popula supabase_migrations.schema_migrations,
-- usado apenas pelo CLI `supabase db push`).
--
-- A partir desta migration, TODA nova migration deve terminar com:
--
--   insert into public.applied_migrations (id, applied_at)
--   values ('NNNN', now())
--   on conflict (id) do update set applied_at = excluded.applied_at;
--
-- Diagnose vira simples: `select * from applied_migrations order by id`.
--
-- Idempotente: re-aplicar não duplica, só atualiza applied_at.

begin;

create table if not exists public.applied_migrations (
  id text primary key,
  applied_at timestamptz not null default now(),
  -- Opcional: notas/contexto da aplicação
  notes text
);

comment on table public.applied_migrations is
  'Tracking de migrations aplicadas via SQL Editor manual. Cada migration nova deve fazer INSERT idempotente no fim.';

-- RLS habilitado SEM policies = bloqueio total pra anon/authenticated.
-- Só service role lê/escreve (script check:migrations + INSERT manual no
-- SQL Editor que roda como postgres superuser). User comum não tem motivo
-- pra ver metadata de migrations.
alter table public.applied_migrations enable row level security;

-- Backfill: marca 0001-0024 como aplicadas (presunção razoável — quem
-- está rodando isso já aplicou as anteriores; usuário pode ajustar
-- manualmente se 0025 for aplicado num DB parcial).
insert into public.applied_migrations (id, applied_at, notes) values
  ('0001', now(), 'backfill via 0025'),
  ('0002', now(), 'backfill via 0025'),
  ('0003', now(), 'backfill via 0025'),
  ('0004', now(), 'backfill via 0025'),
  ('0005', now(), 'backfill via 0025'),
  ('0006', now(), 'backfill via 0025'),
  ('0007', now(), 'backfill via 0025'),
  ('0008', now(), 'backfill via 0025'),
  ('0009', now(), 'backfill via 0025'),
  ('0010', now(), 'backfill via 0025'),
  ('0011', now(), 'backfill via 0025'),
  ('0012', now(), 'backfill via 0025'),
  ('0013', now(), 'backfill via 0025'),
  ('0014', now(), 'backfill via 0025'),
  ('0015', now(), 'backfill via 0025'),
  ('0016', now(), 'backfill via 0025'),
  ('0017', now(), 'backfill via 0025'),
  ('0018', now(), 'backfill via 0025'),
  ('0019', now(), 'backfill via 0025'),
  ('0020', now(), 'backfill via 0025'),
  ('0021', now(), 'backfill via 0025'),
  ('0022', now(), 'backfill via 0025'),
  ('0023', now(), 'backfill via 0025'),
  ('0024', now(), 'backfill via 0025')
on conflict (id) do nothing;

-- Marca a própria 0025
insert into public.applied_migrations (id, applied_at)
values ('0025', now())
on conflict (id) do update set applied_at = excluded.applied_at;

commit;
