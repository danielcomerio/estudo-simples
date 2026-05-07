-- =====================================================================
-- Diagnóstico simples — usa tabela applied_migrations
-- =====================================================================
-- Pré-requisito: 0025 aplicada. Lista o que está marcado no DB.
-- Pra cruzar com o disco (descobrir o que FALTA aplicar), use o
-- script Node `npm run check:migrations` que faz o diff.

select id, applied_at, notes
from public.applied_migrations
order by id;
