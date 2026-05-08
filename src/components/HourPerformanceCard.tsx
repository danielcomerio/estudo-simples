'use client';

import { useMemo } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';

/**
 * Heatmap 24h × performance: agrupa tentativas por hora do dia,
 * mostra qtd e % acerto. Identifica horários de pico do user.
 */
export function HourPerformanceCard() {
  const questions = useStore(selectActiveQuestions);

  const stats = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => ({ total: 0, correct: 0 }));
    for (const q of questions) {
      const hist = q.stats?.history ?? [];
      for (const h of hist) {
        const hr = new Date(h.date).getHours();
        if (hr < 0 || hr > 23) continue;
        buckets[hr].total++;
        if (h.result === 'correct') buckets[hr].correct++;
      }
    }
    return buckets;
  }, [questions]);

  const maxTotal = Math.max(1, ...stats.map((b) => b.total));
  const totalSum = stats.reduce((a, b) => a + b.total, 0);

  if (totalSum < 10) {
    return null; // muito pouco dado
  }

  // Horário de pico (>30 tentativas e maior % acerto)
  const eligible = stats
    .map((b, h) => ({ h, total: b.total, pct: b.total > 0 ? b.correct / b.total : 0 }))
    .filter((x) => x.total >= Math.max(5, totalSum / 50));
  const pico = [...eligible].sort((a, b) => b.pct - a.pct)[0];
  const fraco = [...eligible].sort((a, b) => a.pct - b.pct)[0];

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>
        🕐 Performance por hora
      </h2>
      <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
        Quando você mais estuda e acerta. Total: {totalSum} tentativas.
      </p>

      {/* Bar chart 24h */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(24, 1fr)',
          gap: 2,
          alignItems: 'end',
          height: 80,
          marginBottom: 8,
        }}
      >
        {stats.map((b, h) => {
          const heightPct = b.total > 0 ? (b.total / maxTotal) * 100 : 4;
          const acerto = b.total > 0 ? b.correct / b.total : 0;
          const cor =
            b.total === 0
              ? 'var(--bg-elev-2)'
              : acerto >= 0.7
                ? 'var(--primary)'
                : acerto >= 0.5
                  ? 'var(--warn, #d97706)'
                  : 'var(--danger)';
          return (
            <div
              key={h}
              title={`${h.toString().padStart(2, '0')}h: ${b.total} tentativas, ${b.total > 0 ? Math.round(acerto * 100) : 0}% acerto`}
              style={{
                height: `${heightPct}%`,
                background: cor,
                borderRadius: 2,
                minHeight: 3,
              }}
            />
          );
        })}
      </div>

      {/* Eixo de horas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(24, 1fr)',
          gap: 2,
          fontSize: '0.7rem',
          color: 'var(--muted)',
          marginBottom: 12,
        }}
      >
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} style={{ textAlign: 'center' }}>
            {h % 6 === 0 ? `${h}h` : ''}
          </span>
        ))}
      </div>

      {pico && pico !== fraco && (
        <div className="muted" style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
          🌟 <strong>Horário de pico:</strong> {pico.h.toString().padStart(2, '0')}h
          ({Math.round(pico.pct * 100)}% acerto, {pico.total} tentativas)
          <br />
          🥱 <strong>Mais fraco:</strong> {fraco.h.toString().padStart(2, '0')}h
          ({Math.round(fraco.pct * 100)}% acerto, {fraco.total} tentativas)
        </div>
      )}
    </div>
  );
}
