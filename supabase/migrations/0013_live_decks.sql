-- =====================================================================
-- Migration 0013 — live_decks (Fase C3: sharing live com permissão)
-- =====================================================================
-- Modelo A: usuário cria um "deck" (subset persistente de questões dele)
-- e concede acesso live a outros emails. Grantee vê as questões do
-- owner em tempo real (via JOIN cross-user com policy especial).
--
-- MVP escopo:
--  - Read-only por enquanto. Read-write fica pra evolução futura
--    (precisa de SRS por-user via question_progress, refator do app).
--  - Comportamento ao revogar (decisão do user): grantee recebe
--    snapshot congelado do estado no momento da revogação. Implementado
--    aproveitando Fase C2 — trigger na revogação cria entry em
--    shared_decks com snapshot do deck atual e link ao grantee.
--
-- Defesa em camadas:
--  - RLS: grantee só vê questions do owner via JOIN com live_deck_grants
--    ativo (não-revogado, não-expirado).
--  - Owner pode revogar a qualquer momento — grantee perde acesso live
--    mas recebe snapshot.
--  - grantee_email + grantee_user_id: aceita grants pra emails que ainda
--    não criaram conta (pre-grant). Quando user faz signup, trigger
--    handle_new_user resolve grants pendentes.

begin;

-- ---------------------------------------------------------------------
-- live_decks: agrupamento de questões pra share live
-- ---------------------------------------------------------------------

create table if not exists public.live_decks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, owner_user_id)
);

create index if not exists live_decks_owner_idx
  on public.live_decks (owner_user_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- live_deck_questions: join (deck × questão)
-- ---------------------------------------------------------------------

create table if not exists public.live_deck_questions (
  deck_id uuid not null,
  question_id uuid not null,
  user_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (deck_id, question_id),
  -- FKs compostas garantem deck e questão do mesmo user
  constraint ldq_deck_fk foreign key (deck_id, user_id)
    references public.live_decks (id, owner_user_id) on delete cascade,
  constraint ldq_question_fk foreign key (question_id, user_id)
    references public.questions (id, user_id) on delete cascade
);

create index if not exists ldq_question_idx on public.live_deck_questions (question_id);

-- ---------------------------------------------------------------------
-- live_deck_grants: quem tem acesso a quais decks
-- ---------------------------------------------------------------------

create table if not exists public.live_deck_grants (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.live_decks (id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  -- Email do grantee. Aceita pre-grant (user ainda não criou conta).
  grantee_email text not null check (char_length(grantee_email) between 3 and 320),
  -- Resolvido quando user faz signup (handle_new_user).
  grantee_user_id uuid references auth.users(id) on delete cascade,
  -- MVP: só 'read'. Futuro: 'read_write'.
  permission text not null default 'read'
    check (permission in ('read', 'read_write')),
  created_at timestamptz not null default now(),
  -- Quando owner revoga. Após revogação, RLS bloqueia. Trigger cria
  -- snapshot pro grantee em shared_decks (Fase C2).
  revoked_at timestamptz,
  -- Token do snapshot gerado na revogação (link C2 pro grantee importar)
  frozen_share_token text,
  unique (deck_id, grantee_email)
);

create index if not exists ldg_owner_idx on public.live_deck_grants (owner_user_id);
create index if not exists ldg_grantee_user_idx
  on public.live_deck_grants (grantee_user_id) where revoked_at is null;
create index if not exists ldg_grantee_email_idx
  on public.live_deck_grants (lower(grantee_email)) where revoked_at is null;

-- ---------------------------------------------------------------------
-- RLS — owner CRUD próprio. Grantee read via JOIN.
-- ---------------------------------------------------------------------

alter table public.live_decks enable row level security;
alter table public.live_deck_questions enable row level security;
alter table public.live_deck_grants enable row level security;

-- Owner gerencia decks próprios.
drop policy if exists "ld_owner_all" on public.live_decks;
create policy "ld_owner_all" on public.live_decks
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Grantee pode SELECT decks que recebeu (mas não modificar).
drop policy if exists "ld_grantee_select" on public.live_decks;
create policy "ld_grantee_select" on public.live_decks
  for select to authenticated
  using (
    exists (
      select 1 from public.live_deck_grants g
      where g.deck_id = live_decks.id
        and g.grantee_user_id = auth.uid()
        and g.revoked_at is null
    )
  );

-- live_deck_questions: idem
drop policy if exists "ldq_owner_all" on public.live_deck_questions;
create policy "ldq_owner_all" on public.live_deck_questions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "ldq_grantee_select" on public.live_deck_questions;
create policy "ldq_grantee_select" on public.live_deck_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.live_deck_grants g
      where g.deck_id = live_deck_questions.deck_id
        and g.grantee_user_id = auth.uid()
        and g.revoked_at is null
    )
  );

