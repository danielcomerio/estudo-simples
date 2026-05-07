-- Down de 0012 — drop sharing tables. APAGA TODOS OS LINKS — irreversível.

begin;

drop function if exists public.shared_deck_increment_access(text);

drop policy if exists "shared_decks_select_own" on public.shared_decks;
drop policy if exists "shared_decks_insert_own" on public.shared_decks;
drop policy if exists "shared_decks_update_own" on public.shared_decks;
drop policy if exists "shared_decks_delete_own" on public.shared_decks;

drop table if exists public.shared_decks;

commit;
