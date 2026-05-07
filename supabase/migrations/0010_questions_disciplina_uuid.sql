-- =====================================================================
-- Migration 0010 — questions.disciplina_uuid (FK pra disciplinas.id)
-- =====================================================================
-- Fase B da reforma de organização. Hoje questions.disciplina_id é TEXT
-- (nome cru). Vai ser substituído por disciplina_uuid uuid REFERENCES
-- disciplinas(id) — relação rígida e correta.
--
-- Estratégia de transição (3 migrations):
--  - 0010 (esta): adiciona disciplina_uuid nullable + tenta backfill
--    automático via lower(nome) match. App rodando código antigo
--    continua funcionando (lê disciplina_id text). Código novo escreve
--    em AMBOS (dual-write) durante a transição — Gotcha #13 em vigor.
--  - 0011 (futura): dedup_hash passa a usar disciplina_uuid (com
--    fallback pra disciplina_id text enquanto algumas linhas têm
--    uuid null). FK dual-write continua.
--  - 0012 (futura): NOT NULL constraint em disciplina_uuid (assumindo
--    backfill 100%). Drop disciplina_id text. dedup_hash final.
--
-- Idempotente. Não-destrutiva. Aditiva por design.

begin;

-- ---------------------------------------------------------------------
-- 1. Adiciona coluna nullable
-- ---------------------------------------------------------------------

alter table public.questions
  add column if not exists disciplina_uuid uuid;

-- ---------------------------------------------------------------------
-- 2. FK composta com user_id (defense-in-depth: impossível atribuir
--    questão a disciplina de OUTRO user mesmo via SQL direto)
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'questions_disciplina_uuid_fkey'
  ) then
    alter table public.questions
      add constraint questions_disciplina_uuid_fkey
      foreign key (disciplina_uuid, user_id)
      references public.disciplinas(id, user_id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Index pra lookups (filtro "questões da disciplina X" por uuid)
-- ---------------------------------------------------------------------

create index if not exists questions_user_disciplina_uuid_idx
  on public.questions (user_id, disciplina_uuid)
  where deleted_at is null and disciplina_uuid is not null;

-- ---------------------------------------------------------------------
-- 4. Backfill automático: pra cada questão com disciplina_id text mas
--    sem disciplina_uuid, procura disciplina do mesmo user com
--    lower(nome) = lower(disciplina_id text) e atribui.
--
--    Cobertura ~95% — não cobre quando disciplina_id text tem acento
--    diferente do nome cadastrado ("Matemática" vs "matematica" — só
--    bate por slug, não por lower). Esses 5% restantes ficam null e
--    o app preenche client-side via slug match (lib/normalize) na
--    primeira sincronização pós-update do código.
--
--    Idempotente: roda sempre, mas só atualiza linhas que precisam.
-- ---------------------------------------------------------------------

update public.questions q
   set disciplina_uuid = d.id
  from public.disciplinas d
 where q.disciplina_uuid is null
   and q.disciplina_id is not null
   and d.user_id = q.user_id
   and d.deleted_at is null
   and lower(d.nome) = lower(q.disciplina_id);

-- Log do quanto sobrou pra backfill client-side (informativo)
do $$
declare
  total int;
  backfilled int;
  remaining int;
begin
  select count(*) into total from public.questions
   where disciplina_id is not null and deleted_at is null;
  select count(*) into backfilled from public.questions
   where disciplina_uuid is not null and deleted_at is null;
  remaining := total - backfilled;
  raise notice 'disciplina_uuid backfill: % de % cobertas (% remanescentes pra client-side)',
    backfilled, total, remaining;
end $$;

commit;
