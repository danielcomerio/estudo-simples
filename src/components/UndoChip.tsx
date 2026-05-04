'use client';

import { useEffect } from 'react';

/**
 * Mini-overlay flutuante "Desfazer (Z)" após uma ação reversível.
 * Atalho Z executa onUndo. Auto-some após `ttlMs`. Click fora ignora —
 * mantém visível até timeout pra usuário pegar mesmo se distraído.
 */
export function UndoChip({
  label = 'Desfazer última resposta',
  onUndo,
  onDismiss,
  ttlMs = 6000,
}: {
  label?: string;
  onUndo: () => void;
  onDismiss: () => void;
  ttlMs?: number;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(), ttlMs);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        onUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onUndo, onDismiss, ttlMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-elev)',
        border: '1px solid var(--primary)',
        borderRadius: 999,
        padding: '8px 14px',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        fontSize: '0.88rem',
        animation: 'toast-in 200ms ease',
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        className="primary"
        onClick={onUndo}
        style={{ padding: '3px 12px', fontSize: '0.85rem' }}
      >
        Desfazer (Z)
      </button>
      <button
        type="button"
        className="ghost icon"
        onClick={onDismiss}
        title="Fechar"
        aria-label="Fechar"
        style={{ padding: '0 6px' }}
      >
        ✕
      </button>
    </div>
  );
}
