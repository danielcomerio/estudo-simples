# Estudo Simples

App de repetição espaçada para concursos públicos. Next.js 14 + Supabase + Vercel.

- **Auth**: email/senha (Supabase Auth).
- **Dados**: tabela única `questions` com RLS por usuário.
- **Offline-first**: tudo é lido do `localStorage`, sincronia em background com Supabase.
- **SRS**: SM-2 melhorado (Anki-like) — 4 botões (De novo / Difícil / Bom / Fácil).

---

## 1. Setup do Supabase

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY` (apenas para scripts admin; **nunca** subir ao client)
3. Em **Authentication → Providers → Email**: ative; opcional desabilitar "Confirm email" para login imediato no signup.
4. Em **SQL Editor**, abra um novo query e cole o conteúdo de [`supabase/migrations/0001_initial.sql`](supabase/migrations/0001_initial.sql). Execute.

Pronto: tabela criada, índices, trigger de `updated_at`, RLS por `auth.uid() = user_id`.

---

## 2. Rodar localmente

```bash
# Node 18.18+ é necessário
npm install
cp .env.example .env.local   # se ainda não tiver, e preencha as variáveis
npm run dev
```

Abre em http://localhost:3000.

---

## 3. Deploy no Vercel

```bash
npm i -g vercel        # se ainda não tem
vercel                 # primeira vez: vincula ao projeto Vercel
vercel --prod          # promove para produção
```

Configure as variáveis de ambiente na Vercel (mesmas do `.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` *(opcional, mas recomendado)* — ex.: `https://estudo-simples.vercel.app`. É usado como `redirect URL` da confirmação de email.

Em **Supabase → Authentication → URL Configuration**, adicione a URL da Vercel em **Site URL** e em **Redirect URLs** (`https://seu-app.vercel.app/auth/callback`).

---

## 4. Formatos de JSON aceitos

A importação aceita:

- Um único objeto `{ ... }`
- Um array `[ {...}, {...} ]`
- Um wrapper `{ "questions": [ ... ] }`

### Objetiva

```json
{
  "disciplina_id": "banco_de_dados",
  "tema": "JOINs",
  "dificuldade": 2,
  "banca_estilo": "FGV",
  "enunciado": "Texto da questão...",
  "alternativas": [
    { "letra": "A", "texto": "...", "correta": false, "explicacao": "..." },
    { "letra": "B", "texto": "...", "correta": true,  "explicacao": "..." }
  ],
  "gabarito": "B",
  "explicacao_geral": "Explicação macro do tema...",
  "pegadinhas": ["..."]
}
```

### Discursiva

```json
{
  "tipo": "discursiva",
  "disciplina_id": "inteligencia_artificial",
  "tema": "Métricas...",
  "tipo_discursiva": "A",
  "enunciado_completo": "...",
  "comando": "...",
  "quesitos": [{ "numero": 1, "pergunta": "...", "pontos_max": 2.5 }],
  "rubrica":  [{ "criterio": "...", "pontos": 2.5, "detalhamento": "..." }],
  "espelho_resposta": "...",
  "conceitos_chave": ["..."],
  "pegadinhas_esperadas": ["..."],
  "estrategia_redacao": "...",
  "observacoes_corretor": "..."
}
```

Auto-detecção: presença de `tipo: "discursiva"`, `tipo_discursiva` ou `espelho_resposta` → discursiva. Caso contrário, presença de `alternativas` → objetiva.

---

## 5. Atalhos de teclado

Durante uma sessão de objetivas:

- `A` `B` `C` `D` `E` — selecionar alternativa
- Após responder: `1` De novo · `2` Difícil · `3` ou `Enter` Bom · `4` Fácil

---

## 6. Estrutura

```
src/
  app/
    layout.tsx            # layout raiz (server)
    page.tsx              # /
    banco/page.tsx
    estudar/page.tsx
    discursivas/page.tsx
    stats/page.tsx
    login/page.tsx
    signup/page.tsx
    auth/
      actions.ts          # login, signup, logout (server actions)
      callback/route.ts
    globals.css
  components/             # client components
    StoreProvider, Topbar, Toast, ConfirmDialog, ImportZone, BancoList,
    QuestionRunner, DiscursivaRunner, Dashboard, StatsView
  lib/
    types.ts
    srs.ts                # SM-2 melhorado
    validation.ts
    store.ts              # store reativo (useSyncExternalStore)
    sync.ts               # engine de sync localStorage ↔ Supabase
    supabase/
      client.ts | server.ts | middleware.ts
middleware.ts             # proteção de rotas
supabase/migrations/0001_initial.sql
```

---

## 7. Como a sincronia funciona

1. Cada mutação local marca o id em `pendingSync` e dispara um `scheduleSync()` debouncado.
2. `syncNow()`:
   - Push: `upsert` em chunks dos ids pendentes (com `deleted_at` quando soft-delete).
   - Pull: `select` onde `updated_at > lastPullAt`. Linhas com mutação local pendente são preservadas.
3. Polling a cada 60s + eventos `online` e `focus` forçam re-sync.
4. Soft-delete: localmente fica oculto, é empurrado ao servidor, e depois removido do cache.

---

## 8. Como o SRS funciona

SM-2 melhorado (igual em filosofia ao Anki):

- **De novo (q=0)**: zera repetições, agenda no mesmo dia.
- **Difícil (q=3)**: progride mais devagar (multiplicador reduzido).
- **Bom (q=4)**: progressão padrão (1d → 6d → 6×EF → ...).
- **Fácil (q=5)**: amplifica o intervalo em 1.3×.

Ease factor mantido entre 1.3 e ~3.0 conforme fórmula clássica de Piotr Wozniak.

---

## 9. Práticas de estudo embutidas

- **Active recall**: você responde antes de ver o gabarito.
- **Distributed practice**: SRS distribui revisões ao longo do tempo.
- **Interleaving**: misture disciplinas em uma mesma sessão.
- **Desirable difficulties**: erra cedo, fortalece a memória — daí o botão "De novo".
- **Self-explanation** (discursivas): você escreve antes de revelar o espelho; depois autoavalia por quesito.
- **Heatmap + streak**: feedback motivacional no painel.
