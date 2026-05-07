'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';

type Comment = {
  id: string;
  body: string;
  created_at: string;
  is_mine: boolean;
  author_short: string;
};

/**
 * Lista de comentários de uma questão. Plugável em qualquer runner /
 * drawer. Loadeia lazy via fetch — não bloqueia render.
 */
export function QuestionComments({ questionId }: { questionId: string }) {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  async function reload() {
    try {
      const res = await fetch(
        `/api/question-comments?question_id=${encodeURIComponent(questionId)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: { items: Comment[] } = await res.json();
      setItems(j.items);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  async function submit() {
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch('/api/question-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId, body: draft.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setDraft('');
      void reload();
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remover comentário?')) return;
    try {
      const res = await fetch(
        `/api/question-comments?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void reload();
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: '0.92rem' }}>
        💬 Comentários da comunidade
        {items && items.length > 0 ? ` (${items.length})` : ''}
      </h4>

      {items === null ? (
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Carregando…
        </p>
      ) : items.length === 0 ? (
        <p className="muted" style={{ fontSize: '0.82rem', margin: '4px 0 8px' }}>
          Sem comentários ainda. Seja o primeiro!
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px' }}>
          {items.map((c) => (
            <li
              key={c.id}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: 'var(--bg-elev-2)',
                border: '1px solid var(--border)',
                marginBottom: 6,
                fontSize: '0.85rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  marginBottom: 4,
                }}
              >
                <span>
                  {c.is_mine ? '👤 Você' : `Anônimo #${c.author_short}`} ·{' '}
                  {new Date(c.created_at).toLocaleDateString('pt-BR')}
                </span>
                {c.is_mine && (
                  <button
                    type="button"
                    onClick={() => void remove(c.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '0.75rem',
                    }}
                    aria-label="Remover comentário"
                  >
                    🗑
                  </button>
                )}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {c.body}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
          placeholder="Escreva um comentário…"
          rows={2}
          maxLength={2000}
          style={{
            flex: 1,
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            resize: 'vertical',
            minHeight: 36,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button
          onClick={() => void submit()}
          disabled={!draft.trim() || posting}
          style={{ alignSelf: 'flex-end', padding: '6px 12px' }}
          title="Enviar (Ctrl+Enter)"
        >
          {posting ? '…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
