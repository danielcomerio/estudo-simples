'use client';

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
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
import { renderClozeHTML } from '@/lib/cloze';
import type {
  ClozePayload,
  DiscSessionConfig,
  FlashcardPayload,
  Question,
} from '@/lib/types';
import { QuestionImages } from './QuestionImages';

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

type CardConfig = DiscSessionConfig & { kind: CardKind };

const defaultCfg: CardConfig = {
  disciplinas: [],
  qtd: 20,
  modo: 'srs',
  kind: 'both',
  interleaving: false,
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
  const [cfg, setCfg] = useState<CardConfig>(defaultCfg);
  const [pool, setPool] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);

  const totalCards = useMemo(
    () => all.filter((q) => q.type === 'cloze' || q.type === 'flashcard').length,
    [all]
  );

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
      <CardView
        q={pool[idx]}
        idx={idx}
        total={pool.length}
        onNext={next}
        onQuit={() => {
          setPool([]);
          setPhase('config');
        }}
      />
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

      <h2>Cards (Cloze + Flashcard)</h2>
      <p className="muted" style={{ marginTop: -4, fontSize: '0.9rem' }}>
        Revisão tipo Anki — texto com lacunas (Cloze) ou frente/verso
        (Flashcard). Importe via JSON em <code>/banco</code>; aqui você
        estuda os existentes.
      </p>

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
  onNext,
  onQuit,
}: {
  q: Question;
  idx: number;
  total: number;
  onNext: () => void;
  onQuit: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const algorithm = useAlgorithm();

  // Reset ao trocar
  useEffect(() => {
    setRevealed(false);
  }, [q.id]);

  // Atalhos: espaço/enter pra revelar; depois 1-4 pra rate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setRevealed(true);
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
  }, [revealed, q.id]);

  const rate = (quality: number) => {
    const card: { srs: typeof q.srs } = { srs: { ...q.srs } };
    applyReview(card, quality, algorithm);

    // Considera "correto" para stats se quality >= 3
    const isCorrect = quality >= 3;
    const newHistory = [
      ...(q.stats?.history || []).slice(-49),
      {
        date: Date.now(),
        result: isCorrect ? ('correct' as const) : ('wrong' as const),
        quality,
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
    onNext();
  };

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: '0.88rem' }}>
          {idx + 1}/{total} ·{' '}
          {q.type === 'cloze' ? '🟦 Cloze' : '🃏 Flashcard'}
          {q.disciplina_id && ' · ' + q.disciplina_id}
        </div>
        <button type="button" className="ghost" onClick={onQuit}>
          Sair
        </button>
      </div>

      {q.type === 'cloze' ? (
        <ClozeBody payload={q.payload as ClozePayload} revealed={revealed} />
      ) : (
        <FlashcardBody
          payload={q.payload as FlashcardPayload}
          revealed={revealed}
        />
      )}

      <QuestionImages urls={(q.payload as { imagens?: string[] }).imagens} />

      {!revealed ? (
        <div className="row gap" style={{ marginTop: 18 }}>
          <button
            type="button"
            className="primary"
            onClick={() => setRevealed(true)}
          >
            {q.type === 'cloze' ? 'Revelar lacunas' : 'Virar (verso)'} (Enter)
          </button>
        </div>
      ) : (
        <div
          className="row gap"
          style={{
            marginTop: 18,
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <button type="button" className="danger" onClick={() => rate(0)}>
            1 · De novo
          </button>
          <button type="button" onClick={() => rate(3)}>
            2 · Difícil
          </button>
          <button type="button" className="primary" onClick={() => rate(4)}>
            3 · Bom
          </button>
          <button type="button" onClick={() => rate(5)}>
            4 · Fácil
          </button>
        </div>
      )}
    </div>
  );
}

function ClozeBody({
  payload,
  revealed,
}: {
  payload: ClozePayload;
  revealed: boolean;
}) {
  const html = useMemo(
    () => renderClozeHTML(payload.texto ?? '', revealed ? 'revealed' : 'hidden'),
    [payload.texto, revealed]
  );
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
      {revealed && payload.explicacao && (
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
    </div>
  );
}
