-- =====================================================================
-- Migration 0015 — push_devices (FCM/APNS device tokens)
-- =====================================================================
-- Tabela pra registrar tokens de dispositivos pra envio de push
-- notifications. 1 user pode ter N devices (mobile + web push em PCs).
--
-- Disparos previstos:
--   - revisão SRS vencendo (cron diário)
--   - streak em risco (final do dia se nada estudado)
--   - novo grant em deck compartilhado (real-time via webhook)
--
-- Privacy: token sozinho não revela device. Device fingerprint NÃO é
-- coletado. Token rotaciona quando user reinstala — versão antiga é
-- descartada.

begin;

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null check (char_length(token) between 32 and 2048),
  -- 'fcm' (Android + Web Push), 'apns' (iOS via Capacitor), 'web' (Web Push API)
  platform text not null check (platform in ('fcm', 'apns', 'web')),
  -- User-Agent ou device name pra user identificar/revogar ("iPhone do João")
  device_label text check (device_label is null or char_length(device_label) <= 200),
  created_at timestamptz not null default now(),
  -- Atualizado quando registra novamente com mesmo token (token rotation)
  last_seen_at timestamptz not null default now(),
  -- Disabled quando FCM/APNS retorna erro definitivo (token expirado).
  disabled_at timestamptz,
  -- Token único por user (re-register substitui)
  unique (user_id, token)
);

create index if not exists push_devices_user_idx
  on public.push_devices (user_id) where disabled_at is null;

create index if not exists push_devices_platform_idx
  on public.push_devices (platform) where disabled_at is null;

alter table public.push_devices enable row level security;

drop policy if exists "push_devices_own_all" on public.push_devices;
create policy "push_devices_own_all" on public.push_devices
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
