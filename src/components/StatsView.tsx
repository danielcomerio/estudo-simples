'use client';

import { useMemo } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { fmtPercent } from '@/lib/format';
import { DAY_MS } from '@/lib/srs';
import {
  matchActiveConcurso,
  useActiveConcursoFilter,
  useConcursoDisciplinas,
  useConcursos,
  useDisciplinas,
} from '@/lib/hierarchy';
import { setActiveConcursoId } from '@/lib/settings';
import type { Concurso, ConcursoDisciplina, Disciplina } from '@/lib/types';

export function StatsView() {
  const allQuestions = useStore(selectActiveQuestions);
  const { concurso: activeConcurso, disciplinaNomes: concursoDiscNomes } =
    useActiveConcursoFilter();

  // Aplica filtro de concurso ativo (se houver) — stats refletem o que
  // está sendo estudado, não o universo total.
  const questions = useMemo(
    () =>
      concursoDiscNomes === null
        ? allQuestions
        : allQuestions.filter((q) =>
            matchActiveConcurso(q.disciplina_id, concursoDiscNomes)
          ),
    [allQuestions, concursoDiscNomes]
  );

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
      {activeConcurso && (
        <div
          role="status"
          style={{
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>
            🎯 Estatísticas do concurso <strong>{activeConcurso.nome}</strong>
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => setActiveConcursoId(null)}
            style={{ fontSize: '0.85rem' }}
          >
            Ver tudo
          </button>
        </div>
      )}

      <ConcursosOverview />

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

/**
 * Resumo por concurso: cobertura do edital (questões cadastradas vs
 * qtd_questoes_prova esperada), % acerto, vencendo. Sempre visível em
 * /stats — útil pra ver "estou pronto pra qual concurso?" sem trocar
 * o filtro ativo.
 */
function ConcursosOverview() {
  const allQuestions = useStore(selectActiveQuestions);
  const { data: concursos } = useConcursos();
  const { data: disciplinas } = useDisciplinas();

  if (!concursos || concursos.length === 0) return null;

  return (
    <div className="card">
      <h2>Por concurso</h2>
      <p className="muted" style={{ marginTop: -4, marginBottom: 12 }}>
        Cobertura é a razão entre questões cadastradas das disciplinas
        vinculadas e o total esperado na prova (qtd_questoes_prova). Só
        é informativa quando você preencher quantidade esperada nos vínculos.
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {concursos.map((c) => (
          <ConcursoStatRow
            key={c.id}
            concurso={c}
            allQuestions={allQuestions}
            allDisciplinas={disciplinas ?? []}
          />
        ))}
      </ul>
    </div>
  );
}

function ConcursoStatRow({
  concurso,
  allQuestions,
  allDisciplinas,
}: {
  concurso: Concurso;
  allQuestions: ReturnType<typeof selectActiveQuestions>;
  allDisciplinas: Disciplina[];
}) {
  const { data: vinculos } = useConcursoDisciplinas(concurso.id);

  const stats = useMemo(() => {
    const discById = new Map(allDisciplinas.map((d) => [d.id, d]));
    const nomes: string[] = [];
    let qtdEsperada = 0;
    for (const v of vinculos as ConcursoDisciplina[]) {
      const d = discById.get(v.disciplina_id);
      if (d) nomes.push(d.nome.toLowerCase());
      if (v.qtd_questoes_prova) qtdEsperada += v.qtd_questoes_prova;
    }
    if (nomes.length === 0) {
      return {
        cadastradas: 0,
        attempts: 0,
        correct: 0,
        cobertura: null as number | null,
        qtdEsperada,
      };
    }
    let cadastradas = 0;
    let attempts = 0;
    let correct = 0;
    for (const q of allQuestions) {
      if (!q.disciplina_id) continue;
      if (!nomes.includes(q.disciplina_id.toLowerCase())) continue;
      cadastradas += 1;
      attempts += q.stats?.attempts || 0;
      correct += q.stats?.correct || 0;
    }
    const cobertura =
      qtdEsperada > 0 ? Math.min(1, cadastradas / qtdEsperada) : null;
    return { cadastradas, attempts, correct, cobertura, qtdEsperada };
  }, [vinculos, allDisciplinas, allQuestions]);

  const sub = [concurso.banca, concurso.orgao].filter(Boolean).join(' · ');

  return (
    <li
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
      }}
    >
      <div className="row between gap wrap" style={{ alignItems: 'baseline' }}>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ fontWeight: 600 }}>{concurso.nome}</div>
          {sub && (
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              {sub}
            </div>
          )}
        </div>
        <div className="row gap wrap" style={{ fontSize: '0.88rem' }}>
          <span>
            <strong>{vinculos.length}</strong> disciplina(s)
          </span>
          <span>
            <strong>{stats.cadastradas}</strong> questão(ões) no banco
          </span>
          {stats.cobertura !== null && (
            <span>
              cobertura{' '}
              <strong>
                {Math.round(stats.cobertura * 100)}%
              </strong>{' '}
              ({stats.cadastradas}/{stats.qtdEsperada})
            </span>
          )}
          {stats.attempts > 0 && (
            <span>
              acerto{' '}
              <strong>{fmtPercent(stats.correct, stats.attempts)}</strong>{' '}
              ({stats.attempts} tentativas)
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
