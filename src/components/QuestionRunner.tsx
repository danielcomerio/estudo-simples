'use client';

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { interleaveByGroup, mixDifficulty, renderRichText, shuffle, startOfDay } from '@/lib/utils';
import { DAY_MS } from '@/lib/srs';
import { haptic } from '@/lib/haptic';
import { playSound } from '@/lib/sounds';
import { acquireWakeLock, type WakeLockHandle } from '@/lib/wake-lock';
import { triggerConfetti } from './ConfettiHost';
import {
  clearSession as clearStoredSession,
  readSession,
  saveSession,
} from '@/lib/session-store';
import { clearQueue as clearStudyQueue, readQueue as readStudyQueue } from '@/lib/study-queue';
import { appendSession } from '@/lib/sessions-log';
import { loadPrefs, savePrefs } from '@/lib/session-prefs';
import { QuestionImages } from './QuestionImages';
import { fmtRelative } from '@/lib/format';
import { useSwipe } from '@/lib/use-swipe';
import { UndoChip } from './UndoChip';
import { NoteInline } from './NoteInline';
import { ErrorCausePicker } from './ErrorCausePicker';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';
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
  /** Streak de acertos seguidos na sessão atual (zerado em erro). */
  streak?: number;
  /** Modo livre: stats contam, SRS não muda. Default false. */
  free?: boolean;
  /** Active recall: esconde alternativas até user revelar. */
  activeRecall?: boolean;
  /** Re-injeta questões erradas no fim do pool. */
  retryWrong?: boolean;
};

const defaultCfg: SessionConfig = {
  disciplinas: [],
  qtd: 20,
  modo: 'srs',
  tempo: 0,
  difMin: 1,
  difMax: 5,
  embaralhar: true,
  interleaving: false,
  free: false,
  activeRecall: false,
  retryWrong: false,
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
  } else if (cfg.modo === 'favoritas') {
    pool = pool.filter(
      (q) => (q.payload as Record<string, unknown>).bookmarked === true
    );
  } else if (cfg.modo === 'erros') {
    pool = pool.filter((q) => {
      const h = q.stats?.history || [];
      return h.slice(-5).some((r) => r.result === 'wrong' || r.result === 'timeout');
    });
  } else if (cfg.modo === 'inimigas') {
    // "Inimigas": questões com >=3 tentativas E taxa de acerto < 30%.
    // Foco no que persiste errando — agressivo pra forçar revisão.
    pool = pool.filter((q) => {
      const a = q.stats?.attempts ?? 0;
      const c = q.stats?.correct ?? 0;
      if (a < 3) return false;
      return c / a < 0.3;
    });
    // Ordena por pior taxa primeiro
    pool = pool.slice().sort((x, y) => {
      const ax = (x.stats?.correct ?? 0) / Math.max(1, x.stats?.attempts ?? 1);
      const ay = (y.stats?.correct ?? 0) / Math.max(1, y.stats?.attempts ?? 1);
      return ax - ay;
    });
  } else if (cfg.modo === 'final-prova') {
    // Mistura agressiva pra revisão pré-prova: vencidas SRS (40%) +
    // inimigas (30%) + recém-aprendidas (20%) + variadas aleatórias
    // (10%, ou o que faltar). Sem duplicatas. Embaralha resultado pra
    // simular ordem de prova real.
    const qtd = Math.max(1, cfg.qtd);
    const dueSRS = pool
      .filter((q) => (q.srs?.dueDate ?? 0) < now)
      .slice()
      .sort((a, b) => (a.srs?.dueDate ?? 0) - (b.srs?.dueDate ?? 0));
    const inimigas = pool.filter((q) => {
      const a = q.stats?.attempts ?? 0;
      const c = q.stats?.correct ?? 0;
      if (a < 3) return false;
      return c / a < 0.3;
    });
    const recemAprendidas = pool.filter((q) => {
      const h = q.stats?.history || [];
      if (h.length < 1 || h.length > 4) return false;
      return h
        .slice(-2)
        .every((r) => r.result === 'correct' || r.result === 'self_pass');
    });
    const variadas = shuffle(pool);

    const seen = new Set<string>();
    const out: Question[] = [];
    const addUpTo = (qs: Question[], n: number) => {
      for (const q of qs) {
        if (out.length >= qtd) return;
        if (n <= 0) return;
        if (seen.has(q.id)) continue;
        seen.add(q.id);
        out.push(q);
        n--;
      }
    };
    addUpTo(shuffle(dueSRS), Math.round(qtd * 0.4));
    addUpTo(shuffle(inimigas), Math.round(qtd * 0.3));
    addUpTo(shuffle(recemAprendidas), Math.round(qtd * 0.2));
    addUpTo(variadas, qtd - out.length);
    pool = shuffle(out);
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

  let truncated = pool.slice(0, Math.max(1, cfg.qtd));

  // Cognitive load: evita 3+ questões difíceis consecutivas (causa fadiga,
  // pior retenção — cf. Sweller "cognitive load theory"). Pulado em modo
  // 'dificuldade' (que explicitamente quer ordenar por dificuldade).
  if (cfg.modo !== 'dificuldade') {
    truncated = mixDifficulty(truncated, (q) => q.dificuldade ?? 3, 3);
  }

  // Interleaving: aplicado APÓS sort + truncate. Mantém ordem relativa
  // dentro de cada disciplina (SRS continua priorizando vencidas dentro
  // do grupo) mas distribui blocos de disciplina pelo pool.
  if (cfg.interleaving) {
    return interleaveByGroup(truncated, (q) => q.disciplina_id ?? '(sem)');
  }
  return truncated;
}

