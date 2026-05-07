'use client';

import { useMemo, useState } from 'react';
import { computeForecast } from '@/lib/forecast';
import type { Question } from '@/lib/types';

const DEFAULT_TARGETS = [500, 1000, 2500, 5000, 10000];
const STORAGE_KEY = 'estudo-simples:forecast-target';

export function ForecastCard({ questions }: { questions: Question[] }) {
  const [target, setTarget] = useState<number>(() => {
    if (typeof window === 'undefined') return 1000;
    const stored = parseInt(window.localStorage.getItem(STORAGE_KEY) ?? '', 10);
    return !isNaN(stored) && stored > 0 ? stored : 1000;
  });

  const { totalAttempts, reviewDates } = useMemo(() => {
    let totalAttempts = 0;
    const reviewDates: number[] = [];
    for (const q of questions) {
      totalAttempts += q.stats?.attempts ?? 0;
      for (const h of q.stats?.history ?? []) reviewDates.push(h.date);
    }
    return { totalAttempts, reviewDates };
  }, [questions]);

  const forecast = useMemo(
    () =>
      computeForecast({
        reviewDates,
        currentCount: totalAttempts,
        targetCount: target,
        windowDays: 14,
      }),
    [reviewDates, totalAttempts, target]
  );

  function handleTargetChange(t: number) {
    setTarget(t);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(t));
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>🎯 Forecast — quando atinjo a meta?</h2>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.88rem' }}>
        Projeção linear baseada na sua média de revisões/dia (últimos 14
        dias).
      </p>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        {DEFAULT_TARGETS.map((t) => (
          <button
            key={t}
            onClick={() => handleTargetChange(t)}
            className={target === t ? '' : 'ghost'}
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
          >
            {t.toLocaleString('pt-BR')}
          </button>
        ))}
        <input
          type="number"
          min={1}
          step={100}
          value={target}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v > 0) handleTargetChange(v);
          }}
          style={{ width: 100, padding: '4px 8px', fontSize: '0.85rem' }}
          title="Meta customizada"
        />
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 'var(--radius)',
          background: 'var(--bg-elev-2)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{ fontSize: '0.95rem', marginBottom: 6, lineHeight: 1.5 }}
        >
          {forecast.summary}
        </div>
        {forecast.daysToTarget !== null && forecast.daysToTarget > 0 && (
          <div
            className="muted"
            style={{ fontSize: '0.82rem', marginTop: 8 }}
          >
            <span style={{ marginRight: 12 }}>
              Atual: <strong>{totalAttempts.toLocaleString('pt-BR')}</strong>
            </span>
            <span style={{ marginRight: 12 }}>
              Meta: <strong>{target.toLocaleString('pt-BR')}</strong>
            </span>
            <span>
              Ritmo: <strong>{forecast.avgPerDay.toFixed(1)}/dia</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
