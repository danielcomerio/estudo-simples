'use client';

import { useEffect, useMemo, useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { fmtPercent } from '@/lib/format';
import { DAY_MS } from '@/lib/srs';
import {
  matchActiveConcurso,
  useActiveConcursoFilter,
  useAllConcursoDisciplinas,
  useConcursoDisciplinas,
  useConcursos,
  useDisciplinas,
} from '@/lib/hierarchy';
import { useActiveConcursoId } from '@/lib/settings';
import { useSimuladosForUser } from '@/lib/simulado-store';
import { calcularResultado } from '@/lib/simulado';
import type { Concurso, ConcursoDisciplina, Disciplina, Simulado } from '@/lib/types';

/** Escopo de filtragem das estatísticas — separado do concurso ativo
 *  do Topbar pra permitir explorar concursos sem mudar o filtro global. */
type ScopeKey = '__all__' | '__active__' | string; // string = concurso id

export function StatsView() {
  const allQuestions = useStore(selectActiveQuestions);
  const { data: concursos } = useConcursos();
  const { data: allDisciplinas } = useDisciplinas();
  const { data: allVinculos } = useAllConcursoDisciplinas();
  const activeConcursoId = useActiveConcursoId();
  const { concurso: activeConcurso } = useActiveConcursoFilter();

  // Default: respeita o filtro ativo do Topbar. User pode override aqui.
  const [scope, setScope] = useState<ScopeKey>('__active__');

  // Se o user não tem concurso ativo no Topbar, '__active__' é equivalente
  // a '__all__' — escolhemos o mais explícito pra UX consistente.
  useEffect(() => {
    if (scope === '__active__' && !activeConcursoId) {
      setScope('__all__');
    }
  }, [activeConcursoId, scope]);

  // Resolve o concursoId efetivo do escopo
  const effectiveConcursoId = useMemo(() => {
    if (scope === '__all__') return null;
    if (scope === '__active__') return activeConcursoId;
    return scope;
  }, [scope, activeConcursoId]);

  const effectiveConcurso = useMemo(
    () =>
      effectiveConcursoId
        ? concursos?.find((c) => c.id === effectiveConcursoId) ?? null
        : null,
    [concursos, effectiveConcursoId]
  );

  // Disciplinas vinculadas ao escopo (null = sem filtro)
  const scopeDiscNomes = useMemo<string[] | null>(() => {
    if (!effectiveConcursoId) return null;
    if (!allDisciplinas) return [];
    const byId = new Map(allDisciplinas.map((d) => [d.id, d.nome]));
    return allVinculos
      .filter((v) => v.concurso_id === effectiveConcursoId)
      .map((v) => byId.get(v.disciplina_id))
      .filter((n): n is string => !!n);
  }, [effectiveConcursoId, allDisciplinas, allVinculos]);

  const questions = useMemo(
    () =>
      scopeDiscNomes === null
        ? allQuestions
        : allQuestions.filter((q) =>
            matchActiveConcurso(q.disciplina_id, scopeDiscNomes)
          ),
    [allQuestions, scopeDiscNomes]
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
      <div
        className="card"
        style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem' }}>📊 Estatísticas de:</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ScopeKey)}
            style={{ minWidth: 200 }}
          >
            <option value="__all__">Geral (todos os concursos)</option>
            {activeConcurso && (
              <option value="__active__">
                ★ Concurso ativo: {activeConcurso.nome}
              </option>
            )}
            {(concursos ?? [])
              .filter((c) => c.id !== activeConcursoId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
        </label>
        {effectiveConcurso && scopeDiscNomes && (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {scopeDiscNomes.length} disciplina(s) vinculada(s) ·{' '}
            {questions.length} questão(ões)
          </span>
        )}
        {!effectiveConcurso && (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {questions.length} questão(ões) no banco
          </span>
        )}
      </div>

      <SimuladoStatsSection scopeDiscNomes={scopeDiscNomes} />

      <CalibracaoSection questions={questions} />

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

/**
 * Calibração metacognitiva: agrega histórico de questões por nível de
 * confidence (1=chutei, 2=incerto, 3=confiante) e mostra % acerto em
 * cada um. Útil pra detectar:
 *  - Overconfidence: errou muitas das "💪 Confiante" → você "sabe
 *    coisas que não são verdade"
 *  - Sob-estimar: acertou muitas das "🤔 Chutei" → você sabe mais do
 *    que pensa, pode arriscar mais
 *
 * Esconde a seção quando ainda não há registros — só vale após user
 * ter usado o rating algumas vezes.
 */
function CalibracaoSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const stats = useMemo(() => {
    const buckets = {
      1: { total: 0, correct: 0 },
      2: { total: 0, correct: 0 },
      3: { total: 0, correct: 0 },
    };
    for (const q of questions) {
      const hist = q.stats?.history ?? [];
      for (const h of hist) {
        if (h.confidence === undefined) continue;
        const b = buckets[h.confidence];
        if (!b) continue;
        b.total += 1;
        if (h.result === 'correct') b.correct += 1;
      }
    }
    return buckets;
  }, [questions]);

  const totalRatings = stats[1].total + stats[2].total + stats[3].total;
  if (totalRatings === 0) return null;

  const pct = (b: { total: number; correct: number }) =>
    b.total === 0 ? null : Math.round((b.correct / b.total) * 100);

  // Heurísticas de calibração (simples, não estatística rigorosa)
  const overconfidence = stats[3].total >= 5 && pct(stats[3])! < 70;
  const lucky = stats[1].total >= 5 && pct(stats[1])! > 50;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>Calibração metacognitiva</h2>
      <p className="muted" style={{ marginTop: -4, marginBottom: 12, fontSize: '0.88rem' }}>
        % acerto por nível de confiança que você marcou ANTES de
        responder. Ajuda a identificar onde sua intuição é confiável e
        onde não é.
      </p>
      <div className="row gap wrap" style={{ fontSize: '0.95rem' }}>
        <CalibracaoBucket label="🤔 Chutei" stats={stats[1]} pct={pct(stats[1])} />
        <CalibracaoBucket label="😐 Incerto" stats={stats[2]} pct={pct(stats[2])} />
        <CalibracaoBucket label="💪 Confiante" stats={stats[3]} pct={pct(stats[3])} />
      </div>
      {overconfidence && (
        <p style={{ marginTop: 12, fontSize: '0.88rem', color: 'var(--danger)' }}>
          ⚠ Overconfidence detectada: você errou {100 - pct(stats[3])!}% das
          questões marcadas "Confiante". Reveja com calma quando bater
          essa sensação — não é sinal seguro.
        </p>
      )}
      {lucky && (
        <p style={{ marginTop: 12, fontSize: '0.88rem', color: 'var(--primary)' }}>
          💡 Você acertou {pct(stats[1])}% das questões marcadas "Chutei" —
          mais do que o esperado por sorte. Talvez você saiba mais do
          que pensa; tente arriscar mais antes de pular.
        </p>
      )}
    </div>
  );
}

function CalibracaoBucket({
  label,
  stats,
  pct,
}: {
  label: string;
  stats: { total: number; correct: number };
  pct: number | null;
}) {
  const cor =
    pct === null
      ? 'var(--muted)'
      : pct >= 70
        ? 'var(--primary)'
        : pct >= 50
          ? 'var(--warn, #d97706)'
          : 'var(--danger)';
  return (
    <div
      style={{
        flex: '1 1 160px',
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
      }}
    >
      <div style={{ fontWeight: 500 }}>{label}</div>
      <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
        {stats.total} resposta(s)
      </div>
      <div style={{ marginTop: 4, fontSize: '1.4rem', fontWeight: 600, color: cor }}>
        {pct === null ? '—' : `${pct}%`}
      </div>
      <div className="muted" style={{ fontSize: '0.78rem' }}>
        acertos
      </div>
    </div>
  );
}

/**
 * Stats de simulado: agrega todos os simulados do user (ou filtrados
 * pelo escopo selecionado) — total, finalizados/abandonados, % acerto
 * médio "no tempo", evolução dos últimos 10.
 */
function SimuladoStatsSection({
  scopeDiscNomes,
}: {
  scopeDiscNomes: string[] | null;
}) {
  const userId = useStore((s) => s.userId);
  const allQuestions = useStore(selectActiveQuestions);
  const simulados = useSimuladosForUser(userId);

  const stats = useMemo(() => {
    // Filtra simulados cujo question_ids tenha alguma da disciplina do escopo.
    // Sem disciplinas (geral): considera todos.
    const lookup = new Map(allQuestions.map((q) => [q.id, q]));
    const inScope = scopeDiscNomes
      ? simulados.filter((s) => {
          const lower = scopeDiscNomes.map((n) => n.toLowerCase());
          return s.question_ids.some((qid) => {
            const q = lookup.get(qid);
            return q?.disciplina_id
              ? lower.includes(q.disciplina_id.toLowerCase())
              : false;
          });
        })
      : simulados;

    const finalizados = inScope.filter(
      (s) =>
        s.status === 'finalizado_no_tempo' ||
        s.status === 'finalizado_completo' ||
        s.status === 'finalizado_extra' ||
        s.status === 'finalizado_timeup_stopped'
    );
    const abandonados = inScope.filter((s) => s.status === 'abandonado');
    const emAndamento = inScope.filter((s) => s.status === 'em_andamento');

    // Calcula resultado pra cada finalizado e agrega
    let totalAcertosNoTempo = 0;
    let totalRespondidasNoTempo = 0;
    let totalAcertosGeral = 0;
    let totalRespondidasGeral = 0;
    const evolucao: Array<{ at: number; pctNoTempo: number; nome: string }> = [];

    for (const sim of finalizados) {
      const res = calcularResultado(sim, lookup);
      totalAcertosNoTempo += res.acertos_no_tempo;
      totalRespondidasNoTempo += res.respondidas_no_tempo;
      totalAcertosGeral += res.acertos_no_tempo + res.acertos_extra;
      totalRespondidasGeral +=
        res.respondidas_no_tempo + res.respondidas_extra;
      evolucao.push({
        at: sim.finished_at ?? sim.started_at,
        pctNoTempo:
          res.respondidas_no_tempo > 0
            ? res.acertos_no_tempo / res.respondidas_no_tempo
            : 0,
        nome: sim.nome ?? `#${sim.id.slice(0, 6)}`,
      });
    }

    evolucao.sort((a, b) => a.at - b.at);

    return {
      total: inScope.length,
      finalizados: finalizados.length,
      abandonados: abandonados.length,
      emAndamento: emAndamento.length,
      pctNoTempo:
        totalRespondidasNoTempo > 0
          ? totalAcertosNoTempo / totalRespondidasNoTempo
          : null,
      pctGeral:
        totalRespondidasGeral > 0
          ? totalAcertosGeral / totalRespondidasGeral
          : null,
      evolucao: evolucao.slice(-10),
    };
  }, [simulados, allQuestions, scopeDiscNomes]);

  if (stats.total === 0) {
    return (
      <div className="card">
        <h2 style={{ margin: '0 0 4px' }}>Simulados</h2>
        <p className="muted" style={{ margin: 0 }}>
          Nenhum simulado neste escopo ainda. Faça um em <code>/simulado</code>{' '}
          pra começar a acompanhar evolução.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>Simulados</h2>
      <div
        className="row gap wrap"
        style={{
          marginBottom: stats.evolucao.length > 0 ? 16 : 0,
          fontSize: '0.95rem',
        }}
      >
        <span>
          <strong>{stats.total}</strong> total
        </span>
        <span className="muted">·</span>
        <span>
          <strong>{stats.finalizados}</strong> finalizado(s)
        </span>
        {stats.emAndamento > 0 && (
          <>
            <span className="muted">·</span>
            <span>
              <strong>{stats.emAndamento}</strong> em andamento
            </span>
          </>
        )}
        {stats.abandonados > 0 && (
          <>
            <span className="muted">·</span>
            <span>
              <strong>{stats.abandonados}</strong> abandonado(s)
            </span>
          </>
        )}
        {stats.pctNoTempo !== null && (
          <>
            <span className="muted">·</span>
            <span>
              acerto médio (no tempo){' '}
              <strong>{Math.round(stats.pctNoTempo * 100)}%</strong>
            </span>
          </>
        )}
        {stats.pctGeral !== null &&
          stats.pctGeral !== stats.pctNoTempo && (
            <>
              <span className="muted">·</span>
              <span>
                geral <strong>{Math.round(stats.pctGeral * 100)}%</strong>
              </span>
            </>
          )}
      </div>

      {stats.evolucao.length > 1 && (
        <div>
          <div
            className="muted"
            style={{ fontSize: '0.82rem', marginBottom: 6 }}
          >
            Evolução dos últimos {stats.evolucao.length} (% acerto no tempo)
          </div>
          <SimuladoSparkline points={stats.evolucao.map((e) => e.pctNoTempo)} />
        </div>
      )}
    </div>
  );
}

/**
 * Mini-gráfico de barras horizontais sem dependência. Cada ponto é uma
 * coluna; altura = pct (0 a 1). Cor varia: <50% danger, <70% warn, >=70% ok.
 */
function SimuladoSparkline({ points }: { points: number[] }) {
  const max = 1;
  const barWidth = 100 / points.length;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        height: 60,
        gap: 2,
        background: 'var(--bg-elev-2)',
        padding: 6,
        borderRadius: 'var(--radius)',
      }}
    >
      {points.map((p, i) => {
        const pct = Math.max(0, Math.min(1, p / max));
        const cor =
          p < 0.5
            ? 'var(--danger)'
            : p < 0.7
              ? 'var(--warn, #d97706)'
              : 'var(--primary)';
        return (
          <div
            key={i}
            title={`${Math.round(p * 100)}%`}
            style={{
              flex: `0 0 ${barWidth}%`,
              height: `${pct * 100}%`,
              background: cor,
              borderRadius: '2px 2px 0 0',
              minHeight: 2,
            }}
          />
        );
      })}
    </div>
  );
}
