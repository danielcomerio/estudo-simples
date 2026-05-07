'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { clearSession, readSession, saveSession } from '@/lib/session-store';
import { appendSession } from '@/lib/sessions-log';
import { loadPrefs, savePrefs } from '@/lib/session-prefs';
import { QuestionImages } from './QuestionImages';
import { GabaritoSourceBadge } from './GabaritoSourceBadge';
import { useSwipe } from '@/lib/use-swipe';
import { UndoChip } from './UndoChip';
import { acquireWakeLock } from '@/lib/wake-lock';
import { VoiceSearchButton } from './VoiceSearchButton';
import { AudioRecorder } from './AudioRecorder';
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
  const userId = useStore((s) => s.userId);
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
  const [cfg, setCfgRaw] = useState<DiscSessionConfig>(defaultCfg);
  useEffect(() => {
    const saved = loadPrefs<Partial<DiscSessionConfig>>('discursivas');
    if (saved) setCfgRaw((c) => ({ ...c, ...saved, disciplinas: [] }));
  }, []);

  // Wake Lock — discursivas requerem leitura longa, tela apagar é pior aqui
  useEffect(() => {
    if (phase !== 'running') return;
    const lock = acquireWakeLock();
    return () => lock.release();
  }, [phase]);
  const setCfg = (
    next: DiscSessionConfig | ((p: DiscSessionConfig) => DiscSessionConfig)
  ) => {
    setCfgRaw((prev) => {
      const resolved =
        typeof next === 'function'
          ? (next as (p: DiscSessionConfig) => DiscSessionConfig)(prev)
          : next;
      const { disciplinas: _d, ...rest } = resolved;
      savePrefs('discursivas', rest);
      return resolved;
    });
  };
  const [pool, setPool] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const sessionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (phase !== 'running') return;
    const onBU = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBU);
    return () => window.removeEventListener('beforeunload', onBU);
  }, [phase]);

  // Pausar/resumir sessão de discursivas
  const [pausedAvailable, setPausedAvailable] = useState<{
    pool: Question[];
    idx: number;
  } | null>(null);
  useEffect(() => {
    if (!userId || phase !== 'config') return;
    const stored = readSession(userId, 'discursivas');
    if (!stored) return;
    const restored = stored.poolIds
      .map((id) => allRaw.find((q) => q.id === id && q.type === 'discursiva'))
      .filter((q): q is Question => !!q);
    if (restored.length === 0 || stored.idx >= restored.length) {
      clearSession('discursivas');
      return;
    }
    setPausedAvailable({ pool: restored, idx: stored.idx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, allRaw.length]);

  useEffect(() => {
    if (!userId || phase !== 'running' || pool.length === 0) return;
    saveSession(
      {
        userId,
        poolIds: pool.map((q) => q.id),
        idx,
        embaralhar: false,
        tempoLimite: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        startedAt: Date.now(),
      },
      'discursivas'
    );
  }, [userId, phase, pool, idx]);

  const resumePausedDisc = () => {
    if (!pausedAvailable) return;
    setPool(pausedAvailable.pool);
    setIdx(pausedAvailable.idx);
    setPausedAvailable(null);
    setPhase('running');
  };
  const discardPausedDisc = () => {
    setPausedAvailable(null);
    clearSession('discursivas');
  };

  const discCount = useMemo(() => all.filter((q) => q.type === 'discursiva').length, [all]);

  const start = () => {
    const p = buildPool(all, cfg);
    if (!p.length) return;
    setPool(p);
    setIdx(0);
    sessionStartRef.current = Date.now();
    setPhase('running');
  };

  const next = () => {
    if (idx + 1 >= pool.length) {
      appendSession({
        kind: 'discursivas',
        startedAt: sessionStartRef.current,
        endedAt: Date.now(),
        total: pool.length,
        correct: 0,
        wrong: 0,
        durationMs: Date.now() - sessionStartRef.current,
      });
      clearSession('discursivas');
      setPhase('summary');
    } else setIdx(idx + 1);
  };

  if (phase === 'running' && pool[idx]) {
    return (
      <DiscRunningView
        q={pool[idx]}
        idx={idx}
        total={pool.length}
        onNext={next}
        onQuit={() => {
          clearSession('discursivas');
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
      {pausedAvailable && (
        <div
          role="status"
          style={{
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius)',
            padding: '12px 14px',
            marginBottom: 14,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            ⏸ Sessão pausada: <strong>{pausedAvailable.idx}</strong> de{' '}
            <strong>{pausedAvailable.pool.length}</strong> discursivas
          </div>
          <div className="row gap">
            <button type="button" className="primary" onClick={resumePausedDisc}>
              ▶ Continuar
            </button>
            <button type="button" className="ghost" onClick={discardPausedDisc}>
              Descartar
            </button>
          </div>
        </div>
      )}

      <h2>Praticar discursivas</h2>

      {discCount === 0 && (
        <div
          className="card"
          style={{
            background: 'var(--bg-elev-2)',
            border: '1px dashed var(--border)',
            textAlign: 'center',
            padding: 24,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>✍️</div>
          <strong>Sem questões discursivas</strong>
          <p
            className="muted"
            style={{ margin: '6px 0 12px', fontSize: '0.9rem' }}
          >
            Importe um JSON com type=discursiva (com espelho/rubrica) em{' '}
            <code>/banco</code>.
          </p>
          <Link href="/banco">
            <button type="button" className="primary">
              Ir para o banco
            </button>
          </Link>
        </div>
      )}

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
  const { concurso: activeConcurso } = useActiveConcursoFilter();
  const examDateMs = useMemo(() => {
    if (!activeConcurso?.data_prova) return null;
    const t = new Date(activeConcurso.data_prova).getTime();
    return Number.isNaN(t) ? null : t;
  }, [activeConcurso?.data_prova]);
  const payload = q.payload as DiscursivaPayload;
  const enun =
    payload.enunciado_completo ||
    payload.enunciado ||
    [payload.texto_base, payload.comando].filter(Boolean).join('\n\n');

  const [resposta, setResposta] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [grades, setGrades] = useState<Record<number, number>>({});
  const [rated, setRated] = useState(false);
  // Snapshot pra undo da última rate. Mantido por 6s.
  const [undoSnap, setUndoSnap] = useState<{
    qid: string;
    prevSrs: typeof q.srs;
    prevStats: typeof q.stats;
    prevRated: boolean;
  } | null>(null);

  // resetar ao trocar de questão; restaurar draft local se houver
  useEffect(() => {
    let draft = '';
    try {
      draft = localStorage.getItem(`disc-draft:${q.id}`) ?? '';
    } catch {
      // ignora — privacidade/quota
    }
    setResposta(draft);
    setRevealed(false);
    setGrades({});
    setRated(false);
  }, [q.id]);

  // auto-save da resposta enquanto o usuário digita (debounce 300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (resposta.trim()) localStorage.setItem(`disc-draft:${q.id}`, resposta);
        else localStorage.removeItem(`disc-draft:${q.id}`);
      } catch {
        // quota cheia ou storage indisponível — ignora silenciosamente
      }
    }, 300);
    return () => clearTimeout(t);
  }, [resposta, q.id]);

  // limpa draft após avaliar
  useEffect(() => {
    if (rated) {
      try {
        localStorage.removeItem(`disc-draft:${q.id}`);
      } catch {
        // ignora
      }
    }
  }, [rated, q.id]);

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

  // Swipe ← próxima — só após avaliar (senão pode descartar resposta digitada)
  useSwipe({
    enabled: rated,
    onLeft: onNext,
  });

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
    // Captura snapshot ANTES de aplicar — pra undoLastRate restaurar.
    const snap = {
      qid: q.id,
      prevSrs: { ...q.srs },
      prevStats: { ...q.stats },
      prevRated: rated,
    };
    setRated(true);
    const card: { srs: typeof q.srs } = { srs: { ...q.srs } };
    applyReview(card, quality, algorithm, examDateMs);
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
    setUndoSnap(snap);
  };

  const undoLastRate = () => {
    if (!undoSnap) return;
    updateQuestionLocal(undoSnap.qid, {
      srs: undoSnap.prevSrs,
      stats: undoSnap.prevStats,
    });
    setRated(undoSnap.prevRated);
    setUndoSnap(null);
    scheduleSync(800);
  };

  // Atalho Z desfaz
  useEffect(() => {
    if (!undoSnap) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        undoLastRate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoSnap]);

  const progressPct = Math.round(((idx + (rated ? 1 : 0)) / total) * 100);

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

      <div className="session-progress-bar" style={{ marginBottom: 12 }}>
        <div className="fill" style={{ width: progressPct + '%' }} />
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
            <div
              className="row between"
              style={{ marginTop: 16, alignItems: 'center', flexWrap: 'wrap', gap: 6 }}
            >
              <h3 style={{ margin: 0 }}>Sua resposta</h3>
              <VoiceSearchButton
                onTranscript={(t) =>
                  setResposta((prev) => (prev ? `${prev} ${t}` : t))
                }
              />
            </div>
            <textarea
              className="disc-textarea"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Escreva sua resposta aqui antes de revelar o espelho. Ou use 🎤 pra ditar. O ato de tentar lembrar — mesmo errando — fortalece a memorização (active recall)."
            />
            <AudioRecorder />
            <div className="row gap" style={{ marginTop: 12 }}>
              <button type="button" className="primary" onClick={() => setRevealed(true)}>
                Revelar espelho e rubrica
              </button>
            </div>
          </>
        )}

        {revealed && (
          <DiscReveal
            q={q}
            algorithm={algorithm}
            examDateMs={examDateMs}
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
      {undoSnap && (
        <UndoChip
          onUndo={undoLastRate}
          onDismiss={() => setUndoSnap(null)}
        />
      )}
    </div>
  );
}

function DiscReveal({
  q,
  algorithm,
  examDateMs,
  payload,
  quesitos,
  grades,
  setGrades,
  totals,
  rated,
  rate,
  onNext,
}: {
  q: Question;
  algorithm: 'sm2' | 'fsrs';
  examDateMs: number | null;
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
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Espelho de resposta
            {q.fonte?.gabarito_source && (
              <GabaritoSourceBadge source={q.fonte.gabarito_source} size="small" />
            )}
          </h3>
          {q.fonte?.gabarito_source === 'ia' && (
            <p className="muted" style={{ fontSize: '0.82rem', marginTop: -6 }}>
              ⚠ Espelho gerado por IA — valide contra fonte oficial antes
              de adotar como gabarito.
            </p>
          )}
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
      {(() => {
        const preview = (quality: number) => {
          const card = { srs: { ...q.srs } };
          applyReview(card, quality, algorithm, examDateMs);
          const due = card.srs?.dueDate ?? Date.now();
          const dDays = Math.max(0, Math.round((due - Date.now()) / 86400000));
          if (dDays < 1) return '<1d';
          if (dDays === 1) return '1d';
          if (dDays < 30) return `${dDays}d`;
          if (dDays < 365) return `${Math.round(dDays / 30)}mo`;
          return `${Math.round(dDays / 365)}a`;
        };
        return (
          <div className="row gap center wrap">
            <button type="button" className="rate again" disabled={rated} onClick={() => rate(0)}>
              De novo<small>{preview(0)}</small>
            </button>
            <button type="button" className="rate hard" disabled={rated} onClick={() => rate(3)}>
              Difícil<small>{preview(3)}</small>
            </button>
            <button type="button" className="rate good" disabled={rated} onClick={() => rate(4)}>
              Bom<small>{preview(4)}</small>
            </button>
            <button type="button" className="rate easy" disabled={rated} onClick={() => rate(5)}>
              Fácil<small>{preview(5)}</small>
            </button>
          </div>
        );
      })()}

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
