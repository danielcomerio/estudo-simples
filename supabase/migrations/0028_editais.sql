-- =====================================================================
-- Migration 0028 — Editais ativos (feed agregado)
-- =====================================================================
-- Tabela populada por cron diário que lê RSS público do PCI Concursos
-- (única fonte agregadora de concursos BR com formato parseável).
--
-- Sem PII. Tabela é pública (qualquer authenticated SELECT). INSERT
-- via service role no cron.
--
-- Source = 'pci' por enquanto. Quando outras fontes existirem, vira
-- enum estendido.
--
-- Preferências do user (regions[], areas[]) ficam em tabela separada
-- com RLS own.
--
-- Idempotente.

begin;

create table if not exists public.editais (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('pci')),
  source_id text not null,
  title text not null check (length(title) <= 500),
  link text not null check (length(link) <= 1000),
  description text check (length(description) <= 5000),
  -- Region: 'BR' (federal/nacional), ou abrev de estado ('SP', 'RJ',...)
  -- ou null se não detectável.
  region text,
  -- Area: 'TI', 'Direito', 'Saude', 'Educacao', 'Policia', 'Adm', 'Geral'
  area text,
  pub_date timestamptz,
  fetched_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists editais_pub_date_idx
  on public.editais (pub_date desc nulls last);
create index if not exists editais_region_idx
  on public.editais (region) where region is not null;
create index if not exists editais_area_idx
  on public.editais (area) where area is not null;

alter table public.editais enable row level security;

drop policy if exists "editais_public_select" on public.editais;
create policy "editais_public_select" on public.editais
  for select to authenticated
  using (true);
-- INSERT/UPDATE/DELETE: só service role (cron)

-- ---------------------------------------------------------------------
-- Preferências do user
-- ---------------------------------------------------------------------

create table if not exists public.editais_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Vazio = mostra tudo. Setado = filtra.
  regions text[] not null default '{}'::text[],
  areas text[] not null default '{}'::text[],
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.editais_preferences enable row level security;

drop policy if exists "editais_prefs_own_all" on public.editais_preferences;
create policy "editais_prefs_own_all" on public.editais_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into public.applied_migrations (id, applied_at)
values ('0028', now())
on conflict (id) do update set applied_at = excluded.applied_at;

commit;
