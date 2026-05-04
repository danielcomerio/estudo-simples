# Contexto do projeto — para o Claude

App de **repetição espaçada para concursos públicos** (FGV em primeiro plano).
Migração inicial em 2026-04-25 de um SPA standalone (HTML/CSS/JS +
localStorage) para **Next.js 14 + Supabase + Vercel**, com autenticação
por email/senha e cada usuário em sua própria instância (RLS).

**Onda 0** (2026-04-29 → 2026-04-30): hierarquia (concursos, disciplinas,
tópicos, edital), FSRS opt-in convivendo com SM-2, edição inline de
questão, anotações pessoais e bulk-assign de tópico.

**Onda 1** (2026-05-01 → 2026-05-03): questões reais com origem/fonte/
verificação (migration 0003), wizard de import com fuzzy match e
cross-disciplina warning, suporte a Cloze/Flashcard (migration 0004),
KaTeX condicional, imagens via Supabase Storage, confidence rating +
calibração, bulk-fill de gabarito (`/revisar`), interleaving, paginação
visual, compressão lz-string e migração pra IndexedDB, simulado completo
com cronômetro/relatório, e várias QoL (filtros SRS, atalhos de teclado,
export filtrado, etc).

A documentação voltada ao usuário final está em [`README.md`](README.md). Este
arquivo é o briefing para sessões futuras de Claude — capture o "porquê" das
decisões e os bugs que já machucaram, não o "o que está em cada arquivo".

---

## Stack

