'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { Question } from '@/lib/types';
import { startOfDay } from '@/lib/utils';
import { DAY_MS } from '@/lib/srs';

/**
 * Daily quests: 3 mini-objetivos rotativos por dia que dão sensação
 * de progresso e direção. Auto-detectados pelo histórico do dia
 * — sem state, sem persistência: pure derivation a partir das
 * questions.
 *
 * Quests escolhidos por hash do dia pra rotatear sem repetir muito.
 * Click no quest pendente leva pra rota relevante.
 */

type Quest = {
  id: string;
  emoji: string;
  label: string;
  done: number;
  target: number;
  href: string;
};

function buildQuests(questions: Question[], dailyGoal: number): Quest[] {
  const today = startOfDay(Date.now());
  const tomorrow = today + DAY_MS;

  // Estatísticas do dia
  let totalToday = 0;
  let correctToday = 0;
  const discsHoje = new Set<string>();
  let inimigasHojeAcertadas = 0;
  let novasHoje = 0;
  let respondendoSeguido = 0;
  for (const q of questions) {
    const h = q.stats?.history ?? [];
    const todayEntries = h.filter((e) => e.date >= today && e.date < tomorrow);
    if (todayEntries.length === 0) continue;
    totalToday += todayEntries.length;
    for (const e of todayEntries) {
      if (e.result === 'correct' || e.result === 'self_pass') correctToday++;
    }
    if (q.disciplina_id) discsHoje.add(q.disciplina_id);

    // Foi inimiga (era ≥3 attempts/<30%) e acertou?
    const a = q.stats?.attempts ?? 0;
    const c = q.stats?.correct ?? 0;
    if (a >= 3 && c / a < 0.3 && todayEntries.some((e) => e.result === 'correct')) {
      inimigasHojeAcertadas++;
    }
    // Nova respondida hoje (1ª revisão)
    if (h.length === todayEntries.length && todayEntries.length > 0) {
      novasHoje++;
    }
  }

  // Quests sempre relevantes (sem rotação, são os fundamentais)
  const all: Quest[] = [
    {
      id: 'meta',
      emoji: '🎯',
      label: 'Bater meta diária',
      done: totalToday,
      target: dailyGoal,
      href: '/estudar?modo=srs&qtd=10&auto=1',
    },
    {
      id: 'discs',
      emoji: '📚',
      label: 'Estudar 3 disciplinas diferentes',
      done: discsHoje.size,
      target: 3,
      href: '/estudar',
    },
    {
      id: 'inimigas',
      emoji: '⚔',
      label: 'Acertar 3 inimigas',
      done: inimigasHojeAcertadas,
      target: 3,
      href: '/estudar?modo=inimigas&qtd=10&auto=1',
    },
    {
      id: 'novas',
      emoji: '✨',
      label: 'Aprender 5 questões novas',
      done: novasHoje,
      target: 5,
      href: '/estudar?modo=novas&qtd=5&auto=1',
    },
    {
      id: 'acerto',
      emoji: '🏆',
      label: 'Acertar 80% do que responder hoje',
      done: totalToday >= 5 ? Math.round((100 * correctToday) / totalToday) : 0,
      target: 80,
      href: '/estudar',
    },
  ];

  // Mostra os 3 mais "interessantes" (não completados, mas progredindo)
  // Prioriza: meta diária + 2 outros baseados em hash do dia
  const dayHash = Math.floor(today / DAY_MS) % 4; // rotação de 4 dias
  const fixed = all[0]; // meta sempre presente
  const others = all.slice(1);
  const rotated = [...others.slice(dayHash), ...others.slice(0, dayHash)];
  return [fixed, ...rotated.slice(0, 2)];
}

export function DailyQuests({
  questions,
  dailyGoal,
}: {
  questions: Question[];
  dailyGoal: number;
}) {
  const quests = useMemo(
    () => buildQuests(questions, dailyGoal),
    [questions, dailyGoal]
  );
  // Esconde se nada começou ainda E meta não está clara
  if (quests.every((q) => q.done === 0)) return null;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>🎯 Missões de hoje</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {quests.map((q) => {
          const pct = Math.min(100, Math.round((100 * q.done) / q.target));
          const done = q.done >= q.target;
          return (
            <Link
              key={q.id}
              href={q.href}
              style={{
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                style={{
                  background: done
                    ? 'rgba(34, 197, 94, 0.08)'
                    : 'var(--bg-elev-2)',
                  border: `1px solid ${done ? '#22c55e' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="row between"
                  style={{ alignItems: 'center', marginBottom: 4 }}
                >
                  <div style={{ fontSize: '0.92rem' }}>
                    {done ? '✅' : q.emoji} {q.label}
                  </div>
                  <span
                    className="muted"
                    style={{ fontSize: '0.82rem' }}
                  >
                    {q.done}/{q.target}
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: 'var(--bg-elev)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: done ? '#22c55e' : 'var(--primary)',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
