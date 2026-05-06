'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'estudo-simples:share-target:pending';

/**
 * Cliente do /share-target. Lê text/title/url da query, tenta extrair
 * JSON, persiste em sessionStorage e redireciona pro /banco que vai
 * pegar e popular o paste do ImportZone.
 */
export function ShareTargetReceiver() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const text = params.get('text') ?? '';
    const title = params.get('title') ?? '';
    const url = params.get('url') ?? '';
    const combined = [title, text, url].filter(Boolean).join('\n\n').trim();
    if (!combined) {
      setError('Nada compartilhado. Você pode colar o JSON manualmente em /banco.');
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, combined);
    } catch {
      // Storage falhou — segue redirecionando, user pode colar manual
    }
    // Pequeno delay pra UX (mostrar feedback "recebido")
    const t = setTimeout(() => {
      router.replace('/banco?from=share');
    }, 300);
    return () => clearTimeout(t);
  }, [params, router]);

  if (error) {
    return (
      <div>
        <p className="muted">{error}</p>
        <button
          type="button"
          className="primary"
          onClick={() => router.push('/banco')}
          style={{ marginTop: 14 }}
        >
          Ir pro banco
        </button>
      </div>
    );
  }

  return <p className="muted">✓ Recebido. Redirecionando pro banco…</p>;
}

/**
 * Helper pra ImportZone consumir o conteúdo recebido. Retorna a
 * string e limpa do storage. Idempotente.
 */
export function consumeSharedContent(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v) sessionStorage.removeItem(STORAGE_KEY);
    return v;
  } catch {
    return null;
  }
}
