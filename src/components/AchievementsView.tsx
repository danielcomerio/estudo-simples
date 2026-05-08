'use client';

import { useMemo } from 'react';
import { selectActiveQuestions, useStore, selectDisciplinas } from '@/lib/store';
import { rankAllDisciplinas } from '@/lib/disciplina-mastery';
import { readSessions } from '@/lib/sessions-log';
import { computeDailyStreak } from '@/lib/daily-streak';

type AchievementDef = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** function que recebe stats e retorna progress 0-1 */
  progress: (s: AggStats) => number;
  goal: string;
};

type AggStats = {
  totalQuestoes: number;
  totalRespondidas: number;
  totalAcertos: number;
  totalTentativas: number;
  pctMedio: number;
  dominadasOuro: number;
  dominadasDiamante: number;
  sessoesEstudo: number;
  sessoesSimulado: number;
  currentStreak: number;
  bestStreak: number;
};

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-100',
    emoji: '💯',
    title: 'Primeira centena',
    description: '100 tentativas no banco',
    progress: (s) => Math.min(1, s.totalTentativas / 100),
    goal: '100 tentativas',
  },
  {
    id: 'thousand',
    emoji: '🎯',
    title: 'Milhão (de tentativas)',
    description: '1.000 tentativas',
    progress: (s) => Math.min(1, s.totalTentativas / 1000),
    goal: '1.000 tentativas',
  },
  {
    id: 'fivek',
    emoji: '🏆',
    title: 'Maratonista',
    description: '5.000 tentativas',
    progress: (s) => Math.min(1, s.totalTentativas / 5000),
    goal: '5.000 tentativas',
  },
  {
    id: 'streak-7',
    emoji: '🔥',
    title: 'Semana inteira',
    description: '7 dias seguidos estudando',
    progress: (s) => Math.min(1, s.bestStreak / 7),
    goal: '7d streak',
  },
  {
    id: 'streak-30',
    emoji: '🔥🔥',
    title: 'Mês completo',
    description: '30 dias seguidos',
    progress: (s) => Math.min(1, s.bestStreak / 30),
    goal: '30d streak',
  },
  {
    id: 'streak-100',
    emoji: '⚡',
    title: 'Centenário',
    description: '100 dias seguidos',
    progress: (s) => Math.min(1, s.bestStreak / 100),
    goal: '100d streak',
  },
  {
    id: 'sim-10',
    emoji: '🧪',
    title: 'Simulador',
    description: '10 simulados completos',
    progress: (s) => Math.min(1, s.sessoesSimulado / 10),
    goal: '10 simulados',
  },
  {
    id: 'gold-1',
    emoji: '🥇',
    title: 'Especialista',
    description: 'Disciplina com badge ouro (≥80)',
    progress: (s) => (s.dominadasOuro >= 1 ? 1 : 0),
    goal: '1 dom ouro',
  },
  {
    id: 'gold-3',
    emoji: '🥇🥇🥇',
    title: 'Tri especialista',
    description: '3 disciplinas em ouro',
    progress: (s) => Math.min(1, s.dominadasOuro / 3),
    goal: '3 dom ouro',
  },
  {
    id: 'diamond-1',
    emoji: '💎',
    title: 'Diamante',
    description: 'Disciplina dominada (≥95)',
    progress: (s) => (s.dominadasDiamante >= 1 ? 1 : 0),
    goal: '1 dom diamante',
  },
  {
    id: 'pct-80',
    emoji: '📈',
    title: 'Acima da média',
    description: '80% de acerto médio (≥100 tentativas)',
    progress: (s) =>
      s.totalTentativas >= 100 ? Math.min(1, s.pctMedio / 80) : 0,
    goal: '80% acerto · 100+ tents',
  },
  {
    id: 'sessions-100',
    emoji: '🎓',
    title: 'Cem sessões',
    description: '100 sessões /estudar concluídas',
    progress: (s) => Math.min(1, s.sessoesEstudo / 100),
    goal: '100 sessões',
  },
];

