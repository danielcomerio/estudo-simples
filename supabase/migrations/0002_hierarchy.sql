-- =====================================================================
-- Estudo Simples — Hierarquia: Concursos, Disciplinas, Tópicos, Edital
-- + Tags e topico_id em questions.
--
-- Decisões de segurança (defense-in-depth):
--  * RLS habilitada em todas as novas tabelas, com 4 policies separadas
--    (select/insert/update/delete) sempre com auth.uid() = user_id.
--  * user_id em TODAS as tabelas (inclusive join e edital_itens). Custo
--    irrisório, ganho enorme: simplifica RLS e habilita FKs compostos.
--  * FKs compostos (id, user_id) → (id, user_id) garantem que um usuário
--    nunca consiga referenciar concurso/disciplina/tópico de outro
--    usuário, mesmo se a RLS for bypassada por bug.
--  * CHECK constraints em campos textuais limitam tamanho (defesa
--    contra payload abusivo) e formato (cor hex, status enum).
--  * Idempotente: re-rodável sem erro graças a `if not exists` /
--    `drop ... if exists`.
-- =====================================================================

-- ============== Concursos ==============
create table if not exists public.concursos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  nome            text not null check (char_length(nome) between 1 and 200),
  banca           text check (banca is null or char_length(banca) between 1 and 100),
  orgao           text check (orgao is null or char_length(orgao) between 1 and 200),
  cargo           text check (cargo is null or char_length(cargo) between 1 and 200),
  data_prova      date,
  status          text not null default 'ativo'
                    check (status in ('ativo', 'arquivado', 'concluido')),
  edital_url      text check (edital_url is null or char_length(edital_url) <= 2048),
  notas           text check (notas is null or char_length(notas) <= 10000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  -- Necessário pra FKs compostos vindos das tabelas filhas.
  unique (id, user_id)
);

create index if not exists concursos_user_active_idx
  on public.concursos (user_id) where deleted_at is null;
create index if not exists concursos_user_updated_idx
  on public.concursos (user_id, updated_at);
create index if not exists concursos_user_status_idx
  on public.concursos (user_id, status) where deleted_at is null;

-- ============== Disciplinas ==============
create table if not exists public.disciplinas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  nome            text not null check (char_length(nome) between 1 and 200),
  peso_default    numeric(6,2) check (peso_default is null or peso_default > 0),
  cor             text check (cor is null or cor ~ '^#[0-9a-fA-F]{6}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (id, user_id)
);

-- Nome único por usuário (case-insensitive), só entre ativas.
create unique index if not exists disciplinas_user_nome_uidx
  on public.disciplinas (user_id, lower(nome)) where deleted_at is null;

create index if not exists disciplinas_user_active_idx
  on public.disciplinas (user_id) where deleted_at is null;
create index if not exists disciplinas_user_updated_idx
  on public.disciplinas (user_id, updated_at);

-- ============== Concurso × Disciplina (join com peso) ==============
create table if not exists public.concurso_disciplinas (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  concurso_id           uuid not null,
  disciplina_id         uuid not null,
  peso                  numeric(6,2) not null default 1 check (peso > 0),
  qtd_questoes_prova    int check (qtd_questoes_prova is null or qtd_questoes_prova > 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Defense-in-depth: força que concurso e disciplina sejam do mesmo
  -- user_id desta linha. Impossível inserir cross-user mesmo com bypass
  -- de RLS.
  foreign key (concurso_id, user_id)
    references public.concursos (id, user_id) on delete cascade,
  foreign key (disciplina_id, user_id)
    references public.disciplinas (id, user_id) on delete cascade,
  unique (concurso_id, disciplina_id)
);

create index if not exists concurso_disc_user_idx
  on public.concurso_disciplinas (user_id);
create index if not exists concurso_disc_concurso_idx
  on public.concurso_disciplinas (concurso_id);
create index if not exists concurso_disc_disciplina_idx
  on public.concurso_disciplinas (disciplina_id);

-- ============== Tópicos (hierárquicos) ==============
create table if not exists public.topicos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  disciplina_id     uuid not null,
  parent_topico_id  uuid,
  nome              text not null check (char_length(nome) between 1 and 200),
  ordem             int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  foreign key (disciplina_id, user_id)
    references public.disciplinas (id, user_id) on delete cascade,
  -- Auto-FK compositional pra parent: garante que filho não pode
  -- apontar pra tópico de outro usuário. Cycles são evitados pela camada
  -- de aplicação (UUIDs aleatórios + parent definido antes do filho).
  foreign key (parent_topico_id, user_id)
    references public.topicos (id, user_id) on delete cascade,
  unique (id, user_id)
);

create index if not exists topicos_user_active_idx
  on public.topicos (user_id) where deleted_at is null;
create index if not exists topicos_disciplina_idx
  on public.topicos (disciplina_id) where deleted_at is null;
create index if not exists topicos_parent_idx
  on public.topicos (parent_topico_id) where deleted_at is null;
create index if not exists topicos_user_updated_idx
  on public.topicos (user_id, updated_at);

-- ============== Edital itens ==============
create table if not exists public.edital_itens (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  concurso_id       uuid not null,
  topico_id         uuid,
  texto_original    text not null check (char_length(texto_original) between 1 and 2000),
  ordem             int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  foreign key (concurso_id, user_id)
    references public.concursos (id, user_id) on delete cascade,
  foreign key (topico_id, user_id)
    references public.topicos (id, user_id) on delete set null
);

create index if not exists edital_itens_user_active_idx
  on public.edital_itens (user_id) where deleted_at is null;
create index if not exists edital_itens_concurso_idx
  on public.edital_itens (concurso_id) where deleted_at is null;
