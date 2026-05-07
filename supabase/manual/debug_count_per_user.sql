-- =====================================================================
-- Contadores por usuário — quem tem o quê
-- =====================================================================
-- Útil pra:
--  - identificar power users
--  - detectar contas anormais (10k+ questões, possivelmente abuse)
--  - segmentar pra messaging direcionado

select
  u.email,
  p.plan,
  count(distinct q.id) filter (where q.deleted_at is null) as questoes,
  count(distinct c.id) filter (where c.deleted_at is null) as concursos,
  count(distinct d.id) filter (where d.deleted_at is null) as disciplinas,
  count(distinct sd.id) filter (where sd.revoked_at is null) as shared_decks_ativos,
  count(distinct ld.id) filter (where ld.deleted_at is null) as live_decks,
  count(distinct dev.id) filter (where dev.disabled_at is null) as devices_push
from auth.users u
left join public.profiles p on p.user_id = u.id
left join public.questions q on q.user_id = u.id
left join public.concursos c on c.user_id = u.id
left join public.disciplinas d on d.user_id = u.id
left join public.shared_decks sd on sd.owner_user_id = u.id
left join public.live_decks ld on ld.owner_user_id = u.id
left join public.push_devices dev on dev.user_id = u.id
group by u.id, u.email, p.plan
order by questoes desc nulls last
limit 50;
