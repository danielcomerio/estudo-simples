-- =====================================================================
-- Migration 0019 — Questões do Dia (engagement diário)
-- =====================================================================
-- Feature de retenção: todo dia o user recebe um conjunto de questões
-- pra responder. 2 modos:
--
-- (a) Comunidade: questões definidas pela plataforma (mesmas pra todos
--     no dia X). Permite ranking competitivo (% acerto + consistência).
--
-- (b) Pessoal: user define preferências (qtd, tipos, disciplinas) e
--     IA gera novas questões usando BYO key. Sem custo pro app.
--
-- Schema:
--   - daily_question_sets: 1 por dia, lista de question_ids (modo
--     comunidade). Curado por admin (master).
--   - daily_question_attempts: histórico de quem fez qual set, com
--     score + tempo total. Base do ranking.
--   - daily_preferences: prefs por user (qtd, tipos, hora de
--     notificação, ativo).
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------
-- daily_question_sets — 1 set por dia (comunidade)
-- ---------------------------------------------------------------------

create table if not exists public.daily_question_sets (
  id uuid primary key default gen_random_uuid(),
  -- Data alvo (YYYY-MM-DD em UTC)
  date date not null unique,
  -- Lista de question_ids. Curador (master) escolhe.
  question_ids uuid[] not null,
  -- Metadata pra display
  title text,
  description text,
  difficulty_avg numeric(3, 1),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Pra preview/lock (não publicar antes da hora)
  publish_at timestamptz not null default now()
);

create index if not exists daily_sets_publish_idx
  on public.daily_question_sets (publish_at, date);

alter table public.daily_question_sets enable row level security;

-- Qualquer logged user pode SELECT sets já publicados (publish_at <= now)
drop policy if exists "daily_sets_public_select" on public.daily_question_sets;
create policy "daily_sets_public_select" on public.daily_question_sets
  for select to authenticated
  using (publish_at <= now());

-- INSERT/UPDATE só admin (curado via service role).

-- ---------------------------------------------------------------------
-- daily_question_attempts — histórico do user
-- ---------------------------------------------------------------------

create table if not exists public.daily_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null references public.daily_question_sets(id) on delete cascade,
  -- % acerto
  score_pct int not null check (score_pct between 0 and 100),
  total_questions int not null check (total_questions > 0),
  correct_count int not null check (correct_count >= 0),
  -- Tempo total em segundos (pra desempate no ranking)
  duration_s int not null default 0,
  completed_at timestamptz not null default now(),
  -- 1 attempt por user por set (UNIQUE)
  unique (user_id, set_id)
);

create index if not exists daily_attempts_set_score_idx
  on public.daily_question_attempts (set_id, score_pct desc, duration_s asc);
create index if not exists daily_attempts_user_idx
  on public.daily_question_attempts (user_id, completed_at desc);

alter table public.daily_question_attempts enable row level security;

drop policy if exists "daily_attempts_own_all" on public.daily_question_attempts;
create policy "daily_attempts_own_all" on public.daily_question_attempts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Leitura pública pra ranking (todos podem ver score de todos no set)
drop policy if exists "daily_attempts_public_select" on public.daily_question_attempts;
create policy "daily_attempts_public_select" on public.daily_question_attempts
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- daily_preferences — modo pessoal
-- ---------------------------------------------------------------------

create table if not exists public.daily_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Habilita modo comunidade (recebe avisos do set comunitário)
  community_enabled boolean not null default true,
  -- Habilita modo pessoal (gera via IA usando BYO key)
  personal_enabled boolean not null default false,
  -- Configurações do modo pessoal
  personal_qtd int not null default 10 check (personal_qtd between 1 and 50),
  personal_types text[] not null default array['objetiva']::text[],
  personal_disciplinas text[] not null default '{}'::text[],
  -- Hora de envio (HH:MM em UTC)
  notify_hour smallint not null default 9 check (notify_hour between 0 and 23),
  notify_minute smallint not null default 0 check (notify_minute between 0 and 59),
  updated_at timestamptz not null default now()
);

alter table public.daily_preferences enable row level security;

drop policy if exists "daily_prefs_own_all" on public.daily_preferences;
create policy "daily_prefs_own_all" on public.daily_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