-- live_deck_grants: owner gerencia, grantee vê apenas os próprios.
drop policy if exists "ldg_owner_all" on public.live_deck_grants;
create policy "ldg_owner_all" on public.live_deck_grants
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "ldg_grantee_select" on public.live_deck_grants;
create policy "ldg_grantee_select" on public.live_deck_grants
  for select to authenticated
  using (grantee_user_id = auth.uid());

-- Policy CHAVE: grantee SELECT em questions do owner se tem grant
-- ativo num deck que contém a questão.
drop policy if exists "questions_grantee_select" on public.questions;
create policy "questions_grantee_select" on public.questions
  for select to authenticated
  using (
    user_id != auth.uid()  -- só pra cross-user (own questions já têm policy)
    and exists (
      select 1
      from public.live_deck_questions ldq
      join public.live_deck_grants ldg on ldg.deck_id = ldq.deck_id
      where ldq.question_id = questions.id
        and ldg.grantee_user_id = auth.uid()
        and ldg.revoked_at is null
    )
  );

-- ---------------------------------------------------------------------
-- Trigger: ao revogar, gera snapshot via shared_decks (Fase C2)
-- pra grantee ter acesso permanente readonly ao estado naquele momento.
-- ---------------------------------------------------------------------

create or replace function public.freeze_grant_on_revoke()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_snapshot jsonb;
  v_count int;
  v_owner_email text;
  v_owner_display text;
begin
  -- Só dispara quando revoked_at é setado de null pra value
  if new.revoked_at is null then return new; end if;
  if old.revoked_at is not null then return new; end if;
  -- Sem grantee_user_id resolvido, pula (pre-grant nunca usado)
  if new.grantee_user_id is null then return new; end if;

  -- Lê snapshot atual das questões do deck (sanitizado: sem srs/stats
  -- do owner, sem ids — formato compatível com /api/share/[token]).
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'type', q.type,
      'disciplina_id', q.disciplina_id,
      'tema', q.tema,
      'banca_estilo', q.banca_estilo,
      'dificuldade', q.dificuldade,
      'payload', q.payload,
      'tags', q.tags,
      'origem', q.origem,
      'fonte', q.fonte,
      'verificacao', q.verificacao
    )
  ), '[]'::jsonb), count(*)
    into v_snapshot, v_count
    from public.live_deck_questions ldq
    join public.questions q on q.id = ldq.question_id
   where ldq.deck_id = new.deck_id
     and q.deleted_at is null;

  if v_count = 0 then return new; end if;

  -- Display do owner
  select email into v_owner_email from auth.users where id = new.owner_user_id;
  v_owner_display := coalesce(
    substring(coalesce(v_owner_email, '') from '^([^@]{1,4})') || '***@' ||
      split_part(coalesce(v_owner_email, '@'), '@', 2),
    'Anônimo'
  );

  -- Token: UUID hex sem hífens
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.shared_decks (
    token, owner_user_id, owner_display, filtro, snapshot, question_count,
    expires_at
  ) values (
    v_token,
    new.owner_user_id,
    v_owner_display,
    jsonb_build_object('source', 'live_deck_revoke', 'deck_id', new.deck_id),
    v_snapshot,
    v_count,
    now() + interval '365 days'  -- 1 ano pra grantee ter tempo de importar
  );

  -- Salva token no grant pra UI mostrar pro grantee
  new.frozen_share_token := v_token;
  return new;
end;
$$;

drop trigger if exists ldg_freeze_on_revoke on public.live_deck_grants;
create trigger ldg_freeze_on_revoke
  before update on public.live_deck_grants
  for each row execute function public.freeze_grant_on_revoke();

-- ---------------------------------------------------------------------
-- Trigger: handle_new_user resolve grants pendentes pelo email do
-- novo user (pre-grant). Encadeia com handle_new_user existente da
-- 0005, mas em function separada pra simplificar reuso.
-- ---------------------------------------------------------------------

create or replace function public.resolve_pending_grants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_deck_grants
     set grantee_user_id = new.id
   where lower(grantee_email) = lower(new.email)
     and grantee_user_id is null
     and revoked_at is null;
  return new;
end;
$$;

drop trigger if exists on_user_created_resolve_grants on auth.users;
create trigger on_user_created_resolve_grants
  after insert on auth.users
  for each row execute function public.resolve_pending_grants();

commit;
