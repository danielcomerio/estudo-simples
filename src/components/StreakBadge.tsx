'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { startOfDay } from '@/lib/utils';
import { DAY_MS } from '@/lib/srs';

/**
 * Pequeno indicador 🔥X no Topbar mostrando streak atual. Visível em
 * qualquer rota — encoraja consistência ("ainda não estudei hoje" sem
 * precisar abrir Dashboard).
 *
 * Calculado on-the-fly do histórico (mesma lógica do Dashboard mas
 * lightweight). Some quando streak = 0 pra não poluir.
 */
export function StreakBadge() {
  const questions = useStore(selectActiveQuestions);
  const streak = useMemo(() => {
    const today = startOfDay(Date.now());
    const dayCounts = new Map<number, number>();
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        const d = startOfDay(h.date);
        dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
      }
    }
    const todayCount = dayCounts.get(today) ?? 0;
    let s = 0;
    let freezeUsed = false;
    let cur = todayCount > 0 ? today : today - DAY_MS;
    for (let i = 0; i < 365; i++) {
      const c = dayCounts.get(cur) ?? 0;
      if (c > 0) {
        s++;
      } else if (!freezeUsed) {
        freezeUsed = true;
        s++;
      } else {
        break;
      }
      cur -= DAY_MS;
    }
    return { streak: s, atRisk: todayCount === 0 && s > 0 };
  }, [questions]);

  if (streak.streak === 0) return null;

  return (
    <Link
      href="/conquistas"
      title={
        streak.atRisk
          ? `Streak ${streak.streak} dia(s) — em risco hoje! Estude pra manter`
          : `Streak atual: ${streak.streak} dia(s)`
      }
      className="streak-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '4px 8px',
        borderRadius: 999,
        background: streak.atRisk
          ? 'var(--warn-bg, rgba(217, 119, 6, 0.12))'
          : 'var(--primary-soft)',
        border: `1px solid ${streak.atRisk ? 'var(--warn, #d97706)' : 'var(--primary)'}`,
        color: streak.atRisk ? 'var(--warn, #d97706)' : 'var(--primary)',
        fontSize: '0.78rem',
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden>{streak.atRisk ? '⚠️' : '🔥'}</span>
      {streak.streak}
    </Link>
  );
}
