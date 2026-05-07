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

### Migrations 0005–0015

- `0005_billing.sql` — `profiles`, `stripe_events`, view `my_plan`,
  triggers de enforce limit (free=500q/1concurso na época) + handler
  `handle_new_user`.
- `0006_analytics.sql` — `analytics_events` (privacy-first, sem PII)
  + `newsletter_signups` (lead capture).
- `0007_pricing_tiers.sql` — adiciona tier `estudante` no CHECK
  profiles.plan + atualiza enforce funções (free=200/1, estudante=
  2000/3, pro=ilimitado).
- `0008_disciplinas_slug.sql` — Fase A organização: adiciona
  `disciplinas.slug` (nullable) + index único parcial. App preenche
  client-side.
- `0009_master_tier.sql` — tier `master` no CHECK + funções enforce
  ignoram master (sem limites) + trigger `protect_master_plan`
  bloqueia rebaixamento via UPDATE comum (admin precisa
  `set local app.allow_master_change='true'`).
- `0010_questions_disciplina_uuid.sql` — Fase B organização:
  `questions.disciplina_uuid uuid REFERENCES disciplinas(id, user_id)`
  nullable. Backfill server por `lower(nome)` match. Dual-write em
  vigor (Gotcha #13). Drop de `disciplina_id text` previsto pra 0015+.
- `0011_question_concursos.sql` — Fase C1 organização: tabela join
  N:N `question_concursos` (questão pode estar em múltiplos concursos).
  RLS owner-only. Backfill from `questions.concurso_id` (1:1 legacy).
- `0012_shared_decks.sql` — Fase C2 sharing: snapshot congelado via
  link com token (ex: 32 hex chars). Default expira em 30d, mas
  aceita `expires_at` até 100 anos. Função `shared_deck_increment_access`
  pra contar acessos sem race. Acesso anon via service role no endpoint.
- `0013_live_decks.sql` — Fase C3 sharing live: `live_decks`,
  `live_deck_questions`, `live_deck_grants`. Pre-grant via email
  resolvido pela trigger `resolve_pending_grants` (AFTER INSERT em
  auth.users). Trigger `freeze_grant_on_revoke` cria entry em
  `shared_decks` automaticamente quando owner revoga (decisão do
  user: grantee mantém acesso readonly ao snapshot final).
  RLS especial em `questions` (policy `questions_grantee_select`)
  permite cross-user SELECT via JOIN com grants.
- `0014_questions_unique_id_user.sql` — fix retroativo: 0001 nunca
  declarou `UNIQUE (id, user_id)` em questions, fazendo as FKs
  compostas das 0011/0013 falharem (erro 42830). Migration
  idempotente que adiciona o constraint.
- `0015_push_devices.sql` — registro de device tokens pra push
  notifications (FCM/APNS/Web Push). RLS owner-only. UPSERT por
  (user_id, token) — re-register substitui. Endpoint
  POST /api/push/register valida + grava.
- `0016_count_due_rpc.sql` — RPC SECURITY DEFINER
  `count_due_per_user(p_due_before_ms)` agrupa contagem de questões
  SRS-vencendo por user. Usada pelo cron `/api/cron/srs-due` pra
  enviar push em batch.
- `0017_public_decks_marketplace.sql` — Fase C4 (extensão de C2):
  shared_decks ganha is_public boolean + title + description +
  category + index parcial + RLS pública. Permite marketplace
  comunitário. Endpoint `/api/decks-publicos` lista. UI em
  `/decks-publicos` (PublicDecksMarketplace component). Owner
  publica via SharedLinksSection (PATCH /api/share/[token]).
- `0018_telegram_bindings.sql` — vincula user → chat_id Telegram via
  deeplink one-shot (TTL 1h). RLS owner-only. Endpoints
  `/api/telegram/{bind,webhook}`. UI `TelegramSection` em
  /configuracoes. lib/telegram.ts com sendTelegramMessage helper.
- `0019_questoes_do_dia.sql` — engagement diário. 3 tabelas:
  daily_question_sets (1 set/dia, mesmo pra todos), 
  daily_question_attempts (resultado UNIQUE user×set, base do
  ranking), daily_preferences (modo pessoal BYO IA). Endpoints
  `/api/daily/{set,attempt,ranking}`. UI `/diario` page
  (DailyChallengeView).
- `0020_question_ratings.sql` — 👍/👎 por questão. PK composta
  (user, q), rating IN (-1, 1), comment opcional. Endpoint
  `/api/question-rating`. UI `QuestionRatingButtons` no QuestionRunner.
- `0021_deck_favorites.sql` — N:N user×shared_deck (PK composto)
  pra ⭐ no marketplace público. Endpoint `/api/deck-favorites`.
- `0022_discord_webhooks.sql` — webhook Discord por user (sem bot).
  CHECK valida URL. Endpoint `/api/discord` com test ping.
  Plugado no `notifyUser` como fallback após Telegram.
- `0023_question_comments.sql` — comments públicos por questão.
  RLS public select, own write, owner-da-questão OR author pode
  delete. Endpoint `/api/question-comments`.
- `0024_audit_log.sql` — trilha auditável (action + meta jsonb +
  IP/UA opcional). RLS sem SELECT — só admin via service role.
  Helper `lib/audit.ts` best-effort.
- `0025_applied_migrations_tracking.sql` — tabela
  `applied_migrations` pra rastrear o que está aplicado (Supabase
  Dashboard manual NÃO popula `supabase_migrations.schema_migrations`).
  Backfilla 0001-0024 e marca a 0025. **TODA migration nova daqui
  pra frente deve terminar com:**

  ```sql
  insert into public.applied_migrations (id, applied_at)
  values ('NNNN', now())
  on conflict (id) do update set applied_at = excluded.applied_at;
  ```

  Verifica com `npm run check:migrations` (cruza disco × DB).

**Próxima migration deve ser 0026.** Não editar 0001-0025.

## Engagement diário (Questões do Dia)

- `/diario` page mostra set comunitário + ranking top 50.
- Modo "comunidade": 1 set/dia, mesmo pra todos. Curadoria manual
  (master via SQL ou cron futuro).
- Modo "pessoal" (infra prep): user define prefs, IA gera via BYO
  key. Implementação completa em sessão futura.

## Telegram

- `lib/telegram.ts`: sendTelegramMessage + generateBindToken.
- Endpoints `/api/telegram/{bind,webhook}`: fluxo de vinculação
  one-shot via deeplink.
- UI `TelegramSection` em /configuracoes: botão "🔗 Vincular" gera
  deeplink + polling 3s detecta confirmação no webhook.
- Notificações via Telegram são fallback automático no notifyUser
  quando push falha.
- USER ACTION: `/newbot` no @BotFather, env TELEGRAM_BOT_TOKEN +
  TELEGRAM_BOT_USERNAME + opcional TELEGRAM_WEBHOOK_SECRET.

## Curadoria comunitária

- `question_ratings` (0020): PK composta, rating IN (-1, 1).
- `QuestionRatingButtons` no QuestionRunner: 👍/👎 com counters
  comunidade visíveis + meu rating destacado.
- Útil pra ranquear marketplace + detectar questões problemáticas.

## Notificações unificadas

- `lib/notify.ts`: notifyUser(userId, payload) tenta Web Push primeiro,
  fallback Telegram se vinculado.
- Cron `/api/cron/srs-due` usa essa função.
- Sem duplicar — push é mais imediato; Telegram cobre user sem
  browser ativo.

## Push notifications

- `lib/push.ts` (puro): validatePushPayload, inferDeviceLabel,
  detectPlatform. Tests cobrem edge cases.
- `lib/push-server.ts` (server-only): sendPushToUser(userId, payload)
  pega devices ativos, envia Web Push, marca disabled em 410 Gone.
  MVP sem encryption — pra produção pesada usar `web-push` lib com
  VAPID JWT signing.
- `PushNotificationsSection` em /configuracoes: UI pra ativar Web Push
  (5 estados: unsupported/denied/default/granted-not-registered/granted-
  registered).
- Cron Vercel: `/api/cron/srs-due` (12h UTC), `/api/cron/streak-risk`
  (22h UTC stub). Auth via header `Bearer ${CRON_SECRET}`.
- Setup VAPID detalhado em `docs/PUSH_SETUP.md`.

## Segurança e observability

- Headers de segurança aplicados pelo middleware: CSP (permissivo pra
  Stripe + Supabase), X-Content-Type-Options nosniff, Referrer-Policy,
  Permissions-Policy, X-Frame-Options DENY.
- `/api/health`: reporta status DB ping (latency), config booleans
  (Supabase/Stripe/VAPID/cron_secret), git_sha. Sempre 200 — uptime
  monitor decide alerta baseado em body.status ('ok'|'degraded').
- `ErrorLogger` (client): captura window.onerror + unhandledrejection
  com sample 10%, posta pra /api/log que grava em analytics_events
  (event='client.error'). Roda só em produção.
- SQL helpers em `supabase/manual/debug_*.sql` pra investigação
  manual (list users, count per user, find orphans, active subscriptions).

## Mobile (Capacitor)

- `capacitor.config.ts` na raiz: appId `com.estudosimples.app`,
  `server.url` apontando pra produção. Modelo "shell + URL".
- `docs/CAPACITOR_SETUP.md`: passo-a-passo de setup completo
  (instalação, ícones, build local, submission Play/App Store).
- `android/` e `ios/` no `.gitignore` (gerados por `npx cap add`).
- Push notifications: ver migration 0015. Ainda falta integrar
  plugin `@capacitor/push-notifications` na app (PushNotificationsSection
  já cobre Web Push via VAPID).

## AI Tutor (BYO key)

- `lib/ai-keys.ts`: gestão de chaves API por provider (openai/
  anthropic/gemini) em localStorage. NÃO sincroniza — chave é
  per-device.
- `AIKeysSection` em /configuracoes: UI pra plugar/trocar/remover
  chave. Validação básica de prefix (sk-, sk-ant-).
- `AIExplainButton` no QuestionRunner (após responder): chama
  `/api/ai/chat` proxy. Sem chave: mostra link discreto pra config.
- `AIDiscursivaEvaluator` no DiscursivaRunner (após revelar espelho):
  pede avaliação completa (nota 0-10 + pontos fortes/fracos +
  sugestão). Usa rubrica oficial se disponível. Mesmo padrão BYO.
- `/api/ai/chat`: proxy stateless pro provider. NUNCA armazena chave
  no server. Auth obrigatória + rate limit 30/min.
- Modelos default: gpt-4o-mini, claude-haiku-4-5, gemini-2.0-flash-exp
  (baratos/rápidos).

## TTS (leitura em voz)

- `TTSButton` usa Web Speech API native (sem dep externa).
- Plugado em QuestionRunner, CardsRunner, DiscursivaRunner abaixo
  do enunciado.
- Auto-detecta voz pt-BR. Strip de markdown/LaTeX/code blocks antes
  de falar.
- iOS exige user gesture (já temos — clique do botão).

## Sharing entre usuários (Fases C2/C3/C4)

- **Fase C2 — Snapshot link** (`shared_decks` na 0012): usuário cria
  link com seleção de questões. Receptor importa cópias pra própria
  conta (origem='compartilhada', `fonte.shared_from`). Snapshot
  congelado: alterações do owner depois NÃO afetam receptores.
  - UI owner: ShareDeckButton em `/banco` (toolbar bulk).
  - UI receptor: `/import/[token]` page (preview + botão importar,
    aceita anon mas exige login pra importar).
  - UI owner gestão: SharedLinksSection em `/configuracoes` (lista,
    copiar URL, revogar).
- **Fase C3 — Live deck** (`live_decks` + grants na 0013): owner
  cria deck nominal, concede acesso por email (pre-grant funciona —
  ativa quando user faz signup). Read-only no MVP. Quando revoga,
  trigger `freeze_grant_on_revoke` gera shared_deck snapshot
  automático pra grantee continuar com acesso readonly.
  - UI: `/decks` page (DecksManager) lista próprios + recebidos,
    DeckGrantsManager inline pra cada deck próprio (conceder por
    email, revogar com freeze automático).
  - Gate Pro/Master via `canShareDecks` em `lib/billing.ts`.

## Filtros por concurso ativo

- `useActiveConcursoFilter()` retorna `{ concurso, disciplinaNomes }`.
- `useQuestionConcursoLinks()` (em `lib/question-concursos.ts`)
  retorna mapa `Map<question_id, Set<concurso_id>>` cacheado em
  memória (compartilhado entre componentes — sem refetch por mount).
- `matchActiveConcursoFull(question, activeConcursoId, disciplinaNomes,
  questionLinks)` é a lógica unificada — questão pertence ao concurso
  ativo se UM dos: `concurso_id` direto, link N:N em
  `question_concursos`, ou `disciplina_id` matches alguma disciplina
  vinculada ao concurso (legado).
- 5 componentes usam o helper (BancoList, CardsRunner, DiscursivaRunner,
  QuestionRunner, RevisorPendentes). NÃO use `matchActiveConcurso` direto
  em código novo — sempre `matchActiveConcursoFull`.

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

### Origem do gabarito (`fonte.gabarito_source`)

Adicionado pra distinguir gabarito **oficial** (banca confirmou) vs
**IA-gerado** (pendente de oficialização). 3 caminhos:

1. **JSON do import**: campo opcional `gabarito_source` (ou aliases
   `gabaritoSource`/`gabarito_origem`) com valor `'ia' | 'oficial' |
   'crowd'`. Se `'ia'`, parser **adiciona automaticamente a tag
   `gabarito-ia`** ao array de tags.

2. **Editor manual** (`QuestionEditDrawer`): select "Origem do
   gabarito" na seção fonte. Quando user troca pra/de `'ia'`, tag
   `gabarito-ia` é sincronizada (adicionada/removida) na hora do save
   — caller de `updateQuestionLocal` recebe `tags` final.

3. **Backfill SQL** (`supabase/manual/backfill_gabarito_ia.sql`):
   inferência pra dados pré-existentes —
   `origem='real' AND verificacao='pendente' AND gabarito não-vazio
   AND fonte.gabarito_source IS NULL` recebe source='ia' + tag.
   Idempotente. Preserva sources já definidos manualmente.

NÃO há detecção automática a posteriori — o sinal é declarativo pelo
caller. Caso de uso: marcar IA-pendentes em /banco com filtro
"Origem do gabarito = IA" pra revisar e validar contra fonte oficial.

`GabaritoSourceBadge` é o componente visual. Tag `gabarito-ia` é
**derivada** de source — usar source como fonte de verdade; tag é
só pra busca/export rápido.

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

### Onda 2 (2026-05-04 → ...) — refinements e produtividade

**Painel:**
- Empty state com onboarding em 3 passos (banco vazio)
- Card "🎯 Hoje recomendado" mistura vencidas + erradas + novas
- Heatmap previsão (próximos 30 dias)
- Streak melhorado (atual + recorde + total dias)
- Quick actions com auto-start (`/estudar?modo=X&qtd=N&auto=1`)

**Banco:**
- Filtros novos: SRS (atrasadas/hoje/novas/recentes), tem imagem, tem
  notas, tem LaTeX
- Atalhos Vim-like (j/k Enter espaço x / g G Esc N)
- Bulk: verificação, dificuldade, tags (add/remove)
- Export filtrado/selecionadas (dropdown)
- Search com prefixos `tag:` `disc:` `banca:` + highlight
- Indicador SRS visual no card (🔴/📅/↻)
- Botão ▶ pra estudar 1 questão
- Quick-create (+ Nova) sem JSON, atalho N
- Chip "limpar filtros" + presets nomeados (localStorage)
- Ordenação custom (7 modos)
- Detector de quase-duplicatas em `/duplicatas` (Jaccard)
- Snippets de JSON de exemplo (autoral/discursiva/cloze/flashcard)

**Stats:**
- Selector de escopo (Geral / Concurso ativo / X)
- Comparativo semana atual vs anterior
- Por banca, por tag, por origem (composição segmentada)
- Distribuição de dificuldade
- Tempo médio por disciplina (barras horizontais)
- Gráfico de progressão temporal (SVG, 30d, com média móvel 7d)
- Calibração metacognitiva (overconfidence/lucky)
- "Suas inimigas" (taxa < 30% com ≥3 tentativas)
- Seção de simulados (sparkline)

**Estudar/Cards/Discursivas:**
- Confidence rating + analytics
- Modo livre (não muda SRS)
- Skip soft (Tab) — não conta tentativa
- Cloze incremental (revela uma lacuna por vez)
- Atalhos Esc/Tab nos /cards
- Pause/resume sessão (refresh-safe via session-store em cada modo)
- beforeunload protege sessão ativa

**Drawer:**
- Histórico de revisão expansível (timeline)
- Edição de fonte/origem/verificação
- Botão Duplicar (cria cópia autoral)
- Atalho Ctrl+S salva

**Geral:**
- Persistência IndexedDB com fallback localStorage comprimido
- Compressão lz-string + debounce persist 200ms
- Sync resiliente a 23505 (descarta locais conflitantes)
- Tema dark/light/auto + toggle no Topbar (1 clique)
- Command palette global (Ctrl+K)
- Atalho Ctrl+I pra import
- Modal de ajuda com lista de atalhos (?)
- Backup completo + restore (incluindo hierarquia)
- /revisar com bulk-fill de gabarito via IA

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
