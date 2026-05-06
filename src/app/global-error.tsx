'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — captura crashes que escapam até o root layout.
 * Renderiza HTML mínimo (sem layout) já que o crash pode ser no layout
 * em si. NÃO usa <Link> de next/navigation porque o erro pode ter
 * quebrado o roteador — só anchors e window.location.
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

  const goHome = () => {
    if (typeof window !== 'undefined') window.location.href = '/';
  };
  const reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  const btnStyle: React.CSSProperties = {
    padding: '11px 20px',
    border: '1px solid #1f2937',
    borderRadius: 8,
    background: '#0f172a',
    color: '#e5e7eb',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '0.95rem',
  };
  const btnPrimary: React.CSSProperties = {
    ...btnStyle,
    background: '#22c55e',
    border: 'none',
    color: '#062013',
    fontWeight: 600,
  };

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
            Aconteceu um erro grave que impediu o app de carregar. Tente uma
            das opções abaixo:
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
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button type="button" onClick={() => reset()} style={btnPrimary}>
              Tentar de novo
            </button>
            <button type="button" onClick={reload} style={btnStyle}>
              Recarregar página
            </button>
            <button type="button" onClick={goHome} style={btnStyle}>
              Voltar pro início
            </button>
          </div>
          <p
            style={{
              opacity: 0.6,
              marginTop: 28,
              fontSize: '0.85rem',
            }}
          >
            Se persistir,{' '}
            <a
              href="/contato"
              style={{
                color: '#22c55e',
                textDecoration: 'underline',
              }}
            >
              fale com a gente
            </a>
            . Inclua o ref acima se possível.
          </p>
        </div>
      </body>
    </html>
  );
}