- **Next.js 14.2.x** (App Router, `src/` directory) — versão patch flutua
  via `^14.2.35`. Subir só dentro da série 14.2 (Next 15+ requer migração
  de cookies/etc; ver Gotcha #5).
- **TypeScript estrito**, **React 18.3** (não 19 — ver Gotcha #4).
- **Supabase**: Auth (email/senha) + Postgres + RLS via `@supabase/ssr ^0.5`,
  Storage pra imagens.
- **ts-fsrs ^5.3**: adapter FSRS-6 sobre nosso tipo SRS, convive com
  SM-2 sem perda de dados.
- **lz-string ^1.5**: compressão fallback do estado (quando IDB
  indisponível). UTF-16 mode.
- **katex ^0.16** + `@types/katex`: renderização de fórmulas LaTeX
  ($...$ inline e $$...$$ display) condicional via `hasMath()`.
- **tsx ^4.21** (devDep): executor TS pra scripts em `scripts/`.
- **Vitest ^4.1** (devDep): test runner. Vitest 4 (não 2) deliberado pra
  evitar CVEs dev-only de esbuild/vite v2.
- **Sem** Tailwind, shadcn, zustand, react-query, ou qualquer UI lib.
  CSS puro com variáveis em `src/app/globals.css`. Store próprio sobre
  `useSyncExternalStore`. Decisão deliberada — o usuário rejeitou Tailwind:
  app pequeno, custo de migração não compensaria.
- **Vercel** com `vercel.json { "framework": "nextjs" }` (necessário
  porque o projeto Vercel foi criado antes do código existir).

## Princípios arquiteturais

1. **Offline-first para `questions`.** IndexedDB é a fonte de leitura
   (com fallback localStorage comprimido); Supabase é destino de sincronia
   em background. Nada na UI espera resposta de rede.
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
   é client component porque depende de IDB/localStorage e interatividade.

## Como o sync funciona

`lib/sync.ts` orquestra **só `questions`** (hierarquia não passa por aqui).

- `pushPending()`: percorre `state.pendingSync`, faz `upsert` em chunks
  de 100. **Resiliente a 23505** (duplicate key): se chunk falha, retenta
  item-por-item; itens que dão 23505 individualmente são descartados
  localmente via `discardLocal()` (já existem no servidor com outro id —
  pull traz a versão canônica).
- `pullSince()`: pagina manualmente em páginas de 1000 (`.range()` +
  `.gte(updated_at, lastPullAt)`). Usa `.gte` em vez de `.gt` para não
  perder linhas com timestamps idênticos. Dedupe acontece por id em
  `mergeFromServer`. Teto de 100 páginas.
- `syncNow()`: push depois pull, com lock (`inflight`) e tratamento de
  estado (idle/syncing/error/offline). Toast informativo quando descarte
  acontece.
- `scheduleSync(ms)`: debounce — chamado após cada mutação, default 1500ms.
- `startBackgroundSync()`: kick inicial + polling 60s + listeners
  `online` e `focus`.

Conflitos: quem grava por último ganha (server `now()` no trigger
`updated_at`). Mutações locais não-flushadas são protegidas em pulls
via `pendingSync`.

**CRÍTICO** (Gotcha #13): `questionToRow()` e `rowToQuestion()` mapeiam
explicitamente cada campo. Adicionar coluna nova em `questions` exige
editar AMBAS — senão push apaga e pull ignora silenciosamente. Já valeu
pra colunas das migrations 0002 (topico_id, concurso_id, tags) e 0003
(origem, fonte, verificacao).

## Como o store funciona

`lib/store.ts` é um zustand-lite caseiro **só pra `questions`**:

- Variável `state` no escopo do módulo, substituída inteira a cada `setState`.
- `Set<listener>` notificado em cada mudança.
- Hook `useStore(selector)` usa `useSyncExternalStore` **com cache via
  `useRef`** — sem isso, selectors que retornam novos arrays
  (`questions.filter`, `Array.from(new Set(...))`) provocam loop infinito
  porque `useSyncExternalStore` compara via `Object.is`.
- Mutações: `addQuestion(s?)`, `updateQuestionLocal`, `deleteQuestion(s?)`,
  `discardLocal` (hard-delete pra duplicatas detectadas), `mergeFromServer`,
  `clearPending`, `purgeDeletedLocal`.
- `hydrate(userId)` é **async** — lê IDB primeiro, fallback localStorage
  comprimido. Migração silenciosa: se achar no LS, salva em IDB e remove
  do LS. StoreProvider faz `await hydrate(userId)` antes de
  `startBackgroundSync()`.

### Persistência: IndexedDB → localStorage fallback

`lib/idb.ts` é wrapper minimalista (Promise-based get/set/delete). IDB
quota é gigante (~50-90% do disco) versus 5-10MB do localStorage.

- **persistNow()** tenta IDB primeiro; se falhar (rejeita ou indisponível),
  usa localStorage comprimido com lz-string. **Debounced 200ms** —
  múltiplas mutações em sequência viram 1 persist (compressão de ~5MB
  bloqueava UI).
- **beforeunload** flusha pendências antes do navegador fechar.
- localStorage comprimido tem prefixo `LZ:` pra distinguir de JSON cru
  (estados pré-compressão).

### Outros caches

`lib/hierarchy.ts` é um **cache em memória separado** para concursos/
disciplinas/concurso_disciplinas/tópicos. Cada entidade tem `loadX/createX/
updateX/softDeleteX/useX`. Sem persistência, sem sync diferido — refetch
on mutate. `clearHierarchyCache()` é chamado no logout. Padrão deliberado:
volume baixo justifica simplicidade.

`lib/settings.ts` guarda preferências em localStorage:
- `algorithm: 'sm2' | 'fsrs'`
- `activeConcursoId: string | null` (UUID validado)

`useAlgorithm()` e `useActiveConcursoId()` são hooks reativos a `storage`
event de outras tabs. SSR-safe (init com default 'sm2'/null, useEffect
ajusta no mount — sem isso, hydration mismatch).

`lib/simulado-store.ts` persiste simulados em localStorage com chave
versionada `estudo-simples:simulados:v1`. Refresh-safe — `getSimulado-
EmAndamento(userId)` no mount do `SimuladoView`.

## Como o SRS funciona

Dois algoritmos coexistem desde a Onda 0.5. Default é SM-2 por compat;
FSRS é opt-in via `/configuracoes` → "Algoritmo de revisão".

**Ponto de entrada único:** `applyReview(card, quality, algorithm)` em
`lib/srs-fsrs.ts`. Caller (QuestionRunner, DiscursivaRunner, CardsRunner,
SimuladoReport) chama `useAlgorithm()` e passa o resultado.

### SM-2 (`lib/srs.ts`)
- `q=0` zera repetições; `q=3` usa `max(1.2, EF − 0.15)`; `q=4` é a
  progressão padrão (1d → 6d → 6d×EF → ...); `q=5` × 1.3.

### FSRS-6 (`lib/srs-fsrs.ts`)
- Wrapper sobre `ts-fsrs` 5.3 com `request_retention=0.9`,
  `enable_fuzz=false` (determinismo).
- `fsrsCardToSrs` **incrementa `repetitions`** (não copia `card.reps` que
  reseta em createEmptyCard). Preserva `easeFactor` (SM-2) intacto pra
  permitir voltar.

A SRS struct ganhou fields opcionais (`stability`, `difficulty`, `state`,
`lapses`). Trocar de algoritmo NÃO corrompe.

Para discursivas, `suggestQualityFromScore(pct)` mapeia <40/40-65/65-85/>85 → 0/3/4/5.

## Schema do banco

Quatro migrations canônicas:

### `0001_initial.sql` — questions

Tabela única `questions` (id, user_id, type, disciplina_id, tema,
banca_estilo, dificuldade, payload jsonb, srs jsonb, stats jsonb,
dedup_hash generated, created_at, updated_at, deleted_at). Híbrido
colunas indexadas + payload jsonb. Trigger `set_updated_at`. RLS com 4
policies. **`dedup_hash`** é `md5(coalesce(disciplina_id,'') || '||' ||
coalesce(payload->>'enunciado', payload->>'enunciado_completo', ''))`,
índice único parcial `where deleted_at is null`.

### `0002_hierarchy.sql` — concursos/disciplinas/topicos/edital + tags

5 tabelas novas: `concursos`, `disciplinas`, `concurso_disciplinas`
(join com peso e qtd_questoes_prova), `topicos` (auto-FK pra parent),
`edital_itens`. E 3 colunas em `questions`: `topico_id`, `concurso_id`,
`tags text[]`. Defense-in-depth: FKs compostos `(id, user_id) →
parent(id, user_id)`. CHECK constraints + idempotente. Down em
`0002_hierarchy_down.sql`.

### `0003_origem.sql` — questões reais

3 colunas em `questions`:
- `origem text` CHECK (NULL | 'real' | 'autoral' | 'adaptada')
- `fonte jsonb DEFAULT '{}'` — banca, ano, prova, orgao, cargo,
  external_id, link, etc
- `verificacao text` CHECK (NULL | 'verificada' | 'pendente' | 'duvidosa')

CHECK extra: `origem='real'` exige `fonte.banca` (string) + `fonte.ano`
(number). Cap de tamanho (`length(fonte::text) <= 10000`). Índices:
`(user_id, origem)` parcial, `(user_id, verificacao)` parcial, GIN em
`fonte` pra queries `@> '{"banca":"FGV"}'`. Down em
`0003_origem_down.sql`.

### `0004_cloze_flashcard.sql` — tipos novos

Atualiza CHECK de `type` pra aceitar `'cloze'` e `'flashcard'` além de
`'objetiva'/'discursiva'`. Aditiva, idempotente. Down reverte mas
falha se houver questão dos tipos novos.

### Storage (manual via Dashboard + `supabase/storage_setup.sql`)

Bucket `questions-images` (público, paths com UUID, 5MB cap, MIMEs
PNG/JPEG/WEBP/GIF). 4 policies em `storage.objects`:
- SELECT pública (paths não-enumerable via UUID)
- INSERT/UPDATE/DELETE restritos a `(storage.foldername(name))[1] =
  auth.uid()::text`

Path scheme: `{user_id}/{question_id}/{uuid}.{ext}`.

**Próxima migration deve ser 0005.** Não editar 0001-0004.

## Auth

- Server Actions em `src/app/auth/actions.ts` — `login`, `signup`, `logout`.
  Usam `useFormState` do `react-dom` (não `useActionState`, que é React 19).
- Middleware em `src/middleware.ts` (NÃO na raiz — ver Gotchas).
- Layout root é Server Component que faz `getUser()` e injeta no
  `StoreProvider`. Se `user=null`, layout NÃO renderiza Provider — então
  middleware **tem que estar funcionando**.

## Importação de questões

`lib/real-import.ts` é o coração do wizard. Suporta 2 formatos:

- **Autoral** (nosso): `disciplina_id`, `enunciado`, `alternativas[]` com
  `correta`, etc. Tipos cobertos: objetiva, discursiva, cloze
  (texto com `{{cN::resposta}}`), flashcard (frente/verso).
- **Real** (QConcursos-like): `materia`, `concursoAno`, `banca`, `tipo:
  'MULTIPLA_ESCOLHA'`, `gabarito`, etc. Detecção via `detectFormat()`.
  `parseRealItem()` normaliza pro nosso formato + seta `origem='real'`,
  `fonte={banca, ano, orgao, ...}`, `verificacao='pendente'`.

**Política de descarte** (decisão do user revisada):
- Gabarito ausente (`?` ou vazio) → descartar
- Anulada/desatualizada → descartar (eram 'duvidosa' antes; user prefere banco limpo)
- Enunciado com hint de imagem (`figura abaixo`, `tabela acima`...) →
  descartar
- Tipo não suportado (`DISCURSIVA`, `CERTO_ERRADO`) → descartar

`parseImportBatch` (1 arquivo) e `parseImportBatchMulti` (N arquivos)
agregam num único `BatchParseResult`. Cada um devolve, além de
`toImport`/`realDiscarded`/etc, **`crossDiscWarnings`**: itens com
mesmo enunciado de uma questão já existente em outra disciplina (sinal
de re-categorização — user mapeia no wizard pra dedupar).

**Fuzzy match de disciplinas** (`suggestDisciplinaMapping`): tokenize
(lowercase + sem acento + sem stopwords incluindo "ti") + Jaccard ≥ 0.3.
"TI - Ciência de Dados e Inteligência Artificial" × "inteligencia_artificial"
= 0.4 → match plausível.

## Disciplinas auto-derivadas

Disciplinas NÃO são mais criadas/excluídas manualmente. São DERIVADAS das
questões:
- `ImportZone` chama `ensureDisciplinasExist(nomes)` ao adicionar questões.
- `ConcursoDisciplinasManager` faz o mesmo no useEffect (cobre quando
  user move questões via SQL e a disciplina antiga não existe mais).
- `DisciplinasSection` (`/disciplinas`) tem só "Editar" (cor + peso) — não
  cria nem exclui. Mostra contagem de questões e de concursos vinculados.

## Rotas

- `/` Painel (Dashboard com stats agregadas + heatmap GitHub-style 90 dias)
- `/banco` Lista + edição + filtros (origem, verificação, SRS, busca,
  tipo, disciplina) + atalhos teclado (j/k navegação, Enter edita,
  espaço seleciona, x exclui, / busca) + paginação visual (100 por vez)
- `/estudar` Sessão de objetivas (modos: SRS/aleatorio/dificuldade/erros/
  novas + interleaving + confidence rating)
- `/discursivas` Sessão de discursivas (espelho + autoavaliação)
- `/cards` Cloze + Flashcard (revelar incremental, autoavaliação, SRS)
- `/simulado` Simulado com cronômetro setável, dialog tempo extra,
  relatório completo + integração SRS
- `/revisar` Bulk-fill de gabarito pra questões pendentes (gera prompt
  pra IA, parseia resposta tolerante, aplica em lote)
- `/stats` Selector de escopo (Geral/concurso ativo/concurso X) +
  desempenho por disciplina + heatmap + agregado de simulados +
  calibração metacognitiva
- `/concursos` CRUD de concursos com cards expandíveis pra vincular
  disciplinas (peso + qtd_questoes_prova)
- `/disciplinas` Lista read-only de disciplinas detectadas (só edita
  metadata)
- `/topicos` Em revisão (escondido da nav)
- `/configuracoes` Algoritmo SRS + links pros cadastros

## Concurso ativo (filtro global)

`useActiveConcursoId()` lê settings; selector no Topbar permite trocar.
Quando ativo, `useActiveConcursoFilter()` resolve as disciplinas
vinculadas e filtra TODAS as listagens (banco, estudar, discursivas,
simulado, cards, stats). `matchActiveConcurso(q.disciplina_id, nomes)`
é case-insensitive (mitigação parcial pro caso de rename de disciplina).
`/stats` tem selector próprio que pode override (Geral / Concurso ativo /
qualquer concurso específico).

## Gotchas (já cometidos, não repetir)

1. **Middleware vai em `src/middleware.ts`**, não na raiz, quando o
   projeto usa `src/`. Verificação: `npx next build` deve listar
   `ƒ Middleware`.

2. **`useStore` precisa cachear o resultado do selector.** Sem cache,
   selectors que retornam novos arrays provocam loop infinito.

3. **PostgREST corta em 1000 linhas** mesmo com `.limit()`. Solução:
   paginação manual com `.range()` + `.gte` (não `.gt`).

4. **React 18 ≠ React 19.** Use `useFormState` + `useFormStatus` de
   `react-dom`, não `useActionState`.

5. **`cookies()` em Next 14 é sync, em Next 15 é async.** `await cookies()`
   funciona nos dois.

6. **Vercel não autodetecta Next.js.** Fix: `vercel.json
   { "framework": "nextjs" }`.

7. **Soft-delete obrigatório pra sync funcionar entre dispositivos.**
   `purgeDeletedLocal()` limpa após push.

8. **Dedup de import** por `disciplina_id + enunciado(_completo)` no client
   E como índice único parcial no DB. **dedupeKey() mimica SQL coalesce**
   (string vazia conta como presente, não cai pro próximo) — sem isso, JS
   `||` divergia do hash do DB e duplicatas escapavam (caso real: 100
   discursivas com `enunciado:''`).

9. **`NEXT_PUBLIC_*` vai pro bundle do client.** `SUPABASE_SERVICE_ROLE_KEY`
   nunca deve ter prefixo `NEXT_PUBLIC_`.

10. **Trocar de usuário no mesmo browser**: `hydrate()` detecta via
    `STORAGE_KEY_USER` e limpa cache (LS + IDB).

11. **`renderRichText` (em `lib/utils.ts`)** rendera code blocks +
    LaTeX via KaTeX condicional (`hasMath()`). HTML escapado fora dos
    marcadores. Insere via `dangerouslySetInnerHTML` — seguro.

12. **BOM em JSON colado**: `safeParseJSON` strip `﻿` no início.

13. **`questionToRow`/`rowToQuestion` em `lib/sync.ts`** mapeiam cada
    coluna **explicitamente**. Adicionar coluna nova em `questions` SEM
    atualizar essas duas funções resulta em: push apaga, pull ignora.
    Já queimou na 0.4.4 (topico_id/concurso_id/tags) e na confusão da
    0003 (fonte column not found = migration não aplicada).

14. **Soft-delete em hierarquia auto-relacional não cascateia**: o FK
    `on delete cascade` só roda em hard-delete. `softDeleteTopico` e
    `softDeleteDisciplina` fazem cascade manual.

15. **Composite FK `(id, user_id) → parent(id, user_id)`** exige `UNIQUE
    (id, user_id)` no parent. Custo: 1 índice extra por tabela.

16. **localStorage de hierarquia NÃO existe.** Cache em memória; logout
    limpa via `clearHierarchyCache()`.

17. **Vulnerabilidades aceitas no audit**: 5 high/moderate (eslint-config-
    next/glob CLI; Next 14.2.x DoS — não exploráveis nesta config;
    postcss XSS build-time). Subir Next 15+ resolve.

18. **`utils.ts` pode ficar com encoding misturado** após múltiplos
    Edits sucessivos no mesmo arquivo (já aconteceu — git detectou como
    binário, webpack dev falhou com "unterminated regex literal"). Build
    de produção tolera; dev quebra. Fix: reescrever o arquivo (Write).

19. **IDB hydrate é async** mas `useStore` é sync — StoreProvider faz
    `await hydrate(userId)` antes de `startBackgroundSync()` pra evitar
    pull com `lastPullAt` inicial obsoleto.

20. **Sync resiliente a 23505**: chunk inteiro NÃO falha mais — retenta
    item-por-item, descarta locais que conflitam (já existem no servidor).
    Toast 'warn' avisa quantas. Sem isso, 1 duplicata travava 100 questões
    (caso real do user).

21. **Aplicar migrations no Supabase requer ação manual.** Sintoma de
    esquecer: `column "fonte" does not exist in schema cache` no push.
    Verificar com `select column_name from information_schema.columns
    where table_schema='public' and table_name='questions'`. Em apuros,
    `NOTIFY pgrst, 'reload schema'` força PostgREST a reler.

22. **localStorage cheio** (caso real do user com 2785 questões).
    Resolvido em camadas: (a) compressão lz-string ~70% reduction;
    (b) debounce do persist 200ms (mutações em rajada não recompactam
    repetidamente); (c) migração pra IDB (quota gigante). Todas as 3
    em produção.

## Comandos

```bash
npm install              # uma vez
npm run dev              # http://localhost:3000
npm run build            # validar antes de push
npm run typecheck        # tsc --noEmit (rápido)
npm test                 # Vitest (273+ testes em src/lib/__tests__/)
npm run test:watch       # modo dev
git push                 # Vercel auto-deploya (~1min)
```

Build local sem env reais:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x npm run build
```

Backfill de disciplinas (depois de 0002 aplicada):
```bash
export NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
export SUPABASE_EMAIL=...
export SUPABASE_PASSWORD=...
npm run backfill:disciplinas -- --dry-run    # preview
npm run backfill:disciplinas                  # apply
```

Se `.next` corromper (encoding misturado, cache stale):
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

## Convenções específicas

- Arquivos client começam com `'use client';`.
- Componentes em `src/components/`, páginas em `src/app/<rota>/page.tsx`,
  lógica pura em `src/lib/`, testes em `src/lib/__tests__/*.test.ts`.
- Path alias `@/` aponta pra `src/`.
- Toasts: `import { toast } from '@/components/Toast'`. Kinds:
  `'success' | 'error' | 'warn' | ''`.
- Confirmações destrutivas: `confirmDialog({...danger: true})` sempre.
- Hierarquia: `import { useConcursos, useDisciplinas, useTopicos,
  useConcursoDisciplinas, useAllConcursoDisciplinas, ensureDisciplinas-
  Exist, ... } from '@/lib/hierarchy'`. Mutações lançam `Hierarchy-
  ValidationError` ou `Error` — sempre try/catch + toast.
- Settings: `useAlgorithm`, `useActiveConcursoId`, `setActiveConcursoId`.
- SRS: nunca chame `applySRS`/`applyFSRS` direto — use
  `applyReview(card, q, useAlgorithm())`.
- Render rich (enunciados, alternativas, espelho): `renderRichText(s)`
  (auto KaTeX se `hasMath()`).
- Imagens: `<QuestionImages urls={payload.imagens} />` em qualquer runner.
- **Não escreva** comentários explicando "o que" o código faz. Só "por que"
  quando for não óbvio.

## O que NÃO mudar sem motivo forte

- Stack (não trocar pra Tailwind/shadcn — usuário já vetou).
- Schema híbrido em `questions` (não normalizar alternativas).
- Coexistência SM-2 + FSRS via flag.
- Padrão de auth com middleware no `src/`.
- O cache do `useStore`.
- Pattern do `lib/hierarchy.ts` (cache em memória sem offline-first).
- FKs compostos `(id, user_id) → parent`.
- `questionToRow`/`rowToQuestion` como mapeamento explícito.
- IDB-first com fallback LS comprimido.
- Política de descarte do parser real (anuladas/imagem/desatualizada).
- Disciplinas auto-derivadas (sem CRUD manual no UI).

## Limitações conhecidas / dívida deliberada

- Sync é last-write-wins. Aceitável pra app monousuário.
- Hierarquia não é offline-first. Aceitável (volume baixo).
- Sem realtime. Polling 60s + on-focus.
- Sem dark/light toggle manual — segue OS.
- Sem export de stats em CSV.
- Sem importação de Anki .apkg.
- FSRS roda com parâmetros default — sem optimizer pessoal (precisaria
  histórico de 1k+ revisões).
- `notes_user` no payload jsonb não tem CHECK no DB (só UI).
- Discursivas longas (quesitos/rubrica/conceitos_chave) não têm UI de
  edição estruturada — só edição via QuestionEditDrawer.
- Migrations precisam ser aplicadas manualmente no Supabase.
- Bucket `questions-images` precisa ser criado manualmente.
- Bulk-fill de gabarito assume IA externa (cola/copia) — não integra API.
- Tópicos escondidos da nav até decidir UX (auto-derivar de tema vs.
  manter manual).

## Quando adicionar uma feature nova

Antes de escrever código:
1. Onde encaixa no fluxo? (banco → sessão → revisão → stats →
   configurações)
2. Toca o schema?
   - **`questions`**: nova migration (`0005_*.sql` é a próxima).
     Atualizar `questionToRow`/`rowToQuestion` na MESMA PR (Gotcha #13).
   - **Hierarquia**: idem. Manter padrão de FKs compostos.
   - Adicionar testes em `src/lib/__tests__/` quando lógica for pura.
3. Toca o sync?
   - `questions`: nova mutação em `lib/store.ts` que marca `pendingSync`.
   - Hierarquia: nova função em `lib/hierarchy.ts`.
4. Toca a UI de sessão? Lembrar dos atalhos (A-E pra responder; 1/2/3/4
   pra rate; / pra busca; j/k pra navegar; M no simulado; espaço/enter
   pra revelar cloze).
5. Adiciona campo no payload jsonb? Estender o tipo correspondente
   (Objetiva/Discursiva/Cloze/Flashcard) em `types.ts` com field
   opcional + comentário de propósito.
6. Validação: 3 camadas obrigatórias (UI → lib → DB).
7. Mutação destrutiva: `confirmDialog({...danger: true})` sempre.
8. Testar com `npm test` antes de commitar.

## Histórico crítico de decisões

Veja `git log --oneline` — commits têm o "porquê" no corpo.

### Onda 1 (2026-05-01 → 2026-05-03)

**Estabilidade e desempenho:**
- IndexedDB pra persistência (quota gigante, fallback LS comprimido)
- Compressão lz-string + debounce persist (mitigação intermediária)
- Sync resiliente a 23505 (descarta duplicates locais)
- Paginação visual em /banco (100 por vez)

**Questões reais (formato externo):**
- Migration 0003 origem/fonte/verificação
- Wizard de import multi-step com fuzzy match de disciplinas
- Cross-disciplina warning soft (mesmo enunciado, disc diferente)
- Multi-file no import (N JSONs de uma vez, dedup cruzado)
- Política revisada: descarta anuladas/desatualizadas/imagem

**Tipos novos:**
- Migration 0004 cloze + flashcard
- /cards rota dedicada com runner unificado
- Cloze incremental (revela uma lacuna por vez, Anki-style)

**Conteúdo rico:**
- KaTeX condicional ($...$ inline e $$...$$ display)
- Imagens via Supabase Storage (bucket questions-images)
- Edição de fonte/origem/verificação no QuestionEditDrawer

**Estudo e métricas:**
- Confidence rating (1=chutei/2=incerto/3=confiante) + calibração
- Stats de simulado (sparkline, breakdown)
- Selector de escopo em /stats (Geral/concurso ativo/X)
- Heatmap GitHub-style 7×N com labels e legenda

**Produtividade:**
- /revisar (bulk-fill de gabarito via prompt → IA → parseia resposta)
- Filtros SRS em /banco (atrasadas, hoje, novas, recentes)
- Atalhos de teclado em /banco (j/k Enter espaço x /)
- Bulk verificação em massa
- Export filtrado/selecionadas
- Interleaving forçado em sessões

**UX/refator:**
- /concursos como cidadão de primeira classe (CRUD + vínculos)
- Conceito de "concurso ativo" (settings, Topbar, filtros globais)
- Disciplinas auto-derivadas (sem CRUD manual)
- Tópicos escondidos da nav
- Bug fix: abandonar simulado volta pra lista

### Onda 0 (2026-04-29 → 2026-04-30)

- Anotações pessoais, edição inline de questão, FSRS opt-in,
  atribuição em lote, bulk-assign tópico, tópicos hierárquicos,
  disciplinas CRUD, concursos CRUD, backfill, migration 0002, Vitest.

### Pré-Onda 0

- `cb609b5` vercel.json framework=nextjs
- `52ae58d` paginação no pullSince (limite 1000 linhas)
- `a7a9ff9` middleware movido pra src/
- `9b2a367` favicon SVG
- `6d77aeb` cache no useStore (loop infinito)
- `1b8932f` migração inicial Next.js + Supabase + Vercel

Tag de segurança `pre-onda0` em `e91906b`. `git reset --hard pre-onda0`
restaura o estado anterior se tudo der errado.
