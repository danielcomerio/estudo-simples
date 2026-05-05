'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — captura crashes que escapam até o root layout.
 * Renderiza HTML mínimo (sem layout) já que o crash pode ser no layout
 * em si.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error-boundary]', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          background: '#0b1220',
          color: '#e5e7eb',
          padding: '60px 20px',
          textAlign: 'center',
          minHeight: '100vh',
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: '4rem', marginBottom: 14 }}>💥</div>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 10px' }}>
            Erro crítico
          </h1>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            Aconteceu um erro grave que impediu o app de carregar.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                opacity: 0.5,
                marginBottom: 24,
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '12px 24px',
              background: '#22c55e',
              border: 'none',
              borderRadius: 8,
              color: '#062013',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
