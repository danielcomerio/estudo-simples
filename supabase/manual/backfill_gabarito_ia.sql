-- =====================================================================
-- Backfill de fonte.gabarito_source = 'ia' + tag 'gabarito-ia'
-- =====================================================================
-- Marca questões que provavelmente têm gabarito gerado por IA:
--   origem = 'real'
--   AND verificacao = 'pendente'
--   AND payload->>'gabarito' não é vazio nem '?'
--
-- Aplica:
--   - fonte.gabarito_source = 'ia' (se ainda não tem source definido)
--   - tag 'gabarito-ia' adicionada (se não tiver)
--
-- Idempotente. Não toca questões que já têm source definido (preserva
-- decisões manuais via editor).
--
-- USER ACTION:
--  1. Confirme que o critério bate com o seu cenário (origem=real,
--     verificacao=pendente, gabarito existe = IA gerou).
--  2. Se quiser limitar a UM user específico, adicione filtro
--     `AND user_id = '<seu-uuid>'`. Sem filtro, aplica em TODOS os
--     usuários — fora de produção pode ser ok; em produção, cuidado.

begin;

-- 1. Atualiza fonte.gabarito_source via jsonb_set, só onde não há source
update public.questions
   set fonte = coalesce(fonte, '{}'::jsonb)
        || jsonb_build_object('gabarito_source', 'ia'),
       updated_at = now()
 where deleted_at is null
   and origem = 'real'
   and verificacao = 'pendente'
   and coalesce(payload->>'gabarito', '') !~ '^(\s*\?\s*|\s*null\s*|\s*)$'
   and (fonte->>'gabarito_source') is null;

-- 2. Adiciona tag 'gabarito-ia' onde ainda não tiver
update public.questions
   set tags = coalesce(tags, '{}'::text[]) || ARRAY['gabarito-ia']::text[],
       updated_at = now()
 where deleted_at is null
   and origem = 'real'
   and verificacao = 'pendente'
   and (fonte->>'gabarito_source') = 'ia'
   and not ('gabarito-ia' = any(coalesce(tags, '{}'::text[])));

-- Verifica
select count(*) as questoes_marcadas
  from public.questions
 where deleted_at is null
   and (fonte->>'gabarito_source') = 'ia';

select count(*) as com_tag_ia
  from public.questions
 where deleted_at is null
   and 'gabarito-ia' = any(coalesce(tags, '{}'::text[]));

commit;
