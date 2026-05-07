import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  canManageSubscription,
  canShareDecks,
  isMaster,
  isPro,
  isPaid,
  isProOrMaster,
  isActiveSubscription,
  planLabel,
  shouldBlockNewCheckout,
  type MyPlan,
} from '../billing';

const mockPlan = (overrides: Partial<MyPlan>): MyPlan => ({
  plan: 'free',
  subscription_status: null,
  current_period_end: null,
  cancel_at_period_end: false,
  ...overrides,
});

describe('billing', () => {
  describe('PLAN_LIMITS', () => {
    it('free tem 200 questões e 1 concurso', () => {
      expect(PLAN_LIMITS.free).toEqual({ questions: 200, concursos: 1 });
    });
    it('estudante tem 2.000 questões e 3 concursos', () => {
      expect(PLAN_LIMITS.estudante).toEqual({ questions: 2000, concursos: 3 });
    });
    it('pro é ilimitado', () => {
      expect(PLAN_LIMITS.pro.questions).toBe(Infinity);
      expect(PLAN_LIMITS.pro.concursos).toBe(Infinity);
    });
  });

  describe('isPro', () => {
    it('true só para plan=pro', () => {
      expect(isPro(mockPlan({ plan: 'pro' }))).toBe(true);
      expect(isPro(mockPlan({ plan: 'estudante' }))).toBe(false);
      expect(isPro(mockPlan({ plan: 'free' }))).toBe(false);
      expect(isPro(null)).toBe(false);
      expect(isPro(undefined)).toBe(false);
    });
  });

  describe('isPaid', () => {
    it('true para pro e estudante', () => {
      expect(isPaid(mockPlan({ plan: 'pro' }))).toBe(true);
      expect(isPaid(mockPlan({ plan: 'estudante' }))).toBe(true);
      expect(isPaid(mockPlan({ plan: 'free' }))).toBe(false);
      expect(isPaid(null)).toBe(false);
    });
  });

  describe('planLabel', () => {
    it('mostra emoji e nome', () => {
      expect(planLabel('pro')).toBe('✨ Pro');
      expect(planLabel('estudante')).toBe('🎓 Estudante');
      expect(planLabel('free')).toBe('Grátis');
    });
  });

  describe('isActiveSubscription', () => {
    it('só pro com status ativo', () => {
      expect(
        isActiveSubscription(
          mockPlan({ plan: 'pro', subscription_status: 'active' })
        )
      ).toBe(true);
      expect(
        isActiveSubscription(
          mockPlan({ plan: 'pro', subscription_status: 'trialing' })
        )
      ).toBe(true);
      // past_due ainda permite (grace period Stripe)
      expect(
        isActiveSubscription(
          mockPlan({ plan: 'pro', subscription_status: 'past_due' })
        )
      ).toBe(true);
    });

    it('canceled/unpaid não conta como ativo', () => {
      expect(
        isActiveSubscription(
          mockPlan({ plan: 'pro', subscription_status: 'canceled' })
        )
      ).toBe(false);
      expect(
        isActiveSubscription(
          mockPlan({ plan: 'pro', subscription_status: 'unpaid' })
        )
      ).toBe(false);
      expect(
        isActiveSubscription(
          mockPlan({ plan: 'pro', subscription_status: 'incomplete' })
        )
      ).toBe(false);
    });

    it('estudante não conta como pro ativo', () => {
      expect(
        isActiveSubscription(
          mockPlan({ plan: 'estudante', subscription_status: 'active' })
        )
      ).toBe(false);
    });

    it('null/undefined retorna false', () => {
      expect(isActiveSubscription(null)).toBe(false);
      expect(isActiveSubscription(undefined)).toBe(false);
    });

    it('master é SEMPRE ativo (sem subscription Stripe)', () => {
      expect(
        isActiveSubscription(
          mockPlan({ plan: 'master', subscription_status: null })
        )
      ).toBe(true);
    });
  });

  describe('master tier', () => {
    it('isMaster detecta só master', () => {
      expect(isMaster(mockPlan({ plan: 'master' }))).toBe(true);
      expect(isMaster(mockPlan({ plan: 'pro' }))).toBe(false);
      expect(isMaster(null)).toBe(false);
    });

    it('isProOrMaster cobre ambos', () => {
      expect(isProOrMaster(mockPlan({ plan: 'master' }))).toBe(true);
      expect(isProOrMaster(mockPlan({ plan: 'pro' }))).toBe(true);
      expect(isProOrMaster(mockPlan({ plan: 'estudante' }))).toBe(false);
      expect(isProOrMaster(mockPlan({ plan: 'free' }))).toBe(false);
    });

    it('isPaid inclui master', () => {
      expect(isPaid(mockPlan({ plan: 'master' }))).toBe(true);
    });

    it('PLAN_LIMITS.master é ilimitado', () => {
      expect(PLAN_LIMITS.master.questions).toBe(Infinity);
      expect(PLAN_LIMITS.master.concursos).toBe(Infinity);
    });

    it('planLabel master tem coroa', () => {
      expect(planLabel('master')).toBe('👑 Master');
    });
  });

  describe('shouldBlockNewCheckout', () => {
    it('null/undefined: permite (sem profile)', () => {
      expect(shouldBlockNewCheckout(null)).toEqual({
        blocked: false,
        reason: null,
      });
      expect(shouldBlockNewCheckout(undefined)).toEqual({
        blocked: false,
        reason: null,
      });
    });

    it('master: bloqueia com reason=master', () => {
      expect(shouldBlockNewCheckout({ plan: 'master' })).toEqual({
        blocked: true,
        reason: 'master',
      });
    });

    it('subscription active: bloqueia com reason=already_subscribed', () => {
      expect(
        shouldBlockNewCheckout({
          plan: 'pro',
          subscription_status: 'active',
          stripe_subscription_id: 'sub_xxx',
        })
      ).toEqual({ blocked: true, reason: 'already_subscribed' });
    });

    it('todos os status que contam como ativos bloqueiam', () => {
      const blocking = ['active', 'trialing', 'past_due', 'unpaid', 'paused'];
      for (const status of blocking) {
        expect(
          shouldBlockNewCheckout({
            plan: 'pro',
            subscription_status: status,
            stripe_subscription_id: 'sub_xxx',
          }).blocked
        ).toBe(true);
      }
    });

    it('canceled: NÃO bloqueia (user pode reassinar)', () => {
      expect(
        shouldBlockNewCheckout({
          plan: 'free',
          subscription_status: 'canceled',
          stripe_subscription_id: 'sub_xxx',
        })
      ).toEqual({ blocked: false, reason: null });
    });

    it('incomplete: NÃO bloqueia (checkout falhou — pode tentar de novo)', () => {
      expect(
        shouldBlockNewCheckout({
          plan: 'free',
          subscription_status: 'incomplete',
          stripe_subscription_id: 'sub_xxx',
        })
      ).toEqual({ blocked: false, reason: null });
      expect(
        shouldBlockNewCheckout({
          plan: 'free',
          subscription_status: 'incomplete_expired',
          stripe_subscription_id: 'sub_xxx',
        })
      ).toEqual({ blocked: false, reason: null });
    });

    it('subscription_status active mas SEM subscription_id: permite (estado inválido)', () => {
      // Se webhook nunca rolou, status não deveria estar ativo, mas se
      // de alguma forma estiver, sem subscription_id Stripe, deixa o
      // user comprar — é o comportamento mais útil.
      expect(
        shouldBlockNewCheckout({
          plan: 'free',
          subscription_status: 'active',
          stripe_subscription_id: null,
        })
      ).toEqual({ blocked: false, reason: null });
    });

    it('free user comum: permite', () => {
      expect(
        shouldBlockNewCheckout({
          plan: 'free',
          subscription_status: null,
          stripe_subscription_id: null,
        })
      ).toEqual({ blocked: false, reason: null });
    });
  });

  describe('canShareDecks (Fase C — sharing)', () => {
    it('pro pode', () => {
      expect(canShareDecks(mockPlan({ plan: 'pro' }))).toBe(true);
    });
    it('master pode', () => {
      expect(canShareDecks(mockPlan({ plan: 'master' }))).toBe(true);
    });
    it('estudante NÃO pode (upsell)', () => {
      expect(canShareDecks(mockPlan({ plan: 'estudante' }))).toBe(false);
    });
    it('free NÃO pode', () => {
      expect(canShareDecks(mockPlan({ plan: 'free' }))).toBe(false);
    });
    it('null/undefined: false', () => {
      expect(canShareDecks(null)).toBe(false);
      expect(canShareDecks(undefined)).toBe(false);
    });
  });

  describe('canManageSubscription', () => {
    it('master NÃO pode gerenciar via Stripe portal', () => {
      // Master não tem assinatura Stripe — gerencia manualmente.
      expect(
        canManageSubscription(
          mockPlan({ plan: 'master', subscription_status: null })
        )
      ).toBe(false);
    });

    it('pro com customer Stripe pode', () => {
      expect(
        canManageSubscription(
          mockPlan({ plan: 'pro', subscription_status: 'active' })
        )
      ).toBe(true);
    });

    it('pro sem subscription_status (sem customer Stripe ainda) NÃO pode', () => {
      // Caso: webhook ainda não rolou. UI pode mostrar Pro mas portal
      // falha — bloqueia pra evitar a mensagem contraditória.
      expect(
        canManageSubscription(
          mockPlan({ plan: 'pro', subscription_status: null })
        )
      ).toBe(false);
    });

    it('estudante e free não podem', () => {
      expect(canManageSubscription(mockPlan({ plan: 'estudante' }))).toBe(false);
      expect(canManageSubscription(mockPlan({ plan: 'free' }))).toBe(false);
      expect(canManageSubscription(null)).toBe(false);
    });
  });
});
