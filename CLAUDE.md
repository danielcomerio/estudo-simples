# Contexto do projeto — para o Claude

App de **repetição espaçada para concursos públicos** (FGV em primeiro plano).
Construído em uma única sessão (2026-04-25) migrando de um SPA standalone
(HTML/CSS/JS + localStorage) para **Next.js 14 + Supabase + Vercel**, com
autenticação por email/senha e cada usuário em sua própria instância (RLS).

A documentação voltada ao usuário final está em [`README.md`](README.md). Este
arquivo é o briefing para sessões futuras de Claude — capture o "porquê" das
decisões e os bugs que já machucaram, não o "o que está em cada arquivo".

---

## Stack

- **Next.js 14.2.18** (App Router, `src/` directory) + **TypeScript estrito**
- **React 18.3** (não 19 — ver "Gotchas")
- **Supabase**: Auth (email/senha) + Postgres + RLS via `@supabase/ssr ^0.5`
- **Sem** Tailwind, shadcn, zustand, react-query, ou qualquer UI lib.
  CSS puro com variáveis em `src/app/globals.css`. Store próprio sobre
  `useSyncExternalStore`. Decisão deliberada — o usuário rejeitou Tailwind
  ao propor: app pequeno, sem dialogs/comboboxes complexos, custo de
  migração não compensaria.
- **Vercel** com `vercel.json { "framework": "nextjs" }` (necessário porque
  o projeto Vercel foi criado antes do código existir e ficou marcado
  como "Other")

## Princípios arquiteturais

1. **Offline-first.** localStorage é a fonte de leitura; Supabase é destino
   de sincronia em background. Nada na UI espera resposta de rede.
2. **Validação em fronteira.** Importação de JSON é onde a desconfiança fica.
   Internamente confiamos nos tipos.
3. **Mutações tipadas em um único lugar.** Toda alteração passa pelas
   funções exportadas em `lib/store.ts`. Não mexa no `state` direto.
4. **Sem dependências de UI.** Toast, ConfirmDialog, etc., são componentes
   próprios em `src/components/`.
5. **Server Components só onde compensa** (auth check do layout). O resto
   é client component porque depende de localStorage e interatividade.

## Como o sync funciona

`lib/sync.ts` orquestra:

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

## Como o store funciona

`lib/store.ts` é um zustand-lite caseiro:

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

## Como o SRS funciona

`lib/srs.ts` implementa SM-2 com tweaks Anki-like. Inputs:
- `q=0` (De novo): zera repetições, intervalo 0 (mesmo dia).
- `q=3` (Difícil): progressão usa `max(1.2, EF − 0.15)` em vez de EF cheio.
- `q=4` (Bom): progressão padrão (1d → 6d → 6d × EF → ...).
- `q=5` (Fácil): intervalo final ×1.3.
- EF clamp em [1.3, ~3.0] pela fórmula clássica de Wozniak.

Para discursivas, `suggestQualityFromScore(pct)` mapeia <40/40-65/65-85/>85 → 0/3/4/5.

## Schema do banco

Migração canônica em [`supabase/migrations/0001_initial.sql`](supabase/migrations/0001_initial.sql).
Resumo:

- Tabela única `questions(id, user_id, type, disciplina_id, tema, banca_estilo,
  dificuldade, payload jsonb, srs jsonb, stats jsonb, dedup_hash generated,
  created_at, updated_at, deleted_at)`.
- **Híbrido** colunas indexadas + `payload jsonb` com o conteúdo cru
  (enunciado, alternativas, espelho, etc.). Trade-off escolhido: queries
  simples são rápidas, mudar formato JSON não exige migration. Normalizar
  alternativas em outra tabela seria overkill (decisão acordada com o
  usuário).
- 4 índices parciais para `deleted_at IS NULL` + 1 para `updated_at`
  (sync) + 1 único para dedupe por `(user_id, dedup_hash)`.
- Trigger `set_updated_at` em update.
- RLS habilitado com 4 policies separadas (select/insert/update/delete),
  todas `auth.uid() = user_id`.

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

## Comandos

```bash
npm install              # uma vez
npm run dev              # http://localhost:3000
npm run build            # validar antes de push
npm run typecheck        # tsc --noEmit (rápido)
git push                 # Vercel auto-deploya (~1min)
```

Build local sem env reais: prefixe com placeholders pra não falhar:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x npm run build
```

## Convenções específicas

- Arquivos client começam com `'use client';`.
- Componentes em `src/components/`, páginas em `src/app/<rota>/page.tsx`,
  lógica pura em `src/lib/`.
- Path alias `@/` aponta pra `src/`.
- Toasts: `import { toast } from '@/components/Toast'`. Use kinds
  `'success' | 'error' | 'warn' | ''`.
- Confirmações destrutivas: `import { confirmDialog } from
  '@/components/ConfirmDialog'`. Sempre passe `danger: true` para
  exclusões.
- **Não escreva** comentários explicando "o que" o código faz. Só "por que"
  quando for não óbvio (especialmente: workarounds de limitações de
  framework/SDK, decisões deliberadas que parecem erradas).

## O que NÃO mudar sem motivo forte

- Stack (não trocar pra Tailwind/shadcn — usuário já vetou).
- Schema híbrido (não normalizar alternativas em outra tabela).
- Algoritmo SRS (já é estado-da-arte para SM-2; só trocar se for por
  FSRS, que é o sucessor moderno e exigiria store de revisões).
- Padrão de auth com middleware no `src/`.
- O cache do `useStore`.

## Limitações conhecidas / dívida deliberada

- Sync é last-write-wins. Para um app monousuário em múltiplos
  dispositivos, é aceitável.
- Sem realtime (Supabase Realtime). Polling de 60s + on-focus.
- Sem dark/light toggle manual — segue o `prefers-color-scheme` do SO.
- Sem export de stats em CSV. Só do banco em JSON.
- Sem importação de Anki .apkg. Só JSON.
- Sem suporte a imagens nas questões (text-only).

## Quando adicionar uma feature nova

Antes de escrever código:
1. Onde encaixa no fluxo? (banco → sessão → revisão → stats)
2. Toca o schema? Se sim, criar nova migration `0002_*.sql` (não
   editar a 0001).
3. Toca a sync? Adicionar uma nova mutação em `store.ts` que marque
   `pendingSync` corretamente.
4. Toca a UI de sessão? Lembrar dos atalhos de teclado existentes
   (A-E pra responder; 1/2/3/4 pra rate).

## Histórico crítico de decisões

Veja `git log --oneline` — commits têm o "porquê" no corpo:

- `cb609b5` — `vercel.json` pra forçar framework=nextjs (build estava
  procurando `public/`)
- `52ae58d` — paginação no `pullSince` (limite de 1000 linhas do
  PostgREST aparecia como "carrega 1000 e depois mais 232 num F5")
- `a7a9ff9` — middleware movido pra `src/` (skeleton infinito)
- `9b2a367` — favicon SVG em `app/icon.svg`
- `6d77aeb` — cache no `useStore` (loop infinito)
- `1b8932f` — migração inicial Next.js + Supabase + Vercel
