'use client';

import { useMemo } from 'react';
import { startOfDay } from '@/lib/utils';
import { DAY_MS } from '@/lib/srs';
import type { Question } from '@/lib/types';

/**
 * Mini-calendar do mês atual mostrando dias com revisões. Verde =
 * estudou. Cinza = não. Hoje é destacado com borda. Útil pra ver de
 * relance a consistência do mês.
 */
export function StreakCalendar({ questions }: { questions: Question[] }) {
  const data = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Conta revisões por dia do mês
    const counts = new Map<number, number>();
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        const d = new Date(h.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          counts.set(day, (counts.get(day) ?? 0) + 1);
        }
      }
    }
    const max = Math.max(1, ...Array.from(counts.values()));
    // Domingo = 0 .. Sábado = 6 (igual JS)
    const startWeekday = firstOfMonth.getDay();
    const todayDate = today.getDate();
    return {
      year,
      month,
      daysInMonth,
      counts,
      max,
      startWeekday,
      todayDate,
      monthName: firstOfMonth.toLocaleDateString('pt-BR', { month: 'long' }),
    };
  }, [questions]);

  const dotwLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const cells: (number | null)[] = [];
  // Padding pra primeira semana
  for (let i = 0; i < data.startWeekday; i++) cells.push(null);
  for (let d = 1; d <= data.daysInMonth; d++) cells.push(d);

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', textTransform: 'capitalize' }}>
        📅 {data.monthName} {data.year}
      </h2>
      <p
        className="muted"
        style={{ margin: '0 0 14px', fontSize: '0.85rem' }}
      >
        Cada quadrado é um dia. Verde = estudou, mais escuro = mais
        revisões. Hoje destacado em borda.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          maxWidth: 320,
          margin: '0 auto',
        }}
        role="grid"
      >
        {dotwLabels.map((d, i) => (
          <div
            key={`hdr-${i}`}
            aria-hidden
            style={{
              fontSize: '0.74rem',
              color: 'var(--muted)',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} />;
          const count = data.counts.get(d) ?? 0;
          const isToday = d === data.todayDate;
          const intensity = count === 0 ? 0 : Math.min(1, count / data.max);
          // Cor: cinza se 0, verde escalado se > 0
          const bg =
            count === 0
              ? 'var(--bg-elev-2)'
              : `rgba(34, 197, 94, ${0.25 + intensity * 0.6})`;
          return (
            <div
              key={`d-${d}`}
              role="gridcell"
              title={
                count === 0
                  ? `Dia ${d}: sem revisão`
                  : `Dia ${d}: ${count} revisão(ões)`
              }
              aria-label={`Dia ${d}, ${count} revisões`}
              style={{
                aspectRatio: '1',
                background: bg,
                borderRadius: 6,
                border: isToday ? '2px solid var(--primary)' : '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: isToday ? 700 : 500,
                color:
                  count === 0
                    ? 'var(--muted)'
                    : count >= data.max * 0.75
                      ? '#fff'
                      : 'var(--text)',
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}
