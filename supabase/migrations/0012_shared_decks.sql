-- =====================================================================
-- Migration 0012 — shared_decks (Fase C2: snapshot filtrado de sharing)
-- =====================================================================
-- Permite ao usuário compartilhar um snapshot congelado de questões
-- com outras pessoas via link com token.
--
-- Modelo: SNAPSHOT (cópia, não live). Receptor importa pra sua conta
-- e fica dono pleno. Owner pode revogar mas snapshot já importado
-- continua funcionando — recipient é dono.
--
-- Acesso: por token na URL (UUID hex 32 chars). Sem RLS cross-user
-- complexa — token É o controle de acesso. Quem tem o token, tem
-- acesso (até expires_at, até revogação).
--
-- Restrito a Pro/Master no app (canShareDecks). DB não impõe — a UI
-- e a API são responsáveis (uma falha de gate na API expõe o feature
-- pra Free; aceitável tradeoff vs complicar RLS com check de plan).

begin;

create table if not exists public.shared_decks (
  id uuid primary key default gen_random_uuid(),
  -- Token público — UUID hex sem hífens, 32 chars. Suficiente entropia
  -- contra brute-force (2^128 espaço); embora rate limit no endpoint
  -- também ajude a deter scanners.
  token text not null unique check (char_length(token) between 16 and 64),

  -- Owner do deck (sempre o user que criou).
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  -- Display "amigável" do owner pra mostrar no preview do receptor.
  -- Default: parte local do email mascarada ("dani***@gmail.com").
  owner_display text not null check (char_length(owner_display) <= 100),

  -- Filtro aplicado quando o snapshot foi gerado. Salvar pra (a)
  -- exibir contexto pro receptor ("FGV · Direito Constitucional · 50q")
  -- e (b) eventualmente permitir refresh com mesmo critério.
  filtro jsonb not null default '{}'
    check (length(filtro::text) <= 4000),

  -- Cópia das questões no momento da geração. Cada item é um Question
  -- sanitizado (sem stats/srs do owner — receptor começa do zero) com
  -- ids regenerados na importação. Cap de 5MB pra não estourar limit
  -- de row jsonb do PG (1GB) e evitar abuso (compartilhar 100k de
  -- uma vez).
  snapshot jsonb not null
    check (length(snapshot::text) <= 5 * 1024 * 1024),
  question_count int not null check (question_count between 1 and 5000),

  created_at timestamptz not null default now(),
  -- Default 30 dias. Owner pode estender ou encurtar via UI futura.
  expires_at timestamptz not null default (now() + interval '30 days'),
  access_count int not null default 0,
  -- Quando owner revoga manualmente. Após revogação, GET por token
  -- retorna 410 Gone (snapshot read pelo owner ainda funciona, mas
  -- novos receptores não podem importar).
  revoked_at timestamptz,

  check (expires_at > created_at)
);

-- Index pra lookup por token (constant-time)
-- Já temos UNIQUE — basta. Sem índice secundário.

-- Index pra owner listar seus links
create index if not exists shared_decks_owner_idx
  on public.shared_decks (owner_user_id, created_at desc);

-- Index pra cleanup job futuro deletar expirados
create index if not exists shared_decks_expires_idx
  on public.shared_decks (expires_at)
  where revoked_at is null;

-- ---------------------------------------------------------------------
-- RLS — owner CRUD próprio. Acesso anônimo via token é via SERVICE
-- ROLE (endpoint /api/share/[token] usa supabase admin pra bypass).
-- ---------------------------------------------------------------------

alter table public.shared_decks enable row level security;

drop policy if exists "shared_decks_select_own" on public.shared_decks;
create policy "shared_decks_select_own" on public.shared_decks
  for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "shared_decks_insert_own" on public.shared_decks;
create policy "shared_decks_insert_own" on public.shared_decks
  for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "shared_decks_update_own" on public.shared_decks;
create policy "shared_decks_update_own" on public.shared_decks
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "shared_decks_delete_own" on public.shared_decks;
create policy "shared_decks_delete_own" on public.shared_decks
  for delete to authenticated
  using (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Helper: incrementa access_count atomicamente (evita race condition
-- com múltiplos opens simultâneos do mesmo link).
-- SECURITY DEFINER pra rodar com privilégios elevados, set search_path
-- pra defesa contra injection via search_path.
-- ---------------------------------------------------------------------

create or replace function public.shared_deck_increment_access(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shared_decks
     set access_count = access_count + 1
   where token = p_token
     and revoked_at is null
     and expires_at > now();
end;
$$;

revoke all on function public.shared_deck_increment_access(text) from public;
grant execute on function public.shared_deck_increment_access(text) to anon, authenticated;

commit;
