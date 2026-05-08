-- =====================================================================
-- Migration 0030 — Eventos vinculados a concursos
-- =====================================================================
-- Pra além da `data_prova` única em concursos, permite múltiplos
-- eventos: simulado interno, redação, prova objetiva (data 1, data 2),
-- inscrição, etc.
--
-- ESCOPO INTENCIONAL: events SÃO child de concursos, não agenda
-- genérica. Mantém o app focado (escopo CURRENT, não PIVOT).
--
-- Idempotente.

begin;

create table if not exists public.concurso_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concurso_id uuid not null,
  -- FK composto (Gotcha #15) — exige UNIQUE (id, user_id) em concursos
  -- (presumivelmente já existe da 0002).
  type text not null check (
    type in (
      'inscricao_inicio',
      'inscricao_fim',
      'prova_objetiva',
      'prova_discursiva',
      'redacao',
      'taf',
      'simulado',
      'reuniao_estudo',
      'outro'
    )
  ),
  title text not null check (length(title) between 1 and 200),
  -- Date+time UTC. App converte pra BRT na UI.
  starts_at timestamptz not null,
  -- Opcional — se setado, evento tem duração; senão é instantâneo.
  ends_at timestamptz,
  notes text check (notes is null or length(notes) <= 2000),
  -- Lembrete: minutos antes pra notificar (null = sem reminder)
  reminder_minutes_before int check (
    reminder_minutes_before is null
    or (reminder_minutes_before between 0 and 43200) -- max 30 dias
  ),
  -- Track se já notificamos (cron usa pra não disparar 2x)
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- FK composto pra concursos
  foreign key (concurso_id, user_id)
    references public.concursos (id, user_id)
    on delete cascade
);

create index if not exists concurso_events_user_starts_idx
  on public.concurso_events (user_id, starts_at);
create index if not exists concurso_events_concurso_idx
  on public.concurso_events (concurso_id, starts_at);
create index if not exists concurso_events_pending_reminder_idx
  on public.concurso_events (starts_at, reminder_minutes_before)
  where notified_at is null and reminder_minutes_before is not null;

create or replace function public.concurso_events_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists concurso_events_updated_at on public.concurso_events;
create trigger concurso_events_updated_at
  before update on public.concurso_events
  for each row execute function public.concurso_events_set_updated_at();

alter table public.concurso_events enable row level security;

drop policy if exists "concurso_events_own_all" on public.concurso_events;
create policy "concurso_events_own_all" on public.concurso_events
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into public.applied_migrations (id, applied_at)
values ('0030', now())
on conflict (id) do update set applied_at = excluded.applied_at;

commit;
