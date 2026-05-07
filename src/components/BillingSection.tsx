'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMyPlan } from '@/lib/use-plan';
import {
  canManageSubscription,
  isMaster,
  isPaid,
  planLabel,
} from '@/lib/billing';
import { toast } from './Toast';

/**
 * Seção de assinatura em /configuracoes. Mostra plano atual + atalho
 * pra Customer Portal (Stripe) onde user gerencia (cancelar, atualizar
 * cartão, ver faturas).
 *
 * Casos cobertos:
 *  - free: CTA "Ver planos".
 *  - master: badge especial + nota "gerenciamento manual" (não tem
 *    Stripe customer).
 *  - pro/estudante COM customer Stripe: botão "Gerenciar".
 *  - pro/estudante SEM customer (webhook ainda não rolou): mensagem
 *    "Aguardando confirmação… recarregue em alguns segundos". Antes
 *    aparecia botão que dava 400 e toast contraditório "sem permissão".
 */
export function BillingSection() {
  const { plan, loading } = useMyPlan();
  const [opening, setOpening] = useState(false);
  const paid = isPaid(plan);
  const master = isMaster(plan);
  const canManage = canManageSubscription(plan);
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
        const errCode = (json as { error?: string } | null)?.error;
        const msg =
          errCode === 'no_subscription'
            ? 'Sua assinatura ainda não foi vinculada ao Stripe. Aguarde alguns segundos e recarregue a página — o webhook deve sincronizar logo.'
            : errCode === 'unauthenticated'
              ? 'Sessão expirada. Faça login novamente.'
              : 'Erro abrindo portal. Tente de novo em instantes.';
        toast(msg, 'error', 6000);
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
        <div className="row gap" style={{ alignItems: 'center' }}>
          {master && (
            <span
              className="muted"
              style={{
                fontSize: '0.82rem',
                fontStyle: 'italic',
                maxWidth: 280,
                textAlign: 'right',
              }}
            >
              Conta operacional — gerenciada manualmente, sem assinatura Stripe.
            </span>
          )}
          {!master && canManage && (
            <button
              type="button"
              onClick={openPortal}
              disabled={opening}
              aria-label="Abrir portal de gerenciamento de assinatura"
            >
              {opening ? 'Carregando…' : '⚙ Gerenciar assinatura'}
            </button>
          )}
          {!master && paid && !canManage && (
            <span
              className="muted"
              style={{
                fontSize: '0.82rem',
                maxWidth: 280,
                textAlign: 'right',
              }}
            >
              Aguardando confirmação do pagamento. Recarregue a página em
              instantes.
            </span>
          )}
          {!paid && (
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
