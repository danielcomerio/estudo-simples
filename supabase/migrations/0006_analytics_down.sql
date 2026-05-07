-- =====================================================================
-- Down de 0006 — Analytics events + newsletter signups
-- =====================================================================
-- Aplicar manualmente no SQL Editor SÓ se quiser reverter a 0006.
-- Idempotente: rerodar não quebra.
--
-- ATENÇÃO: drop tables apaga TODOS os eventos coletados e signups da
-- newsletter — irreversível. Faça backup antes (export jsonb) se for
-- material relevante.

begin;

-- Newsletter (drop tabela: policies caem junto)
drop table if exists public.newsletter_signups;

-- Analytics events (drop tabela: policies caem junto)
drop table if exists public.analytics_events;

commit;
