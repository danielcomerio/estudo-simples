'use client';

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  selectActiveQuestions,
  updateQuestionLocal,
  useStore,
  selectDisciplinas,
} from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { applyReview } from '@/lib/srs-fsrs';
import { useAlgorithm, setActiveConcursoId } from '@/lib/settings';
import {
  filterDisciplinaIdsByActiveConcurso,
  matchActiveConcurso,
  useActiveConcursoFilter,
} from '@/lib/hierarchy';
import { interleaveByGroup, renderRichText, shuffle } from '@/lib/utils';
import { clearSession, readSession, saveSession } from '@/lib/session-store';
import { clearQueue as clearStudyQueue, readQueue as readStudyQueue } from '@/lib/study-queue';
import { appendSession } from '@/lib/sessions-log';
import { loadPrefs, savePrefs } from '@/lib/session-prefs';
import { renderClozeHTML } from '@/lib/cloze';
import { haptic } from '@/lib/haptic';
import { acquireWakeLock } from '@/lib/wake-lock';
import { useSwipe } from '@/lib/use-swipe';
import { UndoChip } from './UndoChip';
import { toast } from './Toast';
import type {
  ClozePayload,
  DiscSessionConfig,
  FlashcardPayload,
  Question,
} from '@/lib/types';
import { QuestionImages } from './QuestionImages';
import { GabaritoSourceBadge } from './GabaritoSourceBadge';

/**
 * Runner unificado pra Cloze e Flashcard. Ambos têm o mesmo fluxo:
 *  1. Mostra parte inicial (cloze: texto com lacunas; flashcard: frente)
 *  2. User clica "Revelar" / "Virar"
 *  3. Mostra resposta completa
 *  4. Autoavaliação (4 botões: De novo / Difícil / Bom / Fácil)
 *  5. Aplica SRS, próxima
 *
 * Filtra por concurso ativo. Tipo escolhido na config (cloze, flashcard
 * ou ambos).
 */

type Phase = 'config' | 'running' | 'summary';
type CardKind = 'cloze' | 'flashcard' | 'both';

type CardConfig = DiscSessionConfig & { kind: CardKind; free?: boolean };

const defaultCfg: CardConfig = {
  disciplinas: [],
  qtd: 20,
  modo: 'srs',
  kind: 'both',
  interleaving: false,
  free: false,
};

function buildPool(all: Question[], cfg: CardConfig): Question[] {
  let pool = all.filter((q) =>
    cfg.kind === 'both'
      ? q.type === 'cloze' || q.type === 'flashcard'
      : q.type === cfg.kind
  );
  if (cfg.disciplinas.length) {
    const set = new Set(cfg.disciplinas);
    pool = pool.filter((q) => q.disciplina_id && set.has(q.disciplina_id));
  }
  if (cfg.modo === 'novas') pool = pool.filter((q) => !q.srs?.lastReviewed);
  if (cfg.modo === 'aleatorio') pool = shuffle(pool);
  else if (cfg.modo === 'srs') {
    pool = pool
      .slice()
      .sort((a, b) => (a.srs?.dueDate ?? 0) - (b.srs?.dueDate ?? 0));
  }
  const truncated = pool.slice(0, Math.max(1, cfg.qtd));
  if (cfg.interleaving) {
    return interleaveByGroup(truncated, (q) => q.disciplina_id ?? '(sem)');
  }
  return truncated;
}

