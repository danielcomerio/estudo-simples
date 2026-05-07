# API endpoints — Estudo Simples

Referência interna dos endpoints REST do app. Não é uma API pública —
todos exigem auth (cookie de sessão Supabase) ou são internos
(webhooks/cron com header de auth).

## Convenções

- Todos retornam JSON.
- Erros: `{ "error": "code", "message"?: "..." }` com status HTTP semântico.
- Auth: cookie de sessão Supabase (`createClient` no server). Sem
  Bearer tokens públicos.
- CSRF: rotas mutativas (POST/DELETE) chamam `assertSameOrigin(req)` —
  rejeita se Origin não bate com Host.
- Rate limit: aplicado nos endpoints sensíveis via `rateLimit()`.

## Endpoints

### `GET /api/health`
Healthcheck pra uptime monitoring. Retorna `{"ok":true,"version":"..."}`.
Sem auth. Pode ser polled livremente.

### Auth/Account

#### `POST /api/account/delete`
Apaga conta do user atual + todos os dados (questions, profiles,
subscriptions). Cancela subscription Stripe se ativa.
Auth: obrigatória.

### Stripe (billing)

#### `POST /api/stripe/checkout`
Cria checkout session pra novo plano.
- Body: `{ tier: 'estudante' | 'pro', interval: 'monthly' | 'yearly' }`
- Bloqueia: master (400 `master_no_checkout`); subscription ativa (409 `already_subscribed`).
- Retorna: `{ url }` pra redirect.

#### `POST /api/stripe/portal`
Cria sessão do Stripe Billing Portal pra gerenciar subscription
existente. Retorna `{ url }`.

#### `POST /api/stripe/webhook`
Receptor de eventos Stripe. Verifica HMAC via `STRIPE_WEBHOOK_SECRET`.
Idempotente (stripe_events table). Skip total pra master accounts
(preserva campos legados sem rebaixar).

### Sharing — Fase C2 (snapshot)

#### `POST /api/share`
Cria link de compartilhamento snapshot.
- Body: `{ questionIds: string[], expirationDays?: number }` (1-36500)
- Gate: Pro/Master via `canShareDecks`.
- Cap: 5000 questões.
- Retorna: `{ token, url, expires_at, question_count }`.

#### `GET /api/share`
Lista links do owner. Retorna `{ links: [...] }`.

#### `GET /api/share/[token]`
Preview público (anon). Retorna snapshot completo + metadata.
410 Gone se revoked/expired.

#### `DELETE /api/share/[token]`
Revoga link (UPDATE revoked_at). Auth obrigatória + ownership.

### Sharing — Fase C3 (live decks)

#### `GET /api/live-decks`
Lista decks próprios + recebidos. Retorna `{ own, received }`.

#### `POST /api/live-decks`
Cria deck a partir de questões.
- Body: `{ name, description?, questionIds: string[] }` (max 5000)
- Gate: Pro/Master.
- Retorna: `{ id, name }`.

#### `GET /api/live-decks/[id]/grants`
Lista grants do deck (só owner). Retorna `{ grants: [...] }`.

#### `POST /api/live-decks/[id]/grants`
Concede acesso por email.
- Body: `{ email, permission?: 'read' }` (read_write futuro)
- 409 `already_granted` se email duplicado no mesmo deck.
- Pre-grant: aceita email sem conta — ativa via trigger no signup.

#### `DELETE /api/live-decks/[id]/grants/[grantId]`
Revoga grant. Trigger DB `freeze_grant_on_revoke` cria shared_deck
snapshot automaticamente. Retorna `{ ok, frozen_share_token }`.

### Push notifications

#### `POST /api/push/register`
Registra device token pra push.
- Body: `{ token, platform?: 'fcm'|'apns'|'web', label?, capacitor_platform? }`
- UPSERT por (user_id, token) — re-register substitui.
- Auto-detecta platform/label se não passar.

#### `DELETE /api/push/register?token=xxx`
Remove device. Idempotente.

### Cron

#### `GET /api/cron/srs-due`
Schedule `0 12 * * *` (12h UTC). Conta questões vencendo via RPC
`count_due_per_user` e dispara push pra cada user. Auth: header
`Authorization: Bearer ${CRON_SECRET}`.

#### `GET /api/cron/streak-risk`
Schedule `0 22 * * *`. Stub — implementação requer tracking
server-side de daily activity (não existe ainda).

### Newsletter

#### `POST /api/newsletter`
Lead capture pré-signup. Body `{ email, source? }`.
RLS permite anon insert. Sem retorno de dados sensíveis.

## Rate limits

| Endpoint | Limit | Janela |
|----------|-------|--------|
| `/api/stripe/checkout` | 10 | 1 min |
| `/api/stripe/portal` | 20 | 1 min |
| `/api/share` POST | 10 | 1 min |
| `/api/share/[token]` GET | 60 | 1 min |
| `/api/live-decks` POST | 5 | 1 min |
| `/api/live-decks/*/grants` POST | 20 | 1 min |
| `/api/push/register` | 30 | 1 min |

## Códigos de erro comuns

| Código | Status | Significado |
|--------|--------|-------------|
| `unauthenticated` | 401 | Sem sessão |
| `csrf_violation` | 403 | Origin/Host mismatch |
| `rate_limited` | 429 | Excedeu janela |
| `pro_required` | 403 | Feature paga sem plano Pro |
| `master_no_checkout` | 400 | Tentou checkout sendo master |
| `already_subscribed` | 409 | Duplo checkout |
| `already_granted` | 409 | Grant duplicado |
| `not_found` | 404 | Recurso inexistente |
| `revoked` | 410 | Link/grant revogado |
| `expired` | 410 | Link/grant expirado |
| `invalid_input` / `invalid_body` / `invalid_token` | 400 | Validação falhou |

## Headers de segurança aplicados

- `assertSameOrigin`: compara `Origin` header com `Host` (anti-CSRF).
- `rateLimit`: in-memory por IP, janela rolling.
- `getSupabaseAdmin` (service role): só em endpoints que precisam
  bypassar RLS (webhook, cron, share/[token] GET).

## Não-endpoints

Coisas que **não** são endpoints REST mas vale citar:

- `lib/sync.ts` — direct Supabase client (PostgREST) pra CRUD de
  questions. Não passa por nossos endpoints.
- `lib/hierarchy.ts` — direct Supabase pra concursos/disciplinas/topicos.
- Server Actions (`/auth/actions.ts`): `login`, `signup`, `logout`,
  `enterAsGuest`, `exitGuest`. Não são endpoints REST clássicos.
