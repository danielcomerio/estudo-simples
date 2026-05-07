begin;
drop policy if exists "tg_own_all" on public.telegram_bindings;
drop table if exists public.telegram_bindings;
commit;
