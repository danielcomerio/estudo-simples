'use client';

import type { GeneratedQuestion } from '@/lib/ai-generate';

/**
 * Card de preview de uma questão gerada por IA. Reusado por
 * AIGenerateButton, AIClozeFromTextButton, AIOCRButton.
 */
export function AIQuestionPreviewItem({
  question,
  checked,
  onToggle,
}: {
  question: GeneratedQuestion;
  checked: boolean;
  onToggle: () => void;
}) {
  const p = question.payload as Record<string, unknown>;
  const enunciado =
    (p.enunciado as string) ??
    (p.texto as string) ??
    (p.frente as string) ??
    '(sem enunciado)';
  const correta =
    question.type === 'objetiva' && Array.isArray(p.alternativas)
      ? (p.alternativas as Array<{ correta?: boolean; letra: string }>).find(
          (a) => a.correta
        )?.letra
      : null;

  return (
    <li
      style={{
        padding: 12,
        marginBottom: 8,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: checked ? 'var(--primary-soft)' : 'var(--bg-elev-2)',
        opacity: checked ? 1 : 0.6,
        transition: 'opacity 0.15s, background 0.15s',
      }}
    >
      <label style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          style={{ marginTop: 4 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--muted)',
              marginBottom: 4,
            }}
          >
            {question.type}
            {question.banca_estilo && ` · ${question.banca_estilo}`}
            {correta && ` · gabarito: ${correta}`}
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {enunciado.length > 300
              ? enunciado.slice(0, 300) + '…'
              : enunciado}
          </div>
          {question.type === 'objetiva' && Array.isArray(p.alternativas) && (
            <details style={{ marginTop: 6 }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  color: 'var(--muted)',
                }}
              >
                Ver alternativas
              </summary>
              <ul
                style={{
                  margin: '6px 0 0',
                  paddingLeft: 18,
                  fontSize: '0.85rem',
                }}
              >
                {(
                  p.alternativas as Array<{
                    letra: string;
                    texto: string;
                    correta?: boolean;
                  }>
                ).map((a) => (
                  <li
                    key={a.letra}
                    style={{
                      fontWeight: a.correta ? 600 : 400,
                      color: a.correta ? 'var(--primary)' : undefined,
                    }}
                  >
                    {a.letra}) {a.texto}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </label>
    </li>
  );
}
