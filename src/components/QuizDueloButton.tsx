'use client';

import { useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import { Modal } from './Modal';
import { renderRichText } from '@/lib/utils';

/**
 * Modo "Quiz Duelo": user vs IA (random com taxa configurável). Pra
 * brincadeira solo. Não afeta SRS — modo livre.
 *
 * IA "responde" cada questão: random com prob = aiAccuracy.
 * Quem acertar mais ao fim das 10 ganha.
 */
export function QuizDueloButton() {
  const all = useStore(selectActiveQuestions);
  const [open, setOpen] = useState(false);
  const [aiAccuracy, setAIAccuracy] = useState(0.7);
  const [pool, setPool] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [scoreYou, setScoreYou] = useState(0);
  const [scoreAI, setScoreAI] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const objetivas = all.filter((q) => q.type === 'objetiva');
  const enough = objetivas.length >= 10;

  const start = () => {
    const shuffled = [...objetivas].sort(() => Math.random() - 0.5).slice(0, 10);
    setPool(shuffled.map((q) => q.id));
    setIdx(0);
    setScoreYou(0);
    setScoreAI(0);
    setChosen(null);
    setShowResult(false);
  };

  const submit = (letra: string) => {
    if (chosen) return;
    setChosen(letra);
    const q = all.find((x) => x.id === pool[idx]);
    if (!q) return;
    const p = q.payload as { alternativas?: Array<{ letra: string; correta?: boolean }> };
    const correta = p.alternativas?.find((a) => a.correta)?.letra;
    if (letra === correta) setScoreYou((s) => s + 1);
    if (Math.random() < aiAccuracy) setScoreAI((s) => s + 1);
    setShowResult(true);
  };

  const next = () => {
    if (idx + 1 >= pool.length) {
      // Fim do duelo — mantém open com tela de resultado final
      setIdx(pool.length); // fora do pool = tela final
      return;
    }
    setIdx(idx + 1);
    setChosen(null);
    setShowResult(false);
  };

  const finished = pool.length > 0 && idx >= pool.length;
  const currentQ = pool.length > 0 && idx < pool.length ? all.find((x) => x.id === pool[idx]) : null;

  return (
    <>
      <button
        type="button"
        className="ghost"
        onClick={() => {
          setOpen(true);
          if (pool.length === 0) start();
        }}
        title="Você vs IA — quem acerta mais em 10 questões?"
        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
        disabled={!enough}
      >
        ⚔ Quiz duelo {!enough && '(min 10 objetivas)'}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Quiz duelo" maxWidth="720px">
          <div style={{ padding: 14 }}>
            <div className="row gap" style={{ alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>⚔ Quiz duelo</h3>
              <span style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Você {scoreYou} · IA {scoreAI}
              </span>
            </div>
            {pool.length === 0 ? (
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  Dificuldade da IA:{' '}
                  <strong>{Math.round(aiAccuracy * 100)}%</strong>
                </label>
                <input
                  type="range"
                  min={40}
                  max={95}
                  step={5}
                  value={aiAccuracy * 100}
                  onChange={(e) => setAIAccuracy(parseInt(e.target.value, 10) / 100)}
                  style={{ width: '100%' }}
                />
                <button
                  type="button"
                  className="primary"
                  onClick={start}
                  disabled={!enough}
                  style={{ marginTop: 10 }}
                >
                  Começar 10 questões
                </button>
              </div>
            ) : finished ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <h2 style={{ marginTop: 0 }}>
                  {scoreYou > scoreAI ? '🏆 Você venceu!' : scoreYou < scoreAI ? '🤖 IA venceu' : '🤝 Empate'}
                </h2>
                <p style={{ fontSize: '1.1rem' }}>
                  Você: <strong>{scoreYou}</strong> · IA: <strong>{scoreAI}</strong>
                </p>
                <button type="button" className="primary" onClick={start}>
                  ↻ Nova partida
                </button>
              </div>
            ) : currentQ ? (
              <DueloQuestion
                question={currentQ}
                idx={idx}
                total={pool.length}
                chosen={chosen}
                showResult={showResult}
                onSubmit={submit}
                onNext={next}
              />
            ) : null}
          </div>
        </Modal>
      )}
    </>
  );
}

function DueloQuestion({
  question,
  idx,
  total,
  chosen,
  showResult,
  onSubmit,
  onNext,
}: {
  question: { id: string; payload: unknown };
  idx: number;
  total: number;
  chosen: string | null;
  showResult: boolean;
  onSubmit: (letra: string) => void;
  onNext: () => void;
}) {
  const p = question.payload as {
    enunciado?: string;
    alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>;
  };
  const correta = p.alternativas?.find((a) => a.correta)?.letra;

  return (
    <div>
      <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 6 }}>
        Questão {idx + 1}/{total}
      </div>
      <div
        style={{ fontSize: '0.92rem', marginBottom: 10 }}
        dangerouslySetInnerHTML={{ __html: renderRichText(p.enunciado ?? '') }}
      />
      <div className="row gap wrap" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {(p.alternativas ?? []).map((a) => {
          const isChosen = chosen === a.letra;
          const isCorrect = correta === a.letra;
          let bg: string | undefined;
          if (showResult) {
            if (isCorrect) bg = 'var(--primary-soft)';
            else if (isChosen) bg = 'rgba(220, 38, 38, 0.12)';
          }
          return (
            <button
              key={a.letra}
              type="button"
              onClick={() => onSubmit(a.letra)}
              disabled={!!chosen}
              style={{
                padding: '8px 12px',
                textAlign: 'left',
                fontSize: '0.88rem',
                background: bg,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: chosen ? 'default' : 'pointer',
              }}
            >
              <strong>{a.letra})</strong> {a.texto}
              {showResult && isCorrect && ' ✅'}
              {showResult && isChosen && !isCorrect && ' ❌'}
            </button>
          );
        })}
      </div>
      {showResult && (
        <button
          type="button"
          className="primary"
          onClick={onNext}
          style={{ marginTop: 12 }}
        >
          {idx + 1 >= total ? 'Ver resultado' : 'Próxima'}
        </button>
      )}
    </div>
  );
}
