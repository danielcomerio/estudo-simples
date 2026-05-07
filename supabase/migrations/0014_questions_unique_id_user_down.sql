-- Down de 0014. CUIDADO: drop do UNIQUE quebra FKs compostas que
-- dependem dele (question_concursos, live_deck_questions). Aplicar
-- esse down só depois de dropar essas FKs (rodar 0011_down e
-- 0013_down primeiro).

begin;

alter table public.questions
  drop constraint if exists questions_id_user_unique;

commit;
