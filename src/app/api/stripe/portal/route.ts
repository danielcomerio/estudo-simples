/**
 * Stripe Billing Portal — link onde o user gerencia assinatura.
 * (Cancelar, atualizar cartão, baixar fatura, etc.)
 *
 * Segurança:
 *  - Só user autenticado.
 *  - Customer_id vem do profile do user (não do client) — impossível
 *    abrir portal de outra conta.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe-server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const rl = rateLimit(req, { max: 20, windowMs: 60_000, keyPrefix: 'portal' });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'no_subscription' },
      { status: 400 }
    );
  }

  const origin = req.headers.get('origin') ?? '';
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/configuracoes`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'stripe_error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
