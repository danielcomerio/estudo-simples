begin;
drop policy if exists "ratings_own_all" on public.question_ratings;
drop policy if exists "ratings_public_select" on public.question_ratings;
drop table if exists public.question_ratings;
commit;
