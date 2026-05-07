-- =====================================================================
-- Migration 0023 — Comentários públicos por questão (extensão de ratings)
-- =====================================================================
-- Cada questão pode receber comentários de qualquer user logado. Útil
-- pra correções, dúvidas, dicas. Owner pode deletar comentários nas
-- suas próprias questões. Author pode deletar os próprios.
--
-- Privacy: comentários são associados ao user (display name mascarado
-- na leitura via JOIN — não exposto direto). Conteúdo aparece pra
-- qualquer user logado.
--
-- Idempotente.

begin;

create table if not exists public.question_comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qc_question_idx
  on public.question_comments (question_id, created_at desc);
create index if not exists qc_author_idx
  on public.question_comments (author_id, created_at desc);

-- Trigger update updated_at
create or replace function public.qc_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists qc_set_updated_at on public.question_comments;
create trigger qc_set_updated_at
  before update on public.question_comments
  for each row execute function public.qc_set_updated_at();

alter table public.question_comments enable row level security;

-- SELECT público: qualquer user autenticado vê todos comentários
drop policy if exists "qc_public_select" on public.question_comments;
create policy "qc_public_select" on public.question_comments
  for select to authenticated
  using (true);

-- INSERT: só logado, próprio author_id
drop policy if exists "qc_own_insert" on public.question_comments;
create policy "qc_own_insert" on public.question_comments
  for insert to authenticated
  with check (author_id = auth.uid());

-- UPDATE: só próprio comentário
drop policy if exists "qc_own_update" on public.question_comments;
create policy "qc_own_update" on public.question_comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- DELETE: próprio comentário OU dono da questão
drop policy if exists "qc_owner_or_author_delete" on public.question_comments;
create policy "qc_owner_or_author_delete" on public.question_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.questions q
      where q.id = question_id and q.user_id = auth.uid()
    )
  );

commit;
