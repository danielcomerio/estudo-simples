'use client';

import type { Question } from '@/lib/types';
import { fmtRelative } from '@/lib/format';

/**
 * Timeline visual do histórico de revisões de uma questão.
 * Cada ponto = 1 revisão (correto/errado/pulado/timeout) com tooltip
 * detalhado (data, quality, confidence se houver, erro causa).
 *
 * Auto-some se history vazio. Útil em QuestionEditDrawer ou modal
 * de detalhe.
 */
export function QuestionTimeline({ question }: { question: Question }) {
  const history = question.stats?.history ?? [];
  if (history.length === 0) {
    return (
      <div
        className="muted"
        style={{ fontSize: '0.85rem', padding: '8px 0' }}
      >
        Sem revisões ainda.
      </div>
    );
  }

  const colorFor = (
    result: string
  ): { bg: string; label: string; emoji: string } => {
    if (result === 'correct')
      return { bg: 'var(--primary)', label: 'Acerto', emoji: '✓' };
    if (result === 'self_pass')
      return { bg: '#22c55e', label: 'Auto-pass', emoji: '✓' };
    if (result === 'wrong')
      return { bg: 'var(--danger)', label: 'Erro', emoji: '✗' };
    if (result === 'self_fail')
      return { bg: 'var(--danger)', label: 'Auto-fail', emoji: '✗' };
    if (result === 'timeout')
      return { bg: 'var(--warn, #d97706)', label: 'Tempo esgotado', emoji: '⏱' };
    return { bg: 'var(--muted)', label: result, emoji: '?' };
  };

  // Agrupa últimas 50 revisões pra evitar viewport overflow em questões
  // com 200+ tentativas
  const visible = history.slice(-50);
  const overflow = history.length - visible.length;

  // Calcula stats agregadas
  const total = history.length;
  const correct = history.filter(
    (h) => h.result === 'correct' || h.result === 'self_pass'
  ).length;
  const pct = Math.round((100 * correct) / total);

  return (
    <div>
      <div
        className="row between"
        style={{
          marginBottom: 8,
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <strong style={{ fontSize: '0.92rem' }}>
          📜 Histórico ({total})
        </strong>
        <span className="muted" style={{ fontSize: '0.82rem' }}>
          {correct}/{total} ({pct}% acerto)
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: 8,
          background: 'var(--bg-elev-2)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}
      >
        {overflow > 0 && (
          <span
            className="muted"
            style={{
              fontSize: '0.74rem',
              alignSelf: 'center',
              padding: '0 4px',
            }}
          >
            +{overflow} antes
          </span>
        )}
        {visible.map((h, i) => {
          const c = colorFor(h.result);
          const date = new Date(h.date);
          const tooltip =
            `${c.label} — ${fmtRelative(h.date)} (${date.toLocaleString('pt-BR')})` +
            (h.quality != null ? ` · q=${h.quality}` : '') +
            (h.confidence != null ? ` · conf=${h.confidence}` : '') +
            (h.errorCause ? ` · ${h.errorCause}` : '') +
            (h.timeMs ? ` · ${Math.round(h.timeMs / 1000)}s` : '');
          return (
            <span
              key={i}
              title={tooltip}
              aria-label={tooltip}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: c.bg,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.62rem',
                fontWeight: 700,
                color: '#fff',
                cursor: 'help',
              }}
            >
              {c.emoji}
            </span>
          );
        })}
      </div>
    </div>
  );
}
