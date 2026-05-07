-- =====================================================================
-- Migration 0014 — UNIQUE (id, user_id) em questions
-- =====================================================================
-- Fix retroativo: 0001 não declarou unique composta em questions(id,
-- user_id). Apenas PRIMARY KEY (id) — que é unique só sobre (id), não
-- sobre o par (id, user_id).
--
-- Resultado: FKs compostas que apontam pra questions(id, user_id)
-- — necessárias pra defense-in-depth cross-user — falham na criação
-- com erro 42830 "no unique constraint matching given keys".
--
-- A 0002 já fez isso pras outras tabelas (concursos, disciplinas,
-- topicos), mas questions ficou sem. Bug latente até a 0011 e 0013
-- expõem.
--
-- Fix: adiciona o UNIQUE faltante. Idempotente. Aditiva, não-destrutiva.
-- Necessário ANTES de aplicar 0011 e 0013 (que dependem disso).
--
-- Custo: 1 índice secundário em questions. Tabela tipicamente tem
-- milhares de linhas por user — overhead aceitável.

begin;

-- IF NOT EXISTS pra constraint não está disponível em todas as versões
-- de PG. Usa DO block pra checar e adicionar.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'questions'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%(id, user_id)%'
  ) then
    alter table public.questions
      add constraint questions_id_user_unique unique (id, user_id);
    raise notice 'questions_id_user_unique constraint added.';
  else
    raise notice 'questions já tem UNIQUE (id, user_id) — no-op.';
  end if;
end $$;

commit;
