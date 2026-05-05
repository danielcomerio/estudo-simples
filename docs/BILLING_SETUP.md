# Configuração de Billing (Stripe)

Pra a camada paga funcionar, você precisa:

1. Aplicar a migration 0005 no Supabase
2. Configurar 6 variáveis de ambiente (Vercel + local)
3. Criar produto + 2 prices no Stripe (mensal + anual)
4. Configurar webhook endpoint no Stripe Dashboard

Tudo é configurável e reversível. Sem nenhum ponto onde dado é exposto.

---

## 1. Migration

No Supabase Dashboard → SQL Editor, cola e roda:

```bash
# Local: arquivo
supabase/migrations/0005_billing.sql
```

Cria: `profiles`, `stripe_events`, view `my_plan`, triggers, RLS.

> **Antes de aplicar**, se já existem usuários no `auth.users`, eles vão receber profile via backfill na própria migration (idempotente). Se não, o trigger `on_auth_user_created` cria pra cada novo signup.

> **Grandfather automático**: usuários com **>100 questões** no momento da migration são promovidos pra `plan='pro'` automaticamente (sem subscription Stripe — é "Pro grandfathered"). Sem isso, master/early users com banco grande ficariam bloqueados pelo trigger de limite. Você pode reverter promovendo manualmente: `update profiles set plan='free' where stripe_subscription_id is null and ...`.

Após aplicar, valide:

```sql
select * from public.profiles limit 5;
select * from information_schema.triggers where trigger_name = 'questions_enforce_limit';
```

Pra reverter: `supabase/migrations/0005_billing_down.sql`. **Atenção**: apaga histórico de quem é Pro.

---

## 2. Variáveis de ambiente

### Local (`.env.local`)

```
# Já existentes
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# NOVAS — todas server-only (sem prefixo NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role-key
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx_monthly
STRIPE_PRICE_PRO_YEARLY=price_xxx_yearly
```

### Vercel (Production)

Settings → Environment Variables → adiciona as 5 novas com escopo Production.

> **NUNCA** prefixe nenhuma com `NEXT_PUBLIC_`. Esse prefixo expõe a variável no bundle JS do client. Se vazar a `STRIPE_SECRET_KEY` ou a `SUPABASE_SERVICE_ROLE_KEY`, qualquer pessoa cria charges em sua conta ou bypassa toda a RLS.

---

## 3. Stripe — produto e prices

No Stripe Dashboard (modo Test pra começar):

1. **Products** → Create product
   - Nome: "Estudo Simples Pro"
   - Descrição: "Plano completo com tudo liberado"

2. Adiciona 2 prices recorrentes:
   - **Monthly**: R$ 19,90 BRL recurring monthly → copia o `price_xxx`
   - **Yearly**: R$ 179,00 BRL recurring yearly → copia outro `price_xxx`

3. Cola os 2 IDs em `STRIPE_PRICE_PRO_MONTHLY` e `STRIPE_PRICE_PRO_YEARLY`.

> Os preços exibidos em `/planos` são strings hardcoded em `src/components/PlanosCheckout.tsx` (variáveis `monthly` e `yearly`). Atualize os 2 lugares quando mudar o preço de verdade no Stripe.

---

## 4. Webhook

No Stripe Dashboard → Developers → Webhooks → **Add endpoint**:

- **Endpoint URL**: `https://seu-app.vercel.app/api/stripe/webhook`
  - Local com testing: `stripe listen --forward-to http://localhost:3000/api/stripe/webhook`
- **Events to send** (Select events):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Após criar, **Reveal Signing Secret** → copia → cola em `STRIPE_WEBHOOK_SECRET`.

### Por que esses 4 eventos

- `checkout.session.completed` — usuário acabou de assinar; sincroniza profile + customer/subscription IDs.
- `customer.subscription.created` — backup do anterior pra casos onde checkout não dispara o session event direto.
- `customer.subscription.updated` — mudança de status (active → past_due → canceled), troca de plano, mudança de payment method.
- `customer.subscription.deleted` — cancelamento confirmado; volta pra free.

Outros eventos (`invoice.*`) são informativos: Stripe atualiza `subscription.status` automaticamente e dispara `subscription.updated` em seguida.

---

## 5. Customer Portal

No Stripe Dashboard → Settings → Billing → Customer portal → **Activate**.

Configura o que o usuário pode fazer pelo portal:
- Cancelar
- Atualizar payment method
- Trocar de plano (mensal ↔ anual)
- Baixar faturas

A URL do portal não é fixa — é gerada por sessão via `/api/stripe/portal` com o `customer_id` do user atual.

---

## 6. Teste end-to-end (Test mode)

1. Abre `/planos` logado.
2. Clica "Assinar Pro" → Stripe Checkout abre.
3. Usa **`4242 4242 4242 4242`** (test card, Stripe), CVC qualquer, data futura.
4. Confirma → redireciona pra `/configuracoes?subscribed=1`.
5. Webhook deve disparar (vê em Stripe Dashboard → Webhooks → Events).
6. Profile no Supabase: `plan='pro'`, `subscription_status='active'`, IDs preenchidos.
7. Em `/configuracoes` → seção "Assinatura" mostra "✨ Pro" + botão "Gerenciar".

### Cards de teste úteis

- `4242 4242 4242 4242` — sempre aprova
- `4000 0000 0000 9995` — recusa (saldo insuficiente)
- `4000 0025 0000 3155` — pede 3DS
- Mais em https://docs.stripe.com/testing

---

## Camadas de segurança (resumo)

| Camada | Como funciona | Bypass possível? |
|---|---|---|
| **DB Trigger** `enforce_question_limit` | Roda BEFORE INSERT em `questions`. Lê `profiles.plan`. Rejeita se free + count >= 500. | Não. Mesmo `curl` direto na API REST do Supabase com anon key passa pelo trigger. |
| **RLS em `profiles`** | User só lê próprio. Nenhuma policy de UPDATE — só service role escreve. | Não. Tentar update direto = `permission denied`. |
| **Webhook signature** | Stripe assina payload com `STRIPE_WEBHOOK_SECRET` (HMAC-SHA256). SDK verifica. | Não, sem a secret. |
| **Idempotência** | Cada `event.id` salvo em `stripe_events`. Reprocessar é no-op. | N/A — defesa contra duplicata, não tampering. |
| **Service role isolada** | Só usado em `app/api/stripe/webhook/route.ts`. Importa `getSupabaseAdmin` apenas server-side. Nunca em client component. | Não. Se importasse em client, o build do Next quebraria com erro de env. |
| **Plan readback** | View `my_plan` filtra por `auth.uid()` server-side (security_invoker). | Não. SELECT em `profiles` direto também respeita RLS. |
| **Checkout redirect URLs** | Hardcoded em domínio próprio no server (`origin` do header). Sem param `next` controlado pelo client. | Não há open redirect. |

### Para revisar antes de prod

- [ ] Trocar Stripe pra modo **Live** (não Test)
- [ ] Atualizar todas as 5 envs no Vercel pra credenciais Live
- [ ] Adicionar webhook endpoint Live no Stripe Dashboard
- [ ] Testar 1 ciclo completo com cartão real (Stripe pode estornar imediatamente)
- [ ] Validar: cancelar pelo Portal → webhook → `profiles.plan='free'`
- [ ] Validar: tentar criar a 501ª questão como free → `free_plan_limit_reached`
