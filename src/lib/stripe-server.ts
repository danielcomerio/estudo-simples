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
