'use client';

import { useEffect, useState } from 'react';

/**
 * FAB pequeno "↑" canto inferior esquerdo. Aparece quando scroll >800px.
 * Click volta ao topo suave.
 */
export function BackToTopFab() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(window.scrollY > 800);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Voltar ao topo"
      aria-label="Voltar ao topo"
      style={{
        position: 'fixed',
        bottom: 76,
        left: 16,
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontSize: '1.2rem',
        zIndex: 8000,
      }}
    >
      ↑
    </button>
  );
}
