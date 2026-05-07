'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useStore, selectActiveQuestions } from '@/lib/store';
import { StreakCalendar } from './StreakCalendar';
import { startOfDay } from '@/lib/utils';
import { DAY_MS } from '@/lib/srs';

type Tier = {
  threshold: number;
  label: string;
  emoji: string;
};

type Category = {
  title: string;
  desc: string;
  current: number;
  unit: string;
  tiers: Tier[];
};

export function ConquistasView() {
  const hydrated = useStore((s) => s.hydrated);
  const questions = useStore(selectActiveQuestions);

  const data = useMemo(() => {
    let totalAttempts = 0;
    let totalCorrect = 0;
    let dominadas = 0;
    let bestDay = 0;
    let validador = 0; // gabarito_source = 'oficial' (validadas)
    const dayCounts = new Map<number, number>();
    for (const q of questions) {
      totalAttempts += q.stats?.attempts ?? 0;
      totalCorrect += q.stats?.correct ?? 0;
      const h = q.stats?.history ?? [];
      if (
        h.length >= 5 &&
        h
          .slice(-5)
          .every((r) => r.result === 'correct' || r.result === 'self_pass')
      ) {
        dominadas++;
      }
      if (q.fonte?.gabarito_source === 'oficial') {
        validador++;
      }
      for (const e of h) {
        const d = startOfDay(e.date);
        dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
      }
    }
    for (const v of dayCounts.values()) {
      if (v > bestDay) bestDay = v;
    }

    // Streak (similar lógica do Dashboard mas mais simples — janela 365d)
    const today = startOfDay(Date.now());
    let streak = 0;
    let curDay = today;
    if (!dayCounts.get(today) && dayCounts.get(today - DAY_MS)) curDay = today - DAY_MS;
    for (let i = 0; i < 365; i++) {
      if ((dayCounts.get(curDay) ?? 0) > 0) {
        streak++;
        curDay -= DAY_MS;
      } else {
        break;
      }
    }
    let bestStreak = 0;
    let cur = 0;
    const sortedDays = Array.from(dayCounts.keys()).sort((a, b) => a - b);
    let prev = 0;
    for (const d of sortedDays) {
      if (prev && d - prev === DAY_MS) {
        cur++;
      } else {
        cur = 1;
      }
      if (cur > bestStreak) bestStreak = cur;
      prev = d;
    }

    const pctAcerto =
      totalAttempts > 0 ? Math.round((100 * totalCorrect) / totalAttempts) : 0;
    const diasEstudados = dayCounts.size;

    return {
      totalAttempts,
      totalCorrect,
      pctAcerto,
      dominadas,
      bestDay,
      streak,
      bestStreak,
      diasEstudados,
      bankSize: questions.length,
      validador,
    };
  }, [questions]);

  const categories: Category[] = [
    {
      title: '🔥 Streak (consecutividade)',
      desc: 'Estudar todo dia compõe. Cada dia consecutivo conta.',
      current: data.bestStreak,
      unit: 'dias',
      tiers: [
        { threshold: 3, label: '3 dias', emoji: '🔥' },
        { threshold: 7, label: '7 dias', emoji: '🔥🔥' },
        { threshold: 14, label: '2 semanas', emoji: '🔥🔥' },
        { threshold: 30, label: '1 mês', emoji: '🔥🔥🔥' },
        { threshold: 60, label: '2 meses', emoji: '🔥🔥🔥' },
        { threshold: 90, label: '3 meses', emoji: '🌟' },
        { threshold: 180, label: '6 meses', emoji: '💎' },
        { threshold: 365, label: '1 ano', emoji: '👑' },
      ],
    },
    {
      title: '🎯 Esforço (revisões totais)',
      desc: 'Total de respostas no histórico. Volume de prática.',
      current: data.totalAttempts,
      unit: 'respondidas',
      tiers: [
        { threshold: 50, label: '50 respondidas', emoji: '🎯' },
        { threshold: 100, label: '100 respondidas', emoji: '🎯' },
        { threshold: 250, label: '250 respondidas', emoji: '🎯🎯' },
        { threshold: 500, label: '500 respondidas', emoji: '🎯🎯' },
        { threshold: 1000, label: '1.000 respondidas', emoji: '🎯🎯🎯' },
        { threshold: 2500, label: '2.500 respondidas', emoji: '🎯🎯🎯' },
        { threshold: 5000, label: '5.000 respondidas', emoji: '🌟' },
        { threshold: 10000, label: '10.000 respondidas', emoji: '👑' },
      ],
    },
    {
      title: '🏆 Dominadas (memorizadas)',
      desc: 'Questões com 5+ acertos consecutivos no fim do histórico.',
      current: data.dominadas,
      unit: 'questões',
      tiers: [
        { threshold: 10, label: '10 dominadas', emoji: '🏆' },
        { threshold: 25, label: '25 dominadas', emoji: '🏆' },
        { threshold: 50, label: '50 dominadas', emoji: '🏆🏆' },
        { threshold: 100, label: '100 dominadas', emoji: '🏆🏆' },
        { threshold: 250, label: '250 dominadas', emoji: '🏆🏆🏆' },
        { threshold: 500, label: '500 dominadas', emoji: '🌟' },
        { threshold: 1000, label: '1.000 dominadas', emoji: '👑' },
      ],
    },
    {
      title: '💎 Qualidade (% acerto)',
      desc: 'Taxa de acerto geral. Mínimo 100 tentativas pra contar.',
      current: data.totalAttempts >= 100 ? data.pctAcerto : 0,
      unit: '% acerto',
      tiers: [
        { threshold: 60, label: '60% acerto', emoji: '🥉' },
        { threshold: 70, label: '70% acerto', emoji: '🥇' },
        { threshold: 80, label: '80% acerto', emoji: '🎖' },
        { threshold: 90, label: '90% acerto', emoji: '💎' },
      ],
    },
    {
      title: '📚 Banco (tamanho)',
      desc: 'Total de questões cadastradas (vivas) no banco.',
      current: data.bankSize,
      unit: 'no banco',
      tiers: [
        { threshold: 50, label: '50 no banco', emoji: '📚' },
        { threshold: 100, label: '100 no banco', emoji: '📚' },
        { threshold: 250, label: '250 no banco', emoji: '📚📚' },
        { threshold: 500, label: '500 no banco', emoji: '📚📚' },
        { threshold: 1000, label: '1.000 no banco', emoji: '📚📚📚' },
        { threshold: 2500, label: '2.500 no banco', emoji: '🌟' },
        { threshold: 5000, label: '5.000 no banco', emoji: '👑' },
      ],
    },
    {
      title: '⚡ Recordes pessoais',
      desc: 'Melhor dia do histórico (mais revisões num único dia).',
      current: data.bestDay,
      unit: 'num dia',
      tiers: [
        { threshold: 10, label: '10 num dia', emoji: '⚡' },
        { threshold: 25, label: '25 num dia', emoji: '⚡⚡' },
        { threshold: 50, label: '50 num dia', emoji: '⚡⚡⚡' },
        { threshold: 100, label: '100 num dia', emoji: '🌟' },
        { threshold: 200, label: '200 num dia', emoji: '👑' },
      ],
    },
    {
      title: '📅 Consistência (dias estudados)',
      desc: 'Total de dias com ao menos 1 revisão.',
      current: data.diasEstudados,
      unit: 'dias',
      tiers: [
        { threshold: 7, label: '7 dias estudados', emoji: '📅' },
        { threshold: 30, label: '30 dias estudados', emoji: '📅📅' },
        { threshold: 90, label: '90 dias estudados', emoji: '📅📅📅' },
        { threshold: 180, label: '180 dias estudados', emoji: '🌟' },
        { threshold: 365, label: '1 ano de dias', emoji: '👑' },
      ],
    },
    {
      title: '✓ Validador (gabaritos oficiais)',
      desc:
        'Questões com gabarito marcado como oficial (validado contra fonte). Mostra cuidado com qualidade do banco.',
      current: data.validador,
      unit: 'oficiais',
      tiers: [
        { threshold: 10, label: '10 oficiais', emoji: '✓' },
        { threshold: 50, label: '50 oficiais', emoji: '✓✓' },
        { threshold: 100, label: '100 oficiais', emoji: '✓✓✓' },
        { threshold: 500, label: '500 oficiais', emoji: '🌟' },
        { threshold: 1000, label: '1.000 oficiais', emoji: '👑' },
      ],
    },
  ];

  if (!hydrated) {
    return (
      <div className="card">
        <p className="muted center">Carregando…</p>
      </div>
    );
  }

  const totalUnlocked = categories.reduce(
    (s, cat) => s + cat.tiers.filter((t) => cat.current >= t.threshold).length,
    0
  );
  const totalTiers = categories.reduce((s, cat) => s + cat.tiers.length, 0);

  return (
    <>
      <div className="card">
        <div
          className="row between"
          style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
        >
          <div>
            <h1 style={{ margin: '0 0 4px' }}>🏆 Conquistas</h1>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {totalUnlocked} de {totalTiers} conquistas desbloqueadas (
              {Math.round((100 * totalUnlocked) / totalTiers)}%)
            </p>
          </div>
          <Link href="/stats" style={{ color: 'var(--primary)' }}>
            ← Voltar pras estatísticas
          </Link>
        </div>
        <div
          aria-hidden
          style={{
            height: 6,
            background: 'var(--bg-elev-2)',
            borderRadius: 999,
            overflow: 'hidden',
            marginTop: 12,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(100 * totalUnlocked) / totalTiers}%`,
              background: 'linear-gradient(90deg, var(--primary), #facc15)',
              transition: 'width 0.5s',
            }}
          />
        </div>
      </div>

      <StreakCalendar questions={questions} />

      {categories.map((cat) => (
        <CategoryCard key={cat.title} category={cat} />
      ))}
    </>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const { current, unit, tiers } = category;
  const next = tiers.find((t) => current < t.threshold);
  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{category.title}</h2>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          atual: <strong style={{ color: 'var(--text)' }}>{current}</strong> {unit}
        </span>
      </div>
      <p className="muted" style={{ margin: '6px 0 14px', fontSize: '0.85rem' }}>
        {category.desc}
        {next && (
          <>
            {' '}· próxima: <strong>{next.label}</strong> (+{next.threshold - current})
          </>
        )}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        {tiers.map((t) => {
          const unlocked = current >= t.threshold;
          return (
            <div
              key={t.threshold}
              style={{
                padding: 12,
                borderRadius: 'var(--radius)',
                border: `1px solid ${unlocked ? 'var(--primary)' : 'var(--border)'}`,
                background: unlocked
                  ? 'var(--primary-soft)'
                  : 'var(--bg-elev-2)',
                opacity: unlocked ? 1 : 0.6,
                textAlign: 'center',
                transition: 'opacity 0.2s',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>
                {unlocked ? t.emoji : '🔒'}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                {t.label}
              </div>
              {!unlocked && (
                <div
                  className="muted"
                  style={{ fontSize: '0.74rem', marginTop: 2 }}
                >
                  faltam {t.threshold - current}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
