begin;
drop policy if exists "shared_decks_public_select" on public.shared_decks;
drop index if exists public.shared_decks_public_idx;
alter table public.shared_decks
  drop constraint if exists shared_decks_title_chk,
  drop constraint if exists shared_decks_desc_chk,
  drop column if exists is_public,
  drop column if exists title,
  drop column if exists description,
  drop column if exists category;
commit;