create index if not exists edital_itens_topico_idx
  on public.edital_itens (topico_id) where deleted_at is null;

-- ============== Questions: novos campos ==============
-- ALTERs aditivos. Dados existentes ganham:
--   * topico_id e concurso_id null (preservar comportamento antigo)
--   * tags como array vazio (default)
alter table public.questions
  add column if not exists topico_id   uuid,
  add column if not exists concurso_id uuid,
  add column if not exists tags        text[] not null default array[]::text[]
    check (array_length(tags, 1) is null or array_length(tags, 1) <= 30);

-- FKs compostos pra mesma garantia anti-cross-user.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'questions_topico_user_fk'
  ) then
    alter table public.questions
      add constraint questions_topico_user_fk
        foreign key (topico_id, user_id)
        references public.topicos (id, user_id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'questions_concurso_user_fk'
  ) then
    alter table public.questions
      add constraint questions_concurso_user_fk
        foreign key (concurso_id, user_id)
        references public.concursos (id, user_id) on delete set null;
  end if;
end $$;

create index if not exists questions_topico_idx
  on public.questions (topico_id) where deleted_at is null;
create index if not exists questions_concurso_idx
  on public.questions (concurso_id) where deleted_at is null;
-- GIN pra busca facetada por tag (where tags @> array['x']).
create index if not exists questions_tags_gin_idx
  on public.questions using gin (tags) where deleted_at is null;

-- ============== Triggers updated_at ==============
-- Reusa a função public.set_updated_at() já criada na 0001.

drop trigger if exists set_updated_at_concursos on public.concursos;
create trigger set_updated_at_concursos
  before update on public.concursos
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_disciplinas on public.disciplinas;
create trigger set_updated_at_disciplinas
  before update on public.disciplinas
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_concurso_disciplinas on public.concurso_disciplinas;
create trigger set_updated_at_concurso_disciplinas
  before update on public.concurso_disciplinas
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_topicos on public.topicos;
create trigger set_updated_at_topicos
  before update on public.topicos
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_edital_itens on public.edital_itens;
create trigger set_updated_at_edital_itens
  before update on public.edital_itens
  for each row execute function public.set_updated_at();

-- ============== Row Level Security ==============
alter table public.concursos              enable row level security;
alter table public.disciplinas            enable row level security;
alter table public.concurso_disciplinas   enable row level security;
alter table public.topicos                enable row level security;
alter table public.edital_itens           enable row level security;

-- Bloqueia tudo por default; políticas abaixo abrem só pra dono.

-- ---- concursos ----
drop policy if exists "concursos select own" on public.concursos;
create policy "concursos select own"
  on public.concursos for select
  using (auth.uid() = user_id);

drop policy if exists "concursos insert own" on public.concursos;
create policy "concursos insert own"
  on public.concursos for insert
  with check (auth.uid() = user_id);

drop policy if exists "concursos update own" on public.concursos;
create policy "concursos update own"
  on public.concursos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "concursos delete own" on public.concursos;
create policy "concursos delete own"
  on public.concursos for delete
  using (auth.uid() = user_id);

-- ---- disciplinas ----
drop policy if exists "disciplinas select own" on public.disciplinas;
create policy "disciplinas select own"
  on public.disciplinas for select
  using (auth.uid() = user_id);

drop policy if exists "disciplinas insert own" on public.disciplinas;
create policy "disciplinas insert own"
  on public.disciplinas for insert
  with check (auth.uid() = user_id);

drop policy if exists "disciplinas update own" on public.disciplinas;
create policy "disciplinas update own"
  on public.disciplinas for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "disciplinas delete own" on public.disciplinas;
create policy "disciplinas delete own"
  on public.disciplinas for delete
  using (auth.uid() = user_id);

-- ---- concurso_disciplinas ----
drop policy if exists "concurso_disc select own" on public.concurso_disciplinas;
create policy "concurso_disc select own"
  on public.concurso_disciplinas for select
  using (auth.uid() = user_id);

drop policy if exists "concurso_disc insert own" on public.concurso_disciplinas;
create policy "concurso_disc insert own"
  on public.concurso_disciplinas for insert
  with check (auth.uid() = user_id);

drop policy if exists "concurso_disc update own" on public.concurso_disciplinas;
create policy "concurso_disc update own"
  on public.concurso_disciplinas for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "concurso_disc delete own" on public.concurso_disciplinas;
create policy "concurso_disc delete own"
  on public.concurso_disciplinas for delete
  using (auth.uid() = user_id);

-- ---- topicos ----
drop policy if exists "topicos select own" on public.topicos;
create policy "topicos select own"
  on public.topicos for select
  using (auth.uid() = user_id);

drop policy if exists "topicos insert own" on public.topicos;
create policy "topicos insert own"
  on public.topicos for insert
  with check (auth.uid() = user_id);

drop policy if exists "topicos update own" on public.topicos;
create policy "topicos update own"
  on public.topicos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "topicos delete own" on public.topicos;
create policy "topicos delete own"
  on public.topicos for delete
  using (auth.uid() = user_id);

-- ---- edital_itens ----
drop policy if exists "edital select own" on public.edital_itens;
create policy "edital select own"
  on public.edital_itens for select
  using (auth.uid() = user_id);

drop policy if exists "edital insert own" on public.edital_itens;
create policy "edital insert own"
  on public.edital_itens for insert
  with check (auth.uid() = user_id);

drop policy if exists "edital update own" on public.edital_itens;
create policy "edital update own"
  on public.edital_itens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "edital delete own" on public.edital_itens;
create policy "edital delete own"
  on public.edital_itens for delete
  using (auth.uid() = user_id);
