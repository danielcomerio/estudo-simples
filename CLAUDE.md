# Contexto do projeto — para o Claude

App de **repetição espaçada para concursos públicos** (FGV em primeiro plano).
Migração inicial em 2026-04-25 de um SPA standalone (HTML/CSS/JS +
localStorage) para **Next.js 14 + Supabase + Vercel**, com autenticação
por email/senha e cada usuário em sua própria instância (RLS).

A Onda 0 (2026-04-29 → 2026-04-30) consolidou: hierarquia (concursos,
disciplinas, tópicos, edital), FSRS opt-in convivendo com SM-2, edição
inline de questão, anotações pessoais e bulk-assign de tópico.

A documentação voltada ao usuário final está em [`README.md`](README.md). Este
arquivo é o briefing para sessões futuras de Claude — capture o "porquê" das
decisões e os bugs que já machucaram, não o "o que está em cada arquivo".

---

## Stack

- **Next.js 14.2.x** (App Router, `src/` directory) — versão patch flutua
  via `^14.2.35`. Subir só dentro da série 14.2 (Next 15+ requer migração
  de cookies/etc; ver Gotcha #5).
- **TypeScript estrito**, **React 18.3** (não 19 — ver Gotcha #4).
- **Supabase**: Auth (email/senha) + Postgres + RLS via `@supabase/ssr ^0.5`.
- **ts-fsrs ^5.3** (Onda 0.5): adapter FSRS-6 sobre nosso tipo SRS,
  convive com SM-2 sem perder dados.
- **tsx ^4.21** (devDep): executor TS pra scripts em `scripts/`.
- **Vitest ^4.1** (devDep): test runner. Vitest 4 (não 2) deliberado pra
  evitar CVEs dev-only de esbuild/vite v2.
- **Sem** Tailwind, shadcn, zustand, react-query, ou qualquer UI lib.
  CSS puro com variáveis em `src/app/globals.css`. Store próprio sobre
  `useSyncExternalStore`. Decisão deliberada — o usuário rejeitou Tailwind
  ao propor: app pequeno, sem dialogs/comboboxes complexos, custo de
  migração não compensaria.
- **Vercel** com `vercel.json { "framework": "nextjs" }` (necessário porque
  o projeto Vercel foi criado antes do código existir e ficou marcado
  como "Other").

## Princípios arquiteturais

1. **Offline-first para `questions`.** localStorage é a fonte de leitura;
   Supabase é destino de sincronia em background. Nada na UI espera
   resposta de rede.
2. **Online-first para hierarquia.** Concursos/disciplinas/tópicos são
   baixo volume (dezenas) e mudam pouco — não justificam complexidade
   de sync. Ficam em cache em memória via `lib/hierarchy.ts`, refetch
   após mutações.
3. **Validação em camadas.** UI valida (UX) → lib valida (defense-in-depth)
   → DB CHECK + RLS rejeita o que escapou. Nunca confiar em uma só.
4. **Mutações tipadas em um único lugar.** `questions` passam por
   `lib/store.ts`; hierarquia passa por `lib/hierarchy.ts`. Não mexa no
   `state` direto nem instancie supabase client em componente.
5. **Sem dependências de UI.** Toast, ConfirmDialog, etc., são componentes
   próprios em `src/components/`.
6. **Server Components só onde compensa** (auth check do layout). O resto
   é client component porque depende de localStorage e interatividade.

## Como o sync funciona

`lib/sync.ts` orquestra **só `questions`** (hierarquia não passa por
aqui — ver `lib/hierarchy.ts`).

- `pushPending()`: percorre `state.pendingSync`, faz `upsert` em chunks
  de 100 com `deleted_at` quando soft-deletadas. Em sucesso, limpa
  `pendingSync` e marca `_dirty: false`.
- `pullSince()`: pagina manualmente em páginas de 1000 (`.range()` +
  `.gte(updated_at, lastPullAt)`). Usa `.gte` em vez de `.gt` para não
  perder linhas com timestamps idênticos (caso de upsert em lote — todas
  as linhas da mesma transação compartilham `now()`). Dedupe acontece
  por id em `mergeFromServer`. Teto de 100 páginas (100k linhas).
- `syncNow()`: push depois pull, com lock (`inflight`) e tratamento de
  estado (idle/syncing/error/offline).
- `scheduleSync(ms)`: debounce — chamado após cada mutação, default 1500ms.
- `startBackgroundSync()`: kick inicial + polling 60s + listeners
  `online` e `focus`.

Conflitos: quem grava por último ganha (server `now()` no trigger
`updated_at`). Mutações locais não-flushadas são protegidas em pulls
via `pendingSync` (não sobrescrevemos local quando há push pendente).

**CRÍTICO** (ver Gotcha #13): `questionToRow()` e `rowToQuestion()`
mapeiam explicitamente cada campo. Adicionar coluna nova em `questions`
exige editar AMBAS — senão push apaga e pull ignora silenciosamente.

## Como o store funciona

`lib/store.ts` é um zustand-lite caseiro **só pra `questions`**:

- Variável `state` no escopo do módulo, substituída inteira a cada `setState`.
- `Set<listener>` notificado em cada mudança.
- Hook `useStore(selector)` usa `useSyncExternalStore` **com cache via
  `useRef`** — sem isso, selectors que retornam novos arrays
  (`questions.filter`, `Array.from(new Set(...))`) provocam loop infinito
  porque `useSyncExternalStore` compara via `Object.is`.
- Mutações: `addQuestion(s?)`, `updateQuestionLocal`, `deleteQuestion(s?)`,
  `mergeFromServer`, `clearPending`, `purgeDeletedLocal`. Sempre marcam
  `pendingSync` quando aplicável.
- `hydrate(userId)`: chamado UMA vez no mount do `StoreProvider`. Carrega
  do localStorage, se o `userId` mudou desde a última sessão limpa o cache.

`lib/hierarchy.ts` (Onda 0.4) é um **cache em memória separado** para
concursos/disciplinas/tópicos. Cada entidade tem `loadX/createX/updateX/
softDeleteX/useX`. Sem localStorage, sem sync diferido — refetch on
mutate. `clearHierarchyCache()` é chamado no logout (StoreProvider).
Padrão deliberado: volume baixo justifica simplicidade.

`lib/settings.ts` (Onda 0.5) guarda preferências em localStorage,
hoje só `algorithm: 'sm2' | 'fsrs'`. `useAlgorithm()` é hook reativo
inclusive a `storage` event de outras tabs. Quando crescer pra 3+
settings, refatorar pra objeto único; quando precisar sync entre
dispositivos, mover pra tabela `user_settings` no DB.

## Como o SRS funciona

Dois algoritmos coexistem desde a Onda 0.5. Default é SM-2 por compat;
FSRS é opt-in via `/configuracoes` → "Algoritmo de revisão".

**Ponto de entrada único:** `applyReview(card, quality, algorithm)` em
`lib/srs-fsrs.ts`. Caller (QuestionRunner, DiscursivaRunner) chama
`useAlgorithm()` e passa o resultado.

### SM-2 (`lib/srs.ts`) — `applySRS(card, q)`

- `q=0` (De novo): zera repetições, intervalo 0 (mesmo dia).
- `q=3` (Difícil): progressão usa `max(1.2, EF − 0.15)` em vez de EF cheio.
- `q=4` (Bom): progressão padrão (1d → 6d → 6d × EF → ...).
- `q=5` (Fácil): intervalo final ×1.3.
- EF clamp em [1.3, ~3.0] pela fórmula clássica de Wozniak.

### FSRS-6 (`lib/srs-fsrs.ts`) — `applyFSRS(card, q)`

- Wrapper sobre `ts-fsrs` 5.3 com `request_retention=0.9`,
  `enable_fuzz=false` (determinismo pra testes).
- Mapeia quality 0-5 → Grade FSRS (Again/Hard/Good/Easy).
- `srsToFsrsCard`: SRS sem stability/difficulty → `createEmptyCard`
  (primeira passada calibra). Com FSRS data → reconstrói card.
- `fsrsCardToSrs`: **incrementa `repetitions`** em vez de copiar
  `card.reps` (que reseta em createEmptyCard pra cards migrados de
  SM-2). Preserva `easeFactor` (SM-2) intacto pra permitir voltar.
- Defesa contra clock-skew: `elapsed_days >= 0`. Defesa contra
  interval negativo (corrupção): `scheduled_days >= 0`.

### Convivência

A SRS struct ganhou fields opcionais (`stability`, `difficulty`, `state`,
`lapses`). Trocar de algoritmo NÃO corrompe — fields do anterior ficam
intactos, próxima revisão usa só o atual. Testado em
`__tests__/srs-fsrs.test.ts`.

Para discursivas, `suggestQualityFromScore(pct)` mapeia <40/40-65/65-85/>85 → 0/3/4/5.

## Schema do banco

Duas migrations canônicas:

### `0001_initial.sql` — questions

- Tabela única `questions(id, user_id, type, disciplina_id, tema, banca_estilo,
  dificuldade, payload jsonb, srs jsonb, stats jsonb, dedup_hash generated,
  created_at, updated_at, deleted_at)`.
- **Híbrido** colunas indexadas + `payload jsonb` com o conteúdo cru
  (enunciado, alternativas, espelho, etc.). Trade-off escolhido: queries
  simples são rápidas, mudar formato JSON não exige migration. Normalizar
  alternativas em outra tabela seria overkill (decisão acordada).
- 4 índices parciais `where deleted_at is null` + 1 para `updated_at`
  (sync) + 1 único para dedupe por `(user_id, dedup_hash)`.
- Trigger `set_updated_at` em update.
- RLS habilitada com 4 policies separadas (select/insert/update/delete),
  todas `auth.uid() = user_id`.

### `0002_hierarchy.sql` — concursos/disciplinas/topicos/edital + tags

5 tabelas novas: `concursos`, `disciplinas`, `concurso_disciplinas` (join
com peso), `topicos` (auto-FK pra parent), `edital_itens` (texto cru
mapeado a tópico). E 3 colunas em `questions`: `topico_id`, `concurso_id`,
`tags text[]`.

Decisões deliberadas (defense-in-depth):
- **`user_id` em TODAS as tabelas**, inclusive joins. Custo irrisório,
  ganho enorme: simplifica RLS e habilita FKs compostos.
- **FKs compostos `(id, user_id) → parent(id, user_id)`** em todas as
  referências entre tabelas da hierarquia. Garante que ninguém referencia
  recurso de outro user mesmo com bypass de RLS. Requer `unique (id,
  user_id)` extra em todo parent — custo de 1 índice por tabela.
- CHECK constraints em comprimento de texto (200 chars pra nome, 10k pra
  notas, etc.) e formato (cor `^#[0-9a-fA-F]{6}$`, status enum).
- `tags` com cap 30 itens, índice GIN parcial pra `where tags @> '{...}'`.
- Idempotente (re-rodável com `if not exists`, `do $$` em alterações
  condicionais).
- Down migration em `0002_hierarchy_down.sql` — reverte ALTERs em
  questions e drop cascade nas 5 novas. Triggers e policies caem junto.

**Próxima migration deve ser 0003.** Não editar 0001/0002.

## Auth

- Server Actions em `src/app/auth/actions.ts` — `login`, `signup`, `logout`.
  Usam `useFormState` do `react-dom` (não `useActionState`, que é React 19).
- Middleware em `src/middleware.ts` (NÃO na raiz — ver Gotchas).
- Callback de confirmação de email em `src/app/auth/callback/route.ts`.
- Layout root é Server Component que faz `getUser()` e injeta no
  `StoreProvider`. Se `user=null`, layout NÃO renderiza Provider — então
  middleware **tem que estar funcionando**, senão tudo pifa silenciosamente.

## Gotchas (já cometidos, não repetir)

1. **Middleware vai em `src/middleware.ts`**, não na raiz, quando o
   projeto usa `src/`. Na raiz é silenciosamente ignorado pelo Next.js.
   O sintoma do bug era "skeleton infinito no dashboard": user=null →
   sem Provider → sem hydrate → `hydrated` permanece false. Verificação
   rápida: `npx next build` deve listar `ƒ Middleware` no output.

2. **`useStore` precisa cachear o resultado do selector.** Sem cache,
   selectors que retornam novos arrays (`questions.filter(...)`)
   provocam loop infinito em `useSyncExternalStore` (Object.is detecta
   "mudou" toda render). Implementação atual: `useRef` com par
   `{ src, value }` invalidado quando `state` muda de referência.

3. **PostgREST corta em 1000 linhas** mesmo com `.limit(2000)`. Solução:
   paginação manual em `pullSince` com `.range()`. Use `.gte` (não `.gt`)
   no cursor pra não perder rows com timestamp igual (upsert em lote
   compartilha `now()`). `mergeFromServer` dedupa por id, então o
   re-pull é gratuito.

4. **React 18 ≠ React 19.** Não use `useActionState` (React 19 only);
   use `useFormState` + `useFormStatus` de `react-dom`. Detectado no
   build com warning "Attempted import error".

5. **`cookies()` em Next 14 é sync, em Next 15 é async.** Usei `await
   cookies()` no `lib/supabase/server.ts` — funciona nos dois (await
   sobre não-promise é no-op).

6. **Vercel não autodetecta Next.js se o projeto foi criado vazio.**
   Sintoma: "No Output Directory named 'public' found". Fix: `vercel.json
   { "framework": "nextjs" }` ou ajustar Framework Preset no dashboard.

7. **Soft-delete obrigatório pra sync funcionar entre dispositivos.**
   Hard-delete em uma máquina não consegue avisar a outra. Locamente
   marcamos `deleted_at`, ocultamos da UI, sincronizamos, e
   `purgeDeletedLocal()` limpa depois.

8. **Dedup de import** por `disciplina_id + (enunciado | enunciado_completo)`
   no client (`validation.ts`) **e** como índice único parcial no DB.
   Camada cliente é UX (relatório "X duplicadas"); DB é segurança.

9. **`NEXT_PUBLIC_*` vai pro bundle do client.** `SUPABASE_SERVICE_ROLE_KEY`
   nunca deve ter prefixo `NEXT_PUBLIC_` nem ser referenciada em código
   que pode rodar no client. Não está sendo usada em lugar nenhum hoje.

10. **Trocar de usuário no mesmo browser**: `hydrate()` detecta via
    `STORAGE_KEY_USER` e limpa o cache antes de carregar. Não confie
    no localStorage ser do mesmo dono entre sessões.

11. **`renderTextWithCode`** trata blocos ` ``` ... ``` ` como `<pre>`.
    Restante é HTML-escaped + `\n → <br>`. Insere via
    `dangerouslySetInnerHTML` — seguro porque escapamos antes.

12. **BOM em JSON colado**: `safeParseJSON` strip `﻿` no início.
    Detectado durante testes da v1 standalone.

13. **`questionToRow` e `rowToQuestion` em `lib/sync.ts`** mapeiam cada
    coluna **explicitamente**. Adicionar coluna nova em `questions` SEM
    atualizar essas duas funções resulta em: push apaga o campo no servidor,
    pull ignora valor do servidor. Bug silencioso, descoberto na 0.4.4 com
    `topico_id`/`concurso_id`/`tags`.

14. **Soft-delete em hierarquia auto-relacional não cascateia**: o FK
    `on delete cascade` da migration 0002 só roda em hard-delete. Pra
    `topicos` (filhos via `parent_topico_id`), `softDeleteTopico` faz
    BFS na cache pra marcar todos os descendentes — senão filhos ficam
    órfãos visíveis. Padrão aplicável a qualquer entidade hierárquica
    futura.

15. **Composite FK `(id, user_id) → parent(id, user_id)`** exige `UNIQUE
    (id, user_id)` no parent. Esse `UNIQUE` parece redundante com PK em `id`
    sozinho, mas o Postgres exige a tupla composta como unique constraint
    real. Custo: 1 índice extra por tabela. Vale o ganho de defense-in-
    depth contra cross-user. Padrão da migration 0002.

16. **localStorage de hierarquia NÃO existe.** Diferente de `questions`
    (offline-first), concursos/disciplinas/tópicos só vivem em cache em
    memória via `lib/hierarchy.ts`. Logout limpa via
    `clearHierarchyCache()` (chamado pelo StoreProvider). Não vaza entre
    sessões/users.

17. **Vulnerabilidades aceitas no audit**: 5 high/moderate (eslint-config-
    next/glob CLI command-injection — devDep CLI não invocada; Next 14.2.x
    DoS adicionais — não exploráveis nesta config porque app não usa
    `next/image`/`rewrites`/`redirects`; postcss XSS em `</style>` — build-
    time, fonte sob nosso controle). Documentadas no commit 75d0b44 da
    Onda 0.1. Subir pra Next 15+ resolve todas mas é mudança maior.

## Comandos

```bash
npm install              # uma vez
npm run dev              # http://localhost:3000
npm run build            # validar antes de push
npm run typecheck        # tsc --noEmit (rápido)
npm test                 # Vitest (60+ testes em src/lib/__tests__/)
npm run test:watch       # modo dev
git push                 # Vercel auto-deploya (~1min)
```

Build local sem env reais: prefixe com placeholders pra não falhar:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x npm run build
```

Backfill de disciplinas (depois de aplicar migration 0002 no Supabase):
```bash
export NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
export SUPABASE_EMAIL=...
export SUPABASE_PASSWORD=...
npm run backfill:disciplinas -- --dry-run    # preview
npm run backfill:disciplinas                  # apply
```
Idempotente. Usa anon key + login (nunca service role). Detalhes no
header de `scripts/backfill-disciplinas.ts`.

## Convenções específicas

- Arquivos client começam com `'use client';`.
- Componentes em `src/components/`, páginas em `src/app/<rota>/page.tsx`,
  lógica pura em `src/lib/`, testes em `src/lib/__tests__/*.test.ts`.
- Scripts CLI em `scripts/` (executados via `tsx` por npm scripts).
- Path alias `@/` aponta pra `src/`.
- Toasts: `import { toast } from '@/components/Toast'`. Use kinds
  `'success' | 'error' | 'warn' | ''`.
- Confirmações destrutivas: `import { confirmDialog } from
  '@/components/ConfirmDialog'`. Sempre passe `danger: true` para
  exclusões.
- Hierarquia: `import { useConcursos, useDisciplinas, useTopicos,
  createX, updateX, softDeleteX } from '@/lib/hierarchy'`. Mutações
  podem lançar `HierarchyValidationError` ou `Error` (rede) — sempre
  try/catch + toast.
- Settings: `import { useAlgorithm, setAlgorithm } from '@/lib/settings'`.
- SRS: nunca chame `applySRS` ou `applyFSRS` direto na UI — use
  `applyReview(card, q, useAlgorithm())` em `lib/srs-fsrs.ts`.
- Edição de questão existente: `<QuestionEditDrawer question={q}
  onClose={...} />`. Faz validação completa + dedup-aware antes de
  salvar.
- **Não escreva** comentários explicando "o que" o código faz. Só "por que"
  quando for não óbvio (especialmente: workarounds de limitações de
  framework/SDK, decisões deliberadas que parecem erradas).

## O que NÃO mudar sem motivo forte

- Stack (não trocar pra Tailwind/shadcn — usuário já vetou).
- Schema híbrido em `questions` (não normalizar alternativas em outra tabela).
- Coexistência SM-2 + FSRS via flag (não remover SM-2 — convivência
  garante migração sem perda; quem prefere SM-2 pode continuar).
- Padrão de auth com middleware no `src/`.
- O cache do `useStore`.
- Pattern do `lib/hierarchy.ts` (cache em memória sem offline-first) pra
  entidades de baixo volume — só revisar se uma entidade específica
  passar a ter milhares de linhas.
- FKs compostos `(id, user_id) → parent` em qualquer hierarquia futura
  — defense-in-depth contra cross-user.
- `questionToRow`/`rowToQuestion` como mapeamento explícito (não
  trocar por `...row` spread) — é a barreira de schema-evolução e
  segurança (ignora campos não mapeados).

## Limitações conhecidas / dívida deliberada

- Sync é last-write-wins. Para um app monousuário em múltiplos
  dispositivos, é aceitável.
- Hierarquia (concursos/disciplinas/tópicos) NÃO é offline-first —
  precisa de rede pra criar/listar. Aceitável (volume baixo, mudança
  pouca).
- Sem realtime (Supabase Realtime). Polling de 60s + on-focus.
- Sem dark/light toggle manual — segue o `prefers-color-scheme` do SO.
- Sem export de stats em CSV. Só do banco em JSON.
- Sem importação de Anki .apkg. Só JSON.
- Sem suporte a imagens nas questões (text-only). Em planejamento (Onda 1).
- FSRS roda com parâmetros default — sem treino dos parâmetros pessoais
  do user (que exigiria histórico de 1k+ revisões + trainer). OK pra
  agora; quando volume justificar, integrar `ts-fsrs` optimizer.
- `notes_user` no payload jsonb não tem CHECK de comprimento no DB
  (só UI). Pra estresse extremo, adicionar trigger ou migrar pra
  coluna text com CHECK.
- Discursivas longas (quesitos/rubrica/conceitos_chave) não têm UI de
  edição estruturada — só edição do enunciado e espelho via
  QuestionEditDrawer.
- Migration 0002 e backfill de disciplinas precisam ser aplicados
  manualmente no Supabase pelo user. Documentado.

## Quando adicionar uma feature nova

Antes de escrever código:
1. Onde encaixa no fluxo? (banco → sessão → revisão → stats →
   configurações)
2. Toca o schema?
   - **`questions`**: sempre criar nova migration (`0003_*.sql` é a
     próxima). Atualizar `questionToRow`/`rowToQuestion` na MESMA PR
     (ver Gotcha #13).
   - **Hierarquia**: idem, próxima migration. Manter padrão de FKs
     compostos `(id, user_id)` se for nova entidade hierárquica.
   - Adicionar testes em `src/lib/__tests__/` quando lógica for pura.
3. Toca o sync?
   - `questions`: nova mutação em `lib/store.ts` que marca `pendingSync`.
   - Hierarquia: nova função em `lib/hierarchy.ts` (load/create/update/
     softDelete + cache).
4. Toca a UI de sessão? Lembrar dos atalhos de teclado existentes
   (A-E pra responder; 1/2/3/4 pra rate).
5. Adiciona campo no payload jsonb? Estender `ObjetivaPayload`/
   `DiscursivaPayload` em `types.ts` com field opcional + comentário
   de propósito.
6. Validação: 3 camadas obrigatórias (UI → lib → DB). Não pular nenhuma.
7. Mutação destrutiva: `confirmDialog({...danger: true})` sempre.
8. Testar com `npm test` antes de commitar.

## Histórico crítico de decisões

Veja `git log --oneline` — commits têm o "porquê" no corpo. Onda 0
(2026-04-29 → 2026-04-30):

- `ae60dd3` — Anotações pessoais (notes_user no payload jsonb)
- `7a906b9` — Edição inline de questão (drawer dedup-aware)
- `9342cb2` — Persistência FSRS/SM-2 + UI toggle + callers usam `applyReview`
- `55c53f0` — Adapter FSRS-6 sobre tipo SRS local (`ts-fsrs`)
- `262103d` — Atribuição em lote (concurso/disciplina/tópico) no Import
- `3914ddd` — Bulk-assign tópico no Banco + bug fix sync (faltavam
  topico_id/concurso_id/tags em questionToRow/rowToQuestion)
- `48ad155` — Tópicos hierárquicos com BFS soft-delete cascade
- `3890f2b` — Disciplinas CRUD
- `2afff23` — Concursos CRUD + foundation `lib/hierarchy.ts` +
  `/configuracoes`
- `51950b8` — Backfill script (idempotente, anon key only)
- `773f93f` — Migration 0002: hierarquia + FKs compostos defense-in-depth
- `75d0b44` — Vitest setup + bump Next 14.2.18 → 14.2.35 (CVEs runtime)

Pré-Onda 0:

- `cb609b5` — `vercel.json` pra forçar framework=nextjs (build estava
  procurando `public/`)
- `52ae58d` — paginação no `pullSince` (limite de 1000 linhas do
  PostgREST aparecia como "carrega 1000 e depois mais 232 num F5")
- `a7a9ff9` — middleware movido pra `src/` (skeleton infinito)
- `9b2a367` — favicon SVG em `app/icon.svg`
- `6d77aeb` — cache no `useStore` (loop infinito)
- `1b8932f` — migração inicial Next.js + Supabase + Vercel

Tag de segurança `pre-onda0` em `e91906b` (último commit antes da
Onda 0). `git reset --hard pre-onda0` restaura o estado anterior se
tudo der errado.
