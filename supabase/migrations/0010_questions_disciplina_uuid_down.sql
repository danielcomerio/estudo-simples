-- Down da 0010. Aplicar apenas se quiser reverter completamente. Drop
-- da coluna apaga TODOS os mapeamentos uuid — irreversível, fazer
-- backup antes em produção.

begin;

drop index if exists public.questions_user_disciplina_uuid_idx;

alter table public.questions
  drop constraint if exists questions_disciplina_uuid_fkey;

alter table public.questions
  drop column if exists disciplina_uuid;

commit;
