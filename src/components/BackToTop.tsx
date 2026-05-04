'use client';

import { useEffect, useState } from 'react';

/**
 * Botão flutuante "voltar ao topo". Aparece quando scrollY > threshold.
 * Click rola pra topo com scroll suave (respeita prefers-reduced-motion
 * via 'auto' fallback).
 */
export function BackToTop({ threshold = 800 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
        })
      }
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 40,
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'var(--bg-elev)',
        color: 'var(--text)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        fontSize: '1.1rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      ↑
    </button>
  );
}
