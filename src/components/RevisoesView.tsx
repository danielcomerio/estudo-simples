'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { startOfDay } from '@/lib/utils';

const DAY_MS = 86_400_000;

/**
 * Calendário 30/60/90 dias mostrando quantas questões SRS vencem por
 * dia. Útil pra planejar carga de revisão antes de prova ou ajustar
 * meta diária.
 *
 * Cor: gradiente verde (poucas) → vermelho (muitas) baseado em
 * percentil 90 do range visualizado.
 */
type RangeOpt = 30 | 60 | 90;

export function RevisoesView() {
  const all = useStore(selectActiveQuestions);
  const [range, setRange] = useState<RangeOpt>(30);

  const days = useMemo(() => {
    const today0 = startOfDay(Date.now());
    const out: { date: number; count: number; overdue?: boolean }[] = [];
    for (let i = 0; i < range; i++) {
      out.push({ date: today0 + i * DAY_MS, count: 0 });
    }
    for (const q of all) {
      if (q.type !== 'objetiva' && q.type !== 'discursiva' && q.type !== 'cloze' && q.type !== 'flashcard') continue;
      const due = q.srs?.dueDate ?? 0;
      if (due === 0) continue;
      const dueDay = startOfDay(due);
      // Vencidas (passadas) cabem no dia 0 (hoje)
      if (dueDay < today0) {
        out[0].count++;
        out[0].overdue = true;
        continue;
      }
      const idx = Math.floor((dueDay - today0) / DAY_MS);
      if (idx >= 0 && idx < out.length) out[idx].count++;
    }
    return out;
  }, [all, range]);

  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((a, d) => a + d.count, 0);

  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 4px' }}>📅 Calendário de revisões</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Quantas questões SRS vencem por dia (próximos {range} dias). Total
          previsto: <strong>{total}</strong>.
        </p>
      </div>

      <div className="card">
        <div className="row gap" style={{ alignItems: 'center', marginBottom: 12 }}>
          {([30, 60, 90] as RangeOpt[]).map((r) => (
            <button
              key={r}
              type="button"
              className={r === range ? 'primary' : 'ghost'}
              onClick={() => setRange(r)}
              style={{ padding: '4px 10px', fontSize: '0.85rem' }}
            >
              {r} dias
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <Link
            href="/estudar?modo=srs&qtd=10&auto=1"
            style={{ fontSize: '0.85rem' }}
          >
            ▶ Estudar agora
          </Link>
        </div>

        {/* Grid 7 colunas (semana) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
            marginBottom: 14,
          }}
        >
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <div
              key={i}
              className="muted"
              style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 600 }}
            >
              {d}
            </div>
          ))}
          {/* Padding pré-domingo do primeiro dia */}
          {(() => {
            const firstDow = new Date(days[0].date).getDay();
            return Array.from({ length: firstDow }).map((_, i) => (
              <div key={`pad-${i}`} />
            ));
          })()}
          {days.map((d) => {
            const ratio = d.count / max;
            const cor =
              d.count === 0
                ? 'var(--bg-elev-2)'
                : ratio < 0.3
                  ? 'rgba(34,197,94,0.6)'
                  : ratio < 0.7
                    ? 'rgba(217,119,6,0.6)'
                    : 'rgba(220,38,38,0.7)';
            const dateObj = new Date(d.date);
            const isToday = startOfDay(Date.now()) === d.date;
            return (
              <div
                key={d.date}
                title={`${dateObj.toLocaleDateString('pt-BR')}: ${d.count} questão(ões)${d.overdue ? ' (inclui vencidas)' : ''}`}
                style={{
                  aspectRatio: '1 / 1',
                  background: cor,
                  borderRadius: 4,
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  color: ratio > 0.4 ? '#fff' : 'var(--text)',
                  border: isToday ? '2px solid var(--primary)' : '1px solid var(--border)',
                  fontWeight: isToday ? 700 : 400,
                }}
              >
                <div>{dateObj.getDate()}</div>
                {d.count > 0 && (
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {d.count}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="muted" style={{ fontSize: '0.78rem' }}>
          Cor: verde (carga leve) → amarelo → vermelho (carga alta).
          Borda azul = hoje. Vencidas aparecem agregadas no primeiro dia.
        </div>
      </div>
    </>
  );
}
