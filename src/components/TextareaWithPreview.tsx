'use client';

import { useState } from 'react';
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
  const empty = value.trim().length === 0;

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
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
