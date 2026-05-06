'use client';

import { useEffect, useState } from 'react';

/**
 * Tooltip leve "💡 Dica" que aparece em primeiro uso de uma rota
 * (ou quando user passa visitas significativas sem ver). Idempotente
 * via localStorage. Dispense fecha pra sempre.
 *
 * Uso:
 *   <DidYouKnowTip
 *     id="estudar-foco"
 *     text="Aperte F pra modo foco — esconde tudo exceto a questão."
 *   />
 *
 * Aparece após 2s pra não atrapalhar mount inicial. Animação leve.
 */
export function DidYouKnowTip({
  id,
  text,
  delay = 2000,
}: {
  id: string;
  text: string;
  delay?: number;
}) {
  const [show, setShow] = useState(false);
  const [seen, setSeen] = useState<boolean | null>(null);
  const KEY = `estudo-simples:dyk-seen:${id}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setSeen(localStorage.getItem(KEY) === '1');
    } catch {
      setSeen(true);
    }
  }, [KEY]);

  useEffect(() => {
    if (seen !== false) return;
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [seen, delay]);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
  };

  if (!show) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 'calc(80px + env(safe-area-inset-bottom))',
        left: 12,
        right: 12,
        maxWidth: 480,
        margin: '0 auto',
        zIndex: 45,
        background: 'var(--bg-elev)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--radius)',
        padding: '12px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        animation: 'dyk-slide-in 240ms ease-out',
      }}
    >
      <span style={{ fontSize: '1.4rem', flexShrink: 0 }} aria-hidden>
        💡
      </span>
      <div style={{ flex: 1, minWidth: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Dica</strong>
        {text}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        title="Não mostrar mais"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--muted)',
          fontSize: '1.1rem',
          cursor: 'pointer',
          padding: '4px 8px',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
      <style>{`
        @keyframes dyk-slide-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
