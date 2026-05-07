/**
 * Helpers de billing (planos / entitlements).
 *
 * Princípio: o cliente PODE saber qual plano o user está, mas a
 * verdade é o DB. Toda gate pra feature paga deve ser dupla:
 *   - UI: esconde/desabilita (UX)
 *   - DB: trigger ou RLS rejeita ações do plano errado (segurança)
 *
 * Helper `getMyPlan` lê via view `my_plan` (RLS scoped por auth.uid()).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type Plan = 'free' | 'estudante' | 'pro' | 'master';
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type MyPlan = {
  plan: Plan;
  subscription_status: SubscriptionStatus | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export const PLAN_LIMITS = {
  free: { questions: 200, concursos: 1 },
  estudante: { questions: 2000, concursos: 3 },
  pro: { questions: Infinity, concursos: Infinity },
  master: { questions: Infinity, concursos: Infinity },
} as const;

// Backcompat — código antigo importava esses
export const FREE_QUESTION_LIMIT = PLAN_LIMITS.free.questions;
export const FREE_CONCURSO_LIMIT = PLAN_LIMITS.free.concursos;

export async function getMyPlan(supabase: SupabaseClient): Promise<MyPlan> {
  const { data, error } = await supabase
    .from('my_plan')
    .select('plan, subscription_status, current_period_end, cancel_at_period_end')
    .maybeSingle();
  if (error || !data) {
    // Sem profile (nunca deveria acontecer pós-trigger), trata como free
    return {
      plan: 'free',
      subscription_status: null,
      current_period_end: null,
      cancel_at_period_end: false,
    };
  }
  return data as MyPlan;
}

/**
 * Master tem todos os privilégios de Pro + nunca expira. Pra checks de
 * "tem features Pro?", use isProOrMaster — é o que UI/API devem chamar.
 */
export function isMaster(plan: MyPlan | null | undefined): boolean {
  return plan?.plan === 'master';
}

export function isPro(plan: MyPlan | null | undefined): boolean {
  return plan?.plan === 'pro';
}

/** Quem tem acesso a features Pro: tier 'pro' ou 'master'. */
export function isProOrMaster(plan: MyPlan | null | undefined): boolean {
  return plan?.plan === 'pro' || plan?.plan === 'master';
}

/** Quem tem acesso a features pagas (estudante+): exclui só free. */
export function isPaid(plan: MyPlan | null | undefined): boolean {
  return (
    plan?.plan === 'pro' ||
    plan?.plan === 'estudante' ||
    plan?.plan === 'master'
  );
}

export function planLabel(plan: Plan): string {
  if (plan === 'master') return '👑 Master';
  if (plan === 'pro') return '✨ Pro';
  if (plan === 'estudante') return '🎓 Estudante';
  return 'Grátis';
}

/**
 * Considera "ativo" os status que dão acesso a features Pro:
 *  - master: SEMPRE ativo (não passa por Stripe).
 *  - pro: subscription_status active/trialing/past_due (grace period).
 *
 * Use ESTA função pra gates de feature, não isPro direto — porque
 * 'pro' com subscription canceled ainda vê plan='pro' no DB até a
 * próxima sincronização do webhook, mas não deve ter acesso.
 */
export function isActiveSubscription(plan: MyPlan | null | undefined): boolean {
  if (!plan) return false;
  if (plan.plan === 'master') return true;
  if (plan.plan !== 'pro') return false;
  const status = plan.subscription_status;
  return (
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due'
  );
}

/**
 * Pode acessar Stripe portal pra gerenciar assinatura?
 * Master: NÃO (não tem assinatura no Stripe — gerenciado manualmente).
 * Pro com Stripe customer: SIM.
 */
export function canManageSubscription(
  plan: MyPlan | null | undefined
): boolean {
  if (!plan) return false;
  if (plan.plan === 'master') return false;
  return isPro(plan) && plan.subscription_status !== null;
}

/**
 * Status de subscription que bloqueiam a criação de NOVA subscription
 * (duplo checkout). Usuário com qualquer um destes deve passar pelo
 * portal pra mudar/cancelar — proration automática do Stripe cuida da
 * diferença em upgrades/downgrades.
 */
const BLOCKING_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
]);

/**
 * Decide se um perfil deve ser bloqueado de criar nova checkout session.
 *
 * Bloqueio quando:
 *  - profile é master (não usa Stripe).
 *  - profile já tem subscription_id E status ativo (lista acima).
 *
 * Permite quando:
 *  - profile null/undefined (sem registro — pode comprar).
 *  - subscription_status é null/canceled/incomplete/incomplete_expired
 *    (sem subscription viva — pode comprar de novo).
 *
 * Pra UI: usa `isActiveSubscription(plan)` em conjunção com
 * `plan.plan === target_tier` pra mostrar "Plano atual ✓" vs "Trocar
 * pra X" no botão.
 */
export function shouldBlockNewCheckout(
  profile: {
    plan?: string | null;
    subscription_status?: SubscriptionStatus | string | null;
    stripe_subscription_id?: string | null;
  } | null | undefined
): { blocked: boolean; reason: 'master' | 'already_subscribed' | null } {
  if (!profile) return { blocked: false, reason: null };
  if (profile.plan === 'master') {
    return { blocked: true, reason: 'master' };
  }
  const hasActive =
    !!profile.stripe_subscription_id &&
    !!profile.subscription_status &&
    BLOCKING_SUBSCRIPTION_STATUSES.has(
      profile.subscription_status as SubscriptionStatus
    );
  if (hasActive) return { blocked: true, reason: 'already_subscribed' };
  return { blocked: false, reason: null };
}
