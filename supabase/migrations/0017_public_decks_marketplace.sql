-- =====================================================================
-- Migration 0017 — Marketplace público de decks compartilhados
-- =====================================================================
-- Extensão da Fase C2 (shared_decks) com discoverability pública.
-- Owner opt-in: marca seu shared_deck como público (is_public=true).
-- Aparece em /decks-publicos pra qualquer user logado importar.
--
-- Por que separado de shared_decks: shared_decks são links com token
-- privado. Aqui, qualquer um logado vê e importa.
--
-- Idempotente. Aditiva.

begin;

-- Adiciona campos pra marketplace
alter table public.shared_decks
  add column if not exists is_public boolean not null default false,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists category text;

-- CHECK no title (curto)
alter table public.shared_decks
  drop constraint if exists shared_decks_title_chk;
alter table public.shared_decks
  add constraint shared_decks_title_chk
  check (title is null or char_length(title) between 1 and 200);

-- Cap de description
alter table public.shared_decks
  drop constraint if exists shared_decks_desc_chk;
alter table public.shared_decks
  add constraint shared_decks_desc_chk
  check (description is null or char_length(description) <= 2000);

-- Index pra listagem pública (só públicos, ativos, não expirados)
create index if not exists shared_decks_public_idx
  on public.shared_decks (is_public, created_at desc)
  where is_public = true and revoked_at is null;

-- ---------------------------------------------------------------------
-- RLS: SELECT público pra qualquer user autenticado nos públicos.
-- Já temos "shared_decks_select_own" (owner). Adicionamos uma policy
-- adicional pra grantees logados.
-- ---------------------------------------------------------------------

drop policy if exists "shared_decks_public_select" on public.shared_decks;
create policy "shared_decks_public_select" on public.shared_decks
  for select to authenticated
  using (
    is_public = true
    and revoked_at is null
    and expires_at > now()
  );

commit;
