-- =====================================================================
-- Migration 0011 — N:N entre questões e concursos
-- =====================================================================
-- DEPENDÊNCIA: 0014 (questions_id_user_unique) deve ser aplicada antes,
-- senão a FK composta abaixo falha com erro 42830.
-- =====================================================================
-- Hoje questions.concurso_id é 1:1 (questão pertence a 0 ou 1 concurso).
-- Limitação: questão "Direito Penal art 121" cabe em vários concursos
-- (TJ-SP, MP-RJ, OAB) e teria que ser duplicada.
--
-- Esta migration adiciona tabela question_concursos pra permitir N:N.
-- O campo questions.concurso_id continua como "concurso primário"
-- (back-compat) — não é dropado.
--
-- Filtros que hoje usam questions.concurso_id passam a unir via JOIN
-- LEFT pra incluir matches via question_concursos.
--
-- Defense-in-depth via FK composta (id, user_id) → parent (id, user_id),
-- mesmo padrão da 0002. Composite UNIQUE em concursos pra suportar isso
-- já existe (id, user_id).
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------
-- Tabela join — uma linha por par (questão × concurso)
-- ---------------------------------------------------------------------

create table if not exists public.question_concursos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  question_id     uuid not null,
  concurso_id     uuid not null,
  created_at      timestamptz not null default now(),
  -- FKs compostas garantem que questão e concurso pertencem ao MESMO
  -- user_id da linha — impossível atribuir cross-user mesmo via SQL
  -- direto sem RLS.
  constraint question_concursos_question_fk
    foreign key (question_id, user_id)
    references public.questions (id, user_id)
    on delete cascade,
  constraint question_concursos_concurso_fk
    foreign key (concurso_id, user_id)
    references public.concursos (id, user_id)
    on delete cascade,
  -- Não permitir vincular a mesma questão ao mesmo concurso 2x
  unique (question_id, concurso_id)
);

create index if not exists question_concursos_user_idx
  on public.question_concursos (user_id);
create index if not exists question_concursos_question_idx
  on public.question_concursos (question_id);
create index if not exists question_concursos_concurso_idx
  on public.question_concursos (concurso_id);

-- ---------------------------------------------------------------------
-- RLS — usuário só vê/manipula seus próprios vínculos
-- ---------------------------------------------------------------------

alter table public.question_concursos enable row level security;

drop policy if exists "qc_select_own" on public.question_concursos;
create policy "qc_select_own" on public.question_concursos
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "qc_insert_own" on public.question_concursos;
create policy "qc_insert_own" on public.question_concursos
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "qc_delete_own" on public.question_concursos;
create policy "qc_delete_own" on public.question_concursos
  for delete to authenticated
  using (user_id = auth.uid());

-- Nada de UPDATE: link é binário (existe ou não). Pra mudar concurso,
-- delete + insert.

-- ---------------------------------------------------------------------
-- Backfill: pra cada questão com concurso_id (1:1), espelha em
-- question_concursos. ON CONFLICT pra idempotência.
-- ---------------------------------------------------------------------

insert into public.question_concursos (user_id, question_id, concurso_id)
  select user_id, id, concurso_id
    from public.questions
   where concurso_id is not null
     and deleted_at is null
on conflict (question_id, concurso_id) do nothing;

commit;