export function QuestionRunner() {
  const userId = useStore((s) => s.userId);
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
  const [cfg, setCfgRaw] = useState<SessionConfig>(defaultCfg);

  // Wake Lock: tela acesa durante a sessão. Sem isso, mobile dorme em
  // 30-60s e quebra o fluxo de leitura. Re-adquire ao voltar pro foco.
  useEffect(() => {
    if (phase !== 'running') return;
    const lock: WakeLockHandle = acquireWakeLock();
    return () => lock.release();
  }, [phase]);

  // Carrega prefs salvas no mount (mantém disciplinas vazio sempre — pra
  // evitar pickear disciplinas que não existem mais).
  useEffect(() => {
    const saved = loadPrefs<Partial<SessionConfig>>('estudar');
    if (saved) {
      setCfgRaw((c) => ({ ...c, ...saved, disciplinas: [] }));
    }
  }, []);
  const setCfg = (next: SessionConfig | ((prev: SessionConfig) => SessionConfig)) => {
    setCfgRaw((prev) => {
      const resolved =
        typeof next === 'function' ? (next as (p: SessionConfig) => SessionConfig)(prev) : next;
      // Salva sem disciplinas (campo dependente do banco)
      const { disciplinas: _d, ...rest } = resolved;
      savePrefs('estudar', rest);
      return resolved;
    });
  };
  const [session, setSession] = useState<SessionState | null>(null);
  const [pausedAvailable, setPausedAvailable] = useState<{
    pool: Question[];
    idx: number;
    correct: number;
    wrong: number;
    skipped: number;
    embaralhar: boolean;
    tempoLimite: number;
    free?: boolean;
    activeRecall?: boolean;
    startedAt: number;
  } | null>(null);

  // Detecta sessão pausada ao montar
  useEffect(() => {
    if (!userId) return;
    if (phase !== 'config') return;
    const stored = readSession(userId, 'estudar');
    if (!stored) return;
    const pool = stored.poolIds
      .map((id) => allRaw.find((q) => q.id === id && q.type === 'objetiva'))
      .filter((q): q is Question => !!q);
    if (pool.length === 0 || stored.idx >= pool.length) {
      clearStoredSession('estudar');
      return;
    }
    setPausedAvailable({
      pool,
      idx: stored.idx,
      correct: stored.correct,
      wrong: stored.wrong,
      skipped: stored.skipped,
      embaralhar: stored.embaralhar,
      tempoLimite: stored.tempoLimite,
      free: stored.free,
      activeRecall: stored.activeRecall,
      startedAt: stored.startedAt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, allRaw.length]);

  // Persiste sessão atual em mudanças relevantes
  useEffect(() => {
    if (!userId || phase !== 'running' || !session) return;
    saveSession(
      {
        userId,
        poolIds: session.pool.map((q) => q.id),
        idx: session.idx,
        embaralhar: session.embaralhar,
        tempoLimite: session.tempoLimite,
        free: session.free,
        activeRecall: session.activeRecall,
        correct: session.correct,
        wrong: session.wrong,
        skipped: session.skipped,
        startedAt: session.startedAt,
      },
      'estudar'
    );
  }, [userId, phase, session]);

  // Lembrete de pausa: depois de 30min sem parar, sugere uma pausa.
  // Toast leve, não intrusivo. Memoria via ref pra não disparar mais
  // de uma vez.
  const pauseWarnedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'running' || !session) return;
    pauseWarnedRef.current = false;
    const h = setInterval(() => {
      const elapsedMin = (Date.now() - session.startedAt) / 60000;
      if (elapsedMin >= 30 && !pauseWarnedRef.current) {
        pauseWarnedRef.current = true;
        toast(
          '💤 Você está há 30+ minutos. Considera uma pausa rápida pra reter melhor.',
          'warn',
          8000
        );
      }
    }, 60_000);
    return () => clearInterval(h);
  }, [phase, session]);

  // beforeunload protege fechar/recarregar aba durante sessão
  useEffect(() => {
    if (phase !== 'running') return;
    const onBU = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBU);
    return () => window.removeEventListener('beforeunload', onBU);
  }, [phase]);

  const resumePaused = () => {
    if (!pausedAvailable) return;
    setSession({
      pool: pausedAvailable.pool,
      idx: pausedAvailable.idx,
      embaralhar: pausedAvailable.embaralhar,
      tempoLimite: pausedAvailable.tempoLimite,
      free: pausedAvailable.free,
      activeRecall: pausedAvailable.activeRecall,
      correct: pausedAvailable.correct,
      wrong: pausedAvailable.wrong,
      skipped: pausedAvailable.skipped,
      startedAt: pausedAvailable.startedAt,
    });
    setPausedAvailable(null);
    setPhase('running');
  };

  const discardPaused = () => {
    setPausedAvailable(null);
    clearStoredSession('estudar');
  };

  const objCount = useMemo(() => all.filter((q) => q.type === 'objetiva').length, [all]);
  const favCount = useMemo(
    () =>
      all.filter(
        (q) =>
          q.type === 'objetiva' &&
          (q.payload as Record<string, unknown>).bookmarked === true
      ).length,
    [all]
  );

  // Query params: ?modo=srs&qtd=10&auto=1 → preset + auto-start
  // Útil pros quick actions do Painel. Também ?qid=ID pra estudar
  // 1 questão específica.
  const searchParams = useSearchParams();
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current || phase !== 'config') return;
    // Se qid presente, monta pool com aquela única questão
    const qid = searchParams.get('qid');
    if (qid) {
      const q = allRaw.find((x) => x.id === qid && x.type === 'objetiva');
      if (q) {
        autoStartedRef.current = true;
        setSession({
          pool: [q],
          idx: 0,
          embaralhar: false,
          tempoLimite: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
          startedAt: Date.now(),
        });
        setPhase('running');
        return;
      }
    }
    // Se queue=1, pega IDs da fila local salva pelo /banco
    if (searchParams.get('queue') === '1') {
      const q = readStudyQueue();
      if (q && q.kind === 'objetiva' && q.ids.length > 0) {
        const pool = q.ids
          .map((id) => allRaw.find((x) => x.id === id && x.type === 'objetiva'))
          .filter((x): x is Question => !!x);
        if (pool.length > 0) {
          autoStartedRef.current = true;
          clearStudyQueue();
          setSession({
            pool: cfg.embaralhar ? shuffle(pool) : pool,
            idx: 0,
            embaralhar: cfg.embaralhar,
            tempoLimite: 0,
            correct: 0,
            wrong: 0,
            skipped: 0,
            startedAt: Date.now(),
          });
          setPhase('running');
          return;
        }
      }
    }
    const modo = searchParams.get('modo');
    const qtd = searchParams.get('qtd');
    const auto = searchParams.get('auto');
    if (!modo && !qtd && !auto) return;
    const validModos: SessionConfig['modo'][] = [
      'srs',
      'aleatorio',
      'dificuldade',
      'erros',
      'novas',
      'inimigas',
      'favoritas',
      'final-prova',
    ];
    const newCfg: SessionConfig = { ...cfg };
    if (modo && (validModos as string[]).includes(modo)) {
      newCfg.modo = modo as SessionConfig['modo'];
    }
    if (qtd) {
      const n = parseInt(qtd, 10);
      if (Number.isFinite(n) && n > 0) newCfg.qtd = Math.min(500, n);
    }
    setCfg(newCfg);
    if (auto === '1' && objCount > 0) {
      autoStartedRef.current = true;
      const pool = buildPool(all, newCfg);
      if (pool.length) {
        setSession({
          pool,
          idx: 0,
          embaralhar: newCfg.embaralhar,
          tempoLimite: newCfg.tempo,
          correct: 0,
          wrong: 0,
          skipped: 0,
          startedAt: Date.now(),
          free: newCfg.free,
          activeRecall: newCfg.activeRecall,
          retryWrong: newCfg.retryWrong,
        });
        setPhase('running');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, objCount, allRaw]);

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
      free: cfg.free,
      activeRecall: cfg.activeRecall,
      retryWrong: cfg.retryWrong,
    });
    setPhase('running');
  };

  const quickStart = (
    modo: SessionConfig['modo'],
    qtd: number,
    free = false
  ) => {
    const next = { ...cfg, modo, qtd, free };
    setCfg(next);
    const pool = buildPool(all, next);
    if (!pool.length) return;
    setSession({
      pool,
      idx: 0,
      embaralhar: next.embaralhar,
      tempoLimite: next.tempo,
      correct: 0,
      wrong: 0,
      skipped: 0,
      startedAt: Date.now(),
      free: next.free,
      activeRecall: next.activeRecall,
      retryWrong: next.retryWrong,
    });
    setPhase('running');
  };

  const onFinish = () => {
    if (session) {
      appendSession({
        kind: 'estudar',
        startedAt: session.startedAt,
        endedAt: Date.now(),
        total: session.pool.length,
        correct: session.correct,
        wrong: session.wrong,
        skipped: session.skipped,
        durationMs: Date.now() - session.startedAt,
      });
    }
    clearStoredSession('estudar');
    setPhase('summary');
  };
  const onQuit = async () => {
    // Se já respondeu algo, confirma — evita perder progresso por click
    // acidental no botão Encerrar.
    if (session && (session.correct + session.wrong) > 0) {
      const ok = await confirmDialog({
        title: 'Encerrar sessão?',
        message: `Você já respondeu ${session.correct + session.wrong} questão(ões) nesta sessão. As respostas ficam salvas. Encerrar e voltar pra config?`,
      });
      if (!ok) return;
    }
    clearStoredSession('estudar');
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
        onRepeat={() => {
          // Repete as MESMAS questões em modo livre (free=true) pra não
          // duplicar o agendamento SRS — o usuário acabou de revisar.
          setSession({
            pool: session.pool,
            idx: 0,
            embaralhar: session.embaralhar,
            tempoLimite: session.tempoLimite,
            correct: 0,
            wrong: 0,
            skipped: 0,
            startedAt: Date.now(),
            free: true,
          });
          setPhase('running');
        }}
        onRepeatErradas={(wrongs) => {
          if (wrongs.length === 0) return;
          setSession({
            pool: shuffle(wrongs),
            idx: 0,
            embaralhar: session.embaralhar,
            tempoLimite: session.tempoLimite,
            correct: 0,
            wrong: 0,
            skipped: 0,
            startedAt: Date.now(),
            free: true,
          });
          setPhase('running');
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
            ⏸ Sessão pausada:{' '}
            <strong>{pausedAvailable.idx}</strong> de{' '}
            <strong>{pausedAvailable.pool.length}</strong> questões
            respondidas (
            <span style={{ color: 'var(--primary)' }}>
              {pausedAvailable.correct}✓
            </span>{' '}
            ·{' '}
            <span style={{ color: 'var(--danger)' }}>
              {pausedAvailable.wrong}✗
            </span>
            )
          </div>
          <div
            className="row gap wrap"
            style={{ justifyContent: 'flex-start' }}
          >
            <button
              type="button"
              className="primary"
              onClick={resumePaused}
              style={{ flex: '1 1 auto', minWidth: 140, padding: '10px 16px' }}
            >
              ▶ Continuar
            </button>
            <button
              type="button"
              className="ghost"
              onClick={discardPaused}
              style={{ flex: '0 1 auto', padding: '10px 14px' }}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {objCount > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h2 style={{ margin: '0 0 10px' }}>⚡ Início rápido</h2>
          <div className="quick-start-grid">
            <button
              type="button"
              className="quick-start-btn"
              onClick={() => quickStart('srs', 10)}
              title="10 questões priorizando vencidas"
            >
              <span className="qs-emoji">🎯</span>
              <span className="qs-label">10 SRS</span>
              <span className="qs-sub">prioriza vencidas</span>
            </button>
            <button
              type="button"
              className="quick-start-btn"
              onClick={() => quickStart('aleatorio', 20)}
              title="20 questões aleatórias"
            >
              <span className="qs-emoji">🔀</span>
              <span className="qs-label">20 random</span>
              <span className="qs-sub">aleatório</span>
            </button>
            <button
              type="button"
              className="quick-start-btn"
              onClick={() => quickStart('inimigas', 10)}
              title="Suas inimigas: ≥3 tentativas, &lt;30% acerto"
            >
              <span className="qs-emoji">⚔</span>
              <span className="qs-label">10 inimigas</span>
              <span className="qs-sub">o que mais erra</span>
            </button>
            <button
              type="button"
              className="quick-start-btn"
              onClick={() => quickStart('final-prova', 30)}
              title="30 questões: SRS + inimigas + recém-aprendidas + variadas"
            >
              <span className="qs-emoji">🎓</span>
              <span className="qs-label">Pré-prova</span>
              <span className="qs-sub">30 mistas</span>
            </button>
            {favCount > 0 && (
              <button
                type="button"
                className="quick-start-btn"
                onClick={() => quickStart('favoritas', Math.min(favCount, 20))}
                title={`${favCount} questão(ões) marcadas com ⭐`}
              >
                <span className="qs-emoji">⭐</span>
                <span className="qs-label">Favoritas</span>
                <span className="qs-sub">{favCount} marcadas</span>
              </button>
            )}
          </div>
          <p
            className="muted"
            style={{ fontSize: '0.82rem', margin: '10px 0 0' }}
          >
            Ou{' '}
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const el = document.querySelector(
                  '#estudar-config'
                ) as HTMLElement | null;
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{
                padding: '0',
                border: 'none',
                background: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: 'inherit',
              }}
            >
              configure uma sessão custom
            </button>{' '}
            abaixo.
          </p>
        </section>
      )}

      <h2 id="estudar-config">Configurar sessão</h2>

      {objCount === 0 && (
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
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>📚</div>
          <strong>
            Sem questões objetivas{activeConcurso ? ' neste concurso' : ''}
          </strong>
          <p
            className="muted"
            style={{ margin: '6px 0 12px', fontSize: '0.9rem' }}
          >
            Importe um JSON ou cole questões em <code>/banco</code>. O modo SRS
            agenda revisões a partir do seu desempenho.
          </p>
          <Link href="/banco">
            <button type="button" className="primary">
              Ir para o banco
            </button>
          </Link>
          {activeConcurso && allRaw.filter((q) => q.type === 'objetiva').length > 0 && (
            <button
              type="button"
              className="ghost"
              style={{ marginLeft: 8 }}
              onClick={() => setActiveConcursoId(null)}
              title="Remove o filtro de concurso ativo (estuda todas)"
            >
              Estudar tudo (sem filtro)
            </button>
          )}
        </div>
      )}

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
            <option value="inimigas">⚔ Inimigas (≥3 tentativas, &lt;30% acerto)</option>
            <option value="novas">Só novas (nunca vistas)</option>
            <option value="favoritas">⭐ Só favoritas (marcadas com ⭐)</option>
            <option value="final-prova">🎓 Revisão pré-prova (mistura SRS + inimigas + recém-aprendidas)</option>
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

        <label className="check-row">
          <input
            type="checkbox"
            checked={!!cfg.interleaving}
            onChange={(e) =>
              setCfg({ ...cfg, interleaving: e.target.checked })
            }
          />
          <span title="Distribui disciplinas pelo pool (em vez de blocos por disciplina). Estudo mostra que melhora retenção e discriminação.">
            Intercalar disciplinas (interleaving)
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={!!cfg.free}
            onChange={(e) => setCfg({ ...cfg, free: e.target.checked })}
          />
          <span title="Stats contam normalmente, mas o agendamento SRS NÃO muda. Útil pra revisão pré-prova ou prática extra sem 'puxar' as próximas revisões pra perto.">
            Modo livre (não muda agendamento SRS)
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={!!cfg.activeRecall}
            onChange={(e) =>
              setCfg({ ...cfg, activeRecall: e.target.checked })
            }
          />
          <span title="Esconde alternativas até você apertar Espaço/Enter. Força lembrar antes de ver as opções — evidência forte de melhor memorização (Roediger & Karpicke 2006).">
            🧠 Active recall (esconder alternativas até revelar)
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={!!cfg.retryWrong}
            onChange={(e) =>
              setCfg({ ...cfg, retryWrong: e.target.checked })
            }
          />
          <span title="Quando você marcar 'De novo' (q=0), a questão volta no fim da sessão. Tipo Anki 'again steps'. Reforço imediato antes do schedule de longo prazo.">
            🔁 Re-injetar erradas no fim da sessão
          </span>
        </label>
      </div>

      <div
        className="row gap wrap"
        style={{
          alignItems: 'center',
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          className="primary"
          onClick={start}
          disabled={objCount === 0}
          style={{
            flex: '1 1 auto',
            minWidth: 160,
            padding: '12px 24px',
            fontSize: '1rem',
          }}
        >
          ▶ Iniciar
        </button>
        <span
          className="muted"
          style={{
            fontSize: '0.85rem',
            flex: '0 0 auto',
            textAlign: 'center',
          }}
        >
          {objCount} objetiva{objCount === 1 ? '' : 's'} no banco
        </span>
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
  const { concurso: activeConcurso } = useActiveConcursoFilter();
  // Exam date densification: cap de intervalo SRS pra não agendar pra
  // depois da prova. Só quando há concurso ativo com data_prova válida.
  const examDateMs = useMemo(() => {
    if (!activeConcurso?.data_prova) return null;
    const t = new Date(activeConcurso.data_prova).getTime();
    return Number.isNaN(t) ? null : t;
  }, [activeConcurso?.data_prova]);
  const q = session.pool[session.idx];
  const payload = q.payload as ObjetivaPayload;
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(session.tempoLimite);
  const [focusMode, setFocusMode] = useState(false);
  // Active recall: alternativas ficam escondidas até user revelar.
  // Quando session.activeRecall=false, sempre true (default visível).
  const [revealed, setRevealed] = useState(!session.activeRecall);
  const startedAtRef = useRef(Date.now());
  const ratedRef = useRef(false);

  // Snapshot para undo da última resposta (rate). Mantido por 6s.
  const [undoSnap, setUndoSnap] = useState<{
    qid: string;
    prevSrs: typeof q.srs;
    prevStats: typeof q.stats;
    prevIdx: number;
    prevCorrect: number;
    prevWrong: number;
    prevChosen: string | null;
    prevConfidence: 1 | 2 | 3 | null;
  } | null>(null);

  // Focus mode aplica/remove classe no body
  useEffect(() => {
    if (focusMode) {
      document.body.classList.add('focus-mode');
    } else {
      document.body.classList.remove('focus-mode');
    }
    return () => {
      document.body.classList.remove('focus-mode');
    };
  }, [focusMode]);

  // Embaralha alternativas uma vez por questão. Re-rotula em A/B/C/D/E
  // baseado na nova ordem — visual fica sempre alfabético, mesmo após
  // embaralhar. correta=true preserva quem é a certa.
  const alts = useMemo<Alternativa[]>(() => {
    const original = payload.alternativas || [];
    const ordered = session.embaralhar ? shuffle(original) : original;
    const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    return ordered.map((a, i) => ({ ...a, letra: LETRAS[i] ?? a.letra }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id, session.embaralhar]);

  const correctLetra =
    alts.find((a) => a.correta === true)?.letra ??
    payload.alternativas?.find((a) => a.correta === true)?.letra ??
    payload.gabarito ??
    null;

  // reset ao trocar de questão
  useEffect(() => {
    setAnswered(false);
    setChosen(null);
    setConfidence(null);
    setTimeLeft(session.tempoLimite);
    setRevealed(!session.activeRecall);
    startedAtRef.current = Date.now();
    ratedRef.current = false;
  }, [q.id, session.tempoLimite, session.activeRecall]);

  // Timer — não roda enquanto active recall está escondendo as
  // alternativas (sem opção visível, contagem regressiva é injusta).
  useEffect(() => {
    if (!session.tempoLimite || answered || !revealed) return;
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
  }, [q.id, answered, revealed]);

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
      streak: isCorrect ? (s.streak ?? 0) + 1 : 0,
    }));

    // Feedback háptico (mobile-only, no-op em desktop e iOS) + som
    // (opt-in). Ambos no-op se desabilitados/sem suporte.
    haptic(isCorrect ? 'success' : 'error');
    playSound(isCorrect ? 'success' : 'error');
  };

  const rate = (quality: number) => {
    if (ratedRef.current) return;
    ratedRef.current = true;
    haptic('select');
    // Captura snapshot pra undo. Stats foi atualizado em submit() —
    // o snapshot guarda o stats POST-submit; undo restaura o cenário
    // de "respondi mas ainda não rateei" + decrementa contadores.
    const snap = {
      qid: q.id,
      prevSrs: { ...q.srs },
      prevStats: { ...q.stats },
      prevIdx: session.idx,
      prevCorrect: session.correct,
      prevWrong: session.wrong,
      prevChosen: chosen,
      prevConfidence: confidence,
    };
    // Modo livre: NÃO aplica SRS. Stats já foram contabilizadas em
    // submit(). Útil pra revisão pré-prova sem interferir no schedule.
    if (!session.free) {
      const card: { srs: typeof q.srs } = { srs: { ...q.srs } };
      applyReview(card, quality, algorithm, examDateMs);
      updateQuestionLocal(q.id, { srs: card.srs });
    }
    scheduleSync(800);
    setUndoSnap(snap);
    // retryWrong: se rate=0 (de novo) e flag ativa, re-injeta a questão
    // no fim do pool. Em-sessão, antes que o user encerre. Reforço
    // imediato — Anki "again steps" simplificado.
    if (session.retryWrong && quality === 0 && session.idx + 1 < session.pool.length + 5) {
      update((s) => ({ ...s, pool: [...s.pool, q] }));
    }
    next();
  };

  const undoLastRate = () => {
    if (!undoSnap) return;
    // Restaura srs/stats da question E reverte contadores da session.
    // O stats que captamos é POST-submit, então pra reverter a tentativa
    // toda restauramos o stats com 1 attempt a menos.
    updateQuestionLocal(undoSnap.qid, {
      srs: undoSnap.prevSrs,
      stats: {
        attempts: Math.max(0, (undoSnap.prevStats?.attempts ?? 1) - 1),
        correct: Math.max(
          0,
          (undoSnap.prevStats?.correct ?? 0) -
            (undoSnap.prevChosen === correctLetra ? 1 : 0)
        ),
        wrong: Math.max(
          0,
          (undoSnap.prevStats?.wrong ?? 0) -
            (undoSnap.prevChosen !== correctLetra ? 1 : 0)
        ),
        history: (undoSnap.prevStats?.history ?? []).slice(0, -1),
      },
    });
    update((s) => ({
      ...s,
      idx: undoSnap.prevIdx,
      correct: undoSnap.prevCorrect,
      wrong: undoSnap.prevWrong,
    }));
    setAnswered(false);
    setChosen(null);
    setConfidence(null);
    ratedRef.current = false;
    setUndoSnap(null);
    scheduleSync(800);
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
    toast('↪ Pulada', '', 1200);
    next();
  };

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // F toggle focus mode (a qualquer momento)
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      // Active recall: Espaço/Enter revela alternativas se ainda escondidas
      if (!revealed && !answered) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setRevealed(true);
          return;
        }
        // Tab ainda pula
        if (e.key === 'Tab') {
          e.preventDefault();
          skip();
          return;
        }
        // A-E ignorado até revelar (pra não vazar opção sem ver)
        return;
      }
      if (!answered) {
        // Tab pula questão (skip soft, não conta como erro)
        if (e.key === 'Tab') {
          e.preventDefault();
          skip();
          return;
        }
        const k = e.key.toUpperCase();
        const alt = alts.find((a) => a.letra.toUpperCase() === k);
        if (alt) {
          e.preventDefault();
          submit(alt.letra);
          return;
        }
      } else {
        // Após responder. Shift+1..5 seta dificuldade da questão sem
        // afetar o rate SRS — útil pra recalibrar enquanto revisa.
        if (e.shiftKey && /^[1-5]$/.test(e.key)) {
          e.preventDefault();
          const dif = parseInt(e.key, 10) as 1 | 2 | 3 | 4 | 5;
          updateQuestionLocal(q.id, { dificuldade: dif });
          scheduleSync(500);
          return;
        }
        if (e.key === '1') rate(0);
        else if (e.key === '2') rate(3);
        else if (e.key === '3' || e.key === 'Enter' || e.key === ' ') rate(4);
        else if (e.key === '4') rate(5);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, alts, q.id, revealed]);

  // Swipe horizontal: ← pula questão (só antes de responder, pra não pular sem rate)
  useSwipe({
    enabled: !answered,
    onLeft: skip,
  });

  // chosen é a letra após re-rotular (A/B/C...). Busca em `alts` (já
   // re-rotulado) pra pegar a alternativa real.
  const chosenAlt = chosen ? alts.find((a) => a.letra === chosen) : null;
  const correctAlt =
    alts.find((a) => a.correta === true) ||
    alts.find((a) => a.letra === payload.gabarito);

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
  // Detecta se a questão atual já apareceu antes nesta sessão (caso
  // retryWrong tenha re-injetado). Mostra banner discreto.
  const earlierAppearances = session.pool
    .slice(0, session.idx)
    .filter((p) => p.id === q.id).length;
  const isReplay = earlierAppearances > 0;

  return (
    <div className="card">
      {undoSnap && (
        <UndoChip
          onUndo={undoLastRate}
          onDismiss={() => setUndoSnap(null)}
        />
      )}
      {isReplay && (
        <div
          style={{
            background: 'var(--warn-bg, rgba(217, 119, 6, 0.1))',
            border: '1px solid var(--warn, #d97706)',
            borderRadius: 'var(--radius)',
            padding: '6px 10px',
            marginBottom: 10,
            fontSize: '0.82rem',
            color: 'var(--warn, #d97706)',
          }}
        >
          🔁 Revisão dentro da sessão (apareceu {earlierAppearances}× antes)
          — boa hora pra fixar.
        </div>
      )}
      <div className="session-bar">
        <div className="session-progress">
          {session.idx + 1}/{session.pool.length}
          <span className="small">
            {session.correct}✓ · {session.wrong}✗
            {(session.streak ?? 0) >= 3 && (
              <span style={{ marginLeft: 6, color: 'var(--primary)' }}>
                🔥 {session.streak}
              </span>
            )}
          </span>
          <SessionElapsed startedAt={session.startedAt} />
        </div>
        {session.tempoLimite > 0 && (
          <div className={'session-timer ' + timerCls}>
            {answered ? '—' : `${timeLeft}s`}
          </div>
        )}
        <button
          type="button"
          className="ghost icon"
          onClick={() => setFocusMode((v) => !v)}
          title={`Modo foco (F): ${focusMode ? 'ativo' : 'inativo'}`}
          aria-label="Alternar modo foco"
        >
          {focusMode ? '🔍' : '🎯'}
        </button>
        <button type="button" className="ghost" onClick={onQuit}>
          Encerrar
        </button>
      </div>

      <div className="session-progress-bar" title={`${session.correct}✓ · ${session.wrong}✗ · ${progressPct}% concluído`}>
        {(() => {
          const total = session.correct + session.wrong;
          const acertoPct = total > 0 ? Math.round((100 * session.correct) / total) : null;
          const cor =
            acertoPct == null
              ? 'var(--primary)'
              : acertoPct >= 70
                ? '#22c55e'
                : acertoPct >= 40
                  ? '#f59e0b'
                  : '#ef4444';
          return (
            <div
              className="fill"
              style={{ width: progressPct + '%', background: cor, transition: 'background 0.4s, width 0.3s' }}
            />
          );
        })()}
      </div>

      <article className="question-area">
        <div className="meta-line">
          {q.disciplina_id && <span>{q.disciplina_id}</span>}
          {q.tema && <span>{q.tema}</span>}
          {q.banca_estilo && <span>{q.banca_estilo}</span>}
          {q.dificuldade != null && <span>dif {q.dificuldade}</span>}
          {q.srs?.lastReviewed && <span>↻ {fmtRelative(q.srs.dueDate)}</span>}
        </div>

        {!answered &&
          (q.stats?.attempts ?? 0) > 0 &&
          (() => {
            const a = q.stats!.attempts;
            const c = q.stats!.correct ?? 0;
            const taxa = a > 0 ? c / a : 0;
            const cor =
              taxa < 0.4
                ? 'var(--danger)'
                : taxa < 0.7
                  ? 'var(--warn, #d97706)'
                  : 'var(--primary)';
            const icon = taxa < 0.4 ? '⚠' : taxa < 0.7 ? '⚡' : '✓';
            return (
              <div
                style={{
                  margin: '8px 0 12px',
                  padding: '6px 10px',
                  background: 'var(--bg-elev-2)',
                  borderLeft: `3px solid ${cor}`,
                  borderRadius: 'var(--radius)',
                  fontSize: '0.85rem',
                  color: 'var(--muted)',
                }}
                title={`Histórico desta questão: ${c} de ${a} acertos`}
              >
                <span style={{ color: cor, fontWeight: 500 }}>
                  {icon} {c}/{a}
                </span>{' '}
                acertos no histórico —{' '}
                {taxa < 0.4
                  ? 'atenção redobrada'
                  : taxa < 0.7
                    ? 'reforce o raciocínio'
                    : 'você costuma acertar'}
              </div>
            );
          })()}

        <div
          className="enunciado"
          dangerouslySetInnerHTML={{ __html: renderRichText(payload.enunciado) }}
        />

        <QuestionImages urls={payload.imagens} />

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
                  className={'confidence-btn' + (isOn ? ' active' : '')}
                  title={opt.tip}
                  onClick={() => setConfidence(isOn ? null : opt.v)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {!revealed ? (
          <div
            style={{
              padding: 24,
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-elev-2)',
              textAlign: 'center',
              margin: '14px 0',
            }}
          >
            <div style={{ fontSize: '0.95rem', marginBottom: 8 }}>
              🧠 <strong>Active recall</strong> — pense na resposta antes
              de ver as opções.
            </div>
            <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 14 }}>
              Quando estiver pronto, revele as alternativas.
            </div>
            <button
              type="button"
              className="primary"
              onClick={() => setRevealed(true)}
            >
              Revelar alternativas (Espaço)
            </button>
          </div>
        ) : (
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
        )}
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

          {payload.mnemonic && (
            <div
              className="feedback-block"
              style={{
                background: 'var(--primary-soft)',
                borderLeft: '3px solid var(--primary)',
                paddingLeft: 12,
              }}
            >
              <strong>🧠 Mnemônico</strong>
              <div
                style={{ marginTop: 4 }}
                dangerouslySetInnerHTML={{
                  __html: renderRichText(payload.mnemonic),
                }}
              />
            </div>
          )}

          {!isCorrect && <ErrorCausePicker q={q} />}

          <NoteInline q={q} />
        </div>
      )}

      {answered && (() => {
        // Preview do próximo intervalo SRS sem aplicar — clone, simula,
        // descarta. Caller real vai chamar applyReview com o card real.
        const preview = (quality: number) => {
          if (session.free) return null;
          const card = { srs: { ...q.srs } };
          applyReview(card, quality, algorithm, examDateMs);
          const due = card.srs?.dueDate ?? Date.now();
          const dDays = Math.max(0, Math.round((due - Date.now()) / DAY_MS));
          if (dDays < 1) return '<1d';
          if (dDays === 1) return '1d';
          if (dDays < 30) return `${dDays}d`;
          if (dDays < 365) return `${Math.round(dDays / 30)}mo`;
          return `${Math.round(dDays / 365)}a`;
        };
        const pAgain = preview(0);
        const pHard = preview(3);
        const pGood = preview(4);
        const pEasy = preview(5);
        return (
          <div className="srs-rate">
            <p className="muted center">Como foi essa questão?</p>
            <div className="row gap center wrap">
              <button type="button" className="rate again" onClick={() => rate(0)}>
                De novo<small>1{pAgain && ` · ${pAgain}`}</small>
              </button>
              <button type="button" className="rate hard" onClick={() => rate(3)}>
                Difícil<small>2{pHard && ` · ${pHard}`}</small>
              </button>
              <button type="button" className="rate good" onClick={() => rate(4)}>
                Bom<small>3 · Enter{pGood && ` · ${pGood}`}</small>
              </button>
              <button type="button" className="rate easy" onClick={() => rate(5)}>
                Fácil<small>4{pEasy && ` · ${pEasy}`}</small>
              </button>
            </div>
          </div>
        );
      })()}

      <div className="row gap right" style={{ marginTop: 16 }}>
        {!answered && (
          <button
            type="button"
            className="ghost"
            onClick={skip}
            title="Pular — não conta como tentativa nem erro"
          >
            Pular<span className="kbd-hint-only"> (Tab)</span>
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

function Summary({
  session,
  onRestart,
  onRepeat,
  onRepeatErradas,
}: {
  session: SessionState;
  onRestart: () => void;
  onRepeat?: () => void;
  onRepeatErradas?: (poolWrongs: Question[]) => void;
}) {
  const allQuestions = useStore(selectActiveQuestions);

  const total = session.correct + session.wrong;
  const pct = total === 0 ? 0 : Math.round((100 * session.correct) / total);
  const elapsed = Math.round((Date.now() - session.startedAt) / 1000);
  const tempoMedio = total > 0 ? Math.round(elapsed / total) : 0;

  // Confetti se 100% acerto e ≥5 questões (pra evitar trigger em sessões
  // triviais de 1-2 questões).
  useEffect(() => {
    if (pct === 100 && total >= 5) {
      triggerConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Comparativo: % média histórica do user (excluindo a sessão atual)
  const mediaHistorica = useMemo(() => {
    let acerto = 0;
    let tentativas = 0;
    for (const q of allQuestions) {
      acerto += q.stats?.correct ?? 0;
      tentativas += q.stats?.attempts ?? 0;
    }
    return tentativas > 0 ? Math.round((acerto / tentativas) * 100) : 0;
  }, [allQuestions]);

  // Disciplinas estudadas nessa sessão. Pra cada uma, conta total +
  // acertos (deduzidos do history das questões filtrado por timestamp
  // >= session.startedAt — essas são as revisões dessa sessão).
  const discsEstudadas = useMemo(() => {
    const m = new Map<string, { total: number; correct: number }>();
    for (const q of session.pool) {
      const d = q.disciplina_id || '—';
      const liveQ = allQuestions.find((x) => x.id === q.id) ?? q;
      const sessionHistory = (liveQ.stats?.history ?? []).filter(
        (h) => h.date >= session.startedAt
      );
      if (sessionHistory.length === 0) continue;
      const agg = m.get(d) ?? { total: 0, correct: 0 };
      for (const h of sessionHistory) {
        agg.total++;
        if (h.result === 'correct' || h.result === 'self_pass') agg.correct++;
      }
      m.set(d, agg);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [session.pool, allQuestions, session.startedAt]);

  // Próximas vencendo até amanhã (excluindo as desta sessão)
  const sessionIds = useMemo(
    () => new Set(session.pool.map((q) => q.id)),
    [session.pool]
  );
  const proximasVencendo = useMemo(() => {
    const tomorrow = startOfDay(Date.now()) + 2 * DAY_MS;
    return allQuestions.filter(
      (q) =>
        !sessionIds.has(q.id) &&
        q.type === 'objetiva' &&
        (q.srs?.dueDate ?? 0) < tomorrow
    ).length;
  }, [allQuestions, sessionIds]);

  const cor =
    pct >= 70
      ? 'var(--primary)'
      : pct >= 50
        ? 'var(--warn, #d97706)'
        : 'var(--danger)';
  const delta = pct - mediaHistorica;

  return (
    <div className="card">
      <h2>Sessão concluída</h2>

      <div
        className="row gap"
        style={{ alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap' }}
      >
        <div>
          <div style={{ fontSize: '2.6rem', fontWeight: 600, color: cor }}>
            {pct}%
          </div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            {session.correct}✓ · {session.wrong}✗ · {session.skipped}↷
          </div>
        </div>
        {total > 0 && mediaHistorica > 0 && (
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              vs sua média histórica ({mediaHistorica}%)
            </div>
            <div
              style={{
                fontSize: '1rem',
                color:
                  delta > 0
                    ? 'var(--primary)'
                    : delta < 0
                      ? 'var(--danger)'
                      : 'var(--muted)',
                fontWeight: 500,
              }}
            >
              {delta > 0 ? '↑ +' : delta < 0 ? '↓ ' : '→ '}
              {Math.abs(delta)}pp{' '}
              {delta > 0
                ? 'acima'
                : delta < 0
                  ? 'abaixo'
                  : 'igual'}
            </div>
          </div>
        )}
      </div>

      {/* Insights pós-sessão: 1-3 observações úteis baseadas em
          performance comparativa, velocidade e marcos. */}
      {(() => {
        const insights: { emoji: string; text: string }[] = [];
        if (total >= 5 && mediaHistorica > 0) {
          if (delta >= 15) {
            insights.push({
              emoji: '🚀',
              text: `Você foi ${Math.abs(delta)}pp acima da sua média (${mediaHistorica}%). Foi um bom dia ou as questões tavam fáceis? Tente subir a dificuldade na próxima.`,
            });
          } else if (delta <= -15) {
            insights.push({
              emoji: '🤔',
              text: `Performance ${Math.abs(delta)}pp abaixo da média. Tema novo? Considere uma sessão de revisão das erradas antes de avançar.`,
            });
          }
        }
        if (total >= 8 && pct >= 95) {
          insights.push({
            emoji: '🎯',
            text: `${pct}% num pool de ${total}+ questões é dominância. Hora de aumentar a dificuldade ou intercalar disciplinas pra forçar generalização.`,
          });
        }
        if (total > 0 && tempoMedio > 90) {
          insights.push({
            emoji: '⏱',
            text: `Tempo médio ${tempoMedio}s/questão é alto. Cansaço, ou enunciados longos? Pausa de 5min pode ajudar.`,
          });
        }
        if (elapsed >= 45 * 60) {
          insights.push({
            emoji: '☕',
            text: `Sessão de ${Math.round(elapsed / 60)}min — sua atenção começa a cair depois de 45min. Quebra com um pomodoro?`,
          });
        }
        if (insights.length === 0) return null;
        return (
          <div
            style={{
              background: 'var(--primary-soft)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius)',
              padding: 12,
              marginBottom: 14,
            }}
          >
            <strong style={{ fontSize: '0.92rem' }}>💡 Insights</strong>
            <ul
              style={{
                margin: '8px 0 0',
                paddingLeft: 4,
                listStyle: 'none',
                fontSize: '0.88rem',
                lineHeight: 1.55,
              }}
            >
              {insights.slice(0, 3).map((ins, i) => (
                <li
                  key={i}
                  style={{ marginBottom: i < insights.length - 1 ? 6 : 0 }}
                >
                  <span style={{ marginRight: 6 }}>{ins.emoji}</span>
                  {ins.text}
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {(() => {
        // Lista de questões erradas nesta sessão (com link rápido pra
        // /banco?id pra ler o gabarito/explicação ou editar nota).
        const allWrongs = session.pool
          .map((q) => {
            const live = allQuestions.find((x) => x.id === q.id);
            const sessionHist = (live?.stats?.history ?? []).filter(
              (h) => h.date >= session.startedAt
            );
            const lastWrong = sessionHist[sessionHist.length - 1];
            if (!lastWrong) return null;
            if (lastWrong.result === 'correct' || lastWrong.result === 'self_pass') return null;
            const enun =
              (q.payload as Record<string, unknown>).enunciado ??
              (q.payload as Record<string, unknown>).enunciado_completo ??
              (q.payload as Record<string, unknown>).texto ??
              (q.payload as Record<string, unknown>).frente ??
              '';
            return { id: q.id, preview: String(enun).slice(0, 100), disc: q.disciplina_id ?? '' };
          })
          .filter((w): w is NonNullable<typeof w> => !!w);
        const wrongs = allWrongs.slice(0, 5);
        if (wrongs.length === 0) return null;
        return (
          <div
            style={{
              background: 'var(--danger-soft, rgba(239, 68, 68, 0.08))',
              border: '1px solid var(--danger, #ef4444)',
              borderRadius: 'var(--radius)',
              padding: 12,
              marginBottom: 14,
            }}
          >
            <div className="row between" style={{ marginBottom: 6, alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <strong>
                ✗ Erradas nesta sessão ({allWrongs.length})
              </strong>
              {allWrongs.length > 5 && (
                <Link
                  href={`/estudar?modo=erros&qtd=${allWrongs.length}&auto=1`}
                  style={{ fontSize: '0.82rem' }}
                >
                  Estudar todas →
                </Link>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {wrongs.map((w) => (
                <Link
                  key={w.id}
                  href={`/banco?search=${encodeURIComponent('id:' + w.id)}`}
                  style={{
                    fontSize: '0.82rem',
                    padding: '4px 8px',
                    background: 'var(--bg-elev-2)',
                    borderRadius: 4,
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title="Abrir no /banco pra ler explicação ou anotar"
                >
                  {w.disc && <span className="muted">{w.disc} · </span>}
                  {w.preview}
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      <ul style={{ marginBottom: 14 }}>
        <li>
          ⏱ Tempo total: <strong>{elapsed}s</strong>
          {tempoMedio > 0 && ` (${tempoMedio}s/questão)`}
        </li>
        {discsEstudadas.length > 0 && (
          <li>
            📚 Por disciplina:{' '}
            <strong>
              {discsEstudadas
                .map(([d, s]) => {
                  const pct = s.total > 0 ? Math.round((100 * s.correct) / s.total) : 0;
                  return `${d}: ${s.correct}/${s.total} (${pct}%)`;
                })
                .join(' · ')}
            </strong>
          </li>
        )}
        {proximasVencendo > 0 && (
          <li>
            🎯 Próximas vencendo: <strong>{proximasVencendo}</strong> questão(ões)
            até amanhã
          </li>
        )}
      </ul>

      <div className="row gap wrap">
        <button type="button" className="primary" onClick={onRestart}>
          Nova sessão
        </button>
        {onRepeat && (
          <button
            type="button"
            onClick={onRepeat}
            title="Refaz as mesmas questões em modo livre (não altera SRS)"
          >
            🔁 Repetir essas mesmas
          </button>
        )}
        {onRepeatErradas && (() => {
          const wrongs = session.pool
            .map((q) => {
              const live = allQuestions.find((x) => x.id === q.id);
              const sessionHist = (live?.stats?.history ?? []).filter(
                (h) => h.date >= session.startedAt
              );
              const lastWrong = sessionHist[sessionHist.length - 1];
              if (!lastWrong) return null;
              if (lastWrong.result === 'correct' || lastWrong.result === 'self_pass')
                return null;
              return live ?? q;
            })
            .filter((q): q is Question => !!q);
          if (wrongs.length === 0) return null;
          return (
            <button
              type="button"
              onClick={() => onRepeatErradas(wrongs)}
              title="Refaz só as questões que você errou nesta sessão (modo livre)"
              style={{
                background: 'var(--danger-soft, #4a1d1d)',
                borderColor: 'var(--danger, #ef4444)',
                color: 'var(--danger, #ef4444)',
              }}
            >
              ✗ Repetir {wrongs.length} errada(s)
            </button>
          );
        })()}
        {proximasVencendo > 0 && (
          <Link
            href={`/estudar?modo=srs&qtd=${Math.min(20, proximasVencendo)}&auto=1`}
          >
            <button type="button">
              ▶ Continuar com {Math.min(20, proximasVencendo)} vencendo
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Tempo decorrido na sessão atual. Atualiza a cada segundo.
 * Mostra MM:SS pra brevidade.
 */
function SessionElapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  const sec = Math.floor((now - startedAt) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const label = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  return (
    <span className="small" style={{ marginLeft: 6 }}>
      ⏱ {label}
    </span>
  );
}
