'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from './Toast';
import { track } from '@/lib/analytics';

/**
 * Cards de planos + botão Checkout. Faz POST em /api/stripe/checkout
 * que retorna URL e redireciona pra Stripe.
 *
 * Cliente NUNCA passa price_id — só interval (monthly|yearly). Backend
 * traduz pro Stripe price ID via env vars. Defesa contra tampering.
 */
export function PlanosCheckout() {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);

  const checkout = async () => {
    setLoading(true);
    track('checkout.started', { interval });
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      });
      if (res.status === 401) {
        // Não logado → manda pra signup com redirect de volta
        window.location.href = '/signup?next=/planos';
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        toast(
          json?.error === 'price_not_configured'
            ? 'Planos não configurados (admin precisa setar STRIPE_PRICE_PRO_*).'
            : 'Erro iniciando checkout. Tente de novo.',
          'error'
        );
        setLoading(false);
        return;
      }
      window.location.href = json.url as string;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro de rede', 'error');
      setLoading(false);
    }
  };

  // Preços exibidos. Reais cobrados são definidos no Stripe (env mapeia).
  const monthly = 'R$ 19,90';
  const yearly = 'R$ 179,00';
  const yearlySavings = 'economiza 25%';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 18,
      }}
    >
      {/* Plano Grátis */}
      <div
        className="card"
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 4,
            }}
          >
            Grátis
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
            R$ 0
          </div>
          <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
            pra sempre · sem cartão
          </div>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            color: 'var(--muted)',
            fontSize: '0.9rem',
            lineHeight: 1.7,
            flex: 1,
          }}
        >
          <li>Até 500 questões pessoais</li>
          <li>1 concurso ativo</li>
          <li>SRS (SM-2 + FSRS)</li>
          <li>Active recall, simulado, cards</li>
          <li>Stats básicas</li>
          <li>Backup local + restore</li>
        </ul>
        <Link href="/signup">
          <button type="button" style={{ width: '100%', padding: '12px' }}>
            Criar conta grátis
          </button>
        </Link>
      </div>

      {/* Plano Pro */}
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
        <div>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 4,
            }}
          >
            Pro
          </div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--primary)',
            }}
          >
            {interval === 'monthly' ? monthly : yearly}
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 400,
                marginLeft: 6,
                color: 'var(--muted)',
              }}
            >
              /{interval === 'monthly' ? 'mês' : 'ano'}
            </span>
          </div>
          <div className="row gap" style={{ marginTop: 8, fontSize: '0.85rem' }}>
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={interval === 'monthly' ? 'primary' : 'ghost'}
              style={{ padding: '4px 10px', fontSize: '0.82rem' }}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={interval === 'yearly' ? 'primary' : 'ghost'}
              style={{ padding: '4px 10px', fontSize: '0.82rem' }}
            >
              Anual
            </button>
            {interval === 'yearly' && (
              <span style={{ color: '#22c55e', fontWeight: 500, fontSize: '0.82rem' }}>
                {yearlySavings}
              </span>
            )}
          </div>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: '0.92rem',
            lineHeight: 1.7,
            flex: 1,
          }}
        >
          <li>
            <strong>Tudo do plano grátis</strong>
          </li>
          <li>Questões e concursos ilimitados</li>
          <li>Imagens em questões</li>
          <li>Mnemônicos / dicas de memorização</li>
          <li>Predição de nota por concurso</li>
          <li>Calibração metacognitiva</li>
          <li>Export CSV (questões + histórico)</li>
          <li>Suporte prioritário</li>
        </ul>
        <button
          type="button"
          className="primary"
          onClick={checkout}
          disabled={loading}
          style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
        >
          {loading ? 'Carregando…' : 'Começar trial de 14 dias'}
        </button>
        <p
          className="muted"
          style={{
            margin: '4px 0 0',
            fontSize: '0.78rem',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          14 dias grátis · sem cobrança até o fim do trial · cancela quando quiser
        </p>
      </div>
    </div>
  );
}
