-- 0032_questions_add_soma_type.sql
-- Adiciona tipo 'soma' (UFRGS / Cebraspe somatório) ao CHECK de
-- questions.type. Aditiva, idempotente.
--
-- Payload esperado:
--   { itens: [{ valor: 1, texto: "...", correta: bool }, ...] }
-- Convencional UFRGS: valores 01, 02, 04, 08, 16, 32, 64.
-- Gabarito = soma dos valores com correta=true.

DO $$
BEGIN
  -- Drop e recria CHECK (Postgres não tem ALTER CONSTRAINT IF EXISTS)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_type_check'
      AND conrelid = 'public.questions'::regclass
  ) THEN
    ALTER TABLE public.questions DROP CONSTRAINT questions_type_check;
  END IF;
END $$;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_type_check
  CHECK (type IN ('objetiva', 'discursiva', 'cloze', 'flashcard', 'soma'));

insert into public.applied_migrations (id, applied_at)
values ('0032', now())
on conflict (id) do update set applied_at = excluded.applied_at;
