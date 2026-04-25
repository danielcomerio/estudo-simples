'use client';

import { selectActiveQuestions, useStore } from '@/lib/store';
import { fmtPercent } from '@/lib/format';
import { DAY_MS } from '@/lib/srs';

export function StatsView() {
  const questions = useStore(selectActiveQuestions);

  const byDisc: Record<
    string,
    { total: number; attempts: number; correct: number; due: number }
  > = {};
  const now = Date.now();
  for (const q of questions) {
    const d = q.disciplina_id || '—';
    if (!byDisc[d]) byDisc[d] = { total: 0, attempts: 0, correct: 0, due: 0 };
    byDisc[d].total += 1;
    byDisc[d].attempts += q.stats?.attempts || 0;
    byDisc[d].correct += q.stats?.correct || 0;
    if ((q.srs?.dueDate ?? 0) < now) byDisc[d].due += 1;
  }

  const rows = Object.entries(byDisc).sort();

  // Schedule buckets
  const buckets: Record<string, number> = {
    Atrasadas: 0,
    Hoje: 0,
    Amanhã: 0,
    '2-7 dias': 0,
    '8-30 dias': 0,
    '+30 dias': 0,
  };
  for (const q of questions) {
    const d = q.srs?.dueDate ?? 0;
    const diffDays = Math.round((d - now) / DAY_MS);
    if (diffDays < 0) buckets['Atrasadas']++;
    else if (diffDays === 0) buckets['Hoje']++;
    else if (diffDays === 1) buckets['Amanhã']++;
    else if (diffDays <= 7) buckets['2-7 dias']++;
    else if (diffDays <= 30) buckets['8-30 dias']++;
    else buckets['+30 dias']++;
  }

  return (
    <>
      <div className="card">
        <h2>Desempenho por disciplina</h2>
        {rows.length === 0 ? (
          <p className="muted">Sem dados ainda. Importe questões e estude.</p>
        ) : (
          <div className="stats-table">
            <div className="head">Disciplina</div>
            <div className="head">Total</div>
            <div className="head col-hide-sm">Tentativas</div>
            <div className="head col-hide-sm">% Acerto</div>
            <div className="head">Vencendo</div>
            {rows.map(([d, s]) => (
              <Row key={d} d={d} s={s} />
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Distribuição de revisões agendadas</h2>
        <div className="schedule">
          {Object.entries(buckets).map(([k, v]) => (
            <div key={k} className="bucket">
              <div className="when">{k}</div>
              <div className="count">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Row({
  d,
  s,
}: {
  d: string;
  s: { total: number; attempts: number; correct: number; due: number };
}) {
  return (
    <>
      <div className="row-cell">{d}</div>
      <div className="row-cell">{s.total}</div>
      <div className="row-cell col-hide-sm">{s.attempts}</div>
      <div className="row-cell col-hide-sm">{fmtPercent(s.correct, s.attempts)}</div>
      <div className="row-cell">{s.due}</div>
    </>
  );
}
