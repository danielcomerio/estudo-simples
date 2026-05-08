'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

const PREFIX = 'estudo-simples:concurso-notebook:';

/**
 * Botão "📓 Notas" em cada concurso. Modal abre textarea com auto-save
 * em localStorage por concursoId. Útil pra anotações estratégicas
 * (cargo, salário, política, datas-chave).
 *
 * Per-device — não sincroniza pra simplificar (sem migration nova).
 */
export function ConcursoNotebookButton({
  concursoId,
  concursoNome,
}: {
  concursoId: string;
  concursoNome: string;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(PREFIX + concursoId);
      if (raw) {
        const j = JSON.parse(raw);
        setContent(typeof j?.content === 'string' ? j.content : '');
        if (typeof j?.at === 'number') setSavedAt(j.at);
      } else {
        setContent('');
        setSavedAt(null);
      }
    } catch {
      /* ignore */
    }
  }, [open, concursoId]);

  useEffect(() => {
    if (!open) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          PREFIX + concursoId,
          JSON.stringify({ content, at: Date.now() })
        );
        setSavedAt(Date.now());
      } catch {
        /* ignore */
      }
    }, 500);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [content, concursoId, open]);

  return (
    <>
      <button
        type="button"
        className="ghost"
        onClick={() => setOpen(true)}
        title="Anotações livres deste concurso"
        style={{ padding: '4px 10px', fontSize: '0.82rem' }}
      >
        📓 Notas
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel={`Notas de ${concursoNome}`} maxWidth="640px">
          <div style={{ padding: 14 }}>
            <div className="row gap" style={{ alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>📓 {concursoNome}</h3>
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
              placeholder="Anote: cargo, salário, política da banca, marcos, links importantes…"
              rows={18}
              style={{ width: '100%', fontSize: '0.9rem', resize: 'vertical' }}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
