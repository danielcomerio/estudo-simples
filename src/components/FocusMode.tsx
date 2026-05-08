'use client';

import { useEffect, useState } from 'react';

const KEY = 'estudo-simples:focus-mode-active';

/**
 * Focus mode: esconde elementos da app (topbar, footer, sidebars)
 * via classe `focus-mode` no <body>. CSS aplica display:none nesses
 * elementos.
 *
 * Toggle global por atalho F8 (ou botão). Estado persiste em
 * localStorage pra manter entre rotas.
 *
 * Esc sai do modo.
 */
export function FocusMode() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setActive(localStorage.getItem(KEY) === '1');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        setActive((cur) => {
          const next = !cur;
          if (next) localStorage.setItem(KEY, '1');
          else localStorage.removeItem(KEY);
          return next;
        });
      } else if (e.key === 'Escape' && active) {
        // Esc sai do modo
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        setActive(false);
        localStorage.removeItem(KEY);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  useEffect(() => {
    if (active) document.body.classList.add('focus-mode');
    else document.body.classList.remove('focus-mode');
  }, [active]);

  if (!active) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setActive(false);
        localStorage.removeItem(KEY);
      }}
      title="Sair do modo focado (Esc)"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        padding: '6px 12px',
        fontSize: '0.82rem',
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        zIndex: 9000,
      }}
    >
      🎯 Focado · Esc
    </button>
  );
}
