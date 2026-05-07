-- =====================================================================
-- Migration 0020 — ratings de qualidade de questão
-- =====================================================================
-- User dá feedback rápido (👍/👎) por questão. Útil pra:
--  - Marketplace público: ranquear decks por avaliação média
--  - Detectar questões ruins (mal formuladas, gabarito errado)
--  - Ranking de qualidade entre questões similares

begin;

create table if not exists public.question_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  -- 'up' | 'down' | comentário opcional
  rating smallint not null check (rating in (-1, 1)),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  -- 1 rating por user×questão (UPSERT pra trocar)
  primary key (user_id, question_id)
);

create index if not exists question_ratings_question_idx
  on public.question_ratings (question_id, rating);

alter table public.question_ratings enable row level security;

drop policy if exists "ratings_own_all" on public.question_ratings;
create policy "ratings_own_all" on public.question_ratings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- SELECT público pra agregação (todo logged user pode ver totais)
drop policy if exists "ratings_public_select" on public.question_ratings;
create policy "ratings_public_select" on public.question_ratings
  for select to authenticated
  using (true);

commit;
