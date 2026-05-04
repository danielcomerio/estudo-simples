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
  const syncStatus = useStore((s) => s.syncStatus);
  const lastPullAt = useStore((s) => s.lastPullAt);

  // Mostra skeleton enquanto carrega o store local OU enquanto a
  // primeira sincronização com o servidor ainda não terminou — sem
  // isso, o painel pisca "0 questões" antes do pull inicial completar.
  const firstSyncInFlight = syncStatus === 'syncing' && !lastPullAt;
  if (!hydrated || firstSyncInFlight) {
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
        <div className="card">
          <p className="muted center">Carregando suas questões…</p>
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

  // Counts pra quick actions
  const erradasRecentes = questions.filter((q) => {
    const h = q.stats?.history || [];
    return h.slice(-5).some((r) => r.result === 'wrong' || r.result === 'timeout');
  }).length;
  const pendentes = questions.filter(
    (q) => q.type === 'objetiva' && q.verificacao === 'pendente'
  ).length;
  const novasNuncaEstudadas = questions.filter(
    (q) => !q.srs?.lastReviewed && q.type === 'objetiva'
  ).length;

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

      {(() => {
        // Sessão recomendada: dueToday + erradasRecentes(até 5) + algumas
        // novas se ainda houver espaço. Tempo estimado: 90s/questão.
        const recVencendo = Math.min(15, dueToday);
        const recErradas = Math.min(5, erradasRecentes);
        const recNovas = Math.min(5, novasNuncaEstudadas);
        const totalRec = recVencendo + recErradas + recNovas;
        if (totalRec === 0) return null;
        const minEstim = Math.ceil((totalRec * 90) / 60);
        // Compõe sessão: prioriza vencidas (modo srs com qtd =
        // recVencendo+recErradas+recNovas; embaralha)
        const totalQtd = totalRec;
        return (
          <div
            className="card"
            style={{
              background: 'var(--primary-soft)',
              border: '1px solid var(--primary)',
            }}
          >
            <h2 style={{ margin: '0 0 6px' }}>🎯 Hoje, recomendado</h2>
            <p style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>
              <strong>{totalRec}</strong> questão(ões){' '}
              <span className="muted">(~{minEstim} min)</span>
              {recVencendo > 0 && ` · ${recVencendo} vencendo`}
              {recErradas > 0 && ` · ${recErradas} erradas recentes`}
              {recNovas > 0 && ` · ${recNovas} novas`}
            </p>
            <Link href={`/estudar?modo=srs&qtd=${totalQtd}&auto=1`}>
              <button type="button" className="primary">
                Começar agora ({totalRec})
              </button>
            </Link>
          </div>
        );
      })()}

      <div className="card">
        <h2>Comece agora</h2>
        <div className="row gap wrap">
          {dueToday > 0 && (
            <Link
              href={`/estudar?modo=srs&qtd=${Math.min(20, dueToday)}&auto=1`}
            >
              <button className="primary" type="button">
                🎯 Estudar {Math.min(20, dueToday)} vencendo
              </button>
            </Link>
          )}
          {erradasRecentes > 0 && (
            <Link
              href={`/estudar?modo=erros&qtd=${Math.min(20, erradasRecentes)}&auto=1`}
            >
              <button type="button">
                🔁 Revisar {Math.min(20, erradasRecentes)} erradas recentes
              </button>
            </Link>
          )}
          {novasNuncaEstudadas > 0 && (
            <Link
              href={`/estudar?modo=novas&qtd=${Math.min(10, novasNuncaEstudadas)}&auto=1`}
            >
              <button type="button">
                ✨ Estudar {Math.min(10, novasNuncaEstudadas)} novas
              </button>
            </Link>
          )}
          {pendentes > 0 && (
            <Link href="/revisar">
              <button type="button">⏳ Revisar {pendentes} pendentes</button>
            </Link>
          )}
        </div>

        <div
          className="row gap wrap"
          style={{ marginTop: 12, fontSize: '0.88rem' }}
        >
          <span className="muted">Outras:</span>
          <Link href="/estudar">
            <button type="button" className="ghost">
              Configurar sessão
            </button>
          </Link>
          <Link href="/discursivas">
            <button type="button" className="ghost">
              Discursivas
            </button>
          </Link>
          <Link href="/cards">
            <button type="button" className="ghost">
              Cards (Cloze + Flashcard)
            </button>
          </Link>
          <Link href="/simulado">
            <button type="button" className="ghost">
              Simulado
            </button>
          </Link>
          <Link href="/banco">
            <button type="button" className="ghost">
              Importar
            </button>
          </Link>
        </div>
      </div>

      <div className="card">
        <h2>Atividade — últimos 90 dias</h2>
        <Heatmap days={days} level={level} today={today} />
      </div>

      <PrevisaoSection questions={questions} today={today} />


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

/**
 * Heatmap de PREVISÃO: próximos 30 dias com quantas questões vencem
 * em cada dia. Útil pra ver carga futura ("antes da prova vou ter
 * picos de N revisões/dia").
 *
 * Atrasadas (dueDate < hoje) viram primeira coluna especial (vermelha).
 * Cada coluna = 1 dia. Altura proporcional ao count, normalizada pelo
 * pico do mês.
 */
function PrevisaoSection({
  questions,
  today,
}: {
  questions: { srs?: { dueDate?: number } }[];
  today: number;
}) {
  const buckets = new Array(31).fill(0); // 0=atrasadas, 1..30=próximos dias
  for (const q of questions) {
    const due = q.srs?.dueDate ?? 0;
    if (!due) continue;
    if (due < today) {
      buckets[0] += 1;
      continue;
    }
    const diff = Math.floor((due - today) / DAY_MS);
    if (diff <= 30) buckets[diff] += 1;
  }
  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((s, n) => s + n, 0);
  if (total === 0) return null;

  return (
    <div className="card">
      <h2>Previsão — próximos 30 dias</h2>
      <p className="muted" style={{ marginTop: -4, fontSize: '0.88rem' }}>
        Quantas questões vão vencer em cada dia. Útil pra antecipar dias
        de carga alta (e atrasadas que precisam recuperar).
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: 80,
          gap: 2,
          marginTop: 10,
        }}
      >
        {buckets.map((n, i) => {
          const isAtrasadas = i === 0;
          const isHoje = i === 1;
          const heightPct = (n / max) * 100;
          const cor = isAtrasadas
            ? 'var(--danger)'
            : isHoje
              ? 'var(--warn, #d97706)'
              : 'var(--primary)';
          const dia =
            i === 0
              ? 'Atrasadas'
              : i === 1
                ? 'Hoje'
                : `+${i - 1}d`;
          return (
            <div
              key={i}
              title={`${dia}: ${n} questão(ões)`}
              style={{
                flex: 1,
                height: `${Math.max(2, heightPct)}%`,
                background: cor,
                borderRadius: '2px 2px 0 0',
                position: 'relative',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>
      <div
        className="muted"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: '0.78rem',
        }}
      >
        <span>🔴 atrasadas: {buckets[0]}</span>
        <span>📅 hoje: {buckets[1]}</span>
        <span>+30d</span>
      </div>
    </div>
  );
}

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // dom, seg, ter, qua, qui, sex, sab
const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/**
 * Heatmap GitHub-style: 7 linhas (dom-sáb), N colunas (semanas).
 * Inclui labels de dias da semana, marcas de mês e legenda de
 * intensidade. Hoje é destacado com borda.
 *
 * Days vem ordenado do mais antigo pro mais recente. Padding inicial
 * com null pra alinhar o primeiro dia ao seu dia-da-semana correto.
 */
function Heatmap({
  days,
  level,
  today,
}: {
  days: { date: number; count: number }[];
  level: (n: number) => string;
  today: number;
}) {
  // Calcula padding inicial: se primeiro dia é uma quarta (3),
  // precisamos de 3 cells null antes dele pra começar na coluna certa.
  const firstDay = days[0] ? new Date(days[0].date).getDay() : 0;
  const padded: ({ date: number; count: number } | null)[] = [
    ...Array(firstDay).fill(null),
    ...days,
  ];
  // Trailing padding pra completar a última semana
  while (padded.length % 7 !== 0) padded.push(null);

  // Marcas de mês: colunas onde aparece o 1º do mês
  const weeksCount = padded.length / 7;
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let week = 0; week < weeksCount; week++) {
    // Olha primeiro dia REAL da semana (pula nulls)
    for (let row = 0; row < 7; row++) {
      const cell = padded[week * 7 + row];
      if (!cell) continue;
      const m = new Date(cell.date).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ col: week, label: MONTH_LABELS[m] });
        lastMonth = m;
      }
      break;
    }
  }

  return (
    <div>
      <div
        className="heatmap-month-labels"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${weeksCount}, 13px)`,
          gap: 3,
          paddingLeft: 22,
        }}
      >
        {Array.from({ length: weeksCount }).map((_, week) => {
          const m = monthLabels.find((x) => x.col === week);
          return (
            <div key={week} style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              {m?.label ?? ''}
            </div>
          );
        })}
      </div>
      <div className="heatmap-wrap">
        <div className="heatmap-day-labels">
          {DAY_LABELS.map((l, i) => (
            <div
              key={i}
              style={{
                fontSize: '0.7rem',
                color: 'var(--muted)',
                lineHeight: '13px',
                visibility: i % 2 === 0 ? 'visible' : 'hidden',
              }}
            >
              {l}
            </div>
          ))}
        </div>
        <div className="heatmap">
          {padded.map((d, i) =>
            d === null ? (
              <div key={'pad-' + i} style={{ visibility: 'hidden' }} />
            ) : (
              <div
                key={d.date}
                className={
                  'day ' + level(d.count) + (d.date === today ? ' today' : '')
                }
                title={
                  new Date(d.date).toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  }) +
                  ' · ' +
                  d.count +
                  ' revisão(ões)'
                }
              />
            )
          )}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>menos</span>
        <span className="day"></span>
        <span className="day l1"></span>
        <span className="day l2"></span>
        <span className="day l3"></span>
        <span className="day l4"></span>
        <span>mais</span>
      </div>
    </div>
  );
}
