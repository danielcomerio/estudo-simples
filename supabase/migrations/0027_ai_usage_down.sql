begin;
drop policy if exists "ai_usage_own_select" on public.ai_usage;
drop index if exists public.ai_usage_user_provider_idx;
drop index if exists public.ai_usage_user_created_idx;
drop table if exists public.ai_usage;
delete from public.applied_migrations where id = '0027';
commit;
