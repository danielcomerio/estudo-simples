'use client';

import Link from 'next/link';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { useMyPlan } from '@/lib/use-plan';
import { PLAN_LIMITS } from '@/lib/billing';

/**
 * Banner exibido no /banco quando user está perto/no limite do plano.
 * Visual hint — DB enforça limite de qualquer forma.
 */
export function PlanLimitBanner() {
  const questions = useStore(selectActiveQuestions);
  const { plan } = useMyPlan();

  // Pro: ilimitado, nada a mostrar
  if (plan?.plan === 'pro') return null;
  // User não autenticado / guest (sem profile via RLS): esconde
  if (!plan) return null;

  const planKey = (plan.plan ?? 'free') as 'free' | 'estudante';
  const limit = PLAN_LIMITS[planKey].questions;
  if (!Number.isFinite(limit)) return null;

  const used = questions.length;
  const remaining = Math.max(0, limit - used);
  const pct = Math.min(100, Math.round((100 * used) / limit));

  // Só mostra quando passou de 70% pra não poluir.
  if (pct < 70) return null;

  const isFull = used >= limit;
  return (
    <div
      className="card"
      style={{
        background: isFull
          ? 'var(--danger-soft, rgba(239,68,68,0.08))'
          : 'var(--warn-bg, rgba(217,119,6,0.08))',
        border: `1px solid ${isFull ? 'var(--danger, #ef4444)' : 'var(--warn, #d97706)'}`,
        marginBottom: 14,
        padding: 12,
      }}
    >
      <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ fontSize: '0.95rem' }}>
            {isFull
              ? `🚫 Limite de ${limit} questões atingido`
              : `⚠️ ${used}/${limit} questões usadas (${pct}%)`}
          </strong>
          <div className="muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>
            {isFull
              ? 'Pra adicionar mais, faça upgrade.'
              : `Restam ${remaining} questões no plano ${planKey === 'free' ? 'grátis' : 'Estudante'}.`}
          </div>
          <div
            style={{
              height: 6,
              background: 'var(--bg-elev)',
              borderRadius: 999,
              overflow: 'hidden',
              marginTop: 8,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: isFull
                  ? 'var(--danger, #ef4444)'
                  : 'var(--warn, #d97706)',
              }}
            />
          </div>
        </div>
        <Link href="/planos">
          <button type="button" className="primary">
            Ver Pro →
          </button>
        </Link>
      </div>
    </div>
  );
}
