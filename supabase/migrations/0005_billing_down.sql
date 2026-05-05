-- =====================================================================
-- 0005 DOWN — reverte billing.
-- =====================================================================
-- ATENÇÃO: apaga `profiles` e `stripe_events`. Histórico de quem é Pro
-- é perdido. Use só em ambientes de teste.

begin;

drop trigger if exists concursos_enforce_limit on public.concursos;
drop function if exists public.enforce_concurso_limit();

drop trigger if exists questions_enforce_limit on public.questions;
drop function if exists public.enforce_question_limit();

drop trigger if exists profiles_updated_at on public.profiles;
drop function if exists public.handle_profile_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop view if exists public.my_plan;

drop table if exists public.stripe_events;
drop table if exists public.profiles;

commit;
