import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  isPro,
  isPaid,
  isActiveSubscription,
  planLabel,
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
  });
});
