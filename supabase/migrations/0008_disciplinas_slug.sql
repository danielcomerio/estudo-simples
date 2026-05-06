-- Migration 0008: disciplinas.slug — chave canônica derivada do nome
--
-- Por que: hoje o `lower(nome)` é o discriminador, mas isso não cobre
-- diferenças de acento ("Matemática" vs "matematica"). O app começou a
-- normalizar tudo via slug() no client (lib/normalize.ts) e quer um
-- índice único que reflita essa mesma chave canônica no DB, evitando
-- duplicatas que só existem porque vieram de prompts diferentes.
--
-- Estratégia conservadora:
--  - Adiciona coluna `slug` nullable. App preenche client-side ao montar
--    StoreProvider (loadDisciplinas) — sem dependência de função SQL.
--  - Cria índice único sobre `(user_id, slug)` parcial (ativas), mas
--    cobre só linhas onde slug não é null. Isso permite rollout sem
--    backfill imediato no DB.
--  - Mantém o índice antigo `(user_id, lower(nome))` durante a transição.
--    Próxima migration (0009) pode drop quando todos os clients tiverem
--    rodado o backfill.
--
-- Idempotente: rerodando, só revalida que coluna+índice já existem.
-- Down em 0008_disciplinas_slug_down.sql.

alter table public.disciplinas
  add column if not exists slug text;

-- Cap razoável (mesmo do nome).
alter table public.disciplinas
  drop constraint if exists disciplinas_slug_chk;
alter table public.disciplinas
  add constraint disciplinas_slug_chk
  check (slug is null or char_length(slug) between 1 and 200);

-- Índice único parcial — só valida quando slug está preenchido E disciplina
-- está ativa. Permite linhas com slug=null durante backfill incremental.
create unique index if not exists disciplinas_user_slug_uidx
  on public.disciplinas (user_id, slug)
  where deleted_at is null and slug is not null;

-- Index não-único pra lookups (ex: app procura disciplina por slug).
create index if not exists disciplinas_user_slug_idx
  on public.disciplinas (user_id, slug)
  where deleted_at is null;
