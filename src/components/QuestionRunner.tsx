'use client';

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import {
  useStore,
  selectActiveQuestions,
  selectDisciplinas,
  updateQuestionLocal,
} from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { applyReview } from '@/lib/srs-fsrs';
import { useAlgorithm, setActiveConcursoId } from '@/lib/settings';
import {
  filterDisciplinaIdsByActiveConcurso,
  matchActiveConcurso,
  useActiveConcursoFilter,
} from '@/lib/hierarchy';
import { renderRichText, shuffle } from '@/lib/utils';
import { fmtRelative } from '@/lib/format';
import type {
  Alternativa,
  ObjetivaPayload,
  Question,
  SessionConfig,
} from '@/lib/types';

type Phase = 'config' | 'running' | 'summary';

type SessionState = {
  pool: Question[];
  idx: number;
  embaralhar: boolean;
  tempoLimite: number;
  correct: number;
  wrong: number;
  skipped: number;
  startedAt: number;
};

const defaultCfg: SessionConfig = {
  disciplinas: [],
  qtd: 20,
  modo: 'srs',
  tempo: 0,
  difMin: 1,
  difMax: 5,
  embaralhar: true,
};

function buildPool(all: Question[], cfg: SessionConfig): Question[] {
  let pool = all.filter((q) => q.type === 'objetiva');
  if (cfg.disciplinas.length) {
    const set = new Set(cfg.disciplinas);
    pool = pool.filter((q) => q.disciplina_id && set.has(q.disciplina_id));
  }
  pool = pool.filter((q) => {
    const d = q.dificuldade ?? 3;
    return d >= cfg.difMin && d <= cfg.difMax;
  });

  const now = Date.now();
  if (cfg.modo === 'novas') {
    pool = pool.filter((q) => !q.srs?.lastReviewed);
  } else if (cfg.modo === 'erros') {
    pool = pool.filter((q) => {
      const h = q.stats?.history || [];
      return h.slice(-5).some((r) => r.result === 'wrong' || r.result === 'timeout');
    });
  }

  if (cfg.modo === 'aleatorio') {
    pool = shuffle(pool);
  } else if (cfg.modo === 'dificuldade') {
    pool = pool.slice().sort((a, b) => (b.dificuldade ?? 3) - (a.dificuldade ?? 3));
  } else if (cfg.modo === 'srs') {
    pool = pool.slice().sort((a, b) => {
      const ad = a.srs?.dueDate ?? 0;
      const bd = b.srs?.dueDate ?? 0;
      const aOver = ad < now ? 0 : 1;
      const bOver = bd < now ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      return ad - bd;
    });
  } else {
    pool = shuffle(pool);
  }

  return pool.slice(0, Math.max(1, cfg.qtd));
}

