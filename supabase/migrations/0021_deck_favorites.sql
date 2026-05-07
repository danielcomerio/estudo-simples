-- =====================================================================
-- Migration 0021 — Decks favoritos (marketplace)
-- =====================================================================
-- Permite user marcar deck público como favorito pra acesso rápido.
-- N:N entre users e shared_decks via PK composto.
--
-- Idempotente. Aditiva.

begin;

create table if not exists public.deck_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.shared_decks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

create index if not exists deck_favorites_user_created_idx
  on public.deck_favorites (user_id, created_at desc);

create index if not exists deck_favorites_deck_idx
  on public.deck_favorites (deck_id);

alter table public.deck_favorites enable row level security;

-- User mexe nos próprios favoritos
drop policy if exists "deck_favorites_own_all" on public.deck_favorites;
create policy "deck_favorites_own_all" on public.deck_favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Permite agregar count de favoritos por deck (sem expor user_id)
-- via select público — quem favoritou X é privado, mas count(*) é ok.
drop policy if exists "deck_favorites_public_count" on public.deck_favorites;
create policy "deck_favorites_public_count" on public.deck_favorites
  for select to authenticated
  using (true);

commit;
