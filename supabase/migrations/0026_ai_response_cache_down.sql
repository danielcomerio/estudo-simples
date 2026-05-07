begin;
drop function if exists public.ai_cache_record_hit(text);
drop policy if exists "ai_cache_public_select" on public.ai_response_cache;
drop index if exists public.ai_cache_provider_idx;
drop index if exists public.ai_cache_created_idx;
drop table if exists public.ai_response_cache;
delete from public.applied_migrations where id = '0026';
commit;
