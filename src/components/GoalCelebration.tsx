'use client';

import { useEffect, useState } from 'react';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { useDailyGoal } from '@/lib/settings';
import { startOfDay } from '@/lib/utils';
import { toast } from './Toast';
import { triggerConfetti } from './ConfettiHost';

const CELEBRATED_KEY_PREFIX = 'estudo-simples:goal-celebrated:';

/**
 * Mostra animação leve quando o usuário bate a meta diária pela 1ª
 * vez no dia. Marca em localStorage pra não repetir. Reset automático
 * quando a data muda (chave inclui data).
 *
 * Usa CSS-only (sem dep externa) — emojis voando + scale do toast.
 */
export function GoalCelebration() {
  const dailyGoal = useDailyGoal();
  const questions = useStore(selectActiveQuestions);
  const hydrated = useStore((s) => s.hydrated);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const today = startOfDay(Date.now());
    let reviewsToday = 0;
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        if (h.date >= today) reviewsToday++;
      }
    }
    if (reviewsToday < dailyGoal) return;

    const dateKey =
      CELEBRATED_KEY_PREFIX + new Date(today).toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(dateKey) === '1') return;
      localStorage.setItem(dateKey, '1');
    } catch {
      return;
    }
    setShow(true);
    triggerConfetti();
    toast(
      `🎉 Meta diária batida! ${reviewsToday} revisões hoje.`,
      'success',
      6000
    );
    const t = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(t);
  }, [hydrated, questions, dailyGoal]);

  if (!show) return null;
  // Emojis flutuando — pure CSS animation
  const emojis = ['🎉', '🏆', '🔥', '⭐', '✨', '🎊'];
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: 18 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const dur = 2 + Math.random() * 1.5;
        const size = 1.2 + Math.random() * 1.4;
        const e = emojis[i % emojis.length];
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-10vh',
              left: `${left}%`,
              fontSize: `${size}rem`,
              animation: `goalFall ${dur}s ${delay}s ease-in forwards`,
            }}
          >
            {e}
          </span>
        );
      })}
    </div>
  );
}
