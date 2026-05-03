'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  selectActiveQuestions,
  selectDisciplinas,
  updateQuestionLocal,
  useStore,
} from '@/lib/store';
import { applyReview } from '@/lib/srs-fsrs';
import { useAlgorithm } from '@/lib/settings';
import { scheduleSync } from '@/lib/sync';
import {
  filterDisciplinaIdsByActiveConcurso,
  matchActiveConcurso,
  useActiveConcursoFilter,
} from '@/lib/hierarchy';
import { interleaveByGroup, renderRichText, shuffle } from '@/lib/utils';
import { QuestionImages } from './QuestionImages';
import type {
  DiscSessionConfig,
  DiscursivaPayload,
  Question,
  Quesito,
  RubricaItem,
} from '@/lib/types';

type Phase = 'config' | 'running' | 'summary';

const defaultCfg: DiscSessionConfig = { disciplinas: [], qtd: 3, modo: 'srs' };

function buildPool(all: Question[], cfg: DiscSessionConfig): Question[] {
  let pool = all.filter((q) => q.type === 'discursiva');
  if (cfg.disciplinas.length) {
    const set = new Set(cfg.disciplinas);
    pool = pool.filter((q) => q.disciplina_id && set.has(q.disciplina_id));
  }
  if (cfg.modo === 'novas') pool = pool.filter((q) => !q.srs?.lastReviewed);
  if (cfg.modo === 'aleatorio') pool = shuffle(pool);
  else if (cfg.modo === 'srs') {
    pool = pool.slice().sort((a, b) => (a.srs?.dueDate ?? 0) - (b.srs?.dueDate ?? 0));
  } else {
    pool = shuffle(pool);
  }
  const truncated = pool.slice(0, Math.max(1, cfg.qtd));
  if (cfg.interleaving) {
    return interleaveByGroup(truncated, (q) => q.disciplina_id ?? '(sem)');
  }
  return truncated;
}

