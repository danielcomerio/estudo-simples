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
