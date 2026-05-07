begin;
drop policy if exists "deck_favorites_public_count" on public.deck_favorites;
drop policy if exists "deck_favorites_own_all" on public.deck_favorites;
drop index if exists public.deck_favorites_deck_idx;
drop index if exists public.deck_favorites_user_created_idx;
drop table if exists public.deck_favorites;
commit;
