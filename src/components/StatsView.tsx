'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { LazyMount } from './LazyMount';
import { ForecastCard } from './ForecastCard';
import { PeerStatsCard } from './PeerStatsCard';
import { SimuladoTimeline } from './SimuladoTimeline';
import { HourPerformanceCard } from './HourPerformanceCard';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { fmtPercent } from '@/lib/format';
import { DAY_MS } from '@/lib/srs';
import { startOfDay } from '@/lib/utils';
import {
  matchActiveConcursoFull,
  useActiveConcursoFilter,
  useAllConcursoDisciplinas,
  useConcursoDisciplinas,
  useConcursos,
  useDisciplinas,
} from '@/lib/hierarchy';
import { useQuestionConcursoLinks } from '@/lib/question-concursos';
import { useActiveConcursoId } from '@/lib/settings';
import { useSimuladosForUser } from '@/lib/simulado-store';
import { calcularResultado } from '@/lib/simulado';
import {
  buildDisciplinasCSV,
  buildHistoryCSV,
  buildQuestionsCSV,
  downloadFile,
} from '@/lib/stats-export';
import { readSessions } from '@/lib/sessions-log';
import { toast } from './Toast';
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

  const questionLinks = useQuestionConcursoLinks();

  const questions = useMemo(
    () =>
      !effectiveConcursoId
        ? allQuestions
        : allQuestions.filter((q) =>
            matchActiveConcursoFull(
              q,
              effectiveConcursoId,
              scopeDiscNomes,
              questionLinks
            )
          ),
    [allQuestions, effectiveConcursoId, scopeDiscNomes, questionLinks]
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
        className="card stats-scope-card"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          /* Sticky no topo ao scrollar — usuário não precisa rolar de
             volta pra trocar escopo. Topbar é 56px + safe area. */
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
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
        <ExportCSVMenu questions={questions} />
        <ExportICSButton questions={questions} />
        <ExportAnkiButton questions={questions} />
        <ExportWeeklyReportButton questions={questions} />
      </div>

      {effectiveConcursoId && (
        <PredicaoNotaSection
          questions={questions}
          concursoId={effectiveConcursoId}
          allDisciplinas={allDisciplinas ?? []}
          allVinculos={allVinculos}
        />
      )}

      {/* Sections acima da fold montam direto pra LCP rápido. */}
      <PeriodoSnapshot questions={questions} />

      <WeekdayDistributionSection questions={questions} />

      {/* Sections abaixo são lazy-mounted: só renderizam quando próximas
          do viewport. Reduz tempo até interactive em /stats com 20+
          sections. Cada uma reserva ~140px enquanto não monta. */}
      <LazyMount>
        <ErrorCausesSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <SessionsLogSection />
      </LazyMount>

      <LazyMount>
        <SemanaSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <HoraDoDiaSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <HourWeekdayHeatmapSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <ProgressaoSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <TempoMedioSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <DificuldadeSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <NemesisSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <AprendizadoSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <DisciplinaXPSection
          questions={questions}
          allDisciplinas={allDisciplinas ?? []}
        />
      </LazyMount>

      <LazyMount>
        <ForgettingCurveSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <CargaProximaSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <OrigemDistSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <TemasSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <BancasSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <TagsSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <TagRankingSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <SimuladoStatsSection scopeDiscNomes={scopeDiscNomes} />
      </LazyMount>

      <LazyMount>
        <CalibracaoSection questions={questions} />
      </LazyMount>

      <LazyMount>
        <ConcursosOverview />
      </LazyMount>

      <LazyMount>
        <ForecastCard questions={questions} />
      </LazyMount>

      <LazyMount>
        <PeerStatsCard />
      </LazyMount>

      <LazyMount>
        <SimuladoTimeline />
      </LazyMount>

      <LazyMount>
        <HourPerformanceCard />
      </LazyMount>

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
 * Stats agregadas por (disciplina, tema) — granularidade fina abaixo
 * de disciplina. Útil pra ver "domino Português mas regrido em Crase".
 *
 * Filtra temas com ≥3 questões pra evitar ruído. Sort por % acerto
 * asc (piores no topo, ação clara).
 */
function TemasSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const stats = useMemo(() => {
    const m = new Map<
      string,
      { total: number; attempts: number; correct: number; due: number }
    >();
    const now = Date.now();
    for (const q of questions) {
      if (!q.tema) continue;
      const k = (q.disciplina_id ?? '') + ' › ' + q.tema;
      let agg = m.get(k);
      if (!agg) {
        agg = { total: 0, attempts: 0, correct: 0, due: 0 };
        m.set(k, agg);
      }
      agg.total += 1;
      agg.attempts += q.stats?.attempts ?? 0;
      agg.correct += q.stats?.correct ?? 0;
      if ((q.srs?.dueDate ?? 0) < now) agg.due += 1;
    }
    return Array.from(m.entries())
      .filter(([, s]) => s.total >= 3)
      .map(([k, s]) => ({
        chave: k,
        ...s,
        pct: s.attempts > 0 ? s.correct / s.attempts : null,
      }))
      .sort((a, b) => {
        const ap = a.pct ?? 1.1;
        const bp = b.pct ?? 1.1;
        return ap - bp;
      });
  }, [questions]);

  if (stats.length === 0) return null;

  return (
    <div className="card">
      <h2>Por tema</h2>
      <p className="muted" style={{ marginTop: -4, marginBottom: 12, fontSize: '0.85rem' }}>
        Temas com ≥3 questões cadastradas. Sort por % acerto asc (piores no topo).
        Útil pra ver granularidade abaixo da disciplina.
      </p>
      <div className="stats-table">
        <div className="head">Disciplina › Tema</div>
        <div className="head">Total</div>
        <div className="head col-hide-sm">Tentativas</div>
        <div className="head col-hide-sm">% Acerto</div>
        <div className="head">Vencendo</div>
        {stats.slice(0, 50).map((s) => (
          <BancaRow
            key={s.chave}
            banca={s.chave}
            s={{
              total: s.total,
              attempts: s.attempts,
              correct: s.correct,
              due: s.due,
            }}
          />
        ))}
      </div>
      {stats.length > 50 && (
        <p className="muted" style={{ marginTop: 8, fontSize: '0.82rem' }}>
          Mostrando 50 dos {stats.length} temas. Os demais têm acerto melhor.
        </p>
      )}
    </div>
  );
}

/**
 * Distribuição por origem: barra horizontal segmentada com %
 * de cada categoria (real / autoral / adaptada / legado).
 * Mostra também tipos: objetiva / discursiva / cloze / flashcard.
 */
function OrigemDistSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const total = questions.length;
  if (total === 0) return null;

  const origem: Record<string, number> = {
    real: 0,
    autoral: 0,
    adaptada: 0,
    legado: 0,
  };
  const tipos: Record<string, number> = {
    objetiva: 0,
    discursiva: 0,
    cloze: 0,
    flashcard: 0,
  };
  const gabSource: Record<string, number> = {
    oficial: 0,
    ia: 0,
    crowd: 0,
    indef: 0,
  };
  for (const q of questions) {
    if (q.origem === 'real') origem.real += 1;
    else if (q.origem === 'autoral') origem.autoral += 1;
    else if (q.origem === 'adaptada') origem.adaptada += 1;
    else origem.legado += 1;
    tipos[q.type] = (tipos[q.type] ?? 0) + 1;
    const gs = q.fonte?.gabarito_source ?? null;
    if (gs === 'oficial') gabSource.oficial += 1;
    else if (gs === 'ia') gabSource.ia += 1;
    else if (gs === 'crowd') gabSource.crowd += 1;
    else gabSource.indef += 1;
  }

  const colors: Record<string, string> = {
    real: 'var(--primary)',
    autoral: '#22c55e',
    adaptada: '#f59e0b',
    legado: 'var(--muted)',
    objetiva: 'var(--primary)',
    discursiva: '#a855f7',
    cloze: '#ec4899',
    flashcard: '#06b6d4',
    oficial: 'var(--primary)',
    ia: 'var(--warn, #d97706)',
    crowd: '#06b6d4',
    indef: 'var(--muted)',
  };

  const labels: Record<string, string> = {
    real: '📋 Real',
    autoral: '✏️ Autoral',
    adaptada: '🔧 Adaptada',
    legado: '— Legado (sem origem)',
    objetiva: 'Objetiva',
    discursiva: 'Discursiva',
    cloze: 'Cloze',
    flashcard: 'Flashcard',
    oficial: '✓ Oficial',
    ia: '🤖 IA',
    crowd: '👥 Crowd',
    indef: '— Indefinido',
  };

  return (
    <div className="card">
      <h2>Composição do banco</h2>

      <h3 style={{ fontSize: '0.95rem', margin: '12px 0 6px' }}>Por origem</h3>
      <SegmentedBar buckets={origem} colors={colors} labels={labels} total={total} />

      <h3 style={{ fontSize: '0.95rem', margin: '18px 0 6px' }}>Por tipo</h3>
      <SegmentedBar buckets={tipos} colors={colors} labels={labels} total={total} />

      <h3 style={{ fontSize: '0.95rem', margin: '18px 0 6px' }}>
        Por origem do gabarito
      </h3>
      <SegmentedBar
        buckets={gabSource}
        colors={colors}
        labels={labels}
        total={total}
      />
    </div>
  );
}

