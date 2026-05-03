-- =====================================================================
-- Estudo Simples — Migration 0004: tipos cloze e flashcard
-- =====================================================================
-- Adiciona 'cloze' e 'flashcard' ao CHECK do campo `type`. Payloads
-- são diferentes (esquema livre via jsonb), mas o type identifica
-- o renderer/lógica.
--
-- Cloze: texto com marcadores {{c1::resposta}} pra lacunas reveláveis.
-- Flashcard: frente + verso simples (autoavaliação).
--
-- Migração aditiva — não muda dados existentes. Apenas amplia o
-- conjunto de tipos aceitos.
-- =====================================================================

alter table public.questions
  drop constraint if exists questions_type_check;

alter table public.questions
  add constraint questions_type_check
  check (type in ('objetiva', 'discursiva', 'cloze', 'flashcard'));

-- Confere
select count(*) as total_questoes_pos_migration
from public.questions
where deleted_at is null;
