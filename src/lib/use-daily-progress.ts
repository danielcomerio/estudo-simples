'use client';

import { useMemo } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { useDailyGoal } from '@/lib/settings';
import { startOfDay } from '@/lib/utils';

/**
 * Hook reusável que calcula progresso diário em direção à meta.
 *
 * Retorna:
 *  - completed: questões respondidas hoje
 *  - goal: meta diária configurada
 *  - pct: 0-1 (clamped)
 *  - remaining: quantas faltam (>= 0)
 *  - reachedGoal: bool
 *
 * Olha history (todas questões) — exatas tentativas hoje contam.
 */
export function useDailyProgress(): {
  completed: number;
  goal: number;
  pct: number;
  remaining: number;
  reachedGoal: boolean;
} {
  const goal = useDailyGoal();
  const all = useStore(selectActiveQuestions);

  const completed = useMemo(() => {
    const today0 = startOfDay(Date.now());
    let count = 0;
    for (const q of all) {
      for (const h of q.stats?.history ?? []) {
        if (h.date >= today0) count++;
      }
    }
    return count;
  }, [all]);

  const safeGoal = goal > 0 ? goal : 10;
  const pct = Math.min(1, completed / safeGoal);
  return {
    completed,
    goal: safeGoal,
    pct,
    remaining: Math.max(0, safeGoal - completed),
    reachedGoal: completed >= safeGoal,
  };
}
