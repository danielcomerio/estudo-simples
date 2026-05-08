'use client';

import { useMemo } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';

/**
 * Card pequeno que mostra tempo total acumulado em estudo (soma timeMs
 * de toda história). Motivacional.
 *
 * Aparece só quando user passou de 1h estudando — antes disso, ruído.
 */
export function TempoTotalCard() {
  const all = useStore(selectActiveQuestions);

  const totalMs = useMemo(() => {
    let acc = 0;
    for (const q of all) {
      for (const h of q.stats?.history ?? []) {
        if (typeof h.timeMs === 'number' && h.timeMs > 0 && h.timeMs < 5 * 60_000) {
          // Cap em 5min por questão pra evitar outliers (idle aberto)
          acc += h.timeMs;
        }
      }
    }
    return acc;
  }, [all]);

  if (totalMs < 3_600_000) return null; // < 1h

  const horas = totalMs / 3_600_000;
  const formatado =
    horas >= 100
      ? `${Math.round(horas)}h`
      : horas >= 10
        ? `${horas.toFixed(1)}h`
        : `${horas.toFixed(2)}h`;

  return (
    <div
      className="card"
      style={{
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ fontSize: '1.6rem' }} aria-hidden>⏱</span>
      <div style={{ flex: 1 }}>
        <strong>{formatado} estudados no total</strong>
        <div className="muted" style={{ fontSize: '0.82rem' }}>
          Soma do tempo de cada questão respondida (cap de 5min/questão pra
          ignorar abas esquecidas).
        </div>
      </div>
    </div>
  );
}
