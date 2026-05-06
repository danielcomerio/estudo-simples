# Ações pendentes do usuário

Este arquivo é a "pilha" de coisas que dependem de você fazer (configurações, ações no Supabase/Stripe/Vercel) e que **eu não posso fazer pelo CLI/código**. Mantenha aberto enquanto operacionaliza o lançamento.

## 🔴 Crítico — antes de o app comercial funcionar

### 1. Aplicar migrations no Supabase

No Supabase Dashboard → SQL Editor → cole e roda **na ordem**:

1. `supabase/migrations/0005_billing.sql` (profiles + plan + triggers + grandfather)
2. `supabase/migrations/0006_analytics.sql` (analytics_events + newsletter_signups)
3. `supabase/migrations/0007_pricing_tiers.sql` (3 tiers: free / estudante / pro)

> Idempotentes — pode reaplicar sem quebrar.
>
> Após `0005`, sua conta master é promovida automaticamente pra `plan='pro'` (grandfather de >100 questões).

### 2. Configurar variáveis de ambiente no Vercel

Settings → Environment Variables → adicione (todas sem `NEXT_PUBLIC_` exceto onde indicado):

```
SUPABASE_SERVICE_ROLE_KEY=eyJ... (Supabase Dashboard → Settings → API)
STRIPE_SECRET_KEY=sk_test_xxx (ou sk_live_xxx em prod)
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_ESTUDANTE_MONTHLY=price_xxx
STRIPE_PRICE_ESTUDANTE_YEARLY=price_xxx

# Públicas (com NEXT_PUBLIC_)
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app
NEXT_PUBLIC_CONTACT_EMAIL=contato@seudominio.com
NEXT_PUBLIC_SITE_URL=https://seu-dominio.vercel.app
```

### 3. Criar produtos e prices no Stripe

Stripe Dashboard (Test mode primeiro):

1. Products → Create product → "Estudo Simples Estudante"
   - Monthly: R$ 9,90 BRL recurring monthly → `STRIPE_PRICE_ESTUDANTE_MONTHLY`
   - Yearly: R$ 89,00 BRL recurring yearly → `STRIPE_PRICE_ESTUDANTE_YEARLY`

2. Products → Create product → "Estudo Simples Pro"
   - Monthly: R$ 19,90 BRL recurring monthly → `STRIPE_PRICE_PRO_MONTHLY`
   - Yearly: R$ 179,00 BRL recurring yearly → `STRIPE_PRICE_PRO_YEARLY`

3. Cola os 4 IDs nas envs correspondentes.

### 4. Configurar webhook do Stripe

Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **URL**: `https://seu-app.vercel.app/api/stripe/webhook`
- **Events**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Após criar → "Reveal Signing Secret" → cola em `STRIPE_WEBHOOK_SECRET`

### 5. Ativar Customer Portal no Stripe

Settings → Billing → Customer portal → Activate. Configura permissões: cancelar, atualizar payment, baixar fatura.

### 6. Push de tudo que está commitado localmente

Você ainda tem **muitas mudanças locais não pushadas**. Sem push, nada disso vai pra produção. Sequência segura:

```powershell
git add -A
git commit -m "feat: comercial completo - billing, landing, sobre, roadmap, concursos-populares, etc"
git push
```

Vercel auto-deploya. Aguarda ~1-2min.

---

## 🟡 Importante — UX / configuração

### 7. Definir-se como admin (acesso a /admin)

Após login no app, descubra seu `user_id` no Supabase Dashboard → Authentication → Users. Cole o UUID em env do Vercel:

```
ADMIN_USER_IDS=seu-uuid-aqui
```

Pode listar múltiplos separados por vírgula. Sem isso, `/admin` redireciona pra `/`.

### 8. Setar conta master como Pro manualmente (se grandfather não pegar)

A migration 0005 promove automaticamente users com >100 questões. Se por algum motivo seu profile ficou `free`, faça manualmente no Supabase SQL Editor:

```sql
update public.profiles
   set plan = 'pro', subscription_status = null
 where user_id = 'seu-uuid-aqui';
```

### 9. Atualizar seed da plataforma quando adicionar/remover questões públicas

Já documentado em `docs/BILLING_SETUP.md` e `docs/MANUAL.md` seção 12. Resumo:

```powershell
# Marca questões com tag 'platform' no /banco (bulk)
$env:NEXT_PUBLIC_SUPABASE_URL = "..."
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "..."
$env:SUPABASE_EMAIL = "..."
$env:SUPABASE_PASSWORD = "..."
npm run export:platform
git add public/platform-questions.json
git commit -m "chore(platform): atualiza seed"
git push
```

---

## 🟢 Backlog — ideias e melhorias futuras

### Email transacional (Resend / SendGrid)

- Welcome email após signup confirmado
- Reminders de estudo (configuráveis)
- Reminder do fim do trial (3 dias antes, 1 dia antes)
- Reminder de cobrança pra trial finalizando
- Email de abandoned checkout
- Newsletter de release notes (usar `newsletter_signups`)

### Mais conteúdo / SEO

- Blog estrutura: posts por banca, dicas de estudo, atualidades
- Mais bancas em `/concursos-populares` (Vunesp, Quadrix, IBADE, ...)
- Pages dedicadas pra concursos específicos populares (PF, PRF, INSS, TRT)

### Conversão

- Pix anual à vista (Stripe BR recurring é só cartão hoje — pode ser one-time)
- Programa de referral (1 mês grátis pra cada amigo que assinar)
- Cupons de desconto (Stripe coupons já suportado em `allow_promotion_codes: true`)
- A/B testing dos preços (variantes via Stripe + cookie assignment)
- Welcome flow em 4 etapas (criar concurso → importar/seed → primeira sessão)
- Showcase / demo data interativo na landing

### Funcionalidades

- Importação de Anki .apkg
- Integração Telegram pra reminders diários
- OCR pra capturar questão por foto
- Áudio: leitura de questão (acessibilidade)
- Correção automatizada de discursivas via IA (opt-in)
- Compartilhamento opcional de banco entre colegas
- Plano "estudo grupo"

### Hardening adicional

- 2FA via TOTP (Supabase suporta)
- Audit log de mudanças sensíveis em profiles
- WAF / Cloudflare na frente pra DDoS protection séria
- Rate limit distribuído (atual é em-memória por instância)

---

## ✅ Já implementado e validado

Pra referência — não precisa fazer nada nesses:

- Páginas: `/inicio`, `/sobre`, `/roadmap`, `/manual`, `/planos`, `/contato`, `/privacidade`, `/termos`, `/concursos-populares` + 4 bancas, `/admin`, `/_not-found`
- Billing: profiles + RLS + triggers + grandfather, Stripe checkout/webhook/portal, trial 14 dias, customer portal
- Security: CSRF + rate limit + DB triggers + CSP/HSTS/X-Frame headers
- LGPD: política de privacidade, account deletion endpoint
- SEO: sitemap + robots + OG images + JSON-LD
- Lead capture: newsletter form + endpoint
- Resend de email confirmação
- Mobile: bottom navbar, focus-mode hide, dialogs full em mobile, tap-targets ≥44px
- Memorização: SM-2 + FSRS-6, active recall, mnemônico, retry-wrong, streak com freeze, achievements, calibração
- Estatísticas: heatmap clicável, weekday distribution, periodos, sessions log, top inimigas, ranking de tags
- Plataforma: seed export script + auto-load + recarga manual
