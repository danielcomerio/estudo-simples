'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal wrapper que evita os bugs comuns:
 *
 * 1. Portal pra `document.body` — escapa stacking context de ancestrais
 *    com backdrop-filter/transform/contain (ex: Topbar com blur prendia
 *    modais position:fixed dentro do z-index 50 do header).
 *
 * 2. `alignItems: flex-start` + `overflowY: auto` no overlay — quando
 *    conteúdo é mais alto que viewport, modal não fica clipado em cima
 *    (problema do `alignItems: center`).
 *
 * 3. `padding-top` respeita Topbar (~72px) + safe-area-inset-top (iOS).
 *
 * 4. ESC fecha. Click no backdrop fecha.
 *
 * 5. body scroll lock enquanto aberto (não rola página de baixo).
 *
 * Uso:
 *   {open && (
 *     <Modal onClose={() => setOpen(false)} ariaLabel="Compartilhar">
 *       <h2>Conteúdo</h2>
 *       ...
 *     </Modal>
 *   )}
 */
export function Modal({
  onClose,
  ariaLabel,
  children,
  maxWidth = 540,
}: {
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  maxWidth?: number | string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Body scroll lock — evita scroll fantasma da página de baixo
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label={ariaLabel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 9999,
        overflowY: 'auto',
        paddingTop: 'max(72px, env(safe-area-inset-top, 20px))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--radius)',
          padding: 22,
          maxWidth,
          width: '100%',
          border: '1px solid var(--border)',
          marginBottom: 'auto',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
