/**
 * Stripe webhook — receptor único de eventos de billing.
 *
 * Esse é o único caminho que escreve em `profiles.plan`. Cliente NÃO
 * tem permissão (RLS bloqueia escrita; service role bypassa). Stripe
 * dispara eventos:
 *   - checkout.session.completed (assinou)
 *   - customer.subscription.updated (mudou plano/payment)
 *   - customer.subscription.deleted (cancelou)
 *   - invoice.payment_failed / .succeeded (status changes)
 *
 * Camadas de segurança:
 *  1. Verificação de signature HMAC via Stripe SDK constructEvent.
 *     Stripe assina o payload com STRIPE_WEBHOOK_SECRET; tampering
 *     ou request forjado falha.
 *  2. Idempotência: cada event.id é salvo em stripe_events. Reprocessar
 *     não duplica. Stripe retransmite até 3 dias se respondemos != 2xx.
 *  3. Service role pra escrever em profiles (RLS bloqueia client).
 *  4. Mapping confiável: usa metadata.user_id setado no checkout.
 *  5. Body cru: usa request.text() pra não alterar bytes (constructEvent
 *     compara o raw payload com a signature).
 *
 * IMPORTANTE: NÃO logar payloads completos em produção (PII).
 */

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { planFromPriceId, stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe-server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Determina o plan efetivo: primeiro pelo status (canceled = free),
// depois pelo price_id (estudante vs pro).
function planFor(
  sub: Stripe.Subscription
): 'free' | 'estudante' | 'pro' {
  const active =
    sub.status === 'active' ||
    sub.status === 'trialing' ||
    sub.status === 'past_due';
  if (!active) return 'free';
  // Pega o primeiro item da subscription (single-price model)
  const priceId = sub.items.data[0]?.price.id;
  return planFromPriceId(priceId);
}

async function alreadyProcessed(eventId: string, type: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('stripe_events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();
  if (data) return true;
  // Marca processado ANTES de processar — se subir erro depois,
  // a próxima retransmissão pula. Compromisso: prefere "às vezes pula"
  // a "às vezes duplica" (efeitos colaterais críticos).
  await sb.from('stripe_events').insert({ id: eventId, type });
  return false;
}

async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const sb = getSupabaseAdmin();
  // user_id vem da metadata.user_id (setado no checkout). Fallback:
  // procura profile pelo customer_id.
  const userId = sub.metadata?.user_id;
  let row: { user_id: string } | null = null;
  if (userId) {
    row = { user_id: userId };
  } else {
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const { data } = await sb
      .from('profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data) row = data as { user_id: string };
  }
  if (!row) {
    console.error(
      '[stripe-webhook] subscription sem user_id mapeável',
      sub.id
    );
    return;
  }

  // Master: webhook é totalmente ignorado pra preservar a UI limpa.
  // A trigger protect_master_plan no DB bloqueia mudança de plan, mas
  // os outros campos (subscription_status, current_period_end, etc)
  // não tinham proteção e estavam acumulando lixo (ex: status='canceled'
  // aparecia em /configuracoes mesmo o user sendo master). Solução:
  // pular o UPDATE inteiro pra master. Se admin futuramente quiser
  // associar um customer Stripe a master pra teste, faz manualmente.
  const { data: existing } = await sb
    .from('profiles')
    .select('plan')
    .eq('user_id', row.user_id)
    .maybeSingle();
  const isMasterAccount = (existing as { plan?: string } | null)?.plan === 'master';
  if (isMasterAccount) {
    console.info(
      '[stripe-webhook] master account — skipping subscription sync',
      sub.id
    );
    return;
  }

  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const plan = planFor(sub);

  const previousPlan = (existing as { plan?: string } | null)?.plan ?? null;

  await sb
    .from('profiles')
    .update({
      plan,
      subscription_status: sub.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
    })
    .eq('user_id', row.user_id);

  // Audit se plan mudou (não loga toda renovação periódica)
  if (previousPlan && previousPlan !== plan) {
    const { audit } = await import('@/lib/audit');
    void audit({
      userId: row.user_id,
      action: 'plan.changed',
      meta: {
        from: previousPlan,
        to: plan,
        subscription_id: sub.id,
      },
    });
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  // Em mode=subscription, session tem subscription como string (id) — busca
  // detalhes pra ter status real.
  if (session.mode !== 'subscription' || !session.subscription) return;
  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;
  const sub = await stripe.subscriptions.retrieve(subId);

  // Garante que metadata.user_id está populada (vem do client_reference_id
  // do checkout — fallback)
  if (!sub.metadata?.user_id && session.client_reference_id) {
    await stripe.subscriptions.update(subId, {
      metadata: { user_id: session.client_reference_id },
    });
    sub.metadata = { ...sub.metadata, user_id: session.client_reference_id };
  }
  await syncSubscription(sub);
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription
): Promise<void> {
  const sb = getSupabaseAdmin();
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Master: skipa COMPLETAMENTE — não atualiza nem subscription_status
  // (que estava criando lixo na UI: "Status: canceled" pra um master).
  const { data: rows } = await sb
    .from('profiles')
    .select('user_id, plan')
    .eq('stripe_customer_id', customerId)
    .neq('plan', 'master');

  await sb
    .from('profiles')
    .update({
      plan: 'free',
      subscription_status: 'canceled',
      cancel_at_period_end: false,
    })
    .eq('stripe_customer_id', customerId)
    .neq('plan', 'master');

  for (const r of rows ?? []) {
    const { audit } = await import('@/lib/audit');
    void audit({
      userId: r.user_id,
      action: 'plan.canceled',
      meta: { from: r.plan, subscription_id: sub.id },
    });
  }
}

export async function POST(req: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET ausente');
    return NextResponse.json(
      { error: 'webhook_not_configured' },
      { status: 500 }
    );
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    // Signature inválida = request não veio do Stripe (ou foi adulterado)
    const msg = e instanceof Error ? e.message : 'invalid_signature';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Idempotência
  if (await alreadyProcessed(event.id, event.type)) {
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      // invoice.* são informativos — Stripe atualiza subscription.status
      // de qualquer forma e dispara customer.subscription.updated.
      default:
        // Tipos não tratados: aceita pra Stripe não ficar reentregando
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[stripe-webhook] handler error', event.type, e);
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 });
  }
}
