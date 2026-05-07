# Deploy do Estudo Simples — guia completo

Setup do zero pra deploy em produção. Requer ~1h pra primeira vez.

## Pré-requisitos

- Conta GitHub (código)
- Conta Vercel (hosting)
- Conta Supabase (DB + auth + storage)
- Conta Stripe (pagamentos) — só se ativar billing
- (Opcional) Conta Telegram + @BotFather pra notificações
- Domínio próprio (opcional — Vercel oferece subdomínio free)

## 1. Supabase setup

### 1.1 Criar projeto

1. https://supabase.com → New Project
2. Region: South America (São Paulo)
3. Pricing: Free tier suficiente até ~10k usuários
4. Anote: `Project URL` e `anon key` (Settings → API)

### 1.2 Aplicar migrations

No SQL Editor, aplicar **na ordem**:

```
0001_initial.sql
0002_hierarchy.sql
0003_origem.sql
0004_cloze_flashcard.sql
0005_billing.sql
0006_analytics.sql
0007_pricing_tiers.sql
0008_disciplinas_slug.sql
0009_master_tier.sql
0010_questions_disciplina_uuid.sql
0011_question_concursos.sql
0012_shared_decks.sql
0013_live_decks.sql
0014_questions_unique_id_user.sql
0015_push_devices.sql
0016_count_due_rpc.sql
0017_public_decks_marketplace.sql
0018_telegram_bindings.sql
0019_questoes_do_dia.sql
0020_question_ratings.sql
```

Validar com `supabase/manual/diagnose_migrations.sql` — todos `true`.

### 1.3 Storage bucket (manual)

Storage → New bucket:
- Nome: `questions-images`
- Public ✓
- File size: 5 MB (5242880 bytes)
- Allowed MIME: `image/png, image/jpeg, image/webp, image/gif`

Depois: SQL Editor → cola `supabase/storage_setup.sql`.

### 1.4 Promover Daniel a master (admin)

Editar email em `supabase/manual/promote_master.sql`, rodar no SQL Editor.

## 2. Vercel deploy

### 2.1 Importar repo

1. Vercel → Add New → Project → Import GitHub repo
2. Framework: detected Next.js
3. **Antes de Deploy**: configurar env vars (próxima seção)

### 2.2 Env vars (Production)

Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # SECRET — NÃO public
NEXT_PUBLIC_APP_URL=https://app.estudosimples.com.br
```

Stripe (opcional, só se billing ativado):
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ESTUDANTE_MONTHLY=price_...
STRIPE_PRICE_ESTUDANTE_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
```

VAPID push (opcional):
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=B...
VAPID_PRIVATE_KEY=...   # SECRET
VAPID_SUBJECT=mailto:contato@...
```

Cron (recomendado):
```
CRON_SECRET=<random hex 32 chars>
```

Telegram (opcional):
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=estudosimplesbot
TELEGRAM_WEBHOOK_SECRET=<random>   # opcional
```

### 2.3 Deploy

Click Deploy. Build leva ~2min.

### 2.4 Custom domain

Settings → Domains → Add → seu domínio. Apontar CNAME no provedor de
DNS pra `cname.vercel-dns.com`.

## 3. Stripe (se billing)

Ver `docs/BILLING_SETUP.md` pra passo-a-passo. Resumo:
1. Stripe Dashboard → Products → criar 4 prices
2. Webhooks → Add endpoint → `https://app/api/stripe/webhook`
3. Eventos: checkout.session.completed, customer.subscription.{created,updated,deleted}, invoice.payment_{succeeded,failed}

## 4. Push notifications (se VAPID)

Ver `docs/PUSH_SETUP.md`:
1. `npx web-push generate-vapid-keys` → 2 keys
2. Vercel envs setadas
3. Aplicar 0015 + 0016
4. User clica "🔔 Ativar" em /configuracoes

## 5. Telegram (se bot)

Ver setup em `lib/telegram.ts`:
1. @BotFather → /newbot → token
2. setWebhook URL: `/api/telegram/webhook`
3. Vercel envs setadas
4. User clica "🔗 Vincular" em /configuracoes

## 6. Mobile (Capacitor — opcional)

Ver `docs/CAPACITOR_SETUP.md`. Custo: USD 99/ano Apple + USD 25 Google.

## 7. Monitoring

- Uptime: ping `/api/health` a cada 5min (UptimeRobot grátis).
- Erros: `/admin/errors` (futuro) ou direto SQL em `analytics_events`.
- Logs Vercel: Project → Logs.

## 8. Backup

- Supabase free tier: backups diários automáticos por 7 dias.
- Pra mais histórico: cron próprio que faz `pg_dump` (documentar
  futuro).

## 9. Observability

- `/api/health` reporta status (DB ping, config booleans, git SHA).
- `analytics_events` table com event=`client.error` agrega erros JS.
- Stripe webhook logs no Stripe Dashboard.

## 10. Comandos úteis pós-deploy

```bash
# Rerodar diagnóstico de migrations
psql $SUPABASE_DB_URL -f supabase/manual/diagnose_migrations.sql

# Backup local
pg_dump $SUPABASE_DB_URL > backup-$(date +%Y%m%d).sql

# Cron manual SRS-due
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app/api/cron/srs-due
```

## Custos esperados (1 ano, ~100 usuários)

- Vercel Hobby: free
- Supabase free tier: free (até 500MB DB + 1GB storage)
- Stripe: 2.9% + R$0.39 por transação (volume baixo)
- Domain: ~R$50/ano
- Apple Dev: USD 99 (se mobile)
- Google Play: USD 25 (one-time)

**Total**: ~R$200-1500/ano dependendo do escopo.

## Troubleshooting

- **Build falha**: env vars faltando (NEXT_PUBLIC_SUPABASE_URL/KEY são
  obrigatórias no build).
- **Auth não funciona**: cookie domain incorreto. Verificar middleware.
- **Stripe webhook 400**: signature errada. Conferir
  `STRIPE_WEBHOOK_SECRET`.
- **Push não envia**: VAPID keys não setadas. Ver `docs/PUSH_SETUP.md`.
- **Migration falha**: dependência não aplicada. Rodar diagnose.
