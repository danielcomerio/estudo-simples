'use client';

import { useEffect, useRef, useState } from 'react';
import { renderRichText } from '@/lib/utils';
import { QuestionImages } from './QuestionImages';
import type {
  ClozePayload,
  DiscursivaPayload,
  FlashcardPayload,
  ObjetivaPayload,
  Question,
} from '@/lib/types';

/**
 * Modo leitura do /banco: navega questão a questão como flashcard,
 * mostra enunciado + alternativa correta + explicação. Sem rate, sem
 * afetar SRS — pra revisar passivamente, especialmente pré-prova.
 *
 * ←/→ navega; espaço/enter alterna mostrar resposta; Esc fecha.
 */
export function BancoBrowse({
  questions,
  startIdx = 0,
  onClose,
}: {
  questions: Question[];
  startIdx?: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const [revealed, setRevealed] = useState(false);
  const dlgRef = useRef<HTMLDialogElement>(null);

  const q = questions[idx];

  useEffect(() => {
    if (dlgRef.current && !dlgRef.current.open) {
      try {
        dlgRef.current.showModal();
      } catch {
        onClose();
      }
    }
  }, [onClose]);

  // reset reveal ao navegar
  useEffect(() => {
    setRevealed(false);
  }, [idx]);

  // Atalhos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIdx((i) => Math.min(questions.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setRevealed((r) => !r);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length]);

  const close = () => {
    if (dlgRef.current?.open) dlgRef.current.close();
    onClose();
  };

  if (!q) {
    return null;
  }

  return (
    <dialog
      ref={dlgRef}
      onClose={close}
      style={{
        maxWidth: 820,
        width: '95vw',
        padding: 0,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-elev)',
        color: 'var(--text)',
      }}
    >
      <div style={{ padding: 22 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: '0.88rem' }}>
            📖 Leitura · {idx + 1} de {questions.length}
            {q.disciplina_id && ` · ${q.disciplina_id}`}
            {q.tema && ` · ${q.tema}`}
          </div>
          <button
            type="button"
            className="ghost icon"
            onClick={close}
            aria-label="Fechar"
            title="Fechar (Esc)"
          >
            ✕
          </button>
        </div>

        <Body q={q} revealed={revealed} />

        <QuestionImages
          urls={(q.payload as { imagens?: string[] }).imagens}
        />

        <div
          className="row between"
          style={{
            marginTop: 18,
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div className="row gap">
            <button
              type="button"
              className="ghost"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              aria-label="Anterior"
              title="Anterior (←)"
            >
              ← Anterior
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                setIdx((i) => Math.min(questions.length - 1, i + 1))
              }
              disabled={idx >= questions.length - 1}
              aria-label="Próxima"
              title="Próxima (→)"
            >
              Próxima →
            </button>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? 'Esconder resposta' : 'Mostrar resposta (Espaço)'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Body({ q, revealed }: { q: Question; revealed: boolean }) {
  if (q.type === 'objetiva') {
    const p = q.payload as ObjetivaPayload;
    const correta =
      p.alternativas?.find((a) => a.correta === true) ??
      p.alternativas?.find((a) => a.letra === p.gabarito);
    return (
      <>
        <div
          className="rich"
          dangerouslySetInnerHTML={{
            __html: renderRichText(p.enunciado ?? ''),
          }}
          style={{ marginBottom: 12 }}
        />
        {p.alternativas && (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: 6,
            }}
          >
            {p.alternativas.map((a) => {
              const isCorr = revealed && a === correta;
              return (
                <li
                  key={a.letra}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: isCorr
                      ? 'var(--primary-soft)'
                      : 'var(--bg-elev-2)',
                  }}
                >
                  <strong>{a.letra})</strong>{' '}
                  <span
                    dangerouslySetInnerHTML={{
                      __html: renderRichText(a.texto ?? ''),
                    }}
                  />
                  {isCorr && (
                    <span style={{ color: 'var(--primary)', marginLeft: 8 }}>
                      ✓
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {revealed && p.explicacao_geral && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              background: 'var(--bg-elev-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '0.92rem',
            }}
            dangerouslySetInnerHTML={{
              __html:
                '<strong>Explicação:</strong> ' +
                renderRichText(p.explicacao_geral),
            }}
          />
        )}
      </>
    );
  }
  if (q.type === 'discursiva') {
    const p = q.payload as DiscursivaPayload;
    const enun =
      p.enunciado_completo ||
      p.enunciado ||
      [p.texto_base, p.comando].filter(Boolean).join('\n\n');
    return (
      <>
        <div
          className="rich"
          dangerouslySetInnerHTML={{ __html: renderRichText(enun) }}
          style={{ marginBottom: 12 }}
        />
        {revealed && p.espelho && (
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--bg-elev-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '0.92rem',
            }}
            dangerouslySetInnerHTML={{
              __html:
                '<strong>Espelho:</strong> ' + renderRichText(p.espelho),
            }}
          />
        )}
      </>
    );
  }
  if (q.type === 'cloze') {
    const p = q.payload as ClozePayload;
    const texto = p.texto ?? '';
    // Substitui {{cN::resposta}} por resposta (revelado) ou ___ (oculto)
    const rendered = texto.replace(
      /\{\{c\d+::(.*?)\}\}/g,
      revealed ? '$1' : '_____'
    );
    return (
      <div
        className="rich"
        dangerouslySetInnerHTML={{ __html: renderRichText(rendered) }}
      />
    );
  }
  if (q.type === 'flashcard') {
    const p = q.payload as FlashcardPayload;
    return (
      <>
        <div
          className="rich"
          dangerouslySetInnerHTML={{
            __html: renderRichText(p.frente ?? ''),
          }}
          style={{ marginBottom: 12 }}
        />
        {revealed && (
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--primary-soft)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius)',
            }}
            dangerouslySetInnerHTML={{
              __html: renderRichText(p.verso ?? ''),
            }}
          />
        )}
      </>
    );
  }
  return null;
}
