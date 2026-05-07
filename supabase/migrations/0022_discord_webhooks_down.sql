begin;
drop policy if exists "discord_webhooks_own_all" on public.discord_webhooks;
drop table if exists public.discord_webhooks;
commit;
