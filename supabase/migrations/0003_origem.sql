-- =====================================================================
-- Estudo Simples — Migration 0003: origem / fonte / verificação
-- =====================================================================
-- Propósito: separar questões REAIS (extraídas de provas oficiais) das
-- AUTORAIS (criadas pelo user/IA). Permite filtros, badges, stats e
-- estratégias de estudo dedicadas (ex: simulado só com reais).
--
-- Aplicação: rodar uma vez no SQL Editor do Supabase Dashboard. É
-- aditiva (ALTER TABLE ADD COLUMN com defaults seguros) e idempotente
-- (IF NOT EXISTS em todos os ALTERs sensíveis).
--
-- Rollback: ver 0003_origem_down.sql.
-- =====================================================================

-- ----- Colunas em questions -----

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='origem'
  ) then
    alter table public.questions
      add column origem text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='fonte'
  ) then
    alter table public.questions
      add column fonte jsonb not null default '{}'::jsonb;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='verificacao'
  ) then
    alter table public.questions
      add column verificacao text;
  end if;
end $$;

-- ----- CHECK constraints -----
-- origem só aceita os 3 valores enum-like, ou NULL (legado / não classificada)
alter table public.questions
  drop constraint if exists questions_origem_check;
alter table public.questions
  add constraint questions_origem_check
  check (origem is null or origem in ('real', 'autoral', 'adaptada'));

-- verificacao só aceita os 3 valores, ou NULL
alter table public.questions
  drop constraint if exists questions_verificacao_check;
alter table public.questions
  add constraint questions_verificacao_check
  check (verificacao is null or verificacao in ('verificada', 'pendente', 'duvidosa'));

-- Defesa-in-depth: se origem='real', exige banca + ano em fonte. Sem
-- isso o user pode marcar "real" mas esquecer de preencher os metadados,
-- frustrando filtros e relatórios. Banca como string, ano como number.
alter table public.questions
  drop constraint if exists questions_origem_real_requires_fonte;
alter table public.questions
  add constraint questions_origem_real_requires_fonte
  check (
    origem != 'real' or (
      fonte ? 'banca' and
      fonte ? 'ano' and
      jsonb_typeof(fonte->'banca') = 'string' and
      jsonb_typeof(fonte->'ano') = 'number'
    )
  );

-- Cap de tamanho do jsonb fonte pra evitar payload abusivo (~10KB)
-- Compatível com o pattern já usado em CHECKs de notas em concursos.
alter table public.questions
  drop constraint if exists questions_fonte_max_size;
alter table public.questions
  add constraint questions_fonte_max_size
  check (length(fonte::text) <= 10000);

-- ----- Índices pra filtros rápidos -----

-- Filtro por origem (ex: "só reais") nas listagens ativas do user
create index if not exists questions_user_origem_idx
  on public.questions (user_id, origem)
  where deleted_at is null;

-- Filtro por verificação (ex: "só pendentes" pra revisar)
create index if not exists questions_user_verificacao_idx
  on public.questions (user_id, verificacao)
  where deleted_at is null and verificacao is not null;

-- GIN parcial em fonte pra permitir buscas tipo `fonte @> '{"banca":"FGV"}'`
-- ou `fonte @> '{"ano":2025}'` quando precisarmos de filtros mais ricos.
create index if not exists questions_user_fonte_gin
  on public.questions using gin (fonte)
  where deleted_at is null;

-- ----- Evolução do dedup_hash (compatibilidade) -----
-- O índice único `questions_user_dedup_idx` continua válido — duas
-- questões reais com mesmo enunciado/disciplina ainda são duplicatas
-- (mesmo que origem mude, conteúdo é o mesmo). Não mexer aqui.
