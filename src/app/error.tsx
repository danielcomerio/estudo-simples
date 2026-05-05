'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Error boundary global do segmento root. Captura erros em rotas
 * autenticadas e mostra fallback amigável. Sem stack trace exposta
 * em produção (Next já oculta em build).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Só logamos no console (Vercel captura). Sem reportar pra terceiro
    // sem o user concordar (privacidade).
    console.error('[error-boundary]', error);
  }, [error]);

  return (
    <main
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '60px 20px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: 14 }}>⚠️</div>
      <h1 style={{ fontSize: '1.5rem', margin: '0 0 10px' }}>
        Algo deu errado
      </h1>
      <p
        className="muted"
        style={{ margin: '0 0 18px', fontSize: '1rem', lineHeight: 1.5 }}
      >
        Encontramos um erro inesperado. Você pode tentar de novo, voltar pra
        página inicial, ou recarregar.
      </p>
      {error.digest && (
        <p
          className="muted"
          style={{
            fontSize: '0.78rem',
            marginBottom: 18,
            fontFamily: 'monospace',
          }}
        >
          ref: {error.digest}
        </p>
      )}
      <div
        className="row gap"
        style={{ justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <button type="button" className="primary" onClick={() => reset()}>
          Tentar de novo
        </button>
        <Link href="/">
          <button type="button">Painel</button>
        </Link>
        <button type="button" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
      <p
        className="muted"
        style={{ marginTop: 30, fontSize: '0.85rem' }}
      >
        Se persistir,{' '}
        <Link href="/contato" style={{ color: 'var(--primary)' }}>
          fale com a gente
        </Link>
        .
      </p>
    </main>
  );
}
