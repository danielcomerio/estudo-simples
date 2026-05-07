-- Down de 0013 — drop sharing live. APAGA todos os decks/grants live.

begin;

drop trigger if exists on_user_created_resolve_grants on auth.users;
drop function if exists public.resolve_pending_grants();

drop trigger if exists ldg_freeze_on_revoke on public.live_deck_grants;
drop function if exists public.freeze_grant_on_revoke();

drop policy if exists "questions_grantee_select" on public.questions;

drop policy if exists "ld_owner_all" on public.live_decks;
drop policy if exists "ld_grantee_select" on public.live_decks;
drop policy if exists "ldq_owner_all" on public.live_deck_questions;
drop policy if exists "ldq_grantee_select" on public.live_deck_questions;
drop policy if exists "ldg_owner_all" on public.live_deck_grants;
drop policy if exists "ldg_grantee_select" on public.live_deck_grants;

drop table if exists public.live_deck_grants;
drop table if exists public.live_deck_questions;
drop table if exists public.live_decks;

commit;
