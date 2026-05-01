-- =====================================================================
-- Estudo Simples — DOWN da migration 0003
-- =====================================================================
-- Reverte adições de origem/fonte/verificacao em questions.
-- Aviso: APAGA OS DADOS dessas colunas. Faça backup do JSON exportado
-- pelo /banco antes de rodar isso em prod.
-- =====================================================================

drop index if exists public.questions_user_origem_idx;
drop index if exists public.questions_user_verificacao_idx;
drop index if exists public.questions_user_fonte_gin;

alter table public.questions
  drop constraint if exists questions_origem_check,
  drop constraint if exists questions_verificacao_check,
  drop constraint if exists questions_origem_real_requires_fonte,
  drop constraint if exists questions_fonte_max_size;

alter table public.questions
  drop column if exists origem,
  drop column if exists fonte,
  drop column if exists verificacao;
