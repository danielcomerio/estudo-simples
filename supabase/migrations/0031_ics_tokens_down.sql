begin;
drop function if exists public.ics_token_record_fetch(text);
drop policy if exists "ics_tokens_own_all" on public.ics_tokens;
drop index if exists public.ics_tokens_token_idx;
drop table if exists public.ics_tokens;
delete from public.applied_migrations where id = '0031';
commit;
