begin;
drop policy if exists "daily_prefs_own_all" on public.daily_preferences;
drop policy if exists "daily_attempts_own_all" on public.daily_question_attempts;
drop policy if exists "daily_attempts_public_select" on public.daily_question_attempts;
drop policy if exists "daily_sets_public_select" on public.daily_question_sets;
drop table if exists public.daily_preferences;
drop table if exists public.daily_question_attempts;
drop table if exists public.daily_question_sets;
commit;