export function CardsRunner() {
  const userId = useStore((s) => s.userId);
  const allRaw = useStore(selectActiveQuestions);
  const disciplinasRaw = useStore(selectDisciplinas);
  const { concurso: activeConcurso, disciplinaNomes: concursoDiscNomes } =
    useActiveConcursoFilter();

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
  const [cfg, setCfgRaw] = useState<CardConfig>(defaultCfg);
  useEffect(() => {
    const saved = loadPrefs<Partial<CardConfig>>('cards');
    if (saved) setCfgRaw((c) => ({ ...c, ...saved, disciplinas: [] }));
  }, []);

  // Wake Lock: tela acesa durante sessão de cards
  useEffect(() => {
    if (phase !== 'running') return;
    const lock = acquireWakeLock();
    return () => lock.release();
  }, [phase]);
  const setCfg = (next: CardConfig | ((prev: CardConfig) => CardConfig)) => {
    setCfgRaw((prev) => {
      const resolved =
        typeof next === 'function' ? (next as (p: CardConfig) => CardConfig)(prev) : next;
      const { disciplinas: _d, ...rest } = resolved;
      savePrefs('cards', rest);
      return resolved;
    });
  };
  const [pool, setPool] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  // Marca início da sessão pra calcular durationMs no log final.
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

  // Sessão pausada
  const [pausedAvailable, setPausedAvailable] = useState<{
    pool: Question[];
    idx: number;
  } | null>(null);

  useEffect(() => {
    if (!userId || phase !== 'config') return;
    const stored = readSession(userId, 'cards');
    if (!stored) return;
    const restoredPool = stored.poolIds
      .map((id) =>
        allRaw.find(
          (q) => q.id === id && (q.type === 'cloze' || q.type === 'flashcard')
        )
      )
      .filter((q): q is Question => !!q);
    if (restoredPool.length === 0 || stored.idx >= restoredPool.length) {
      clearSession('cards');
      return;
    }
    setPausedAvailable({ pool: restoredPool, idx: stored.idx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, allRaw.length]);

  // Persiste sessão atual
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
      'cards'
    );
  }, [userId, phase, pool, idx]);

  const resumePaused = () => {
    if (!pausedAvailable) return;
    setPool(pausedAvailable.pool);
    setIdx(pausedAvailable.idx);
    setPausedAvailable(null);
    setPhase('running');
  };

  const discardPaused = () => {
    setPausedAvailable(null);
    clearSession('cards');
  };

  // Auto-start: 1 card via ?qid=ID, ou fila de IDs via ?queue=1
  const searchParams = useSearchParams();
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current || phase !== 'config') return;
    const qid = searchParams.get('qid');
    if (qid) {
      const q = allRaw.find(
        (x) => x.id === qid && (x.type === 'cloze' || x.type === 'flashcard')
      );
      if (q) {
        autoStartedRef.current = true;
        setPool([q]);
        setIdx(0);
        setPhase('running');
      }
      return;
    }
    if (searchParams.get('queue') === '1') {
      const qd = readStudyQueue();
      if (qd && qd.kind === 'cards' && qd.ids.length > 0) {
        const queuePool = qd.ids
          .map((id) =>
            allRaw.find(
              (x) => x.id === id && (x.type === 'cloze' || x.type === 'flashcard')
            )
          )
          .filter((x): x is Question => !!x);
        if (queuePool.length > 0) {
          autoStartedRef.current = true;
          clearStudyQueue();
          setPool(queuePool);
          setIdx(0);
          setPhase('running');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allRaw]);

  const totalCards = useMemo(
    () => all.filter((q) => q.type === 'cloze' || q.type === 'flashcard').length,
    [all]
  );

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
        kind: 'cards',
        startedAt: sessionStartRef.current,
        endedAt: Date.now(),
        total: pool.length,
        correct: 0,
        wrong: 0,
        durationMs: Date.now() - sessionStartRef.current,
      });
      clearSession('cards');
      setPhase('summary');
    } else setIdx(idx + 1);
  };

  // Snapshot pra undo da última rate. Vive no pai pra sobreviver à
  // transição entre cards.
  const [undoSnap, setUndoSnap] = useState<{
    qid: string;
    prevSrs: Question['srs'];
    prevStats: Question['stats'];
    prevIdx: number;
  } | null>(null);

  const undoLastRate = () => {
    if (!undoSnap) return;
    const prev = (pool.find((q) => q.id === undoSnap.qid) as Question | undefined);
    if (prev) {
      updateQuestionLocal(prev.id, {
        srs: undoSnap.prevSrs,
        stats: {
          attempts: Math.max(0, (undoSnap.prevStats?.attempts ?? 1) - 1),
          correct: undoSnap.prevStats?.correct ?? 0,
          wrong: undoSnap.prevStats?.wrong ?? 0,
          history: (undoSnap.prevStats?.history ?? []).slice(0, -1),
        },
      });
    }
    setIdx(undoSnap.prevIdx);
    setUndoSnap(null);
    scheduleSync(800);
  };

  // Atalho Z desfaz último rate (enquanto chip está visível)
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

  if (phase === 'running' && pool[idx]) {
    return (
      <>
        {undoSnap && (
          <UndoChip
            onUndo={undoLastRate}
            onDismiss={() => setUndoSnap(null)}
          />
        )}
        <CardView
          q={pool[idx]}
          idx={idx}
          total={pool.length}
          free={!!cfg.free}
          onNext={next}
          onRated={(snap) => setUndoSnap({ ...snap, prevIdx: idx })}
          onQuit={() => {
            clearSession('cards');
            setPool([]);
            setPhase('config');
          }}
        />
      </>
    );
  }

  if (phase === 'summary') {
    return (
      <div className="card">
        <h2>Sessão concluída</h2>
        <p>Você revisou {pool.length} card(s).</p>
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
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>
            🎯 Concurso: <strong>{activeConcurso.nome}</strong> ·{' '}
            {totalCards} card(s)
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
            <strong>{pausedAvailable.pool.length}</strong> cards
          </div>
          <div className="row gap">
            <button type="button" className="primary" onClick={resumePaused}>
              ▶ Continuar
            </button>
            <button type="button" className="ghost" onClick={discardPaused}>
              Descartar
            </button>
          </div>
        </div>
      )}

      <h2>Cards (Cloze + Flashcard)</h2>
      <p className="muted" style={{ marginTop: -4, fontSize: '0.9rem' }}>
        Revisão tipo Anki — texto com lacunas (Cloze) ou frente/verso
        (Flashcard). Importe via JSON em <code>/banco</code>; aqui você
        estuda os existentes.
      </p>

      {totalCards === 0 && (
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
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>🃏</div>
          <strong>Nenhum card{activeConcurso ? ' neste concurso' : ''}</strong>
          <p
            className="muted"
            style={{ margin: '6px 0 12px', fontSize: '0.9rem' }}
          >
            Crie cards manualmente em <code>/banco</code> (botão + Nova) ou
            importe um JSON com type=cloze/flashcard.
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
          <small>Vazio = todas.</small>
        </label>
        <label>
          <span>Tipo</span>
          <select
            value={cfg.kind}
            onChange={(e) => setCfg({ ...cfg, kind: e.target.value as CardKind })}
          >
            <option value="both">Cloze + Flashcard</option>
            <option value="cloze">Só Cloze</option>
            <option value="flashcard">Só Flashcard</option>
          </select>
        </label>
        <label>
          <span>Quantidade</span>
          <input
            type="number"
            min={1}
            max={500}
            value={cfg.qtd}
            onChange={(e) =>
              setCfg({ ...cfg, qtd: parseInt(e.target.value) || 1 })
            }
          />
        </label>
        <label>
          <span>Modo</span>
          <select
            value={cfg.modo}
            onChange={(e) =>
              setCfg({ ...cfg, modo: e.target.value as CardConfig['modo'] })
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
            onChange={(e) => setCfg({ ...cfg, interleaving: e.target.checked })}
          />
          <span>Intercalar disciplinas</span>
        </label>
        <label
          className="check-row"
          title="Treina sem mover o agendamento (não atualiza SRS nem stats)"
        >
          <input
            type="checkbox"
            checked={!!cfg.free}
            onChange={(e) => setCfg({ ...cfg, free: e.target.checked })}
          />
          <span>Modo treino (não afeta SRS)</span>
        </label>
      </div>
      <div className="row gap" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="primary"
          disabled={totalCards === 0}
          onClick={start}
        >
          Iniciar
        </button>
        <span className="muted">{totalCards} card(s) no banco</span>
      </div>
    </div>
  );
}

function CardView({
  q,
  idx,
  total,
  free,
  onNext,
  onRated,
  onQuit,
}: {
  q: Question;
  idx: number;
  total: number;
  free: boolean;
  onNext: () => void;
  onRated?: (snap: {
    qid: string;
    prevSrs: Question['srs'];
    prevStats: Question['stats'];
  }) => void;
  onQuit: () => void;
}) {
  // Pra cloze: revelados = quantas lacunas já foram reveladas (0..N).
  //   Quando >= total, equivale a "totalmente revelado" (autoavaliação).
  // Pra flashcard: 0 = frente / >=1 = verso revelado.
  const [revealed, setRevealed] = useState(0);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const algorithm = useAlgorithm();
  const { concurso: activeConcurso } = useActiveConcursoFilter();
  const examDateMs = useMemo(() => {
    if (!activeConcurso?.data_prova) return null;
    const t = new Date(activeConcurso.data_prova).getTime();
    return Number.isNaN(t) ? null : t;
  }, [activeConcurso?.data_prova]);

  const totalBlanks = useMemo(() => {
    if (q.type !== 'cloze') return 1;
    const p = q.payload as ClozePayload;
    const matches = (p.texto ?? '').match(/\{\{c\d+::/g);
    return matches?.length ?? 0;
  }, [q.id, q.type, q.payload]);

  // "Totalmente revelado" = mostrou tudo, hora de autoavaliar
  const allRevealed = revealed >= totalBlanks;

  // Reset ao trocar
  useEffect(() => {
    setRevealed(0);
    setConfidence(null);
  }, [q.id]);

  // Atalhos: espaço/enter pra revelar próximo; após tudo revelado, 1-4 pra rate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Esc sai a qualquer momento
      if (e.key === 'Escape') {
        e.preventDefault();
        onQuit();
        return;
      }
      if (!allRevealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setRevealed((r) => r + 1);
        }
        // Tab pula card (skip — não conta como study)
        if (e.key === 'Tab') {
          e.preventDefault();
          toast('↪ Pulado', '', 1200);
          onNext();
        }
      } else {
        if (e.key === '1') rate(0);
        else if (e.key === '2') rate(3);
        else if (e.key === '3' || e.key === 'Enter' || e.key === ' ') rate(4);
        else if (e.key === '4') rate(5);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRevealed, q.id]);

  // Swipe: ← pula (não rate); → revela próxima lacuna/verso
  useSwipe({
    onLeft: () => {
      if (!allRevealed) onNext();
    },
    onRight: () => {
      if (!allRevealed) setRevealed((r) => r + 1);
    },
  });

  const rate = (quality: number) => {
    haptic(quality >= 3 ? 'success' : 'error');
    if (free) {
      // Modo treino: não toca em SRS nem stats — só avança
      onNext();
      return;
    }
    // Snapshot pra undo (capturado ANTES de mutar)
    const snap = {
      qid: q.id,
      prevSrs: { ...q.srs },
      prevStats: { ...q.stats },
    };
    const card: { srs: typeof q.srs } = { srs: { ...q.srs } };
    applyReview(card, quality, algorithm, examDateMs);

    // Considera "correto" para stats se quality >= 3
    const isCorrect = quality >= 3;
    const newHistory = [
      ...(q.stats?.history || []).slice(-49),
      {
        date: Date.now(),
        result: isCorrect ? ('correct' as const) : ('wrong' as const),
        quality,
        ...(confidence !== null && { confidence }),
      },
    ];

    updateQuestionLocal(q.id, {
      srs: card.srs,
      stats: {
        attempts: (q.stats?.attempts || 0) + 1,
        correct: (q.stats?.correct || 0) + (isCorrect ? 1 : 0),
        wrong: (q.stats?.wrong || 0) + (isCorrect ? 0 : 1),
        history: newHistory,
      },
    });
    scheduleSync(800);
    onRated?.(snap);
    onNext();
  };

  const progressPct = Math.round(((idx + (allRevealed ? 1 : 0)) / total) * 100);

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="muted" style={{ fontSize: '0.88rem' }}>
          {idx + 1}/{total} ·{' '}
          {q.type === 'cloze' ? '🟦 Cloze' : '🃏 Flashcard'}
          {q.disciplina_id && ' · ' + q.disciplina_id}
          {free && (
            <span
              style={{
                marginLeft: 6,
                background: 'var(--bg-elev-2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: '0.75rem',
              }}
              title="Modo treino — não atualiza SRS"
            >
              treino
            </span>
          )}
        </div>
        <button type="button" className="ghost" onClick={onQuit}>
          Sair
        </button>
      </div>

      <div className="session-progress-bar" style={{ marginBottom: 12 }}>
        <div className="fill" style={{ width: progressPct + '%' }} />
      </div>

      {q.type === 'cloze' ? (
        <ClozeBody
          payload={q.payload as ClozePayload}
          revealedCount={revealed}
          totalBlanks={totalBlanks}
        />
      ) : (
        <FlashcardBody
          payload={q.payload as FlashcardPayload}
          revealed={allRevealed}
        />
      )}

      <QuestionImages urls={(q.payload as { imagens?: string[] }).imagens} />

      {/* Badge de origem do gabarito — só aparece após revelar tudo
          (fica em pé de igualdade com QuestionRunner que mostra junto
          com gabarito). Pra cloze/flashcard, "gabarito" é a resposta
          revelada; aviso quando IA-gerado. */}
      {allRevealed && q.fonte?.gabarito_source && (
        <div
          style={{
            margin: '8px 0',
            padding: '8px 12px',
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            Origem da resposta:
          </span>
          <GabaritoSourceBadge source={q.fonte.gabarito_source} size="medium" />
          {q.fonte.gabarito_source === 'ia' && (
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              ⚠ Valide contra fonte oficial.
            </span>
          )}
        </div>
      )}

      {!allRevealed && (
        <div
          role="radiogroup"
          aria-label="Confiança antes de revelar"
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
            margin: '12px 0 4px',
            padding: '8px 10px',
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
            fontSize: '0.85rem',
          }}
        >
          <span className="muted" style={{ marginRight: 4 }}>
            Quão certo está? <em>(opcional)</em>
          </span>
          {[
            { v: 1 as const, label: '🤔 Chutei' },
            { v: 2 as const, label: '😐 Incerto' },
            { v: 3 as const, label: '💪 Confiante' },
          ].map((opt) => {
            const isOn = confidence === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
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

      {!allRevealed && (
        <p
          className="muted"
          style={{
            marginTop: 12,
            marginBottom: 0,
            fontSize: '0.82rem',
            fontStyle: 'italic',
          }}
        >
          💡 Pense na resposta antes de revelar — esse momento de
          esforço fortalece a memorização (active recall).
        </p>
      )}

      {!allRevealed ? (
        <div className="row gap" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="primary"
            onClick={() => setRevealed((r) => r + 1)}
          >
            {q.type === 'cloze'
              ? totalBlanks > 1
                ? `Revelar próxima (${revealed + 1}/${totalBlanks}) [Enter]`
                : 'Revelar [Enter]'
              : 'Virar (verso) [Enter]'}
          </button>
          {q.type === 'cloze' && totalBlanks > 1 && revealed > 0 && (
            <button
              type="button"
              className="ghost"
              onClick={() => setRevealed(totalBlanks)}
            >
              Revelar todas
            </button>
          )}
        </div>
      ) : free ? (
        <div className="row gap" style={{ marginTop: 18 }}>
          <button type="button" className="primary" onClick={() => rate(4)}>
            Próxima [Enter]
          </button>
        </div>
      ) : (() => {
        const preview = (quality: number) => {
          if (free) return '';
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
          <div
            className="row gap"
            style={{
              marginTop: 18,
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <button type="button" className="danger" onClick={() => rate(0)}>
              1 · De novo{preview(0) && ` · ${preview(0)}`}
            </button>
            <button type="button" onClick={() => rate(3)}>
              2 · Difícil{preview(3) && ` · ${preview(3)}`}
            </button>
            <button type="button" className="primary" onClick={() => rate(4)}>
              3 · Bom{preview(4) && ` · ${preview(4)}`}
            </button>
            <button type="button" onClick={() => rate(5)}>
              4 · Fácil{preview(5) && ` · ${preview(5)}`}
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function ClozeBody({
  payload,
  revealedCount,
  totalBlanks,
}: {
  payload: ClozePayload;
  revealedCount: number;
  totalBlanks: number;
}) {
  const html = useMemo(
    () => renderClozeHTML(payload.texto ?? '', revealedCount),
    [payload.texto, revealedCount]
  );
  const allRevealed = revealedCount >= totalBlanks;
  return (
    <div>
      <div
        style={{
          fontSize: '1.05rem',
          lineHeight: 1.7,
          padding: 14,
          background: 'var(--bg-elev-2)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {allRevealed && payload.explicacao && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: 'var(--bg-elev)',
            borderRadius: 'var(--radius)',
            fontSize: '0.92rem',
          }}
          dangerouslySetInnerHTML={{
            __html:
              '<strong>Explicação:</strong> ' +
              renderRichText(payload.explicacao),
          }}
        />
      )}
      {allRevealed && (payload as { mnemonic?: string }).mnemonic && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            background: 'var(--primary-soft)',
            borderLeft: '3px solid var(--primary)',
            paddingLeft: 12,
            borderRadius: 'var(--radius)',
            fontSize: '0.92rem',
          }}
          dangerouslySetInnerHTML={{
            __html:
              '<strong>🧠 Mnemônico:</strong> ' +
              renderRichText((payload as { mnemonic?: string }).mnemonic ?? ''),
          }}
        />
      )}
    </div>
  );
}

function FlashcardBody({
  payload,
  revealed,
}: {
  payload: FlashcardPayload;
  revealed: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: '1.1rem',
          lineHeight: 1.6,
          padding: 18,
          background: 'var(--bg-elev-2)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          minHeight: 80,
        }}
        dangerouslySetInnerHTML={{ __html: renderRichText(payload.frente) }}
      />
      {revealed && (
        <div
          style={{
            fontSize: '1rem',
            lineHeight: 1.6,
            padding: 14,
            background: 'var(--primary-soft)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--primary)',
          }}
          dangerouslySetInnerHTML={{ __html: renderRichText(payload.verso) }}
        />
      )}
      {revealed && (payload as { mnemonic?: string }).mnemonic && (
        <div
          style={{
            fontSize: '0.92rem',
            padding: 10,
            background: 'var(--bg-elev-2)',
            borderLeft: '3px solid var(--primary)',
            paddingLeft: 12,
            borderRadius: 'var(--radius)',
          }}
          dangerouslySetInnerHTML={{
            __html:
              '<strong>🧠 Mnemônico:</strong> ' +
              renderRichText((payload as { mnemonic?: string }).mnemonic ?? ''),
          }}
        />
      )}
    </div>
  );
}
