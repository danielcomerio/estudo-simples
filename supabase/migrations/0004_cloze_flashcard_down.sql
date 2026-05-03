-- DOWN da 0004 — volta CHECK pra só 'objetiva'/'discursiva'.
-- AVISO: se houver questões com type='cloze' ou 'flashcard', o
-- ALTER vai FALHAR. Soft-delete ou converter elas antes de rodar.

alter table public.questions
  drop constraint if exists questions_type_check;

alter table public.questions
  add constraint questions_type_check
  check (type in ('objetiva', 'discursiva'));