function SegmentedBar({
  buckets,
  colors,
  labels,
  total,
}: {
  buckets: Record<string, number>;
  colors: Record<string, string>;
  labels: Record<string, string>;
  total: number;
}) {
  const entries = Object.entries(buckets).filter(([, v]) => v > 0);
  return (
    <div>
      <div
        style={{
          display: 'flex',
          height: 22,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        {entries.map(([k, v]) => (
          <div
            key={k}
            style={{
              width: `${(v / total) * 100}%`,
              background: colors[k] ?? 'var(--muted)',
            }}
            title={`${labels[k] ?? k}: ${v} (${Math.round((v / total) * 100)}%)`}
          />
        ))}
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '8px 0 0',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: '0.85rem',
        }}
      >
        {entries.map(([k, v]) => (
          <li key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                background: colors[k] ?? 'var(--muted)',
                borderRadius: 2,
              }}
            />
            <span>{labels[k] ?? k}:</span>
            <strong>{v}</strong>
            <span className="muted">({Math.round((v / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Lista de questões "inimigas" — taxa de acerto baixa com volume
 * suficiente pra ser estatisticamente confiável.
 *
 * Critério: ≥3 tentativas E acerto < 30%. Limita a top 20 por
 * número de tentativas (mais "treinadas" e ainda erradas no topo).
 *
 * Botão "Estudar essa" abre /estudar?qid=X pra prática isolada.
 */
function NemesisSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const nemesis = useMemo(() => {
    const list = questions
      .filter((q) => {
        const a = q.stats?.attempts ?? 0;
        const c = q.stats?.correct ?? 0;
        return a >= 3 && c / a < 0.3;
      })
      .map((q) => ({
        q,
        attempts: q.stats?.attempts ?? 0,
        correct: q.stats?.correct ?? 0,
        pct: (q.stats?.correct ?? 0) / (q.stats?.attempts ?? 1),
      }))
      .sort((a, b) => b.attempts - a.attempts || a.pct - b.pct);
    return list.slice(0, 20);
  }, [questions]);

  if (nemesis.length === 0) return null;

  return (
    <div className="card">
      <h2>Suas inimigas</h2>
      <p className="muted" style={{ marginTop: -4, marginBottom: 12, fontSize: '0.85rem' }}>
        Questões com taxa de acerto &lt; 30% (≥3 tentativas).
        Vale focar nelas — entender o erro pode ser mais valioso que
        praticar 10 questões que você já acerta sem pensar.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {nemesis.map(({ q, attempts, correct, pct }) => {
          const enun =
            q.type === 'objetiva'
              ? (q.payload as { enunciado?: string }).enunciado ?? ''
              : q.type === 'discursiva'
                ? (q.payload as { enunciado_completo?: string; enunciado?: string }).enunciado_completo ??
                  (q.payload as { enunciado?: string }).enunciado ??
                  ''
                : q.type === 'cloze'
                  ? (q.payload as { texto?: string }).texto ?? ''
                  : (q.payload as { frente?: string }).frente ?? '';
          const route =
            q.type === 'cloze' || q.type === 'flashcard'
              ? `/cards?qid=${q.id}`
              : `/estudar?qid=${q.id}`;
          return (
            <li
              key={q.id}
              style={{
                background: 'var(--bg-elev-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
              }}
            >
              <div className="row between gap wrap" style={{ alignItems: 'center' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div
                    className="muted"
                    style={{ fontSize: '0.78rem', marginBottom: 2 }}
                  >
                    {q.disciplina_id ?? '(sem disciplina)'}
                    {q.tema && ` · ${q.tema}`}
                  </div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {enun}
                  </div>
                </div>
                <div className="row gap" style={{ alignItems: 'center' }}>
                  <span
                    style={{
                      color: 'var(--danger)',
                      fontWeight: 600,
                    }}
                  >
                    {Math.round(pct * 100)}%
                  </span>
                  <span className="muted" style={{ fontSize: '0.82rem' }}>
                    ({correct}/{attempts})
                  </span>
                  <Link href={route}>
                    <button type="button" className="primary">
                      ▶ Estudar
                    </button>
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Distribuição de dificuldade — # questões por nível 1-5.
 * Mais "(sem)" pra questões sem dificuldade definida.
 *
 * Útil pra ver se banco está balanceado ou enviesado.
 */
function DificuldadeSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const buckets: Record<string, { count: number; correct: number; attempts: number }> = {
    '1': { count: 0, correct: 0, attempts: 0 },
    '2': { count: 0, correct: 0, attempts: 0 },
    '3': { count: 0, correct: 0, attempts: 0 },
    '4': { count: 0, correct: 0, attempts: 0 },
    '5': { count: 0, correct: 0, attempts: 0 },
    '(sem)': { count: 0, correct: 0, attempts: 0 },
  };
  for (const q of questions) {
    const k = q.dificuldade != null ? String(q.dificuldade) : '(sem)';
    if (!buckets[k]) continue;
    buckets[k].count += 1;
    buckets[k].correct += q.stats?.correct ?? 0;
    buckets[k].attempts += q.stats?.attempts ?? 0;
  }
  const total = Object.values(buckets).reduce((s, b) => s + b.count, 0);
  if (total === 0) return null;
  const max = Math.max(...Object.values(buckets).map((b) => b.count));

  const labels: Record<string, string> = {
    '1': '1 — muito fácil',
    '2': '2 — fácil',
    '3': '3 — médio',
    '4': '4 — difícil',
    '5': '5 — muito difícil',
    '(sem)': 'sem dificuldade',
  };

  return (
    <div className="card">
      <h2>Distribuição de dificuldade</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(buckets).map(([k, b]) => {
          if (b.count === 0) return null;
          const w = max > 0 ? (b.count / max) * 100 : 0;
          const pct = b.attempts > 0 ? Math.round((b.correct / b.attempts) * 100) : null;
          return (
            <li
              key={k}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr 130px',
                gap: 10,
                alignItems: 'center',
                fontSize: '0.9rem',
              }}
            >
              <span>{labels[k]}</span>
              <div style={{ background: 'var(--bg-elev-2)', height: 18, borderRadius: 4 }}>
                <div
                  style={{
                    background: 'var(--primary)',
                    height: '100%',
                    width: `${w}%`,
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ textAlign: 'right' }}>
                <strong>{b.count}</strong>
                {pct !== null && (
                  <span className="muted" style={{ marginLeft: 6, fontSize: '0.82rem' }}>
                    · {pct}% acerto
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p
        className="muted"
        style={{ marginTop: 10, fontSize: '0.78rem', fontStyle: 'italic' }}
      >
        Banco bem balanceado distribui mais nas faixas 2-4 (médio).
        Muitas em "(sem)" significam que muita questão não foi
        classificada — bulk-edit dificuldade no /banco resolve.
      </p>
    </div>
  );
}

/**
 * Tempo médio por disciplina. Calcula média de history.timeMs (em
 * segundos) agrupando por disciplina_id. Útil pra detectar matérias
 * que demandam mais tempo (priorizar treino de leitura rápida) ou
 * questões "presas" (média muito alta sugere conteúdo complexo).
 */
function TempoMedioSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const stats = useMemo(() => {
    const m = new Map<string, { somaMs: number; count: number }>();
    for (const q of questions) {
      const d = q.disciplina_id || '(sem)';
      for (const h of q.stats?.history ?? []) {
        if (typeof h.timeMs !== 'number' || h.timeMs <= 0) continue;
        let agg = m.get(d);
        if (!agg) {
          agg = { somaMs: 0, count: 0 };
          m.set(d, agg);
        }
        agg.somaMs += h.timeMs;
        agg.count += 1;
      }
    }
    return Array.from(m.entries())
      .map(([disc, s]) => ({
        disc,
        media: s.count > 0 ? s.somaMs / s.count / 1000 : 0,
        count: s.count,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.media - a.media);
  }, [questions]);

  if (stats.length === 0) return null;

  const maxMedia = Math.max(...stats.map((s) => s.media));

  return (
    <div className="card">
      <h2>Tempo médio por disciplina</h2>
      <p className="muted" style={{ marginTop: -4, marginBottom: 12, fontSize: '0.85rem' }}>
        Média de tempo por questão (extraída do histórico). Alto = matéria
        que consome mais; pode ser sinal pra treinar leitura ou simplificar
        o estudo.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stats.map(({ disc, media, count }) => {
          const widthPct = (media / maxMedia) * 100;
          return (
            <li
              key={disc}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr 80px',
                gap: 10,
                alignItems: 'center',
                fontSize: '0.9rem',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={disc}>
                {disc}
              </span>
              <div style={{ background: 'var(--bg-elev-2)', height: 18, borderRadius: 4 }}>
                <div
                  style={{
                    background: 'var(--primary)',
                    height: '100%',
                    width: `${widthPct}%`,
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ textAlign: 'right' }}>
                <strong>{media.toFixed(1)}s</strong>
                <span className="muted" style={{ fontSize: '0.78rem', marginLeft: 4 }}>
                  ({count})
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Gráfico de progressão temporal (últimos 30 dias).
 *  - Barras: # revisões por dia
 *  - Linha sobreposta: % acerto rolling de 7 dias
 * SVG simples, sem deps. Eixos rudimentares.
 */
function ProgressaoSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const data = useMemo(() => {
    const now = Date.now();
    const startOf = (ts: number) => {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const today = startOf(now);
    const dias: { date: number; count: number; correct: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      dias.push({ date: today - i * DAY_MS, count: 0, correct: 0 });
    }
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        const d = startOf(h.date);
        const idx = dias.findIndex((x) => x.date === d);
        if (idx < 0) continue;
        dias[idx].count += 1;
        if (h.result === 'correct' || h.result === 'self_pass') {
          dias[idx].correct += 1;
        }
      }
    }
    return dias;
  }, [questions]);

  const totalRev = data.reduce((s, d) => s + d.count, 0);
  if (totalRev === 0) return null;

  // Rolling % acerto (janela 7 dias)
  const rolling = data.map((_, i) => {
    let c = 0;
    let t = 0;
    for (let j = Math.max(0, i - 6); j <= i; j++) {
      c += data[j].correct;
      t += data[j].count;
    }
    return t > 0 ? c / t : null;
  });

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const W = 600;
  const H = 200;
  const barW = W / data.length;

  return (
    <div className="card">
      <h2>Progressão — últimos 30 dias</h2>
      <p
        className="muted"
        style={{ marginTop: -4, marginBottom: 12, fontSize: '0.85rem' }}
      >
        Barras: revisões por dia. Linha verde: % acerto (média móvel 7d).
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        preserveAspectRatio="none"
      >
        {/* Grid lines horizontais (25%, 50%, 75%) */}
        {[0.25, 0.5, 0.75].map((p, i) => (
          <line
            key={i}
            x1={0}
            y1={H * (1 - p)}
            x2={W}
            y2={H * (1 - p)}
            stroke="var(--border)"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
        ))}
        {/* Barras de count */}
        {data.map((d, i) => {
          const h = (d.count / maxCount) * H * 0.85;
          return (
            <rect
              key={i}
              x={i * barW + 1}
              y={H - h}
              width={Math.max(1, barW - 2)}
              height={h}
              fill="var(--primary)"
              opacity={d.count === 0 ? 0.15 : 0.7}
            >
              <title>
                {new Date(d.date).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                })}{' '}
                · {d.count} revisão(ões), {d.correct} acerto(s)
              </title>
            </rect>
          );
        })}
        {/* Linha de % acerto rolling */}
        <polyline
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={rolling
            .map((r, i) =>
              r === null
                ? ''
                : `${i * barW + barW / 2},${H - r * H * 0.95}`
            )
            .filter(Boolean)
            .join(' ')}
        />
      </svg>
      <div
        className="muted"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          marginTop: 4,
        }}
      >
        <span>30d atrás</span>
        <span>hoje</span>
      </div>
    </div>
  );
}

/**
 * Stats por tag. Cada questão pode ter N tags; cada tag aparece numa
 * linha agregando contagem + acerto. Útil pra ver onde a taxonomia
 * acompanha desempenho ("apostas-FGV" vs "letra-fria-CESPE", etc).
 *
 * Esconde quando nenhuma questão tem tags (evita seção vazia).
 */
/**
 * Distribuição de revisões por dia da semana. Útil pra notar padrão
 * (estuda mais segunda? menos sábado?). Total = todas as revisões do
 * histórico carregado.
 */
function WeekdayDistributionSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const data = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    let acertosOK = [0, 0, 0, 0, 0, 0, 0];
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        const dow = new Date(h.date).getDay();
        counts[dow]++;
        if (h.result === 'correct' || h.result === 'self_pass') {
          acertosOK[dow]++;
        }
      }
    }
    return counts.map((c, i) => ({
      label: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i],
      total: c,
      pct: c > 0 ? Math.round((100 * acertosOK[i]) / c) : 0,
    }));
  }, [questions]);

  const max = Math.max(1, ...data.map((d) => d.total));
  const totalAll = data.reduce((s, d) => s + d.total, 0);
  if (totalAll === 0) return null;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>📅 Por dia da semana</h2>
      <p
        className="muted"
        style={{ marginTop: 0, fontSize: '0.85rem', marginBottom: 12 }}
      >
        Distribuição de revisões e taxa de acerto por dia.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
        }}
      >
        {data.map((d) => {
          const h = d.total > 0 ? Math.max(8, (d.total / max) * 80) : 4;
          return (
            <div
              key={d.label}
              style={{
                background: 'var(--bg-elev-2)',
                borderRadius: 'var(--radius)',
                padding: 6,
                textAlign: 'center',
              }}
              title={`${d.total} revisões · ${d.pct}% acerto`}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                {d.label}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  height: 80,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: `${h}px`,
                    background:
                      d.pct >= 70 ? '#22c55e' : d.pct >= 40 ? '#f59e0b' : '#ef4444',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.3s',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.78rem', marginTop: 2 }}>{d.total}</div>
              {d.total > 0 && (
                <div
                  className="muted"
                  style={{ fontSize: '0.68rem' }}
                >
                  {d.pct}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Distribuição das causas dos erros. Mostra padrão pra direcionar:
 * muitos "atenção" → trabalha foco; muitos "leitura" → ler com calma;
 * muitos "conceito" → estuda mais.
 */
function ErrorCausesSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {
      concept: 0,
      careless: 0,
      interpret: 0,
      time: 0,
      tricky: 0,
    };
    let total = 0;
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        if (h.errorCause) {
          counts[h.errorCause] = (counts[h.errorCause] ?? 0) + 1;
          total++;
        }
      }
    }
    return { counts, total };
  }, [questions]);

  if (data.total === 0) return null;

  const labels: Record<string, { emoji: string; name: string; tip: string }> = {
    concept: {
      emoji: '🧠',
      name: 'Não sabia (conceito)',
      tip: 'Estude mais o assunto: explicação, vídeo, doutrina.',
    },
    careless: {
      emoji: '🤦',
      name: 'Atenção',
      tip: 'Releia antes de marcar. Cobre alternativa pra evitar pular.',
    },
    interpret: {
      emoji: '📖',
      name: 'Leitura',
      tip: 'Quebre enunciado em partes. Sublinhe palavras-chave.',
    },
    time: {
      emoji: '⏱',
      name: 'Tempo',
      tip: 'Treine com cronômetro no /simulado. Aprenda a "pular e voltar".',
    },
    tricky: {
      emoji: '🎩',
      name: 'Pegadinha',
      tip: 'Tag essas com `pegadinha` no /banco e revise antes da prova.',
    },
  };

  const sorted = Object.entries(data.counts)
    .map(([k, v]) => ({ key: k, count: v, pct: Math.round((100 * v) / data.total) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>🤔 Por que você erra</h2>
      <p
        className="muted"
        style={{ marginTop: 0, fontSize: '0.85rem', marginBottom: 12 }}
      >
        Causas dos seus erros (auto-classificadas após errar). Padrão sugere
        ação. Total: {data.total} erros classificados.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((row) => {
          const meta = labels[row.key];
          return (
            <div key={row.key}>
              <div
                className="row between"
                style={{ marginBottom: 4, fontSize: '0.88rem' }}
              >
                <span>
                  {meta.emoji} <strong>{meta.name}</strong>
                </span>
                <span className="muted">
                  {row.count} ({row.pct}%)
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg-elev)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${row.pct}%`,
                    background:
                      row.key === 'concept'
                        ? 'var(--primary)'
                        : row.key === 'careless'
                          ? '#f59e0b'
                          : row.key === 'interpret'
                            ? '#a855f7'
                            : row.key === 'time'
                              ? '#ef4444'
                              : '#06b6d4',
                  }}
                />
              </div>
              <p
                className="muted"
                style={{ margin: '4px 0 0', fontSize: '0.78rem' }}
              >
                {meta.tip}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Lista as últimas 10 sessões concluídas (de qualquer tipo). Útil pra
 * ver tendência de % acerto sessão a sessão.
 */
function SessionsLogSection() {
  const [sessions, setSessions] = useState<ReturnType<typeof readSessions>>([]);
  useEffect(() => {
    setSessions(readSessions());
  }, []);
  const last10 = sessions.slice(0, 10);
  if (last10.length === 0) return null;

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  const fmtDur = (ms: number) => {
    const min = Math.round(ms / 60000);
    if (min < 1) return '<1min';
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m}min`;
  };
  const kindIcon = (k: string) => {
    if (k === 'estudar') return '🎯';
    if (k === 'discursivas') return '✍️';
    if (k === 'cards') return '🃏';
    if (k === 'simulado') return '📝';
    return '·';
  };

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 12px' }}>📜 Últimas sessões</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {last10.map((s) => {
          const total = s.correct + s.wrong;
          const pct = total > 0 ? Math.round((100 * s.correct) / total) : null;
          const cor =
            pct == null
              ? 'var(--muted)'
              : pct >= 70
                ? '#22c55e'
                : pct >= 40
                  ? '#f59e0b'
                  : '#ef4444';
          return (
            <div
              key={s.id}
              className="row gap"
              style={{
                padding: '6px 10px',
                background: 'var(--bg-elev-2)',
                borderRadius: 'var(--radius)',
                fontSize: '0.85rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ width: 22, textAlign: 'center' }}>
                {kindIcon(s.kind)}
              </span>
              <span style={{ minWidth: 110 }}>{fmtDate(s.startedAt)}</span>
              <span className="muted">{s.total} questão(ões)</span>
              {pct != null && (
                <span style={{ color: cor, fontWeight: 500 }}>{pct}%</span>
              )}
              <span className="muted" style={{ marginLeft: 'auto' }}>
                {fmtDur(s.durationMs)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Snapshot rápido de períodos: 7 dias / 30 dias / total. Cada coluna
 * mostra revisões, % acerto e dias estudados. Útil pra ver tendência
 * sem entrar em detalhes — comparação visual instantânea.
 */
function PeriodoSnapshot({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const periods = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    const cutoff7 = todayStart - 6 * DAY_MS; // últimos 7 dias incluindo hoje
    const cutoff30 = todayStart - 29 * DAY_MS;

    const stats = {
      d7: { rev: 0, correct: 0, days: new Set<number>() },
      d30: { rev: 0, correct: 0, days: new Set<number>() },
      all: { rev: 0, correct: 0, days: new Set<number>() },
    };

    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        const d = new Date(h.date).setHours(0, 0, 0, 0);
        const ok = h.result === 'correct' || h.result === 'self_pass';
        stats.all.rev += 1;
        if (ok) stats.all.correct += 1;
        stats.all.days.add(d);
        if (h.date >= cutoff30) {
          stats.d30.rev += 1;
          if (ok) stats.d30.correct += 1;
          stats.d30.days.add(d);
          if (h.date >= cutoff7) {
            stats.d7.rev += 1;
            if (ok) stats.d7.correct += 1;
            stats.d7.days.add(d);
          }
        }
      }
    }
    return [
      {
        label: 'Últimos 7 dias',
        emoji: '📅',
        rev: stats.d7.rev,
        correct: stats.d7.correct,
        days: stats.d7.days.size,
        max: 7,
      },
      {
        label: 'Últimos 30 dias',
        emoji: '📆',
        rev: stats.d30.rev,
        correct: stats.d30.correct,
        days: stats.d30.days.size,
        max: 30,
      },
      {
        label: 'Total',
        emoji: '∞',
        rev: stats.all.rev,
        correct: stats.all.correct,
        days: stats.all.days.size,
        max: null,
      },
    ];
  }, [questions]);

  if (periods[2].rev === 0) return null;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 12px' }}>📊 Por período</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {periods.map((p) => {
          const pct = p.rev > 0 ? Math.round((p.correct / p.rev) * 100) : 0;
          const consistencia = p.max
            ? `${p.days}/${p.max} dias`
            : `${p.days} dias`;
          return (
            <div
              key={p.label}
              style={{
                background: 'var(--bg-elev-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 12,
              }}
            >
              <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                {p.emoji} {p.label}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>
                {p.rev} <span className="muted" style={{ fontSize: '0.85rem', fontWeight: 400 }}>revisões</span>
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                <span style={{ color: pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444' }}>
                  {pct}% acerto
                </span>{' '}
                <span className="muted">· {consistencia}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Top 5 tags com pior desempenho (>=10 tentativas pra evitar vieses
 * de baixa amostra). Ordena por % acerto crescente. Útil pra direcionar
 * estudo: aparece destacado, com call-to-action de filtrar /banco.
 */
function TagRankingSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const piores = useMemo(() => {
    const m = new Map<string, { attempts: number; correct: number; total: number }>();
    for (const q of questions) {
      const tags = q.tags ?? [];
      const a = q.stats?.attempts ?? 0;
      const c = q.stats?.correct ?? 0;
      if (a === 0 || tags.length === 0) continue;
      for (const t of tags) {
        const agg = m.get(t) ?? { attempts: 0, correct: 0, total: 0 };
        agg.attempts += a;
        agg.correct += c;
        agg.total += 1;
        m.set(t, agg);
      }
    }
    return Array.from(m.entries())
      .filter(([, s]) => s.attempts >= 10)
      .map(([t, s]) => ({ tag: t, ...s, pct: s.correct / s.attempts }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 5);
  }, [questions]);

  if (piores.length === 0) return null;

  return (
    <div
      className="card"
      style={{
        background: 'var(--danger-soft, rgba(239, 68, 68, 0.08))',
        border: '1px solid var(--danger, #ef4444)',
      }}
    >
      <h2 style={{ margin: '0 0 6px' }}>🚨 Tags com pior desempenho</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: '0.88rem' }}>
        Top 5 tags onde você mais erra (≥10 tentativas). Foque aqui pra
        ganho direto de aprovação.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {piores.map((t) => {
          const pct = Math.round(t.pct * 100);
          return (
            <div key={t.tag}>
              <div className="row between" style={{ marginBottom: 3, fontSize: '0.88rem' }}>
                <Link
                  href={`/banco?search=${encodeURIComponent('tag:' + t.tag)}`}
                  style={{ fontWeight: 500 }}
                >
                  🏷 {t.tag}
                </Link>
                <span className="muted" style={{ fontSize: '0.82rem' }}>
                  {pct}% · {t.correct}/{t.attempts} · {t.total} questão(ões)
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg-elev)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background:
                      pct < 30
                        ? '#ef4444'
                        : pct < 50
                          ? '#f59e0b'
                          : 'var(--primary)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TagsSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const stats = useMemo(() => {
    const m = new Map<
      string,
      { total: number; attempts: number; correct: number; due: number }
    >();
    const now = Date.now();
    for (const q of questions) {
      const tags = q.tags ?? [];
      if (tags.length === 0) continue;
      for (const t of tags) {
        let agg = m.get(t);
        if (!agg) {
          agg = { total: 0, attempts: 0, correct: 0, due: 0 };
          m.set(t, agg);
        }
        agg.total += 1;
        agg.attempts += q.stats?.attempts ?? 0;
        agg.correct += q.stats?.correct ?? 0;
        if ((q.srs?.dueDate ?? 0) < now) agg.due += 1;
      }
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [questions]);

  if (stats.length === 0) return null;

  return (
    <div className="card">
      <h2>Por tag</h2>
      <p className="muted" style={{ marginTop: -4, marginBottom: 12, fontSize: '0.88rem' }}>
        Cada questão pode estar em várias tags — total geral &gt; total de questões.
      </p>
      <div className="stats-table">
        <div className="head">Tag</div>
        <div className="head">Questões</div>
        <div className="head col-hide-sm">Tentativas</div>
        <div className="head col-hide-sm">% Acerto</div>
        <div className="head">Vencendo</div>
        {stats.slice(0, 30).map(([tag, s]) => (
          <BancaRow key={tag} banca={tag} s={s} />
        ))}
      </div>
      {stats.length > 30 && (
        <p className="muted" style={{ marginTop: 8, fontSize: '0.82rem' }}>
          Mostrando 30 das {stats.length} tags. As demais aparecem ordenadas
          por uso decrescente.
        </p>
      )}
    </div>
  );
}

/**
 * Stats agregadas por banca. Banca extraída de:
 *  1. fonte.banca (origem='real' garante)
 *  2. banca_estilo (autorais marcadas com estilo de banca)
 *  3. fallback "(sem banca)"
 *
 * Útil pra concursos com múltiplas bancas (FGV+CESPE+FCC etc).
 */
function BancasSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const stats = useMemo(() => {
    const m = new Map<
      string,
      { total: number; attempts: number; correct: number; due: number }
    >();
    const now = Date.now();
    for (const q of questions) {
      const banca =
        (typeof q.fonte?.banca === 'string' && q.fonte.banca) ||
        q.banca_estilo ||
        '(sem banca)';
      let agg = m.get(banca);
      if (!agg) {
        agg = { total: 0, attempts: 0, correct: 0, due: 0 };
        m.set(banca, agg);
      }
      agg.total += 1;
      agg.attempts += q.stats?.attempts ?? 0;
      agg.correct += q.stats?.correct ?? 0;
      if ((q.srs?.dueDate ?? 0) < now) agg.due += 1;
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [questions]);

  if (stats.length === 0) return null;

  return (
    <div className="card">
      <h2>Por banca</h2>
      <div className="stats-table">
        <div className="head">Banca</div>
        <div className="head">Total</div>
        <div className="head col-hide-sm">Tentativas</div>
        <div className="head col-hide-sm">% Acerto</div>
        <div className="head">Vencendo</div>
        {stats.map(([banca, s]) => (
          <BancaRow key={banca} banca={banca} s={s} />
        ))}
      </div>
    </div>
  );
}

function BancaRow({
  banca,
  s,
}: {
  banca: string;
  s: { total: number; attempts: number; correct: number; due: number };
}) {
  return (
    <>
      <div className="row-cell">{banca}</div>
      <div className="row-cell">{s.total}</div>
      <div className="row-cell col-hide-sm">{s.attempts}</div>
      <div className="row-cell col-hide-sm">
        {fmtPercent(s.correct, s.attempts)}
      </div>
      <div className="row-cell">{s.due}</div>
    </>
  );
}

/**
 * Comparativo semana atual vs semana anterior:
 *  - Questões revisadas
 *  - % acerto
 *  - Tempo investido (min)
 * Indicador ↑/↓ + delta absoluto.
 *
 * "Semana" = últimos 7 dias rolando (não calendário). Anterior = 7-14d.
 */
function SemanaSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const stats = useMemo(() => {
    const now = Date.now();
    const semana = 7 * 24 * 60 * 60 * 1000;
    const inicioAtual = now - semana;
    const inicioAnterior = now - 2 * semana;

    let curRev = 0,
      curCorrect = 0,
      curMs = 0;
    let prevRev = 0,
      prevCorrect = 0,
      prevMs = 0;

    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        const isCur = h.date >= inicioAtual && h.date < now;
        const isPrev = h.date >= inicioAnterior && h.date < inicioAtual;
        if (!isCur && !isPrev) continue;
        if (isCur) {
          curRev++;
          if (h.result === 'correct' || h.result === 'self_pass') curCorrect++;
          curMs += h.timeMs ?? 0;
        } else {
          prevRev++;
          if (h.result === 'correct' || h.result === 'self_pass') prevCorrect++;
          prevMs += h.timeMs ?? 0;
        }
      }
    }
    return {
      curRev,
      curCorrect,
      curMs,
      prevRev,
      prevCorrect,
      prevMs,
      curPct: curRev > 0 ? Math.round((curCorrect / curRev) * 100) : null,
      prevPct: prevRev > 0 ? Math.round((prevCorrect / prevRev) * 100) : null,
    };
  }, [questions]);

  if (stats.curRev === 0 && stats.prevRev === 0) return null;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>Esta semana vs anterior</h2>
      <div
        className="row gap wrap"
        style={{ marginTop: 8, fontSize: '0.95rem' }}
      >
        <SemanaMetric
          label="Revisões"
          atual={stats.curRev}
          anterior={stats.prevRev}
        />
        <SemanaMetric
          label="% Acerto"
          atual={stats.curPct}
          anterior={stats.prevPct}
          unit="%"
          higherIsBetter
        />
        <SemanaMetric
          label="Tempo (min)"
          atual={Math.round(stats.curMs / 60000)}
          anterior={Math.round(stats.prevMs / 60000)}
        />
      </div>
      <p
        className="muted"
        style={{ marginTop: 8, fontSize: '0.78rem', fontStyle: 'italic' }}
      >
        Janela rolante: últimos 7 dias vs 7-14 dias atrás.
      </p>
    </div>
  );
}

function SemanaMetric({
  label,
  atual,
  anterior,
  unit = '',
  higherIsBetter = true,
}: {
  label: string;
  atual: number | null;
  anterior: number | null;
  unit?: string;
  higherIsBetter?: boolean;
}) {
  const valid = atual !== null && anterior !== null;
  const delta = valid ? atual - anterior : null;
  const showDelta = delta !== null && anterior !== 0;
  const better =
    showDelta && (higherIsBetter ? delta > 0 : delta < 0);
  const worse = showDelta && (higherIsBetter ? delta < 0 : delta > 0);
  const arrow = !showDelta ? '' : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const cor = better
    ? 'var(--primary)'
    : worse
      ? 'var(--danger)'
      : 'var(--muted)';

  return (
    <div
      style={{
        flex: '1 1 140px',
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
      }}
    >
      <div className="muted" style={{ fontSize: '0.82rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 600, marginTop: 2 }}>
        {atual ?? '—'}
        {unit}
      </div>
      <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
        anterior: {anterior ?? '—'}
        {unit}
      </div>
      {showDelta && delta !== 0 && (
        <div
          style={{
            color: cor,
            fontSize: '0.85rem',
            fontWeight: 500,
            marginTop: 2,
          }}
        >
          {arrow} {Math.abs(delta)}
          {unit}
        </div>
      )}
    </div>
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

function HoraDoDiaSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const grid = useMemo(() => {
    // matriz [dia 0-6][hora 0-23] = qtd de revisões
    const m: number[][] = Array.from({ length: 7 }, () =>
      Array(24).fill(0)
    );
    let total = 0;
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        const d = new Date(h.date);
        m[d.getDay()][d.getHours()] += 1;
        total += 1;
      }
    }
    let max = 1;
    for (const row of m) {
      for (const c of row) if (c > max) max = c;
    }
    return { m, max, total };
  }, [questions]);

  if (grid.total === 0) return null;

  const dias = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const diasFull = [
    'Domingo',
    'Segunda',
    'Terça',
    'Quarta',
    'Quinta',
    'Sexta',
    'Sábado',
  ];

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>Quando você estuda</h2>
      <p
        className="muted"
        style={{ margin: '0 0 12px', fontSize: '0.85rem' }}
      >
        Dia da semana × hora do dia. Quanto mais escuro, mais revisões nesse
        slot.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto repeat(24, 1fr)',
          gap: 2,
          fontSize: '0.7rem',
          overflowX: 'auto',
        }}
      >
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="muted"
            style={{ textAlign: 'center', minWidth: 14 }}
          >
            {h % 6 === 0 ? h : ''}
          </div>
        ))}
        {grid.m.map((row, di) => (
          <Fragment key={di}>
            <div className="muted" style={{ paddingRight: 4 }} title={diasFull[di]}>
              {dias[di]}
            </div>
            {row.map((c, hi) => {
              const intensity = c === 0 ? 0 : 0.15 + (c / grid.max) * 0.85;
              return (
                <div
                  key={hi}
                  title={`${diasFull[di]} ${hi}h: ${c} revisões`}
                  style={{
                    aspectRatio: '1',
                    minHeight: 14,
                    background:
                      c === 0
                        ? 'var(--bg-elev-2)'
                        : `rgba(34,197,94,${intensity.toFixed(2)})`,
                    border: '1px solid var(--border)',
                    borderRadius: 2,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Predição de nota se a prova fosse hoje, baseada em:
 *   - Pra cada disciplina vinculada ao concurso, calcula a taxa de
 *     acerto histórica do user nas questões dessa disciplina.
 *   - Multiplica pela qtd_questoes_prova prevista (do vínculo).
 *   - Soma → nota estimada e %
 *
 * Confidence interval simples baseado no n de tentativas: poucas
 * amostras → faixa larga.
 */
function PredicaoNotaSection({
  questions,
  concursoId,
  allDisciplinas,
  allVinculos,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
  concursoId: string;
  allDisciplinas: Disciplina[];
  allVinculos: ConcursoDisciplina[];
}) {
  const data = useMemo(() => {
    const vinculos = allVinculos.filter((v) => v.concurso_id === concursoId);
    if (vinculos.length === 0) return null;
    const byDiscId = new Map(allDisciplinas.map((d) => [d.id, d]));

    let totalQuestoesProva = 0;
    let notaEstim = 0;
    let totalAttempts = 0;
    const linhas: Array<{
      nome: string;
      qtd: number;
      acertos: number;
      tentativas: number;
      taxa: number;
      previstos: number;
    }> = [];

    for (const v of vinculos) {
      const disc = byDiscId.get(v.disciplina_id);
      if (!disc) continue;
      const qtd = v.qtd_questoes_prova ?? 0;
      let acertos = 0;
      let tentativas = 0;
      for (const q of questions) {
        if (q.disciplina_id !== disc.nome) continue;
        for (const h of q.stats?.history ?? []) {
          tentativas++;
          if (h.result === 'correct' || h.result === 'self_pass') acertos++;
        }
      }
      const taxa = tentativas > 0 ? acertos / tentativas : 0;
      const previstos = qtd > 0 ? taxa * qtd : 0;
      totalQuestoesProva += qtd;
      notaEstim += previstos;
      totalAttempts += tentativas;
      if (qtd > 0 || tentativas > 0) {
        linhas.push({
          nome: disc.nome,
          qtd,
          acertos,
          tentativas,
          taxa,
          previstos,
        });
      }
    }

    if (totalQuestoesProva === 0) return null;
    const pct = (notaEstim / totalQuestoesProva) * 100;
    const margem =
      totalAttempts === 0
        ? 30
        : Math.max(5, Math.min(30, (1.96 / Math.sqrt(totalAttempts)) * 100));

    linhas.sort((a, b) => a.taxa - b.taxa);

    return {
      linhas,
      totalQuestoesProva,
      notaEstim,
      pct,
      margem,
      totalAttempts,
    };
  }, [questions, concursoId, allDisciplinas, allVinculos]);

  if (!data) return null;

  const corNota =
    data.pct >= 70
      ? 'var(--primary)'
      : data.pct >= 50
        ? 'var(--warn, #d97706)'
        : 'var(--danger)';

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>📊 Se a prova fosse hoje</h2>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.85rem' }}>
        Estimativa baseada na sua taxa de acerto por disciplina × quantidade
        prevista na prova. Margem cresce com poucas tentativas.
      </p>
      <div
        className="row gap"
        style={{ alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap' }}
      >
        <div>
          <div style={{ fontSize: '2.4rem', fontWeight: 600, color: corNota }}>
            {data.notaEstim.toFixed(1)}
            <span
              className="muted"
              style={{ fontSize: '1rem', marginLeft: 4, fontWeight: 400 }}
            >
              {' '}/ {data.totalQuestoesProva}
            </span>
          </div>
          <div className="muted" style={{ fontSize: '0.88rem' }}>
            ≈ <strong style={{ color: corNota }}>{data.pct.toFixed(1)}%</strong>
            {' '}(± {data.margem.toFixed(0)}%, {data.totalAttempts} tentativas)
          </div>
        </div>
      </div>
      {data.linhas.length > 0 && (
        <div style={{ fontSize: '0.85rem' }}>
          <strong>Onde focar (piores primeiro):</strong>
          <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
            {data.linhas.slice(0, 5).map((l) => (
              <div
                key={l.nome}
                className="row between"
                style={{ alignItems: 'center', gap: 8 }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.nome}
                </span>
                <span
                  className="muted"
                  style={{
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {l.tentativas > 0 ? `${(l.taxa * 100).toFixed(0)}%` : '—'}
                  {l.qtd > 0 && (
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>
                      (~{l.previstos.toFixed(1)}/{l.qtd})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cards "Dominadas" e "Quase aprendi":
 * - Dominadas: histórico recente com >=5 acertos seguidos. Reforço
 *   pra não esquecer (manter na pilha).
 * - Quase aprendi: histórico recente com 2-3 acertos seguidos
 *   precedidos por erro — em consolidação. Foco antes de prova.
 */
function AprendizadoSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const data = useMemo(() => {
    const dominadas: typeof questions = [];
    const consolidando: typeof questions = [];
    for (const q of questions) {
      const h = q.stats?.history ?? [];
      if (h.length < 2) continue;
      // Conta sequência de acertos no fim
      let streak = 0;
      for (let i = h.length - 1; i >= 0; i--) {
        const r = h[i].result;
        if (r === 'correct' || r === 'self_pass') streak++;
        else break;
      }
      if (streak >= 5) {
        dominadas.push(q);
      } else if (streak === 2 || streak === 3) {
        // Antes da streak deve ter pelo menos um erro recente
        const prev = h[h.length - 1 - streak];
        if (
          prev &&
          (prev.result === 'wrong' || prev.result === 'timeout')
        ) {
          consolidando.push(q);
        }
      }
    }
    return { dominadas, consolidando };
  }, [questions]);

  if (data.dominadas.length === 0 && data.consolidando.length === 0) return null;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>🧠 Aprendizado</h2>
      <p
        className="muted"
        style={{ margin: '0 0 14px', fontSize: '0.85rem' }}
      >
        Detecção automática baseada nas últimas respostas.
      </p>
      <div className="row gap wrap">
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontWeight: 500 }}>
            🔥 Dominadas{' '}
            <span className="muted" style={{ fontWeight: 400 }}>
              · {data.dominadas.length}
            </span>
          </div>
          <p
            className="muted"
            style={{ margin: '4px 0 0', fontSize: '0.82rem' }}
          >
            5+ acertos seguidos. Tendência de manter — só revisar quando
            o SRS sugerir.
          </p>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontWeight: 500 }}>
            🌱 Consolidando{' '}
            <span className="muted" style={{ fontWeight: 400 }}>
              · {data.consolidando.length}
            </span>
          </div>
          <p
            className="muted"
            style={{ margin: '4px 0 0', fontSize: '0.82rem' }}
          >
            2–3 acertos seguidos depois de erro. Reforçar antes de prova
            ajuda a fixar.
          </p>
          {data.consolidando.length > 0 && (
            <Link
              href={`/estudar?modo=erros&qtd=${Math.min(15, data.consolidando.length)}&auto=1`}
              style={{
                display: 'inline-block',
                marginTop: 8,
                color: 'var(--primary)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              ▶ Reforçar essas {Math.min(15, data.consolidando.length)} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Sistema de XP e níveis por disciplina — derivado puro do histórico,
 * sem schema novo. Cada acerto vale 10 XP, self_pass 8, errado 0.
 * Bonus de +2 por sequência (acerto após acerto).
 *
 * Level = floor(sqrt(xp / 25)) + 1 → cresce devagar nos altos níveis,
 * dando sensação de progresso constante sem inflacionar.
 *  - Lv 2 = 25 XP   (~3 acertos)
 *  - Lv 3 = 100 XP  (~10 acertos)
 *  - Lv 5 = 400 XP  (~40 acertos)
 *  - Lv 10 = 2025 XP
 */
function DisciplinaXPSection({
  questions,
  allDisciplinas,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
  allDisciplinas: { id: string; nome: string }[];
}) {
  const data = useMemo(() => {
    const xpByDisc = new Map<string, number>();
    for (const q of questions) {
      const d = q.disciplina_id;
      if (!d) continue;
      const h = q.stats?.history ?? [];
      let prevCorrect = false;
      let xp = 0;
      for (const e of h) {
        if (e.result === 'correct') {
          xp += prevCorrect ? 12 : 10;
          prevCorrect = true;
        } else if (e.result === 'self_pass') {
          xp += 8;
          prevCorrect = false;
        } else {
          prevCorrect = false;
        }
      }
      if (xp > 0) {
        xpByDisc.set(d, (xpByDisc.get(d) ?? 0) + xp);
      }
    }
    const discNomes = new Map<string, string>();
    for (const d of allDisciplinas) {
      discNomes.set(d.id.toLowerCase(), d.nome);
      discNomes.set(d.nome.toLowerCase(), d.nome);
    }
    const rows = Array.from(xpByDisc.entries())
      .map(([disc, xp]) => {
        const lvl = Math.floor(Math.sqrt(xp / 25)) + 1;
        const xpAtLvl = (lvl - 1) ** 2 * 25;
        const xpNextLvl = lvl ** 2 * 25;
        const intoLvl = xp - xpAtLvl;
        const lvlSpan = xpNextLvl - xpAtLvl;
        const pct = Math.min(100, Math.round((100 * intoLvl) / lvlSpan));
        const nome = discNomes.get(disc.toLowerCase()) ?? disc;
        return { disc, nome, xp, lvl, intoLvl, lvlSpan, pct };
      })
      .sort((a, b) => b.lvl - a.lvl || b.xp - a.xp);
    return rows;
  }, [questions, allDisciplinas]);

  if (data.length === 0) return null;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>⚡ Níveis por disciplina</h2>
      <p
        className="muted"
        style={{ margin: '0 0 14px', fontSize: '0.85rem' }}
      >
        Acerto = +10 XP · sequência = +12 · self-pass = +8. Sobe nível com
        prática consistente.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.slice(0, 12).map((r) => (
          <div
            key={r.disc}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: levelColor(r.lvl),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: r.lvl >= 100 ? '0.85rem' : '1.05rem',
                fontWeight: 700,
                flexShrink: 0,
                lineHeight: 1,
              }}
              title={`Nível ${r.lvl}`}
            >
              {r.lvl}
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div
                className="row between"
                style={{ alignItems: 'baseline', gap: 8, marginBottom: 4 }}
              >
                <strong
                  style={{
                    fontSize: '0.95rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={r.nome}
                >
                  {r.nome}
                </strong>
                <span className="muted" style={{ fontSize: '0.78rem' }}>
                  {r.intoLvl}/{r.lvlSpan} XP · total {r.xp}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${r.pct}%`,
                    background: levelColor(r.lvl),
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        {data.length > 12 && (
          <p className="muted" style={{ fontSize: '0.82rem', margin: '4px 0 0' }}>
            Mostrando top 12 de {data.length} disciplinas com XP.
          </p>
        )}
      </div>
    </div>
  );
}

function levelColor(lvl: number): string {
  if (lvl >= 20) return '#a855f7'; // roxo
  if (lvl >= 10) return '#f59e0b'; // âmbar
  if (lvl >= 5) return '#22c55e';  // verde
  if (lvl >= 3) return '#3b82f6';  // azul
  return '#64748b';                 // cinza azulado
}

/**
 * Curva de esquecimento (Ebbinghaus / FSRS). Usa stability média das
 * questões em consolidação como proxy: R(t) = 0.9^(t/S). Compara com
 * a curva "natural" sem revisão. Educa sobre o valor do SRS.
 *
 * S (stability) é estimada a partir do interval atual das questões com
 * pelo menos 2 acertos. Não usa ts-fsrs aqui — fórmula simplificada
 * que alinha com o request_retention=0.9 usado pelo scheduler real.
 */
function ForgettingCurveSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const data = useMemo(() => {
    const intervals: number[] = [];
    let totalRevisadas = 0;
    let dominadas = 0;
    for (const q of questions) {
      if (!q.srs?.lastReviewed) continue;
      totalRevisadas++;
      const interval = q.srs.interval ?? 0;
      if (interval > 0 && (q.srs.repetitions ?? 0) >= 2) {
        intervals.push(interval);
      }
      const h = q.stats?.history ?? [];
      if (
        h.length >= 5 &&
        h.slice(-5).every((r) => r.result === 'correct' || r.result === 'self_pass')
      ) {
        dominadas++;
      }
    }
    if (intervals.length === 0) return null;
    intervals.sort((a, b) => a - b);
    const median =
      intervals[Math.floor(intervals.length / 2)] ??
      intervals[intervals.length - 1] ??
      1;
    const avg = intervals.reduce((s, x) => s + x, 0) / intervals.length;
    const stability = Math.max(1, Math.round((median + avg) / 2));
    return { stability, totalRevisadas, dominadas, intervals };
  }, [questions]);

  if (!data) return null;

  // Retenção em vários horizons
  const horizons = [1, 3, 7, 14, 30, 60, 90];
  const retent = (t: number, S: number) => Math.pow(0.9, t / S);

  // Curva natural (Ebbinghaus): S ≈ 1 dia (sem revisão = esquece rápido)
  const natural = horizons.map((t) => Math.pow(0.9, t / 1));
  const yours = horizons.map((t) => retent(t, data.stability));

  // SVG dimensions
  const W = 320;
  const H = 140;
  const PAD = { top: 10, right: 10, bottom: 24, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xScale = (i: number) => PAD.left + (i / (horizons.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + (1 - v) * innerH;

  const polylineFor = (values: number[]) =>
    values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>📉 Curva de retenção</h2>
      <p
        className="muted"
        style={{ margin: '0 0 12px', fontSize: '0.85rem' }}
      >
        Probabilidade de você ainda lembrar uma questão em função do
        tempo desde a última revisão. Sua stability média:{' '}
        <strong>{data.stability} dia(s)</strong> · {data.intervals.length}{' '}
        questões consolidadas.
      </p>

      <div
        style={{
          background: 'var(--bg-elev-2)',
          borderRadius: 'var(--radius)',
          padding: 12,
          overflow: 'auto',
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          style={{ maxWidth: 480, display: 'block', margin: '0 auto' }}
          role="img"
          aria-label="Curva de retenção"
        >
          {/* Grid Y (0%, 50%, 90%, 100%) */}
          {[0, 0.5, 0.9, 1].map((y) => (
            <g key={y}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yScale(y)}
                y2={yScale(y)}
                stroke="var(--border)"
                strokeDasharray={y === 0.9 ? '0' : '2 3'}
                strokeWidth={y === 0.9 ? 1.5 : 1}
                opacity={y === 0.9 ? 0.6 : 0.35}
              />
              <text
                x={PAD.left - 4}
                y={yScale(y) + 3}
                fontSize="9"
                fill="var(--muted)"
                textAnchor="end"
              >
                {Math.round(y * 100)}%
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {horizons.map((t, i) => (
            <text
              key={t}
              x={xScale(i)}
              y={H - PAD.bottom + 14}
              fontSize="9"
              fill="var(--muted)"
              textAnchor="middle"
            >
              {t}d
            </text>
          ))}

          {/* Curva natural (esquecimento sem revisão) */}
          <polyline
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="3 3"
            points={polylineFor(natural)}
            opacity="0.7"
          />

          {/* Sua curva (com SRS) */}
          <polyline
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            points={polylineFor(yours)}
          />

          {/* Pontos */}
          {yours.map((v, i) => (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(v)}
              r="3"
              fill="var(--primary)"
            />
          ))}
        </svg>

        {/* Legenda */}
        <div
          className="row gap"
          style={{
            justifyContent: 'center',
            marginTop: 10,
            fontSize: '0.78rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--primary)' }}>
            ━ Você (S={data.stability}d)
          </span>
          <span style={{ color: '#ef4444' }}>━ ━ Sem revisão (Ebbinghaus)</span>
        </div>
      </div>

      <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
        Em <strong>{data.stability * 7}d</strong>, você ainda deve lembrar
        ~{Math.round(retent(data.stability * 7, data.stability) * 100)}% das
        questões consolidadas (sem revisar). Em <strong>30d</strong> sem
        revisar nada, retenção cai pra ~
        {Math.round(retent(30, data.stability) * 100)}%. SRS evita essa
        queda agendando revisões antes de você esquecer.
      </p>
    </div>
  );
}

/**
 * Carga de revisões agendadas nos próximos 30 dias. Ajuda planejar:
 * dias com pico ficam visíveis em vermelho. Inclui "atrasadas" no
 * dia 0 (se houver).
 */
function CargaProximaSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const data = useMemo(() => {
    const now = Date.now();
    const today = startOfDay(now);
    const days: { date: number; count: number; isOverdue?: boolean }[] = [];
    let atrasadas = 0;
    for (let i = 0; i < 30; i++) {
      days.push({ date: today + i * DAY_MS, count: 0 });
    }
    for (const q of questions) {
      const due = q.srs?.dueDate ?? 0;
      if (!due) continue;
      if (due < today) {
        atrasadas++;
        continue;
      }
      const dayIdx = Math.floor((startOfDay(due) - today) / DAY_MS);
      if (dayIdx >= 0 && dayIdx < days.length) days[dayIdx].count++;
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    return { days, atrasadas, max };
  }, [questions]);

  if (data.days.every((d) => d.count === 0) && data.atrasadas === 0) {
    return null;
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>📅 Carga próxima (30 dias)</h2>
      <p
        className="muted"
        style={{ margin: '0 0 12px', fontSize: '0.85rem' }}
      >
        Quantas revisões estão agendadas pra cada dia. Picos altos
        valem antecipar parte pra equilibrar.
      </p>
      {data.atrasadas > 0 && (
        <div
          style={{
            marginBottom: 10,
            padding: '6px 10px',
            background: 'var(--danger-soft, #4a1d1d)',
            border: '1px solid var(--danger, #ef4444)',
            borderRadius: 'var(--radius)',
            fontSize: '0.88rem',
          }}
        >
          🔴 <strong>{data.atrasadas}</strong> atrasada(s) — vence(ram)
          antes de hoje.
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(30, 1fr)',
          gap: 2,
          alignItems: 'end',
        }}
      >
        {data.days.map((d, i) => {
          const intensity = d.count === 0 ? 0 : 0.2 + (d.count / data.max) * 0.8;
          const day = new Date(d.date);
          const dayLabel = `${day.getDate()}/${day.getMonth() + 1}`;
          const heightPct = d.count === 0 ? 0 : (d.count / data.max) * 100;
          const cor =
            d.count > data.max * 0.66
              ? '#ef4444'
              : d.count > data.max * 0.33
                ? '#f59e0b'
                : '#22c55e';
          return (
            <div
              key={i}
              title={`${dayLabel}: ${d.count} revisão(ões)`}
              style={{
                height: 60,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap: 2,
              }}
            >
              <div
                style={{
                  height: `${heightPct}%`,
                  background: `${cor}${Math.round(intensity * 255)
                    .toString(16)
                    .padStart(2, '0')}`,
                  border: d.count > 0 ? `1px solid ${cor}` : 'none',
                  borderRadius: 2,
                  minHeight: d.count > 0 ? 3 : 0,
                }}
              />
              {(i === 0 || (i + 1) % 7 === 0) && (
                <div
                  style={{
                    fontSize: '0.6rem',
                    color: 'var(--muted)',
                    textAlign: 'center',
                  }}
                >
                  {dayLabel}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Menu de export CSV. Mostra dropdown com 3 opções: questões agregadas,
 * disciplinas agregadas, e histórico cru de revisões.
 */
/**
 * Heatmap 7 (dias da semana) × 24 (horas). Identifica padrão pessoal
 * — "estudo melhor à noite", "fins de semana são mais produtivos", etc.
 * Intensidade da cor proporcional à média do slot (max=verde forte).
 */
function HourWeekdayHeatmapSection({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const matrix = useMemo(() => {
    // 7 dias × 24 horas = 168 slots
    const m: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => 0)
    );
    let total = 0;
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        const d = new Date(h.date);
        const dow = d.getDay(); // 0 = domingo
        const hr = d.getHours();
        m[dow][hr]++;
        total++;
      }
    }
    if (total === 0) return null;
    let max = 0;
    for (const row of m) for (const v of row) if (v > max) max = v;
    return { m, max, total };
  }, [questions]);

  if (!matrix) return null;

  const dotw = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>🗓 Padrão por hora × dia</h2>
      <p
        className="muted"
        style={{ margin: '0 0 14px', fontSize: '0.85rem' }}
      >
        Intensidade do verde proporcional ao volume de revisões em cada
        slot. Identifica seu horário mais produtivo.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 2,
            fontSize: '0.7rem',
          }}
        >
          <thead>
            <tr>
              <th style={{ padding: '0 4px' }}></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th
                  key={h}
                  style={{
                    color: 'var(--muted)',
                    fontWeight: 400,
                    padding: 0,
                    minWidth: 14,
                    textAlign: 'center',
                  }}
                >
                  {h % 3 === 0 ? h : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.m.map((row, dow) => (
              <tr key={dow}>
                <th
                  style={{
                    color: 'var(--muted)',
                    fontWeight: 500,
                    paddingRight: 6,
                    fontSize: '0.74rem',
                    textAlign: 'right',
                  }}
                >
                  {dotw[dow]}
                </th>
                {row.map((v, h) => {
                  const intensity = v / matrix.max;
                  const bg =
                    v === 0
                      ? 'var(--bg-elev-2)'
                      : `rgba(34, 197, 94, ${0.15 + intensity * 0.7})`;
                  return (
                    <td
                      key={h}
                      title={
                        v === 0
                          ? `${dotw[dow]} ${h}h: sem revisões`
                          : `${dotw[dow]} ${h}h-${h + 1}h: ${v} revisão(ões)`
                      }
                      style={{
                        width: 14,
                        height: 14,
                        background: bg,
                        borderRadius: 2,
                        padding: 0,
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.78rem' }}>
        Total: {matrix.total} revisão(ões) analisada(s).
      </p>
    </div>
  );
}

function ExportICSButton({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const onClick = async () => {
    const { generateRevisionICS, downloadICS } = await import(
      '@/lib/ics-export'
    );
    const ics = generateRevisionICS(questions, 30);
    downloadICS(
      ics,
      `estudo-simples-revisoes-${new Date().toISOString().slice(0, 10)}.ics`
    );
  };
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      title="Exportar agenda de revisões dos próximos 30 dias (.ics — Google Calendar, Outlook, Apple)"
    >
      📅 Exportar agenda (.ics)
    </button>
  );
}

function ExportAnkiButton({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const onClick = async () => {
    const { questionsToAnkiCsv, downloadAnkiCsv } = await import(
      '@/lib/anki-export'
    );
    const csv = questionsToAnkiCsv(questions);
    downloadAnkiCsv(
      csv,
      `estudo-simples-anki-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      title="Exportar como CSV no formato Anki (Front, Back, Tags). Importável no Anki Desktop e Anki Mobile."
    >
      🃏 Exportar pro Anki
    </button>
  );
}

function ExportWeeklyReportButton({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const onClick = async () => {
    const { generateWeeklyReport, downloadWeeklyReport } = await import(
      '@/lib/weekly-report'
    );
    const md = generateWeeklyReport(questions);
    downloadWeeklyReport(md);
  };
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      title="Exportar relatório markdown da última semana com top stats e recomendações"
    >
      📝 Relatório semanal (.md)
    </button>
  );
}

function ExportCSVMenu({
  questions,
}: {
  questions: ReturnType<typeof selectActiveQuestions>;
}) {
  const [open, setOpen] = useState(false);
  if (questions.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const exportQuestoes = () => {
    const csv = buildQuestionsCSV(questions);
    downloadFile(csv, `estudo-simples-questoes-${today}.csv`);
    toast(`${questions.length} questão(ões) exportadas em CSV`, 'success');
    setOpen(false);
  };
  const exportDisciplinas = () => {
    const csv = buildDisciplinasCSV(questions);
    downloadFile(csv, `estudo-simples-disciplinas-${today}.csv`);
    toast('Disciplinas exportadas em CSV', 'success');
    setOpen(false);
  };
  const exportHistorico = () => {
    const csv = buildHistoryCSV(questions);
    downloadFile(csv, `estudo-simples-historico-${today}.csv`);
    toast('Histórico exportado em CSV', 'success');
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Exportar dados em CSV"
      >
        📥 Exportar CSV
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: 'var(--bg-elev)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 4,
              zIndex: 51,
              minWidth: 220,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            <button
              type="button"
              onClick={exportQuestoes}
              className="ghost"
              style={{ display: 'block', width: '100%', textAlign: 'left' }}
            >
              📄 Questões agregadas
            </button>
            <button
              type="button"
              onClick={exportDisciplinas}
              className="ghost"
              style={{ display: 'block', width: '100%', textAlign: 'left' }}
            >
              📚 Disciplinas agregadas
            </button>
            <button
              type="button"
              onClick={exportHistorico}
              className="ghost"
              style={{ display: 'block', width: '100%', textAlign: 'left' }}
            >
              📜 Histórico cru de revisões
            </button>
          </div>
        </>
      )}
    </div>
  );
}
