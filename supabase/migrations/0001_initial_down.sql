-- =====================================================================
-- Down de 0001_initial — drop completo da tabela questions
-- =====================================================================
-- ATENÇÃO: APAGA TODOS OS DADOS de questões. Irreversível sem backup.
-- Use APENAS pra reset total em desenvolvimento.
--
-- Pré-requisito: aplicar primeiro os downs de 0002+ que dependem
-- de questions via FK (0010 disciplina_uuid, 0011 question_concursos,
-- 0013 live_deck_questions, 0020 question_ratings).

begin;

-- Drop policies
drop policy if exists "questions_select_own" on public.questions;
drop policy if exists "questions_insert_own" on public.questions;
drop policy if exists "questions_update_own" on public.questions;
drop policy if exists "questions_delete_own" on public.questions;
drop policy if exists "questions_grantee_select" on public.questions;

-- Drop trigger + function
drop trigger if exists set_questions_updated_at on public.questions;
drop function if exists public.set_updated_at();

-- Drop indices (se ainda não foram dropados em downs anteriores)
drop index if exists public.questions_user_active_idx;
drop index if exists public.questions_user_type_idx;
drop index if exists public.questions_user_disciplina_idx;
drop index if exists public.questions_user_updated_idx;
drop index if exists public.questions_user_dedup_idx;

-- Drop tabela (CASCADE pra forçar mesmo com FKs incompatíveis)
drop table if exists public.questions cascade;

commit;
