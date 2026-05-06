-- =====================================================================
-- Migration 0006 — Analytics events (privacy-first)
-- =====================================================================
-- Tabela append-only de eventos pra entender o funil de uso e
-- conversão. Privacidade-first:
--   - Sem PII, sem IP, sem User-Agent.
--   - user_id é nullable (visitantes ficam anônimos).
--   - User pode INSERT com auth.uid() em "user_id" próprio. Não pode
--     SELECT (privacidade — só admin via service role).
--
-- Eventos esperados (string convencionada):
--   landing.viewed, signup.started, signup.completed, login.completed,
--   guest.entered, checkout.started, checkout.completed,
--   subscription.canceled, session.completed (study).
--
-- Cardinalidade controlada: campos `event` curtos, `props` jsonb com
-- até umas 5 chaves no max. Cap de tamanho via CHECK.

begin;

create table if not exists public.analytics_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  event text not null check (length(event) <= 64),
  props jsonb not null default '{}' check (length(props::text) <= 4000),
  created_at timestamptz not null default now()
);

comment on table public.analytics_events is
  'Eventos de uso (privacy-first). Sem PII. User_id pode ser null (visitante).';

create index if not exists idx_analytics_events_event_created
  on public.analytics_events(event, created_at desc);
create index if not exists idx_analytics_events_user_created
  on public.analytics_events(user_id, created_at desc);

alter table public.analytics_events enable row level security;

-- Permite INSERT pelo próprio user (auth.uid() ou null pra anônimo).
-- Anônimo: precisa de role 'anon'. Auth: precisa que user_id == auth.uid()
-- ou seja null (decisão: aceitar null sempre pra simplicidade).
drop policy if exists "anyone inserts own event" on public.analytics_events;
create policy "anyone inserts own event" on public.analytics_events
  for insert
  with check (
    user_id is null
    or user_id = auth.uid()
  );

-- SEM policy de SELECT/UPDATE/DELETE — admin via service role.

-- =====================================================================
-- Newsletter / lead capture
-- =====================================================================
-- Captura de email pra leads que ainda não viraram conta. Útil pra
-- nurture: mandar conteúdo educacional, aviso de release, etc.
--
-- Privacy: email é PII — RLS exige que só admin via service role leia.
-- Anon pode INSERT (lead capture form na landing). Limit do Supabase
-- Auth + rate limit no endpoint cobrem abuse.

create table if not exists public.newsletter_signups (
  id bigserial primary key,
  email text not null,
  source text,                       -- "landing-hero", "footer", etc.
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,       -- não-null = optou sair
  unsubscribe_token text unique      -- pra link de unsubscribe
);

create unique index if not exists uq_newsletter_email_active
  on public.newsletter_signups(lower(email))
  where unsubscribed_at is null;

comment on table public.newsletter_signups is
  'Leads não-autenticados. Email duplicado bloqueado por unique index ativo.';

alter table public.newsletter_signups enable row level security;

-- Anon inserts permitidos (form público na landing)
drop policy if exists "anon inserts newsletter signup" on public.newsletter_signups;
create policy "anon inserts newsletter signup"
  on public.newsletter_signups
  for insert to anon, authenticated
  with check (true);

-- SEM policy de SELECT — só service role lê.
-- Unsubscribe é via endpoint /api/newsletter/unsubscribe?token=... usando
-- service role.

commit;
