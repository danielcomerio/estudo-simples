begin;
drop index if exists public.audit_action_created_idx;
drop index if exists public.audit_user_created_idx;
drop table if exists public.audit_log;
commit;
