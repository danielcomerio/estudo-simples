# Segurança — Estudo Simples

Documento de superfície de ataque e mitigações em vigor. Atualize ao adicionar/remover layers.

## HTTP headers (next.config.js)

| Header | Valor | Por quê |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` em dev) `https://js.stripe.com`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob: https:`; `font-src 'self' data:`; `connect-src 'self' <SUPABASE>` Stripe + ws localhost (dev); `frame-src` apenas Stripe; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self' Stripe`; `upgrade-insecure-requests` em prod | XSS, clickjacking, exfiltração |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Força HTTPS por 2 anos |
| `X-Content-Type-Options` | `nosniff` | Mitiga MIME sniffing XSS |
| `X-Frame-Options` | `DENY` | Backup pra `frame-ancestors` (browsers antigos) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy: não vaza path/query pra outros domínios |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self "https://checkout.stripe.com")` | Bloqueia features não usadas. Microphone permitido implicitamente pra Web Speech (voice search) — nota: navegador pede permissão explícita |

## Auth

- Supabase Auth via cookies httpOnly (`@supabase/ssr`).
- Login/Signup como Server Actions (`use server`) — Origin checked pelo runtime do Next.
- Logout limpa LS + IDB + cookies em `logoutAndReset()`.
- Visitante via cookie `es-guest=1` (não httpOnly, OK porque guest data fica só local).
- Master account via env `ADMIN_USER_IDS`. `/admin` redireciona não-admin pra `/`.

## RLS (Postgres)

Toda tabela do user (questions, concursos, disciplinas, topicos, edital_itens, concurso_disciplinas, simulados — quando aplicado, billing) tem 4 policies:

```sql
SELECT, INSERT, UPDATE, DELETE: USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
```

- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) **nunca** vai pro bundle do client (sem prefixo `NEXT_PUBLIC_`). Usado só em rotas server (`/admin`, webhook Stripe).
- Composite FKs `(id, user_id) → parent(id, user_id)` impedem que A roube id-prefix de B mesmo se RLS de uma tabela falhasse.

## DB CHECKs (defesa em profundidade)

Mesmo que UI e lib validem, DB tem CHECKs:
- `questions.type IN ('objetiva', 'discursiva', 'cloze', 'flashcard')`
- `questions.dificuldade BETWEEN 1 AND 5`
- `questions.origem IN (NULL, 'real', 'autoral', 'adaptada')`
- `questions.verificacao IN (NULL, 'verificada', 'pendente', 'duvidosa')`
- `origem='real'` exige `fonte.banca` (string) e `fonte.ano` (number)
- `length(fonte::text) <= 10000` (anti DoS)
- Triggers `enforce_question_limit` e `enforce_concurso_limit` por tier (free/estudante/pro) — última barreira contra abuso.

## XSS

- Todo HTML user-gerado (enunciado, alternativas, espelho, notas, mnemonic) passa por `lib/utils.ts:renderRichText()` que faz HTML escape e só permite tags brancas (`code`, `mark`, KaTeX inline).
- `dangerouslySetInnerHTML` usado APENAS via `renderRichText()` ou pra JSON-LD literal estático (`/inicio`). Nunca com strings cruas de input.
- KaTeX é renderizado server-side via `katex.renderToString` — output controlado.

## CSRF

Server Actions do Next 14 incluem token automático no form submit. Backend valida Origin header.

Webhook Stripe (`/api/stripe/webhook`) valida assinatura HMAC com `STRIPE_WEBHOOK_SECRET`. Idempotência via tabela `stripe_events`.

## Rate limiting

In-memory rate limit por IP (mencionado em compact previa). Aplicado em endpoints sensíveis: `/api/stripe/checkout`, `/api/stripe/portal`, `/api/newsletter`. Sem proteção persistente — vai mitigar bot trivial mas não DDoS sério (Vercel Edge protege isso).

## Storage (imagens de questão)

Bucket `questions-images` (Supabase Storage):
- Público (paths não-enumerable via UUID)
- INSERT/UPDATE/DELETE restritos a `(storage.foldername(name))[1] = auth.uid()::text`
- Cap 5MB por upload, MIMEs PNG/JPEG/WEBP/GIF
- Path scheme: `{user_id}/{question_id}/{uuid}.{ext}`

User não consegue listar pasta de outro pq Supabase Storage só lista por path auth-checked.

## Stripe

- Sem dados de cartão no app (Hosted Checkout).
- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` server-side only.
- Customer Portal pra cancelamento/upgrade — Stripe-managed.
- Idempotência via `stripe_events.event_id UNIQUE` previne replay.

## Cliente: armazenamento local

- IndexedDB + localStorage (compressed) — dados ficam no navegador.
- `purgeDeletedLocal` limpa após sync push.
- `STORAGE_KEY_USER` rastreado: ao trocar de user no mesmo browser, hidrate detecta e limpa LS + IDB.

## LGPD

- Conta deletada via `/configuracoes` → "Excluir conta" → deleta hard no DB (cascade nos owned).
- Export completo via Backup (todos os dados em JSON).
- Política em `/privacidade` (gerada de `docs/PRIVACY.md`).

## Vulnerabilidades aceitas

`npm audit` reporta 5 high/moderate em dev-dependencies (eslint-config-next/glob CLI, postcss XSS build-time). Não exploráveis em runtime de produção. Subir Next 15 resolveria — pendente decisão.

## Reporting de vulnerabilidades

Encontrou problema de segurança? Reporte de forma responsável **sem
disclosure público**:

- **Email**: contato@estudosimples.com.br (assunto `[SECURITY]`)
- Acuse de recebimento em ≤48h
- Resolução proporcional ao impacto
- Crédito público se você aceitar (Hall of Fame)

**Não faça**: DDoS, acessar dados de outros usuários (mesmo se
conseguir), persistência. Sem bug bounty monetário no momento.

## Próximos passos

- [ ] Adicionar `report-uri` no CSP pra coletar violations em produção.
- [ ] Implementar Trusted Types policy (Chrome) pra prevenir DOM-XSS programaticamente.
- [ ] Subresource integrity (SRI) em scripts externos (Stripe.js).
- [ ] Pen-test após 1k usuários reais.
- [ ] Rate limit persistente (Redis ou Vercel KV) em endpoints sensíveis.
- [ ] Adicionar tests de segurança específicos (XSS payload, CSRF replay, rate limit overrun).
