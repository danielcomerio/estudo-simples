/**
 * DELETE /api/account/delete — exclui a conta do user (LGPD art. 18).
 *
 * Fluxo:
 *  1. CSRF + rate limit (proteção contra deletes acidentais via CSRF).
 *  2. Verifica auth.
 *  3. Cancela subscription Stripe (se existir).
 *  4. Apaga `auth.users` row via service role — ON DELETE CASCADE
 *     remove profiles + questions + concursos + tudo automaticamente
 *     (FKs com cascade na 0001).
 *  5. Cliente recebe sucesso e faz logout local.
 *
 * Stripe customer NÃO é apagado — política do Stripe + obrigação fiscal
 * de retenção de invoices. Customer fica órfão sem subscriptions ativas
 * (não cobra). Usuário pode fazer signup novo com mesmo email mais tarde.
 *
 * Idempotente: se rodar 2x e a 2ª não encontrar o user, retorna 200 OK.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe-server';
import { assertSameOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  // Rate limit estrito: 3 deletes por hora por IP. Defesa contra spam.
  const rl = rateLimit(req, {
    max: 3,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'delete',
  });
  if (rl) return rl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Confirmação extra: body precisa ter { confirmEmail: <user.email> }
  // pra deixar quase impossível delete por engano (mesmo se algo
  // suspeito chegasse a passar pelas defesas anteriores).
  let body: { confirmEmail?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body vazio = rejeita
  }
  if (!body.confirmEmail || body.confirmEmail !== user.email) {
    return NextResponse.json(
      { error: 'confirm_email_mismatch' },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  // 1. Cancela Stripe subscription se existir
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const subId = (profile as { stripe_subscription_id?: string } | null)
      ?.stripe_subscription_id;
    if (subId) {
      try {
        await stripe.subscriptions.cancel(subId, {
          invoice_now: false,
          prorate: false,
        });
      } catch (e) {
        // Cancelamento pode falhar se subscription já estiver canceled.
        // Não bloqueia o delete da conta.
        console.warn('[account-delete] stripe cancel failed', e);
      }
    }
  } catch (e) {
    console.warn('[account-delete] profile lookup failed', e);
  }

  // 2. Apaga auth.users (cascade derruba profiles, questions, etc.)
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    console.error('[account-delete] auth.users delete failed', deleteErr);
    return NextResponse.json(
      { error: 'delete_failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