export function AchievementsView() {
  const all = useStore(selectActiveQuestions);
  const disc = useStore(selectDisciplinas);

  const stats = useMemo<AggStats>(() => {
    const totalQuestoes = all.length;
    const totalRespondidas = all.filter((q) => (q.stats?.attempts ?? 0) > 0).length;
    const totalAcertos = all.reduce((a, q) => a + (q.stats?.correct ?? 0), 0);
    const totalTentativas = all.reduce((a, q) => a + (q.stats?.attempts ?? 0), 0);
    const pctMedio = totalTentativas > 0 ? Math.round((totalAcertos / totalTentativas) * 100) : 0;
    const masteries = rankAllDisciplinas(disc, all);
    const dominadasOuro = masteries.filter((m) => m.score >= 80).length;
    const dominadasDiamante = masteries.filter((m) => m.score >= 95).length;
    const sessoes = readSessions();
    const sessoesEstudo = sessoes.filter((s) => s.kind === 'estudar').length;
    const sessoesSimulado = sessoes.filter((s) => s.kind === 'simulado').length;
    const dates = new Set<string>();
    for (const q of all) {
      for (const h of q.stats?.history ?? []) {
        dates.add(new Date(h.date).toISOString().slice(0, 10));
      }
    }
    const { currentStreak, bestStreak } = computeDailyStreak(Array.from(dates));
    return {
      totalQuestoes,
      totalRespondidas,
      totalAcertos,
      totalTentativas,
      pctMedio,
      dominadasOuro,
      dominadasDiamante,
      sessoesEstudo,
      sessoesSimulado,
      currentStreak,
      bestStreak,
    };
  }, [all, disc]);

  const computed = ACHIEVEMENTS.map((a) => ({
    ...a,
    pct: a.progress(stats),
    completed: a.progress(stats) >= 1,
  }));
  const completed = computed.filter((a) => a.completed);
  const inProgress = computed.filter((a) => !a.completed);

  return (
    <>
      <div className="card">
        <h1 style={{ margin: '0 0 4px' }}>🏆 Conquistas</h1>
        <p className="muted" style={{ margin: 0 }}>
          {completed.length} de {ACHIEVEMENTS.length} desbloqueadas.
        </p>
      </div>

      {completed.length > 0 && (
        <div className="card">
          <h2 style={{ margin: '0 0 8px', fontSize: '1rem' }}>✅ Desbloqueadas</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {completed.map((a) => (
              <AchRow key={a.id} a={a} />
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: '1rem' }}>🎯 Em progresso</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {inProgress.map((a) => (
            <AchRow key={a.id} a={a} />
          ))}
        </ul>
      </div>
    </>
  );
}

function AchRow({ a }: { a: AchievementDef & { pct: number; completed: boolean } }) {
  return (
    <li
      style={{
        padding: '10px 12px',
        marginBottom: 8,
        background: a.completed ? 'var(--primary-soft)' : 'var(--bg-elev-2)',
        borderRadius: 'var(--radius)',
        opacity: a.completed ? 1 : 0.85,
      }}
    >
      <div className="row gap" style={{ alignItems: 'center' }}>
        <span style={{ fontSize: '1.4rem' }}>{a.emoji}</span>
        <div style={{ flex: 1 }}>
          <strong>{a.title}</strong>
          <div className="muted" style={{ fontSize: '0.82rem' }}>
            {a.description}
          </div>
        </div>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {Math.round(a.pct * 100)}%
        </span>
      </div>
      {!a.completed && (
        <div
          style={{
            marginTop: 6,
            height: 4,
            background: 'var(--bg)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${a.pct * 100}%`,
              height: '100%',
              background: 'var(--primary)',
            }}
          />
        </div>
      )}
    </li>
  );
}
