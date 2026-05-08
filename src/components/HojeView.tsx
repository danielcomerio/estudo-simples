'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { isOverdue } from '@/lib/srs';
import { DailyBriefingCard } from './DailyBriefingCard';
import { StreakFreezesCard } from './StreakFreezesCard';

const DAY_MS = 86_400_000;

/**
 * /hoje — visão consolidada do que importa AGORA. Mais focada que o
 * Dashboard. Bom como landing pra users com banco populado.
 */
export function HojeView() {
  const questions = useStore(selectActiveQuestions);

  const stats = useMemo(() => {
    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const eod = todayEnd.getTime();
    const tomorrowEnd = eod + DAY_MS;

    let vencidas = 0;
    let amanha = 0;
    let novas = 0;
    let inimigas = 0;
    for (const q of questions) {
      if (isOverdue(q.srs, now)) vencidas++;
      const due = q.srs?.dueDate ?? 0;
      if (due > now && due < tomorrowEnd) amanha++;
      if ((q.srs?.repetitions ?? 0) === 0) novas++;
      const t = q.stats?.attempts ?? 0;
      const c = q.stats?.correct ?? 0;
      if (t >= 3 && c / t < 0.4) inimigas++;
    }
    return { vencidas, amanha, novas, inimigas };
  }, [questions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card">
        <h1 style={{ margin: '0 0 4px' }}>Hoje</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
          Visão concentrada do que importa agora. Outros indicadores ficam
          em <Link href="/">Painel</Link>.
        </p>
      </div>

      <DailyBriefingCard />

      <StreakFreezesCard currentStreak={0} />

      <div className="grid-cards">
        <ActionCard
          icon="🔥"
          n={stats.vencidas}
          label="vencidas"
          href={`/estudar?modo=srs&qtd=${Math.min(20, stats.vencidas || 1)}&auto=1`}
          description="Estudar agora"
          highlight
        />
        <ActionCard
          icon="📅"
          n={stats.amanha}
          label="vencendo até amanhã"
          href="/banco?srs=hoje"
          description="Ver no banco"
        />
        <ActionCard
          icon="🆕"
          n={stats.novas}
          label="novas"
          href={`/estudar?modo=novas&qtd=${Math.min(10, stats.novas || 1)}&auto=1`}
          description="Aprender 10"
        />
        <ActionCard
          icon="👹"
          n={stats.inimigas}
          label="inimigas"
          href={`/estudar?modo=inimigas&qtd=${Math.min(10, stats.inimigas || 1)}&auto=1`}
          description="Vencer 10"
        />
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Próximos passos</h2>
        <div className="row gap wrap">
          <Link href="/simulado" className="ghost" style={btn}>
            🧪 Simular prova
          </Link>
          <Link href="/discursivas" className="ghost" style={btn}>
            ✍ Discursivas
          </Link>
          <Link href="/diario" className="ghost" style={btn}>
            🎯 Questões do dia
          </Link>
          <Link href="/stats" className="ghost" style={btn}>
            📈 Stats detalhadas
          </Link>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  n,
  label,
  href,
  description,
  highlight,
}: {
  icon: string;
  n: number;
  label: string;
  href: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="card stat"
      style={{
        textDecoration: 'none',
        color: 'inherit',
        background: highlight && n > 0 ? 'var(--primary-soft)' : undefined,
        border: highlight && n > 0 ? '1px solid var(--primary)' : undefined,
      }}
    >
      <div style={{ fontSize: '1.6rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 600 }}>{n}</div>
      <div className="muted" style={{ fontSize: '0.85rem' }}>{label}</div>
      <div style={{ fontSize: '0.82rem', marginTop: 4, color: 'var(--primary)' }}>
        {description} →
      </div>
    </Link>
  );
}

const btn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
};