export function QuestionRunner() {
  const allRaw = useStore(selectActiveQuestions);
  const disciplinasRaw = useStore(selectDisciplinas);
  const { concurso: activeConcurso, disciplinaNomes: concursoDiscNomes } =
    useActiveConcursoFilter();

  // Filtra ANTES de chegar nos selects/picker — pra usuário não selecionar
  // disciplinas que serão excluídas pelo concurso ativo.
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
  const [cfg, setCfg] = useState<SessionConfig>(defaultCfg);
  const [session, setSession] = useState<SessionState | null>(null);

  const objCount = useMemo(() => all.filter((q) => q.type === 'objetiva').length, [all]);

  const start = () => {
    const pool = buildPool(all, cfg);
    if (!pool.length) return;
    setSession({
      pool,
      idx: 0,
      embaralhar: cfg.embaralhar,
      tempoLimite: cfg.tempo,
      correct: 0,
      wrong: 0,
      skipped: 0,
      startedAt: Date.now(),
    });
    setPhase('running');
  };

  const onFinish = () => setPhase('summary');
  const onQuit = () => {
    setSession(null);
    setPhase('config');
  };

  if (phase === 'running' && session) {
    return (
      <RunningView
        session={session}
        setSession={setSession}
        onFinish={onFinish}
        onQuit={onQuit}
      />
    );
  }

  if (phase === 'summary' && session) {
    return (
      <Summary
        session={session}
        onRestart={() => {
          setSession(null);
          setPhase('config');
        }}
      />
    );
  }

  return (
    <div className="card">
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
            🎯 Estudando para <strong>{activeConcurso.nome}</strong>
            {concursoDiscNomes && concursoDiscNomes.length > 0
              ? ` · ${disciplinas.length} disciplina(s) · ${objCount} objetiva(s)`
              : ' · sem disciplinas vinculadas'}
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => setActiveConcursoId(null)}
            style={{ fontSize: '0.85rem' }}
          >
            Estudar tudo
          </button>
        </div>
      )}

      <h2>Configurar sessão</h2>

      <div className="form-grid">
        <label>
          <span>Disciplinas</span>
          <select
            multiple
            size={5}
            value={cfg.disciplinas}
            onChange={(e) => {
              const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
              setCfg({ ...cfg, disciplinas: vals });
            }}
          >
            {disciplinas.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <small>Segure Ctrl/Cmd para várias. Vazio = todas.</small>
        </label>

        <label>
          <span>Quantidade</span>
          <input
            type="number"
            min={1}
            max={500}
            value={cfg.qtd}
            onChange={(e) => setCfg({ ...cfg, qtd: parseInt(e.target.value) || 1 })}
          />
        </label>

        <label>
          <span>Modo</span>
          <select
            value={cfg.modo}
            onChange={(e) =>
              setCfg({ ...cfg, modo: e.target.value as SessionConfig['modo'] })
            }
          >
            <option value="srs">Repetição espaçada (priorizar vencidas)</option>
            <option value="aleatorio">Aleatório</option>
            <option value="dificuldade">Por dificuldade (mais difíceis primeiro)</option>
            <option value="erros">Só as que errei recentemente</option>
            <option value="novas">Só novas (nunca vistas)</option>
          </select>
        </label>

        <label>
          <span>Tempo por questão (s, 0 = sem limite)</span>
          <input
            type="number"
            min={0}
            max={3600}
            value={cfg.tempo}
            onChange={(e) => setCfg({ ...cfg, tempo: parseInt(e.target.value) || 0 })}
          />
        </label>

        <label>
          <span>Dificuldade mínima</span>
          <select
            value={cfg.difMin}
            onChange={(e) => setCfg({ ...cfg, difMin: parseInt(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Dificuldade máxima</span>
          <select
            value={cfg.difMax}
            onChange={(e) => setCfg({ ...cfg, difMax: parseInt(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={cfg.embaralhar}
            onChange={(e) => setCfg({ ...cfg, embaralhar: e.target.checked })}
          />
          <span>Embaralhar alternativas</span>
        </label>
      </div>

      <div className="row gap">
        <button
          type="button"
          className="primary"
          onClick={start}
          disabled={objCount === 0}
        >
          Iniciar
        </button>
        <span className="muted">{objCount} objetiva(s) no banco</span>
      </div>
    </div>
  );
}

function RunningView({
  session,
  setSession,
  onFinish,
  onQuit,
}: {
  session: SessionState;
  setSession: Dispatch<SetStateAction<SessionState | null>>;
  onFinish: () => void;
  onQuit: () => void;
}) {
  const update = (fn: (s: SessionState) => SessionState) =>
    setSession((cur) => (cur ? fn(cur) : cur));
  const algorithm = useAlgorithm();
  const q = session.pool[session.idx];
  const payload = q.payload as ObjetivaPayload;
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(session.tempoLimite);
  const startedAtRef = useRef(Date.now());
  const ratedRef = useRef(false);

  // Embaralha alternativas uma vez por questão
  const alts = useMemo<Alternativa[]>(() => {
    return session.embaralhar ? shuffle(payload.alternativas || []) : payload.alternativas || [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);

  const correctLetra =
    payload.alternativas?.find((a) => a.correta === true)?.letra ?? payload.gabarito ?? null;

  // reset ao trocar de questão
  useEffect(() => {
    setAnswered(false);
    setChosen(null);
    setConfidence(null);
    setTimeLeft(session.tempoLimite);
    startedAtRef.current = Date.now();
    ratedRef.current = false;
  }, [q.id, session.tempoLimite]);

  // Timer
  useEffect(() => {
    if (!session.tempoLimite || answered) return;
    const h = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(h);
          submit(null, true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id, answered]);

  const submit = (letra: string | null, timeOut = false) => {
    if (answered) return;
    setAnswered(true);
    setChosen(letra);

    const isCorrect = !!letra && letra === correctLetra;
    const elapsed = Date.now() - startedAtRef.current;

    const newHistory = [
      ...(q.stats?.history || []).slice(-49),
      {
        date: Date.now(),
        result: isCorrect ? ('correct' as const) : timeOut ? ('timeout' as const) : ('wrong' as const),
        answer: letra,
        timeMs: elapsed,
        // Confidence só é registrada se o user marcou explicitamente.
        // Sem isso /stats agrega só sobre as marcadas — fonte limpa.
        ...(confidence !== null && { confidence }),
      },
    ];

    updateQuestionLocal(q.id, (cur) => ({
      stats: {
        attempts: (cur.stats?.attempts || 0) + 1,
        correct: (cur.stats?.correct || 0) + (isCorrect ? 1 : 0),
        wrong: (cur.stats?.wrong || 0) + (isCorrect ? 0 : 1),
        history: newHistory,
      },
    }));

    update((s) => ({
      ...s,
      correct: s.correct + (isCorrect ? 1 : 0),
      wrong: s.wrong + (isCorrect ? 0 : 1),
    }));
  };

  const rate = (quality: number) => {
    if (ratedRef.current) return;
    ratedRef.current = true;
    const card: { srs: typeof q.srs } = { srs: { ...q.srs } };
    applyReview(card, quality, algorithm);
    updateQuestionLocal(q.id, { srs: card.srs });
    scheduleSync(800);
    next();
  };

  const next = () => {
    if (session.idx + 1 >= session.pool.length) {
      onFinish();
    } else {
      update((s) => ({ ...s, idx: s.idx + 1 }));
    }
  };

  const skip = () => {
    update((s) => ({ ...s, skipped: s.skipped + 1 }));
    next();
  };

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!answered) {
        const k = e.key.toUpperCase();
        const alt = alts.find((a) => a.letra.toUpperCase() === k);
        if (alt) {
          e.preventDefault();
          submit(alt.letra);
          return;
        }
      } else {
        // Após responder
        if (e.key === '1') rate(0);
        else if (e.key === '2') rate(3);
        else if (e.key === '3' || e.key === 'Enter' || e.key === ' ') rate(4);
        else if (e.key === '4') rate(5);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, alts, q.id]);

  const chosenAlt = chosen ? payload.alternativas?.find((a) => a.letra === chosen) : null;
  const correctAlt =
    payload.alternativas?.find((a) => a.correta === true) ||
    payload.alternativas?.find((a) => a.letra === payload.gabarito);

  const isCorrect = !!chosen && chosen === correctLetra;
  const timerCls =
    !session.tempoLimite
      ? ''
      : timeLeft <= 5
        ? 'danger'
        : timeLeft <= Math.max(5, session.tempoLimite * 0.25)
          ? 'warn'
          : '';

  const progressPct = Math.round(((session.idx + (answered ? 1 : 0)) / session.pool.length) * 100);

  return (
    <div className="card">
      <div className="session-bar">
        <div className="session-progress">
          {session.idx + 1}/{session.pool.length}
          <span className="small">
            {session.correct}✓ · {session.wrong}✗
          </span>
        </div>
        {session.tempoLimite > 0 && (
          <div className={'session-timer ' + timerCls}>
            {answered ? '—' : `${timeLeft}s`}
          </div>
        )}
        <button type="button" className="ghost" onClick={onQuit}>
          Encerrar
        </button>
      </div>

      <div className="session-progress-bar">
        <div className="fill" style={{ width: progressPct + '%' }} />
      </div>

      <article className="question-area">
        <div className="meta-line">
          {q.disciplina_id && <span>{q.disciplina_id}</span>}
          {q.tema && <span>{q.tema}</span>}
          {q.banca_estilo && <span>{q.banca_estilo}</span>}
          {q.dificuldade != null && <span>dif {q.dificuldade}</span>}
          {q.srs?.lastReviewed && <span>↻ {fmtRelative(q.srs.dueDate)}</span>}
        </div>

        <div
          className="enunciado"
          dangerouslySetInnerHTML={{ __html: renderRichText(payload.enunciado) }}
        />

        {!answered && (
          <div
            role="radiogroup"
            aria-label="Confiança antes de responder"
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              flexWrap: 'wrap',
              margin: '8px 0 12px',
              padding: '8px 10px',
              background: 'var(--bg-elev-2)',
              borderRadius: 'var(--radius)',
              fontSize: '0.85rem',
            }}
          >
            <span className="muted" style={{ marginRight: 4 }}>
              Quão certo você tá? <em>(opcional, ajuda a calibrar)</em>
            </span>
            {[
              { v: 1 as const, label: '🤔 Chutei', tip: 'Não sei, marquei no chute' },
              { v: 2 as const, label: '😐 Incerto', tip: 'Tenho ideia mas não tenho certeza' },
              { v: 3 as const, label: '💪 Confiante', tip: 'Tenho certeza' },
            ].map((opt) => {
              const isOn = confidence === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  title={opt.tip}
                  onClick={() => setConfidence(isOn ? null : opt.v)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid ' + (isOn ? 'var(--primary)' : 'var(--border)'),
                    background: isOn ? 'var(--primary-soft)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: 'var(--text)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="alternativas">
          {alts.map((a) => {
            let cls = 'alt';
            if (answered) {
              if (a.letra === correctLetra) cls += ' correct';
              else if (chosen && a.letra === chosen) cls += ' wrong';
            } else if (chosen === a.letra) {
              cls += ' selected';
            }
            return (
              <button
                key={a.letra}
                type="button"
                className={cls}
                disabled={answered}
                onClick={() => submit(a.letra)}
              >
                <span className="letra">{a.letra}</span>
                <span className="texto">{a.texto || ''}</span>
              </button>
            );
          })}
        </div>
      </article>

      {answered && (
        <div className={'feedback-area ' + (isCorrect ? 'correct' : 'wrong')}>
          <h3>{isCorrect ? '✓ Correto' : chosen == null ? '⏱ Tempo esgotado' : '✗ Incorreto'}</h3>

          {correctAlt && (
            <div className="feedback-block">
              <strong>Gabarito: {correctAlt.letra}</strong>
              {correctAlt.texto && (
                <div
                  style={{ marginTop: 6 }}
                  dangerouslySetInnerHTML={{ __html: renderRichText(correctAlt.texto) }}
                />
              )}
              {correctAlt.explicacao && (
                <div
                  style={{ marginTop: 6 }}
                  dangerouslySetInnerHTML={{
                    __html:
                      '<strong>Por que está certa:</strong> ' +
                      renderRichText(correctAlt.explicacao),
                  }}
                />
              )}
            </div>
          )}

          {!isCorrect && chosenAlt?.explicacao && (
            <div className="feedback-block">
              <div
                dangerouslySetInnerHTML={{
                  __html:
                    `<strong>Por que sua escolha (${chosenAlt.letra}) está errada:</strong> ` +
                    renderRichText(chosenAlt.explicacao),
                }}
              />
            </div>
          )}

          {payload.explicacao_geral && (
            <div className="feedback-block">
              <strong>Explicação geral:</strong>
              <div
                style={{ marginTop: 4 }}
                dangerouslySetInnerHTML={{ __html: renderRichText(payload.explicacao_geral) }}
              />
            </div>
          )}

          {Array.isArray(payload.pegadinhas) && payload.pegadinhas.length > 0 && (
            <div className="feedback-block">
              <strong>Pegadinhas:</strong>
              <ul>
                {payload.pegadinhas.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {payload.notes_user && (
            <div
              className="feedback-block"
              style={{
                background: 'var(--primary-soft)',
                borderLeft: '3px solid var(--primary)',
                paddingLeft: 12,
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
        </div>
      )}

      {answered && (
        <div className="srs-rate">
          <p className="muted center">Como foi essa questão?</p>
          <div className="row gap center wrap">
            <button type="button" className="rate again" onClick={() => rate(0)}>
              De novo<small>1</small>
            </button>
            <button type="button" className="rate hard" onClick={() => rate(3)}>
              Difícil<small>2</small>
            </button>
            <button type="button" className="rate good" onClick={() => rate(4)}>
              Bom<small>3 · Enter</small>
            </button>
            <button type="button" className="rate easy" onClick={() => rate(5)}>
              Fácil<small>4</small>
            </button>
          </div>
        </div>
      )}

      <div className="row gap right" style={{ marginTop: 16 }}>
        {!answered && (
          <button type="button" onClick={skip}>
            Pular
          </button>
        )}
      </div>

      <div className="kbd-hints">
        {!answered ? (
          <span>
            <span className="kbd">A</span>
            <span className="kbd">B</span>
            <span className="kbd">C</span>… para responder
          </span>
        ) : (
          <span>
            <span className="kbd">1</span>De novo · <span className="kbd">2</span>Difícil ·{' '}
            <span className="kbd">3/Enter</span>Bom · <span className="kbd">4</span>Fácil
          </span>
        )}
      </div>
    </div>
  );
}

function Summary({ session, onRestart }: { session: SessionState; onRestart: () => void }) {
  const total = session.correct + session.wrong;
  const pct = total === 0 ? '—' : Math.round((100 * session.correct) / total) + '%';
  const elapsed = Math.round((Date.now() - session.startedAt) / 1000);
  return (
    <div className="card">
      <h2>Sessão concluída</h2>
      <p>
        Você respondeu <strong>{total}</strong> questão(ões) em {elapsed}s.
      </p>
      <ul>
        <li>
          ✓ Acertos: <strong>{session.correct}</strong>
        </li>
        <li>
          ✗ Erros: <strong>{session.wrong}</strong>
        </li>
        <li>
          ↷ Puladas: <strong>{session.skipped}</strong>
        </li>
        <li>
          % Acerto: <strong>{pct}</strong>
        </li>
      </ul>
      <div className="row gap">
        <button type="button" className="primary" onClick={onRestart}>
          Nova sessão
        </button>
      </div>
    </div>
  );
}
