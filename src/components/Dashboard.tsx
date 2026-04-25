'use client';

import Link from 'next/link';
import { useStore, selectActiveQuestions, selectDisciplinas } from '@/lib/store';
import { fmtPercent } from '@/lib/format';
import { DAY_MS } from '@/lib/srs';
import { startOfDay } from '@/lib/utils';

export function Dashboard() {
  const hydrated = useStore((s) => s.hydrated);
  const questions = useStore(selectActiveQuestions);
  const disciplinas = useStore(selectDisciplinas);

  if (!hydrated) {
    return (
      <>
        <div className="grid-cards">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card stat">
              <div className="skeleton" style={{ height: 14, width: '60%', margin: '0 auto 10px' }} />
              <div className="skeleton" style={{ height: 30, width: '40%', margin: '0 auto' }} />
            </div>
          ))}
        </div>
      </>
    );
  }

  const total = questions.length;
  const tomorrow = startOfDay(Date.now()) + DAY_MS;
  const dueToday = questions.filter((q) => (q.srs?.dueDate ?? 0) < tomorrow).length;
  const totalAttempts = questions.reduce((s, q) => s + (q.stats?.attempts || 0), 0);
  const totalCorrect = questions.reduce((s, q) => s + (q.stats?.correct || 0), 0);

  // Heatmap dos últimos 90 dias
  const today = startOfDay(Date.now());
  const days: { date: number; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    days.push({ date: today - i * DAY_MS, count: 0 });
  }
  for (const q of questions) {
    for (const h of q.stats?.history || []) {
      const d = startOfDay(h.date);
      const idx = days.findIndex((x) => x.date === d);
      if (idx >= 0) days[idx].count += 1;
    }
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (n: number) =>
    n === 0
      ? ''
      : n / max < 0.25
        ? 'l1'
        : n / max < 0.5
          ? 'l2'
          : n / max < 0.75
            ? 'l3'
            : 'l4';

  // Streak (dias consecutivos com >=1 revisão até hoje)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak++;
    else break;
  }

  // Por disciplina, vencendo hoje
  const dueByDisc: Record<string, number> = {};
  for (const q of questions) {
    if ((q.srs?.dueDate ?? 0) < tomorrow) {
      const d = q.disciplina_id || '—';
      dueByDisc[d] = (dueByDisc[d] || 0) + 1;
    }
  }
  const dueChips = Object.entries(dueByDisc).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="grid-cards">
        <div className="card stat">
          <div className="stat-label">Total</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">{disciplinas.length} disciplina{disciplinas.length === 1 ? '' : 's'}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Vencendo hoje</div>
          <div className="stat-value">{dueToday}</div>
          <div className="stat-sub">{total === 0 ? '—' : `${Math.round((100 * dueToday) / total)}% do banco`}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">% Acerto</div>
          <div className="stat-value">{fmtPercent(totalCorrect, totalAttempts)}</div>
          <div className="stat-sub">{totalAttempts} tentativa{totalAttempts === 1 ? '' : 's'}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Streak</div>
          <div className="stat-value">{streak}</div>
          <div className="stat-sub">dia{streak === 1 ? '' : 's'} consecutivo{streak === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="card">
        <h2>Atalhos</h2>
        <div className="row gap wrap">
          <Link href="/estudar"><button className="primary" type="button">Iniciar sessão de estudo</button></Link>
          <Link href="/banco"><button type="button">Importar questões</button></Link>
          <Link href="/discursivas"><button type="button">Praticar discursivas</button></Link>
        </div>
      </div>

      <div className="card">
        <h2>Atividade — últimos 90 dias</h2>
        <div className="heatmap">
          {days.map((d) => (
            <div
              key={d.date}
              className={'day ' + level(d.count)}
              title={new Date(d.date).toLocaleDateString('pt-BR') + ' · ' + d.count + ' revisão(ões)'}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Vencendo hoje, por disciplina</h2>
        <div className="chips">
          {dueChips.length === 0 ? (
            <span className="muted">Nada vencendo. Belo trabalho.</span>
          ) : (
            dueChips.map(([d, n]) => (
              <span key={d} className="chip">
                {d} <strong>· {n}</strong>
              </span>
            ))
          )}
        </div>
      </div>
    </>
  );
}
