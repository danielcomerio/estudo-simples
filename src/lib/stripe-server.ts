/**
 * Stripe SDK init — server-only.
 *
 * NUNCA importe esse arquivo de um client component. STRIPE_SECRET_KEY
 * é segredo absoluto: vazá-lo permite a qualquer pessoa criar charges
 * em nome da sua conta. Só roda em route handlers (`app/api/.../route.ts`)
 * ou server actions.
 *
 * Uso:
 *   import { stripe } from '@/lib/stripe-server';
 *   await stripe.checkout.sessions.create(...)
 */

import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;

if (!key && typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  // Não quebra build (build pode rodar sem env real), mas avisa em runtime
  // quando a key falta de fato.
  console.warn(
    '[stripe-server] STRIPE_SECRET_KEY não configurado — billing não vai funcionar.'
  );
}

export const stripe = new Stripe(key ?? 'sk_test_placeholder', {
  // Pinned na versão da SDK instalada — atualiza junto com `npm update stripe`.
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
export const STRIPE_PRICE_PRO_MONTHLY =
  process.env.STRIPE_PRICE_PRO_MONTHLY ?? '';
export const STRIPE_PRICE_PRO_YEARLY =
  process.env.STRIPE_PRICE_PRO_YEARLY ?? '';
export const STRIPE_PRICE_ESTUDANTE_MONTHLY =
  process.env.STRIPE_PRICE_ESTUDANTE_MONTHLY ?? '';
export const STRIPE_PRICE_ESTUDANTE_YEARLY =
  process.env.STRIPE_PRICE_ESTUDANTE_YEARLY ?? '';

/**
 * Mapa price_id → tier. Usado pelo webhook pra determinar o plan
 * efetivo após o usuário trocar de price (subscription.updated).
 *
 * Mantém server-side — cliente nunca passa price_id, só nome do tier.
 */
export function planFromPriceId(priceId: string | null | undefined): 'free' | 'estudante' | 'pro' {
  if (!priceId) return 'free';
  if (priceId === STRIPE_PRICE_PRO_MONTHLY || priceId === STRIPE_PRICE_PRO_YEARLY) {
    return 'pro';
  }
  if (
    priceId === STRIPE_PRICE_ESTUDANTE_MONTHLY ||
    priceId === STRIPE_PRICE_ESTUDANTE_YEARLY
  ) {
    return 'estudante';
  }
  // Price não-mapeado: assume pro (defensive — usuário pagando merece acesso)
  return 'pro';
}

export function priceIdFor(
  tier: 'estudante' | 'pro',
  interval: 'monthly' | 'yearly'
): string {
  if (tier === 'pro') {
    return interval === 'yearly' ? STRIPE_PRICE_PRO_YEARLY : STRIPE_PRICE_PRO_MONTHLY;
  }
  return interval === 'yearly'
    ? STRIPE_PRICE_ESTUDANTE_YEARLY
    : STRIPE_PRICE_ESTUDANTE_MONTHLY;
}
