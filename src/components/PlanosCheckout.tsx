'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from './Toast';
import { track } from '@/lib/analytics';
import { useMyPlan } from '@/lib/use-plan';
import {
  isActiveSubscription,
  isMaster,
  type Plan,
} from '@/lib/billing';

/**
 * Cards de planos (3 tiers) + botão Checkout. Cliente nunca passa
 * price_id — só `tier` + `interval`. Backend mapeia.
 *
 * Estados especiais:
 *  - master: card do Pro mostra "Conta Master ativa" (sem CTA).
 *  - assinante ativo do mesmo tier: botão vira "Plano atual ✓" disabled.
 *  - assinante ativo de outro tier: botão vira "Trocar pra X" e abre
 *    Stripe portal (proration automática) em vez de novo checkout.
 *  - canceled/free: checkout normal.
 */
export function PlanosCheckout() {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<null | 'estudante' | 'pro' | 'portal'>(null);
  const { plan } = useMyPlan();

  const currentPlan: Plan | null = plan?.plan ?? null;
  const isActive = isActiveSubscription(plan);
  const master = isMaster(plan);

  const openPortal = async () => {
    setLoading('portal');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        toast(
          'Erro abrindo portal de assinatura. Tente em instantes.',
          'error'
        );
        setLoading(null);
        return;
      }
      window.location.href = json.url as string;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro de rede', 'error');
      setLoading(null);
    }
  };

  const checkout = async (tier: 'estudante' | 'pro') => {
    // GUARD client-side: já assina algo ativo? Joga pro portal pra
    // upgrade/downgrade (proration automática). Backend também rejeita
    // — defesa em camadas.
    if (isActive && currentPlan && currentPlan !== tier) {
      openPortal();
      return;
    }
    setLoading(tier);
    track('checkout.started', { interval, tier });
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval, tier }),
      });
      if (res.status === 401) {
        window.location.href = '/signup?next=/planos';
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        const errCode = (json as { error?: string; message?: string } | null)?.error;
        const errMsg = (json as { message?: string } | null)?.message;
        let msg = 'Erro iniciando checkout. Tente de novo.';
        if (errCode === 'master_no_checkout') {
          msg = errMsg ?? 'Conta Master não usa Stripe.';
        } else if (errCode === 'already_subscribed') {
          // Server rejeitou duplo checkout — abre portal.
          openPortal();
          return;
        } else if (errCode === 'price_not_configured') {
          msg = 'Plano não configurado (admin precisa setar STRIPE_PRICE_*).';
        }
        toast(msg, 'error', 6000);
        setLoading(null);
        return;
      }
      window.location.href = json.url as string;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro de rede', 'error');
      setLoading(null);
    }
  };

  // Helper: rótulo do botão de cada tier conforme estado atual
  const buttonState = (
    tier: 'estudante' | 'pro'
  ): { label: string; disabled: boolean; onClick?: () => void; primary?: boolean } => {
    if (master) {
      return {
        label: '👑 Conta Master ativa',
        disabled: true,
      };
    }
    if (isActive && currentPlan === tier) {
      return {
        label: '✓ Plano atual',
        disabled: true,
      };
    }
    if (isActive && currentPlan && currentPlan !== tier) {
      const acao =
        (currentPlan === 'estudante' && tier === 'pro') ||
        currentPlan === 'free'
          ? 'Trocar pra'
          : 'Mudar pra';
      return {
        label: loading === 'portal' ? 'Abrindo portal…' : `${acao} ${tier === 'pro' ? 'Pro' : 'Estudante'}`,
        disabled: loading !== null,
        onClick: openPortal,
        primary: tier === 'pro',
      };
    }
    return {
      label: loading === tier ? 'Carregando…' : 'Começar trial 14 dias',
      disabled: loading !== null,
      onClick: () => checkout(tier),
      primary: tier === 'pro',
    };
  };

  // Toggle mensal / anual exibido em cima dos cards
  return (
    <>
      <div
        className="row gap"
        style={{
          justifyContent: 'center',
          marginBottom: 22,
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => setInterval('monthly')}
          className={interval === 'monthly' ? 'primary' : 'ghost'}
          style={{ padding: '8px 18px', fontSize: '0.92rem' }}
        >
          Mensal
        </button>
        <button
          type="button"
          onClick={() => setInterval('yearly')}
          className={interval === 'yearly' ? 'primary' : 'ghost'}
          style={{ padding: '8px 18px', fontSize: '0.92rem' }}
        >
          Anual{' '}
          <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>· 25% off</span>
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 18,
        }}
      >
        {/* Grátis */}
        <div
          className="card"
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <Header label="Grátis" sub="pra sempre · sem cartão" priceMain="R$ 0" />
          <ul style={featureUl}>
            <Feat>200 questões pessoais</Feat>
            <Feat>1 concurso ativo</Feat>
            <Feat>SRS (SM-2 + FSRS)</Feat>
            <Feat>Active recall, simulado, cards</Feat>
            <Feat>Stats básicas</Feat>
            <Feat>Backup local + restore</Feat>
          </ul>
          {/* Pra usuários logados, "Criar conta grátis" não faz sentido.
              Cada estado tem um botão coerente:
              - free logado: "Plano atual ✓" disabled
              - estudante/pro logado: "Manter no Grátis" → portal pra
                cancelar (Stripe gerencia downgrade)
              - master: "Conta operacional" disabled
              - anon (não-logado): "Criar conta grátis" original */}
          {(() => {
            if (master) {
              return (
                <button
                  type="button"
                  disabled
                  style={{ width: '100%', padding: '12px' }}
                >
                  👑 Conta Master
                </button>
              );
            }
            if (currentPlan === 'free') {
              return (
                <button
                  type="button"
                  disabled
                  style={{ width: '100%', padding: '12px' }}
                >
                  ✓ Plano atual
                </button>
              );
            }
            if (isActive && (currentPlan === 'estudante' || currentPlan === 'pro')) {
              return (
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={loading !== null}
                  style={{ width: '100%', padding: '12px' }}
                  title="Cancelar assinatura paga via portal Stripe"
                >
                  {loading === 'portal' ? 'Abrindo…' : 'Cancelar pra Grátis'}
                </button>
              );
            }
            // Anon (sem plan carregado) — flow normal de signup
            return (
              <Link href="/signup">
                <button type="button" style={{ width: '100%', padding: '12px' }}>
                  Criar conta grátis
                </button>
              </Link>
            );
          })()}
        </div>

        {/* Estudante */}
        <div
          className="card"
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <Header
            label="🎓 Estudante"
            sub={interval === 'monthly' ? '/mês · cancela quando quiser' : '/ano · cancela quando quiser'}
            priceMain={interval === 'monthly' ? 'R$ 9,90' : 'R$ 89,00'}
          />
          <ul style={featureUl}>
            <Feat strong>Tudo do Grátis</Feat>
            <Feat>2.000 questões pessoais</Feat>
            <Feat>3 concursos ativos</Feat>
            <Feat>Predição de nota por concurso</Feat>
            <Feat>Calibração metacognitiva</Feat>
            <Feat>Export CSV</Feat>
          </ul>
          {(() => {
            const s = buttonState('estudante');
            return (
              <button
                type="button"
                onClick={s.onClick}
                disabled={s.disabled}
                style={{ width: '100%', padding: '13px', fontSize: '0.95rem' }}
              >
                {s.label}
              </button>
            );
          })()}
        </div>

        {/* Pro */}
        <div
          className="card"
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            border: '2px solid var(--primary)',
            background: 'var(--primary-soft)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -12,
              left: 18,
              background: 'var(--primary)',
              color: 'white',
              padding: '2px 10px',
              borderRadius: 999,
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            RECOMENDADO
          </div>
          <Header
            label="✨ Pro"
            sub={interval === 'monthly' ? '/mês · cancela quando quiser' : '/ano · cancela quando quiser'}
            priceMain={interval === 'monthly' ? 'R$ 19,90' : 'R$ 179,00'}
            accent
          />
          <ul style={featureUl}>
            <Feat strong>Tudo do Estudante</Feat>
            <Feat>Questões e concursos ilimitados</Feat>
            <Feat>Imagens em questões</Feat>
            <Feat>Mnemônicos / dicas</Feat>
            <Feat>Suporte prioritário</Feat>
            <Feat>Acesso antecipado a novidades</Feat>
          </ul>
          {(() => {
            const s = buttonState('pro');
            return (
              <button
                type="button"
                className={s.primary ? 'primary' : ''}
                onClick={s.onClick}
                disabled={s.disabled}
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
              >
                {s.label}
              </button>
            );
          })()}
          {!isActive && !master && (
            <p
              className="muted"
              style={{
                margin: '4px 0 0',
                fontSize: '0.78rem',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              14 dias grátis · sem cobrança até o fim do trial
            </p>
          )}
        </div>
      </div>
    </>
  );
}

const featureUl: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: '0.92rem',
  lineHeight: 1.7,
  flex: 1,
  color: 'var(--text)',
};

function Header({
  label,
  sub,
  priceMain,
  accent,
}: {
  label: string;
  sub: string;
  priceMain: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: '0.78rem',
          color: accent ? 'var(--primary)' : 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          lineHeight: 1,
          color: accent ? 'var(--primary)' : undefined,
        }}
      >
        {priceMain}
      </div>
      <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
        {sub}
      </div>
    </div>
  );
}

function Feat({
  children,
  strong,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return <li style={{ fontWeight: strong ? 600 : undefined }}>{children}</li>;
}
