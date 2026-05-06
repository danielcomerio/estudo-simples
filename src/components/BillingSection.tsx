'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMyPlan } from '@/lib/use-plan';
import { isPaid, planLabel } from '@/lib/billing';
import { toast } from './Toast';

/**
 * Seção de assinatura em /configuracoes. Mostra plano atual + atalho
 * pra Customer Portal (Stripe) onde user gerencia (cancelar, atualizar
 * cartão, ver faturas).
 */
export function BillingSection() {
  const { plan, loading } = useMyPlan();
  const [opening, setOpening] = useState(false);
  const paid = isPaid(plan);
  const planName = plan ? planLabel(plan.plan) : 'Grátis';

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ height: 22, width: 140, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: 220 }} />
      </div>
    );
  }

  const openPortal = async () => {
    setOpening(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        toast(
          json?.error === 'no_subscription'
            ? 'Você ainda não tem assinatura Pro pra gerenciar.'
            : 'Erro abrindo portal. Tente de novo.',
          'error'
        );
        setOpening(false);
        return;
      }
      window.location.href = json.url as string;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro de rede', 'error');
      setOpening(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 10px' }}>Assinatura</h2>
      <div
        className="row between"
        style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
      >
        <div>
          <div style={{ fontSize: '0.92rem' }}>
            Plano atual:{' '}
            <strong style={{ color: paid ? 'var(--primary)' : undefined }}>
              {plan?.subscription_status === 'trialing'
                ? `🎁 ${planName} (trial)`
                : planName}
            </strong>
          </div>
          {plan?.subscription_status && (
            <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
              {plan.subscription_status === 'trialing' && plan.current_period_end ? (
                <>
                  Trial até{' '}
                  <strong>
                    {new Date(plan.current_period_end).toLocaleDateString('pt-BR')}
                  </strong>
                  {' · '}
                  primeira cobrança a partir dessa data
                </>
              ) : (
                <>
                  Status: {plan.subscription_status}
                  {plan.cancel_at_period_end && ' · cancela ao fim do ciclo'}
                  {plan.current_period_end &&
                    ` · próximo ciclo: ${new Date(plan.current_period_end).toLocaleDateString('pt-BR')}`}
                </>
              )}
            </div>
          )}
        </div>
        <div className="row gap">
          {paid ? (
            <button type="button" onClick={openPortal} disabled={opening}>
              {opening ? 'Carregando…' : '⚙ Gerenciar assinatura'}
            </button>
          ) : (
            <Link href="/planos">
              <button type="button" className="primary">
                Ver planos →
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
