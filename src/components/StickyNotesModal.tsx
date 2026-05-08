'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

const KEY = 'estudo-simples:sticky-notes:v1';

/**
 * Bloco de notas global do app. Aberto via Ctrl+Shift+M (M de "memo").
 * Persiste em localStorage. Markdown simples renderizado mas sem dep
 * externa — só **bold** e _italic_ visualmente.
 */
export function StickyNotesModal() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const j = JSON.parse(raw);
        setContent(typeof j?.content === 'string' ? j.content : '');
        if (typeof j?.at === 'number') setSavedAt(j.at);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-save 500ms debounce
  useEffect(() => {
    if (!open) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ content, at: Date.now() }));
        setSavedAt(Date.now());
      } catch {
        /* ignore */
      }
    }, 500);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [content, open]);

  if (!open) return null;
  return (
    <Modal onClose={() => setOpen(false)} ariaLabel="Bloco de notas" maxWidth="640px">
      <div style={{ padding: 14 }}>
        <div className="row gap" style={{ alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>📝 Bloco de notas</h3>
          <span style={{ flex: 1 }} />
          {savedAt && (
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              Salvo {new Date(savedAt).toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Anote o que quiser… (auto-save em localStorage)"
          rows={20}
          style={{
            width: '100%',
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            resize: 'vertical',
          }}
        />
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
          Atalho: <kbd>Ctrl+Shift+M</kbd> · Persiste no navegador.
        </p>
      </div>
    </Modal>
  );
}
