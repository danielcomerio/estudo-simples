-- =====================================================================
-- Migration 0018 — bindings de Telegram pra notificações
-- =====================================================================
-- User vincula seu telegram via flow:
--   1. Bot do app (configurado via TELEGRAM_BOT_TOKEN env) gera deeplink:
--      https://t.me/seubot?start=BIND_TOKEN
--   2. User clica → bot envia /start BIND_TOKEN.
--   3. Bot webhook chama /api/telegram/bind com BIND_TOKEN + chat_id.
--   4. App valida token (TTL curto), salva chat_id em telegram_bindings.
--
-- Backend cron envia mensagens via Telegram Bot API. Sem custo.
-- Diferencial: WhatsApp Business API requer aprovação Meta + custo;
-- Telegram bot é grátis e instantâneo.

begin;

create table if not exists public.telegram_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Chat ID do Telegram (pode ser positivo pra user, negativo pra grupo)
  chat_id bigint not null,
  -- Username/firstname pra display ("Daniel" / "@daniel")
  display text,
  bind_token text unique,
  bind_token_expires_at timestamptz,
  bound_at timestamptz,
  created_at timestamptz not null default now(),
  -- 1 user por chat_id (evita binding cruzado)
  unique (user_id, chat_id)
);

create index if not exists telegram_bindings_user_idx
  on public.telegram_bindings (user_id) where bound_at is not null;
create index if not exists telegram_bindings_token_idx
  on public.telegram_bindings (bind_token)
  where bind_token is not null and bound_at is null;

alter table public.telegram_bindings enable row level security;

drop policy if exists "tg_own_all" on public.telegram_bindings;
create policy "tg_own_all" on public.telegram_bindings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
