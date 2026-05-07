-- =====================================================================
-- Migration 0022 — Discord webhooks (outbound notification)
-- =====================================================================
-- Permite user colar uma webhook URL do Discord (channel webhook que
-- ele criou) pra receber notificações no canal/servidor. Sem bot, sem
-- OAuth — minimalista.
--
-- Privacy: webhook URL contém token. Tratamos como secret. SELECT só
-- pelo próprio user via RLS.
--
-- Idempotente.

begin;

create table if not exists public.discord_webhooks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  webhook_url text not null check (
    webhook_url like 'https://discord.com/api/webhooks/%' or
    webhook_url like 'https://discordapp.com/api/webhooks/%'
  ),
  enabled boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.discord_webhooks enable row level security;

drop policy if exists "discord_webhooks_own_all" on public.discord_webhooks;
create policy "discord_webhooks_own_all" on public.discord_webhooks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
