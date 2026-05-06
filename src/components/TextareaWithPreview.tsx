'use client';

import { useRef, useState } from 'react';
import { renderRichText } from '@/lib/utils';

/**
 * Textarea com toggle Edit/Preview. Render usa renderRichText (mesmo
 * que mostra durante a sessão), incluindo KaTeX condicional, code
 * blocks e HTML escapado.
 *
 * Útil em campos longos (enunciado, explicação, espelho) pra ver
 * como vai aparecer antes de salvar.
 */
export function TextareaWithPreview({
  value,
  onChange,
  placeholder,
  rows = 4,
  required,
  minLength,
  maxLength,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
>) {
  const [showPreview, setShowPreview] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const empty = value.trim().length === 0;

  // Wrap markdown shortcut: Ctrl+B → **selection**, Ctrl+I → *selection*
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k !== 'b' && k !== 'i') return;
    e.preventDefault();
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);
    const wrap = k === 'b' ? '**' : '*';
    const next = `${before}${wrap}${sel || (k === 'b' ? 'negrito' : 'itálico')}${wrap}${after}`;
    onChange(next);
    // Re-seleciona texto wrapped no próximo tick
    requestAnimationFrame(() => {
      const newStart = start + wrap.length;
      const newEnd = newStart + (sel.length || (k === 'b' ? 7 : 7));
      ta.setSelectionRange(newStart, newEnd);
      ta.focus();
    });
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        className="row gap"
        style={{
          marginBottom: 4,
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
        }}
      >
        <button
          type="button"
          className={!showPreview ? 'primary' : 'ghost'}
          onClick={() => setShowPreview(false)}
          style={{
            padding: '2px 10px',
            fontSize: '0.78rem',
            borderRadius: 4,
          }}
          aria-pressed={!showPreview}
        >
          ✏ Editar
        </button>
        <button
          type="button"
          className={showPreview ? 'primary' : 'ghost'}
          onClick={() => setShowPreview(true)}
          disabled={empty}
          style={{
            padding: '2px 10px',
            fontSize: '0.78rem',
            borderRadius: 4,
          }}
          aria-pressed={showPreview}
          title={empty ? 'Vazio — nada pra mostrar' : 'Ver como ficará'}
        >
          👁 Preview
        </button>
      </div>
      {showPreview && !empty ? (
        <div
          style={{
            minHeight: rows * 22,
            padding: '12px 14px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-elev-2)',
            fontSize: '0.92rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
          dangerouslySetInnerHTML={{ __html: renderRichText(value) }}
        />
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={rows}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          {...rest}
          style={{ width: '100%', ...(rest.style ?? {}) }}
        />
      )}
    </div>
  );
}
