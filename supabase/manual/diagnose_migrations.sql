-- =====================================================================
-- Diagnóstico — quais migrations estão aplicadas
-- =====================================================================
-- Use sempre que tiver dúvida ou após aplicar nova. Cada coluna é true
-- se a migration correspondente foi aplicada.

select
  -- 0001: tabela questions
  to_regclass('public.questions') is not null as m0001_questions,

  -- 0002: hierarquia (5 tabelas + colunas em questions)
  (to_regclass('public.concursos') is not null
   and to_regclass('public.disciplinas') is not null
   and to_regclass('public.concurso_disciplinas') is not null
   and to_regclass('public.topicos') is not null
   and to_regclass('public.edital_itens') is not null
   and exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='questions'
               and column_name='topico_id')
  ) as m0002_hierarquia,

  -- 0003: origem/fonte/verificacao
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='questions'
          and column_name='fonte') as m0003_origem,

  -- 0004: cloze/flashcard
  exists (select 1 from pg_constraint c
          join pg_class t on t.oid = c.conrelid
          where t.relname='questions'
          and pg_get_constraintdef(c.oid) ilike '%cloze%') as m0004_cloze_flashcard,

  -- 0005: billing
  (to_regclass('public.profiles') is not null
   and to_regclass('public.stripe_events') is not null) as m0005_billing,

  -- 0006: analytics
  to_regclass('public.analytics_events') is not null as m0006_analytics,

  -- 0007: tier estudante
  exists (select 1 from pg_constraint c
          join pg_class t on t.oid = c.conrelid
          where t.relname='profiles'
          and pg_get_constraintdef(c.oid) ilike '%estudante%') as m0007_estudante,

  -- 0008: disciplinas.slug
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='disciplinas'
          and column_name='slug') as m0008_slug,

  -- 0009: tier master
  exists (select 1 from pg_constraint c
          join pg_class t on t.oid = c.conrelid
          where t.relname='profiles'
          and pg_get_constraintdef(c.oid) ilike '%master%') as m0009_master,

  -- 0010: questions.disciplina_uuid
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='questions'
          and column_name='disciplina_uuid') as m0010_disciplina_uuid,

  -- 0011: question_concursos N:N
  to_regclass('public.question_concursos') is not null as m0011_question_concursos,

  -- 0012: shared_decks (Fase C2)
  to_regclass('public.shared_decks') is not null as m0012_shared_decks,

  -- 0013: live_decks (Fase C3)
  (to_regclass('public.live_decks') is not null
   and to_regclass('public.live_deck_questions') is not null
   and to_regclass('public.live_deck_grants') is not null) as m0013_live_decks,

  -- 0014: questions UNIQUE composto
  exists (select 1 from pg_constraint c
          join pg_class t on t.oid = c.conrelid
          where t.relname='questions' and c.contype='u'
          and pg_get_constraintdef(c.oid) ilike '%(id, user_id)%') as m0014_unique,

  -- 0015: push_devices
  to_regclass('public.push_devices') is not null as m0015_push_devices,

  -- 0016: RPC count_due_per_user
  exists (select 1 from pg_proc
          where proname = 'count_due_per_user') as m0016_count_due_rpc,

  -- Storage bucket
  exists (select 1 from storage.buckets where id='questions-images') as storage_bucket;
