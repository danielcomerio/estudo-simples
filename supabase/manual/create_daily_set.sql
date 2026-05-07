-- =====================================================================
-- Cria set diário (modo comunidade) — admin/master
-- =====================================================================
-- Aplicar no SQL Editor pra gerar o set do dia. Estratégia: pega 20
-- questões objetivas com melhor rating (👍 > 👎), random tie-break.
--
-- Substitua a `target_date` se quiser publicar no futuro.

with target_date as (
  select current_date as date  -- TROCAR pra futuro: '2026-05-10'::date
),
ranked_qs as (
  select
    q.id,
    coalesce(sum(case when r.rating = 1 then 1 else 0 end), 0) as ups,
    coalesce(sum(case when r.rating = -1 then 1 else 0 end), 0) as downs,
    random() as rand
  from public.questions q
  left join public.question_ratings r on r.question_id = q.id
  where q.deleted_at is null
    and q.type = 'objetiva'
    -- Apenas questões com gabarito oficial (curadoria de qualidade)
    and (q.fonte->>'gabarito_source') = 'oficial'
  group by q.id
),
top_qs as (
  select id from ranked_qs
  order by (ups - downs) desc, rand
  limit 20
)
insert into public.daily_question_sets (
  date, question_ids, title, description, publish_at
)
values (
  (select date from target_date),
  array(select id from top_qs),
  'Desafio Diário — ' || (select date from target_date)::text,
  '20 questões objetivas selecionadas pela comunidade. Boa sorte!',
  now() -- publica imediatamente; pra agendar, troca pra timestamp futuro
)
on conflict (date) do nothing;

-- Verifica
select date, array_length(question_ids, 1) as count, title, publish_at
from public.daily_question_sets
where date = (select date from target_date);