export function DiscursivaRunner() {
  const allRaw = useStore(selectActiveQuestions);
  const disciplinasRaw = useStore(selectDisciplinas);
  const { disciplinaNomes: concursoDiscNomes } = useActiveConcursoFilter();

  const all = useMemo(
    () =>
      concursoDiscNomes === null
        ? allRaw
        : allRaw.filter((q) =>
            matchActiveConcurso(q.disciplina_id, concursoDiscNomes)
          ),
    [allRaw, concursoDiscNomes]
  );
  const disciplinas = useMemo(
    () => filterDisciplinaIdsByActiveConcurso(disciplinasRaw, concursoDiscNomes),
    [disciplinasRaw, concursoDiscNomes]
  );

  const [phase, setPhase] = useState<Phase>('config');
  const [cfg, setCfg] = useState<DiscSessionConfig>(defaultCfg);
  const [pool, setPool] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);

  const discCount = useMemo(() => all.filter((q) => q.type === 'discursiva').length, [all]);

  const start = () => {
    const p = buildPool(all, cfg);
    if (!p.length) return;
    setPool(p);
    setIdx(0);
    setPhase('running');
  };

  const next = () => {
    if (idx + 1 >= pool.length) setPhase('summary');
    else setIdx(idx + 1);
  };

  if (phase === 'running' && pool[idx]) {
    return (
      <DiscRunningView
        q={pool[idx]}
        idx={idx}
        total={pool.length}
        onNext={next}
        onQuit={() => {
          setPhase('config');
          setPool([]);
        }}
      />
    );
  }
  if (phase === 'summary') {
    return (
      <div className="card">
        <h2>Sessão de discursivas concluída</h2>
        <p>
          Você revisou <strong>{pool.length}</strong> discursiva(s).
        </p>
        <div className="row gap">
          <button
            type="button"
            className="primary"
            onClick={() => {
              setPool([]);
              setPhase('config');
            }}
          >
            Nova sessão
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Praticar discursivas</h2>
      <div className="form-grid">
        <label>
          <span>Disciplinas</span>
          <select
            multiple
            size={5}
            value={cfg.disciplinas}
            onChange={(e) =>
              setCfg({
                ...cfg,
                disciplinas: Array.from(e.target.selectedOptions).map((o) => o.value),
              })
            }
          >
            {disciplinas.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <small>Vazio = todas.</small>
        </label>
        <label>
          <span>Quantidade</span>
          <input
            type="number"
            min={1}
            max={50}
            value={cfg.qtd}
            onChange={(e) => setCfg({ ...cfg, qtd: parseInt(e.target.value) || 1 })}
          />
        </label>
        <label>
          <span>Modo</span>
          <select
            value={cfg.modo}
            onChange={(e) =>
              setCfg({ ...cfg, modo: e.target.value as DiscSessionConfig['modo'] })
            }
          >
            <option value="srs">Repetição espaçada</option>
            <option value="aleatorio">Aleatório</option>
            <option value="novas">Só novas</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={!!cfg.interleaving}
            onChange={(e) =>
              setCfg({ ...cfg, interleaving: e.target.checked })
            }
          />
          <span title="Distribui disciplinas pelo pool em vez de blocos.">
            Intercalar disciplinas (interleaving)
          </span>
        </label>
      </div>
      <div className="row gap">
        <button type="button" className="primary" disabled={discCount === 0} onClick={start}>
          Iniciar
        </button>
        <span className="muted">{discCount} discursiva(s) no banco</span>
      </div>
    </div>
  );
}

function DiscRunningView({
  q,
  idx,
  total,
  onNext,
  onQuit,
}: {
  q: Question;
  idx: number;
  total: number;
  onNext: () => void;
  onQuit: () => void;
}) {
  const algorithm = useAlgorithm();
  const payload = q.payload as DiscursivaPayload;
  const enun =
    payload.enunciado_completo ||
    payload.enunciado ||
    [payload.texto_base, payload.comando].filter(Boolean).join('\n\n');

  const [resposta, setResposta] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [grades, setGrades] = useState<Record<number, number>>({});
  const [rated, setRated] = useState(false);

  // resetar ao trocar de questão
  useEffect(() => {
    setResposta('');
    setRevealed(false);
    setGrades({});
    setRated(false);
  }, [q.id]);

  const quesitos: Quesito[] = useMemo(() => {
    if (Array.isArray(payload.quesitos) && payload.quesitos.length) return payload.quesitos;
    if (Array.isArray(payload.rubrica)) {
      return payload.rubrica.map((r: RubricaItem, i: number) => ({
        numero: i + 1,
        pergunta: r.criterio,
        pontos_max: r.pontos,
      }));
    }
    return [];
  }, [payload]);

  // Inicializa grades em 70% do máximo (heurística)
  useEffect(() => {
    if (!revealed) return;
    const init: Record<number, number> = {};
    quesitos.forEach((qi, i) => {
      const max = Number(qi.pontos_max) || 10;
      init[i] = Math.round(max * 0.7 * 2) / 2;
    });
    setGrades(init);
    // Conta como tentativa quando o usuário reveleia
    updateQuestionLocal(q.id, (cur) => ({
      stats: {
        ...cur.stats,
        attempts: (cur.stats?.attempts || 0) + 1,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const totals = useMemo(() => {
    let sum = 0;
    let max = 0;
    quesitos.forEach((qi, i) => {
      const m = Number(qi.pontos_max) || 10;
      max += m;
      sum += grades[i] ?? 0;
    });
    return { sum, max, pct: max === 0 ? 0 : sum / max };
  }, [grades, quesitos]);

  const rate = (quality: number) => {
    if (rated) return;
    setRated(true);
    const card: { srs: typeof q.srs } = { srs: { ...q.srs } };
    applyReview(card, quality, algorithm);
    const newHistory = [
      ...(q.stats?.history || []).slice(-49),
      {
        date: Date.now(),
        result: quality >= 3 ? ('self_pass' as const) : ('self_fail' as const),
        quality,
        selfScore: totals.sum,
        selfMax: totals.max,
      },
    ];
    updateQuestionLocal(q.id, (cur) => ({
      srs: card.srs,
      stats: {
        ...cur.stats,
        correct: (cur.stats?.correct || 0) + (quality >= 3 ? 1 : 0),
        wrong: (cur.stats?.wrong || 0) + (quality >= 3 ? 0 : 1),
        history: newHistory,
      },
    }));
    scheduleSync(800);
  };

  return (
    <div className="card">
      <div className="session-bar">
        <div className="session-progress">
          {idx + 1}/{total}
        </div>
        <button type="button" className="ghost" onClick={onQuit}>
          Encerrar
        </button>
      </div>

      <article className="question-area">
        <div className="meta-line">
          {q.disciplina_id && <span>{q.disciplina_id}</span>}
          {q.tema && <span>{q.tema}</span>}
          {q.banca_estilo && <span>{q.banca_estilo}</span>}
          {payload.tipo_discursiva && <span>tipo {payload.tipo_discursiva}</span>}
          {q.dificuldade != null && <span>dif {q.dificuldade}</span>}
        </div>

        <div
          className="enunciado"
          dangerouslySetInnerHTML={{ __html: renderRichText(enun) }}
        />

        <QuestionImages urls={payload.imagens} />

        {quesitos.length > 0 && !revealed && (
          <div>
            <h3>Quesitos</h3>
            {quesitos.map((qi, i) => (
              <div key={i} className="disc-quesito">
                <span className="quesito-num">{qi.numero ?? i + 1}</span>
                {qi.pergunta || qi.criterio || ''}{' '}
                <em className="muted">({qi.pontos_max ?? '—'} pts)</em>
              </div>
            ))}
          </div>
        )}

        {!revealed && (
          <>
            <h3 style={{ marginTop: 16 }}>Sua resposta</h3>
            <textarea
              className="disc-textarea"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Escreva sua resposta aqui antes de revelar o espelho. O ato de tentar lembrar — mesmo errando — fortalece a memorização (active recall)."
            />
            <div className="row gap">
              <button type="button" className="primary" onClick={() => setRevealed(true)}>
                Revelar espelho e rubrica
              </button>
            </div>
          </>
        )}

        {revealed && (
          <DiscReveal
            payload={payload}
            quesitos={quesitos}
            grades={grades}
            setGrades={setGrades}
            totals={totals}
            rated={rated}
            rate={rate}
            onNext={onNext}
          />
        )}
      </article>
    </div>
  );
}

function DiscReveal({
  payload,
  quesitos,
  grades,
  setGrades,
  totals,
  rated,
  rate,
  onNext,
}: {
  payload: DiscursivaPayload;
  quesitos: Quesito[];
  grades: Record<number, number>;
  setGrades: (g: Record<number, number>) => void;
  totals: { sum: number; max: number; pct: number };
  rated: boolean;
  rate: (q: number) => void;
  onNext: () => void;
}) {
  return (
    <div>
      {payload.notes_user && (
        <div
          style={{
            background: 'var(--primary-soft)',
            borderLeft: '3px solid var(--primary)',
            paddingLeft: 12,
            paddingTop: 8,
            paddingBottom: 8,
            marginBottom: 14,
            borderRadius: '0 var(--radius) var(--radius) 0',
          }}
        >
          <strong>Suas anotações:</strong>
          <div
            style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{
              __html: renderRichText(payload.notes_user),
            }}
          />
        </div>
      )}

      {payload.espelho_resposta && (
        <>
          <h3>Espelho de resposta</h3>
          <div
            className="espelho-block"
            dangerouslySetInnerHTML={{ __html: renderRichText(payload.espelho_resposta) }}
          />
        </>
      )}

      {Array.isArray(payload.rubrica) && payload.rubrica.length > 0 && (
        <>
          <h3>Rubrica de correção</h3>
          {payload.rubrica.map((r, i) => (
            <div key={i} className="disc-quesito">
              <strong>{r.criterio}</strong> <em className="muted">({r.pontos} pts)</em>
              {r.detalhamento && (
                <div
                  style={{ marginTop: 6 }}
                  dangerouslySetInnerHTML={{ __html: renderRichText(r.detalhamento) }}
                />
              )}
            </div>
          ))}
        </>
      )}

      {Array.isArray(payload.conceitos_chave) && payload.conceitos_chave.length > 0 && (
        <>
          <h3>Conceitos-chave</h3>
          <ul>
            {payload.conceitos_chave.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      )}

      {Array.isArray(payload.pegadinhas_esperadas) && payload.pegadinhas_esperadas.length > 0 && (
        <>
          <h3>Pegadinhas esperadas</h3>
          <ul>
            {payload.pegadinhas_esperadas.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      )}

      {payload.estrategia_redacao && (
        <>
          <h3>Estratégia de redação</h3>
          <div
            className="espelho-block warn"
            dangerouslySetInnerHTML={{ __html: renderRichText(payload.estrategia_redacao) }}
          />
        </>
      )}

      {payload.observacoes_corretor && (
        <>
          <h3>Observações do corretor</h3>
          <div
            className="espelho-block"
            dangerouslySetInnerHTML={{ __html: renderRichText(payload.observacoes_corretor) }}
          />
        </>
      )}

      {quesitos.length > 0 && (
        <>
          <h3>Sua autoavaliação</h3>
          {quesitos.map((qi, i) => {
            const max = Number(qi.pontos_max) || 10;
            return (
              <div key={i} className="disc-quesito">
                <span className="quesito-num">{qi.numero ?? i + 1}</span>
                {qi.pergunta || qi.criterio || ''}{' '}
                <em className="muted">(máx {max})</em>
                <div className="disc-self-grade">
                  <input
                    type="range"
                    min={0}
                    max={max}
                    step={0.5}
                    value={grades[i] ?? 0}
                    onChange={(e) =>
                      setGrades({ ...grades, [i]: parseFloat(e.target.value) })
                    }
                    disabled={rated}
                  />
                  <span className="grade-value">
                    {(grades[i] ?? 0).toFixed(1)} / {max}
                  </span>
                </div>
              </div>
            );
          })}
          <div className="disc-totals">
            Total: <strong>{totals.sum.toFixed(1)} / {totals.max.toFixed(1)}</strong> ({Math.round(totals.pct * 100)}%)
          </div>
        </>
      )}

      <p className="muted center">
        {rated ? 'Avaliação registrada. Próxima revisão agendada.' : 'Como foi essa questão?'}
      </p>
      <div className="row gap center wrap">
        <button type="button" className="rate again" disabled={rated} onClick={() => rate(0)}>
          De novo
        </button>
        <button type="button" className="rate hard" disabled={rated} onClick={() => rate(3)}>
          Difícil
        </button>
        <button type="button" className="rate good" disabled={rated} onClick={() => rate(4)}>
          Bom
        </button>
        <button type="button" className="rate easy" disabled={rated} onClick={() => rate(5)}>
          Fácil
        </button>
      </div>

      {rated && (
        <div className="row gap right" style={{ marginTop: 16 }}>
          <button type="button" className="primary" onClick={onNext}>
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
