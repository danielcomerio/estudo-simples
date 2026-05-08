'use client';

import { useMemo, useState } from 'react';
import { parseCloze, type ClozeBlank } from '@/lib/cloze';
import { escapeHtml } from '@/lib/utils';

/**
 * Modo "preenche tudo": cada lacuna {{cN::texto}} vira <input>. User
 * preenche todas, clica "Verificar" — IA-free check de match (case-
 * insensitive + trim).
 *
 * Renderização: percorre o texto fazendo split nos marcadores e injeta
 * inputs por blank. Inputs preservam ordem.
 *
 * Output: callback `onComplete(allCorrect, score)` quando user clica
 * verificar, pra caller decidir se aplica SRS.
 */
export function ClozeFillTrainer({
  texto,
  onComplete,
}: {
  texto: string;
  onComplete?: (allCorrect: boolean, correctCount: number, total: number) => void;
}) {
  const parsed = useMemo(() => parseCloze(texto), [texto]);
  const blanks = parsed.blanks;
  const [answers, setAnswers] = useState<string[]>(() => blanks.map(() => ''));
  const [checked, setChecked] = useState(false);

  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();

  const isCorrect = (i: number) =>
    checked && norm(answers[i] ?? '') === norm(blanks[i].resposta);
  const isWrong = (i: number) => checked && !isCorrect(i);

  // Render texto com inputs nos lugares certos
  const segments = useMemo(() => {
    const RE = /\{\{c(\d+)::([^}]+?)(?:::([^}]+?))?\}\}/g;
    const parts: Array<{ kind: 'text' | 'blank'; content: string; idx?: number }> = [];
    let last = 0;
    let blankIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = RE.exec(texto)) !== null) {
      if (m.index > last) {
        parts.push({ kind: 'text', content: texto.slice(last, m.index) });
      }
      parts.push({ kind: 'blank', content: '', idx: blankIdx });
      blankIdx++;
      last = m.index + m[0].length;
    }
    if (last < texto.length) {
      parts.push({ kind: 'text', content: texto.slice(last) });
    }
    return parts;
  }, [texto]);

  const verify = () => {
    setChecked(true);
    const correctCount = blanks.filter(
      (b, i) => norm(answers[i] ?? '') === norm(b.resposta)
    ).length;
    onComplete?.(correctCount === blanks.length, correctCount, blanks.length);
  };

  const reset = () => {
    setAnswers(blanks.map(() => ''));
    setChecked(false);
  };

  if (blanks.length === 0) {
    return (
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Sem lacunas neste texto.
      </p>
    );
  }

  return (
    <div>
      <div style={{ fontSize: '1rem', lineHeight: 1.7 }}>
        {segments.map((s, i) =>
          s.kind === 'text' ? (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: escapeHtml(s.content) }}
            />
          ) : (
            <input
              key={i}
              type="text"
              value={answers[s.idx!] ?? ''}
              onChange={(e) => {
                const next = [...answers];
                next[s.idx!] = e.target.value;
                setAnswers(next);
              }}
              disabled={checked}
              placeholder={blanks[s.idx!].dica ?? '___'}
              style={{
                display: 'inline-block',
                margin: '0 4px',
                padding: '2px 8px',
                fontSize: '0.95rem',
                width: `${Math.max(80, blanks[s.idx!].resposta.length * 12)}px`,
                background: isCorrect(s.idx!)
                  ? 'rgba(34,197,94,0.15)'
                  : isWrong(s.idx!)
                    ? 'rgba(220,38,38,0.15)'
                    : 'var(--bg-elev-2)',
                border: `1px solid ${isCorrect(s.idx!) ? 'var(--primary)' : isWrong(s.idx!) ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 4,
              }}
            />
          )
        )}
      </div>
      <div className="row gap" style={{ marginTop: 14 }}>
        {!checked ? (
          <button
            type="button"
            className="primary"
            onClick={verify}
            disabled={answers.some((a) => !a.trim())}
          >
            ✓ Verificar
          </button>
        ) : (
          <button type="button" className="ghost" onClick={reset}>
            ↻ Refazer
          </button>
        )}
      </div>
      {checked && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
            fontSize: '0.85rem',
          }}
        >
          {blanks.map((b, i) => (
            <div key={i}>
              {isCorrect(i) ? '✅' : '❌'}{' '}
              <strong>Lacuna {i + 1}:</strong> {b.resposta}
              {!isCorrect(i) && (
                <span className="muted" style={{ marginLeft: 6 }}>
                  (você: {answers[i] || '(vazio)'})
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
