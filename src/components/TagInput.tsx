'use client';

import { useMemo, useRef, useState } from 'react';
import {
  allKnownTags,
  canonicalTag,
  tagCategory,
  tagDescription,
} from '@/lib/tag-dictionary';
import { canonicalizeTagList } from '@/lib/tag-dictionary';
import { normalizeTagList } from '@/lib/normalize';

/**
 * Input de tags com:
 * - Chip-style (pills clicáveis pra remover)
 * - Sugestões de auto-completion (dicionário canônico)
 * - Auto-canonicalização: "fgv" digitado → "banca-fgv" salvo
 * - Warning se digitar variante não-canônica
 *
 * value: string CSV (ex: "banca-fgv, art-5, doutrina")
 * onChange: chamado com a string CSV canonicalizada
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'tags separadas por vírgula',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(() => canonicalizeTagList(normalizeTagList(value)), [value]);

  const suggestions = useMemo(() => {
    if (!draft.trim() || draft.length < 1) return [] as string[];
    const q = draft.toLowerCase();
    const known = allKnownTags().map((t) => t.canonical);
    return known
      .filter(
        (t) =>
          !tags.includes(t) &&
          (t.includes(q) || (tagDescription(t) ?? '').toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [draft, tags]);

  function commit(raw: string) {
    if (!raw.trim()) return;
    const c = canonicalTag(raw);
    if (!c || tags.includes(c)) return;
    const next = [...tags, c];
    onChange(next.join(', '));
    setDraft('');
  }

  function remove(tag: string) {
    const next = tags.filter((t) => t !== tag);
    onChange(next.join(', '));
  }

  return (
    <div
      className="tag-input-wrapper"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 6,
        background: 'var(--bg)',
        minHeight: 36,
        position: 'relative',
      }}
    >
      <div className="row gap wrap" style={{ alignItems: 'center' }}>
        {tags.map((t) => {
          const cat = tagCategory(t);
          const desc = tagDescription(t);
          return (
            <span
              key={t}
              title={desc ?? t}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                fontSize: '0.82rem',
                background:
                  cat === 'banca'
                    ? 'rgba(59, 130, 246, 0.12)'
                    : cat === 'origem'
                      ? 'rgba(168, 85, 247, 0.12)'
                      : cat === 'status'
                        ? 'rgba(217, 119, 6, 0.12)'
                        : 'var(--bg-elev-2)',
                color: 'var(--text)',
                borderRadius: 999,
                border: '1px solid var(--border)',
              }}
            >
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                title="Remover"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.78rem',
                  color: 'var(--muted)',
                  lineHeight: 1,
                }}
                aria-label={`Remover tag ${t}`}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
              if (draft.trim()) {
                e.preventDefault();
                commit(draft);
              }
            } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
              remove(tags[tags.length - 1]);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // commit on blur (próximo tick pra permitir click em sugestão)
            setTimeout(() => {
              setFocused(false);
              if (draft.trim()) commit(draft);
            }, 150);
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            flex: 1,
            minWidth: 100,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '0.88rem',
            padding: '2px 4px',
          }}
        />
      </div>

      {focused && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 2,
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
            maxHeight: 240,
            overflowY: 'auto',
            zIndex: 20,
          }}
        >
          {suggestions.map((s) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
                inputRef.current?.focus();
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: 'var(--text)',
              }}
            >
              <strong>{s}</strong>
              {tagDescription(s) && (
                <span className="muted" style={{ marginLeft: 6, fontSize: '0.78rem' }}>
                  — {tagDescription(s)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {draft.trim() && canonicalTag(draft) !== draft.trim().toLowerCase() && !suggestions.includes(draft.trim()) && (
        <div
          className="muted"
          style={{ fontSize: '0.78rem', marginTop: 4, paddingLeft: 4 }}
        >
          Será salvo como <strong>{canonicalTag(draft)}</strong>
        </div>
      )}
    </div>
  );
}
