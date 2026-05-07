-- =====================================================================
-- Migration 0016 — RPC count_due_per_user
-- =====================================================================
-- Função usada pelo cron /api/cron/srs-due pra agrupar contagem de
-- questões vencendo por usuário. Sem essa RPC, o cron retorna 200
-- com nota "RPC não criada" e não dispara push.
--
-- Performance: usa o índice questions_user_active_idx + filter por
-- srs->>'dueDate'. Pra usuários com >10k questões, considere índice
-- expression em (srs->>'dueDate')::bigint, mas só se ficar lento.
--
-- SECURITY DEFINER: roda como owner pra bypass RLS (cron precisa ler
-- todos os users). Não expõe nada do conteúdo, só contagens.

begin;

create or replace function public.count_due_per_user(p_due_before_ms bigint)
returns table(user_id uuid, due_count int)
language sql
security definer
set search_path = public
as $$
  select user_id, count(*)::int as due_count
    from public.questions
   where deleted_at is null
     and type = 'objetiva'
     and ((srs->>'dueDate')::bigint) <= p_due_before_ms
   group by user_id
  having count(*) > 0;
$$;

revoke all on function public.count_due_per_user(bigint) from public;
-- Service role tem acesso total por default; só restringimos public.

commit;
