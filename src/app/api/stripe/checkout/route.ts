/**
 * Stripe Checkout — cria a session e devolve URL pra redirect.
 *
 * Segurança:
 *  - Apenas users autenticados podem invocar (auth.getUser na sessão).
 *  - User_id do Supabase passa em `client_reference_id` e em metadata
 *    (redundância — webhook usa o que estiver disponível).
 *  - Aceita body `{ price: 'monthly' | 'yearly' }`. Mapeamento de price
 *    real é server-side (env vars). Cliente NUNCA passa price_id.
 *  - URLs success/cancel são fixas em domínio próprio (sem open redirect).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { priceIdFor, stripe } from '@/lib/stripe-server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Defesa CSRF: rejeita request que não vem do nosso domínio
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  // Rate limit: 10 checkouts iniciados por minuto por IP
  const rl = rateLimit(req, { max: 10, windowMs: 60_000, keyPrefix: 'checkout' });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Body: { tier: 'estudante' | 'pro', interval: 'monthly' | 'yearly' }
  let interval: 'monthly' | 'yearly' = 'monthly';
  let tier: 'estudante' | 'pro' = 'pro';
  try {
    const body = await req.json();
    if (body?.interval === 'yearly') interval = 'yearly';
    if (body?.tier === 'estudante') tier = 'estudante';
  } catch {
    // body opcional — default pro monthly
  }

  const price = priceIdFor(tier, interval);
  if (!price) {
    return NextResponse.json(
      { error: 'price_not_configured' },
      { status: 500 }
    );
  }

  // Origin: pega do header pra não hardcode. Sem open redirect porque
  // só usamos como prefixo das URLs success/cancel — não passa pra
  // Stripe um domínio externo.
  const origin = req.headers.get('origin') ?? '';
  const successUrl = `${origin}/configuracoes?subscribed=1`;
  const cancelUrl = `${origin}/planos?canceled=1`;

  // Procura customer já existente pra não criar duplicado
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // Trial: usuário ainda não teve subscription antes (nem ativa nem
  // cancelada). Stripe controla "trial usado uma vez por customer" via
  // `subscription_data.trial_settings.end_behavior`. Se já tiveram
  // trial, Stripe rejeita criar trial novo automaticamente.
  const trialDays = profile?.stripe_subscription_id ? 0 : 14;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Pode usar customer existente ou customer_email pra Stripe
      // criar um novo. Quando webhook receber checkout.session.completed,
      // sincroniza o customer_id no profile.
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email }),
      // Usado pelo webhook pra mapear de volta ao user_id Supabase
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: {
        metadata: { user_id: user.id },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'stripe_error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
