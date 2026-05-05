'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MyPlan } from './billing';

/**
 * Hook reativo que lê o plano do user (via view `my_plan`). Recarrega
 * em focus pra refletir mudanças após Stripe webhook (ex: user assinou
 * em outra aba, volta nessa, deve ver Pro).
 *
 * Cliente NUNCA pode atualizar plano. Esse hook é leitura pura. UI
 * baseada nele é hint de UX — DB tem trigger que enforça limites.
 */
export function useMyPlan() {
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const sb = createClient();
    const load = async () => {
      const { data } = await sb
        .from('my_plan')
        .select(
          'plan, subscription_status, current_period_end, cancel_at_period_end'
        )
        .maybeSingle();
      if (cancelled) return;
      setPlan(
        (data as MyPlan | null) ?? {
          plan: 'free',
          subscription_status: null,
          current_period_end: null,
          cancel_at_period_end: false,
        }
      );
      setLoading(false);
    };
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return { plan, loading, isPro: plan?.plan === 'pro' };
}
