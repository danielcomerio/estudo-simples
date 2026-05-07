-- =====================================================================
-- Detecta órfãos / inconsistências de dados
-- =====================================================================
-- FKs cascade cobrem 99%, mas vale verificar periodicamente.

-- 1. Questões com disciplina_id text que NÃO existe na tabela disciplinas
--    (legado pré-Fase B; aceitável mas indica que disciplina_uuid pode
--    estar null pra essas)
select
  q.user_id,
  q.disciplina_id as nome_orfao,
  count(*) as count
from public.questions q
where q.deleted_at is null
  and q.disciplina_id is not null
  and not exists (
    select 1 from public.disciplinas d
    where d.user_id = q.user_id
      and lower(d.nome) = lower(q.disciplina_id)
      and d.deleted_at is null
  )
group by q.user_id, q.disciplina_id
order by count desc
limit 50;

-- 2. Questões com disciplina_uuid set mas referenciando disciplina deletada
--    (NÃO deveria acontecer — FK on delete set null cobre — mas verifica)
select
  q.id as question_id,
  q.user_id,
  q.disciplina_uuid
from public.questions q
where q.deleted_at is null
  and q.disciplina_uuid is not null
  and not exists (
    select 1 from public.disciplinas d
    where d.id = q.disciplina_uuid
  )
limit 20;

-- 3. shared_decks expirados há > 30d que ainda não foram limpos
--    (se acumular, cleanup via job futuro)
select
  count(*) as shared_decks_expirados_velhos,
  pg_size_pretty(sum(length(snapshot::text))::bigint) as snapshot_bytes_total
from public.shared_decks
where expires_at < now() - interval '30 days';

-- 4. live_deck_grants com grantee_email mas grantee_user_id null há
--    > 90d (provável que email nunca virou conta — user pode revogar
--    pra liberar slots futuros)
select
  ldg.deck_id,
  ldg.grantee_email,
  ldg.created_at
from public.live_deck_grants ldg
where ldg.grantee_user_id is null
  and ldg.revoked_at is null
  and ldg.created_at < now() - interval '90 days'
order by ldg.created_at
limit 20;
