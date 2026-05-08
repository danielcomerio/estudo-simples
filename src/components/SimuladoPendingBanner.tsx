'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getSimuladoEmAndamento } from '@/lib/simulado-store';

const DAY_MS = 86_400_000;

/**
 * Banner no Painel quando há simulado iniciado há mais de 24h sem
 * conclusão. Oferece continuar ou descartar.
 */
export function SimuladoPendingBanner() {
  const userId = useStore((s) => s.userId);
  const [pending, setPending] = useState<{ startedAt: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const sim = getSimuladoEmAndamento(userId);
    if (!sim) return;
    const startedMs =
      typeof sim === 'object' && 'startedAt' in sim
        ? (sim as { startedAt: number }).startedAt
        : 0;
    if (!startedMs) return;
    if (Date.now() - startedMs < DAY_MS) return; // <24h, sem aviso ainda
    setPending({ startedAt: startedMs });
  }, [userId]);

  if (!pending) return null;
  const hours = Math.floor((Date.now() - pending.startedAt) / 3_600_000);

  return (
    <div
      className="card"
      style={{
        background: 'var(--warn-bg, rgba(217, 119, 6, 0.08))',
        border: '1px solid var(--warn, #d97706)',
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '1.6rem' }} aria-hidden>🧪</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Simulado em andamento há {hours}h</strong>
        <div className="muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>
          Continue de onde parou ou descarte.
        </div>
      </div>
      <Link href="/simulado">
        <button type="button" className="primary" style={{ padding: '6px 12px' }}>
          Continuar
        </button>
      </Link>
    </div>
  );
}
