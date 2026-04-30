-- =====================================================================
-- ROLLBACK da 0002_hierarchy.sql
--
-- Reverte na ordem inversa de dependências. Triggers e policies caem
-- automaticamente com `drop table cascade`. Os ALTERs em `questions`
-- são revertidos explicitamente.
--
-- ATENÇÃO: ao rodar este script você PERDE todos os dados das tabelas
-- novas (concursos, disciplinas, topicos, etc.) e perde topico_id /
-- concurso_id / tags das questões. Faça backup antes (pg_dump) se já
-- tiver populado dados.
-- =====================================================================

-- 1. Reverter ALTERs em questions
alter table public.questions drop constraint if exists questions_concurso_user_fk;
alter table public.questions drop constraint if exists questions_topico_user_fk;

drop index if exists public.questions_tags_gin_idx;
drop index if exists public.questions_concurso_idx;
drop index if exists public.questions_topico_idx;

alter table public.questions drop column if exists tags;
alter table public.questions drop column if exists concurso_id;
alter table public.questions drop column if exists topico_id;

-- 2. Drop tabelas em ordem reversa (cascade limpa indexes/triggers/policies)
drop table if exists public.edital_itens         cascade;
drop table if exists public.topicos              cascade;
drop table if exists public.concurso_disciplinas cascade;
drop table if exists public.disciplinas          cascade;
drop table if exists public.concursos            cascade;
