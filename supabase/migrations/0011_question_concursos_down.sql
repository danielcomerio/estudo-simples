-- Down de 0011. Remove tabela join + policies. concurso_id em questions
-- (1:1) continua intacto.

begin;

drop policy if exists "qc_select_own" on public.question_concursos;
drop policy if exists "qc_insert_own" on public.question_concursos;
drop policy if exists "qc_delete_own" on public.question_concursos;

drop table if exists public.question_concursos;

commit;
