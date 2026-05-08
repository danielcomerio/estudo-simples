-- Down migration 0032 — remove tipo 'soma' do CHECK.
-- Falha se houver questões com type='soma' existentes (proteção).

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.questions
    WHERE type = 'soma' AND deleted_at IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Não pode rollback: % questões type=soma existem', v_count;
  END IF;
END $$;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_type_check;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_type_check
  CHECK (type IN ('objetiva', 'discursiva', 'cloze', 'flashcard'));

DELETE FROM public.applied_migrations WHERE id = '0032';
