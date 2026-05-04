'use client';

import { useEffect, useRef, useState } from 'react';
import { renderRichText } from '@/lib/utils';
import { updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { toast } from './Toast';
import type { Question } from '@/lib/types';

/**
 * Bloco inline pra adicionar/editar nota pessoal numa questão durante
 * a sessão de estudo. Salva em payload.notes_user via updateQuestionLocal.
 *
 * Útil pra capturar insights no momento "ahá" da revelação — fixa
 * memória ativa muito melhor que reler explicação depois.
 */
export function NoteInline({ q }: { q: Question }) {
  const existing =
    (q.payload as { notes_user?: string }).notes_user ?? '';
  const [editing, setEditing] = useState(!existing);
  const [text, setText] = useState(existing);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Reset ao trocar de questão
  useEffect(() => {
    const cur = (q.payload as { notes_user?: string }).notes_user ?? '';
    setText(cur);
    setEditing(!cur);
  }, [q.id, q.payload]);

  const save = () => {
    const next = text.trim();
    updateQuestionLocal(q.id, (cur) => ({
      payload: { ...cur.payload, notes_user: next || undefined },
    }));
    scheduleSync(800);
    toast(next ? 'Anotação salva' : 'Anotação removida', 'success');
    setEditing(false);
  };

  if (!editing && existing) {
    return (
      <div
        className="feedback-block"
        style={{
          background: 'var(--primary-soft)',
          borderLeft: '3px solid var(--primary)',
          paddingLeft: 12,
        }}
      >
        <div
          className="row between"
          style={{ alignItems: 'center', marginBottom: 4 }}
        >
          <strong>💭 Sua anotação</strong>
          <button
            type="button"
            className="ghost"
            onClick={() => setEditing(true)}
            style={{ fontSize: '0.78rem', padding: '2px 8px' }}
          >
            editar
          </button>
        </div>
        <div
          style={{ whiteSpace: 'pre-wrap' }}
          dangerouslySetInnerHTML={{ __html: renderRichText(existing) }}
        />
      </div>
    );
  }

  return (
    <div
      className="feedback-block"
      style={{
        background: 'var(--bg-elev-2)',
        borderLeft: '3px solid var(--border-strong, var(--border))',
        paddingLeft: 12,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 6 }}>
        💭 Anotar insight
      </strong>
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Por que errei? O que vou lembrar pra próxima?"
        style={{ width: '100%', fontSize: '0.9rem' }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="row gap" style={{ marginTop: 6 }}>
        <button
          type="button"
          className="primary"
          onClick={save}
          style={{ padding: '4px 12px', fontSize: '0.85rem' }}
        >
          Salvar (Ctrl+Enter)
        </button>
        {existing && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setText(existing);
              setEditing(false);
            }}
            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
