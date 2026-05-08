'use client';

import { useEffect, useRef } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { triggerAchievement } from './AchievementToast';
import { triggerConfetti } from './ConfettiHost';
import { startOfDay } from '@/lib/utils';
import { DAY_MS } from '@/lib/srs';

/**
 * Detecta unlocks de tiers de conquistas e dispara AchievementToast
 * em transições. Persiste highest seen em localStorage pra evitar
 * disparar múltiplas vezes.
 *
 * Categorias monitoradas:
 *  - 🔥 Streak (3, 7, 14, 30, 60, 90, 180, 365 dias)
 *  - 🏆 Dominadas (10, 25, 50, 100, 250, 500, 1000)
 *  - 🎯 Total revisões (50, 100, 250, 500, 1k, 2.5k, 5k, 10k)
 *
 * Roda no Dashboard porque ele já calcula esses números.
 */

const STREAK_TIERS = [3, 7, 14, 30, 60, 90, 180, 365];
const DOM_TIERS = [10, 25, 50, 100, 250, 500, 1000];
const TOTAL_TIERS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
const BANCA_TIERS = [3, 5, 10, 20]; // disciplinas dominadas dessa banca

// Bancas mais cobradas — só essas viram achievements
const TRACKED_BANCAS = ['FGV', 'Cebraspe', 'CESPE', 'FCC', 'VUNESP', 'IBFC', 'Quadrix'];

const STORAGE_KEY = 'estudo-simples:achievements-seen-v2';

type Seen = {
  streak: number;
  dom: number;
  total: number;
  banca: Record<string, number>; // bancaName → highest tier seen
};

function loadSeen(): Seen {
  const empty: Seen = { streak: 0, dom: 0, total: 0, banca: {} };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<Seen>;
    return {
      streak: parsed.streak ?? 0,
      dom: parsed.dom ?? 0,
      total: parsed.total ?? 0,
      banca: parsed.banca ?? {},
    };
  } catch {
    return empty;
  }
}

function saveSeen(s: Seen): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function AchievementDetector() {
  const hydrated = useStore((s) => s.hydrated);
  const questions = useStore(selectActiveQuestions);
  const seenRef = useRef<Seen>({ streak: 0, dom: 0, total: 0, banca: {} });
  const initRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!initRef.current) {
      seenRef.current = loadSeen();
      initRef.current = true;
    }

    // Calcula stats atuais
    let totalAttempts = 0;
    let dominadas = 0;
    const dayCounts = new Map<number, number>();
    // Disciplinas dominadas por banca (banca → set de disciplinas)
    const bancaDom = new Map<string, Set<string>>();

    for (const q of questions) {
      totalAttempts += q.stats?.attempts ?? 0;
      const h = q.stats?.history ?? [];
      const isDominated =
        h.length >= 5 &&
        h
          .slice(-5)
          .every((r) => r.result === 'correct' || r.result === 'self_pass');
      if (isDominated) {
        dominadas++;
        const banca = q.banca_estilo?.trim();
        const disc = q.disciplina_id?.trim();
        if (banca && disc && TRACKED_BANCAS.includes(banca)) {
          let set = bancaDom.get(banca);
          if (!set) {
            set = new Set();
            bancaDom.set(banca, set);
          }
          set.add(disc.toLowerCase());
        }
      }
      for (const e of h) {
        const d = startOfDay(e.date);
        dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
      }
    }

    // Streak atual (mesma lógica do ConquistasView)
    const today = startOfDay(Date.now());
    let curDay = today;
    if (!dayCounts.get(today) && dayCounts.get(today - DAY_MS)) {
      curDay = today - DAY_MS;
    }
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      if ((dayCounts.get(curDay) ?? 0) > 0) {
        streak++;
        curDay -= DAY_MS;
      } else {
        break;
      }
    }

    const seen = seenRef.current;
    let changed = false;

    // Detecta unlocks (highest tier ≤ valor atual mas > seen)
    const checkTiers = (
      tiers: number[],
      current: number,
      key: 'streak' | 'dom' | 'total',
      emoji: string,
      label: (n: number) => string
    ) => {
      for (const t of tiers) {
        if (current >= t && seen[key] < t) {
          triggerAchievement(emoji, label(t));
          triggerConfetti();
          seen[key] = t;
          changed = true;
        }
      }
    };

    checkTiers(STREAK_TIERS, streak, 'streak', '🔥', (n) => `Streak ${n} dias`);
    checkTiers(
      DOM_TIERS,
      dominadas,
      'dom',
      '🏆',
      (n) => `${n.toLocaleString('pt-BR')} questões dominadas`
    );
    checkTiers(
      TOTAL_TIERS,
      totalAttempts,
      'total',
      '🎯',
      (n) => `${n.toLocaleString('pt-BR')} revisões`
    );

    // Mestre da banca: disciplinas dominadas com banca_estilo específica
    for (const [banca, set] of bancaDom.entries()) {
      const count = set.size;
      const seenForBanca = seen.banca[banca] ?? 0;
      for (const t of BANCA_TIERS) {
        if (count >= t && seenForBanca < t) {
          triggerAchievement(
            '🥷',
            `Mestre ${banca} — ${t} disciplinas dominadas`
          );
          triggerConfetti();
          seen.banca[banca] = t;
          changed = true;
        }
      }
    }

    if (changed) saveSeen(seen);
  }, [hydrated, questions]);

  return null;
}
