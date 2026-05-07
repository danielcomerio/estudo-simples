'use client';

import { useEffect } from 'react';

/**
 * Sentry-lite — captura window.onerror + unhandledRejection e envia
 * pra /api/log com sample 10% (evita ruído + custo). Sem provider
 * externo; loga em analytics_events com event='client.error'.
 *
 * Útil pra detectar regressões em produção sem custo Sentry. Pra
 * análise séria, integrar Sentry/Rollbar/Bugsnag depois.
 *
 * Não captura erros sensíveis (mensagens podem vazar PII em raros
 * casos — sample baixo + filter de stack reduz risco).
 *
 * Roda só em produção (NODE_ENV=production) pra não poluir logs em dev.
 */
export function ErrorLogger() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;

    const SAMPLE_RATE = 0.1; // 10% — ajustar se ruído baixo

    const shouldSample = () => Math.random() < SAMPLE_RATE;

    const log = (data: {
      type: 'error' | 'rejection';
      message: string;
      stack?: string;
      url?: string;
      line?: number;
      col?: number;
    }) => {
      // Truncate pra não estourar size cap do props jsonb (4000 chars)
      const truncate = (s: string | undefined, max: number) =>
        s && s.length > max ? s.slice(0, max) : s;

      void fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'client.error',
          props: {
            type: data.type,
            message: truncate(data.message, 200),
            stack: truncate(data.stack, 1000),
            url: data.url,
            ua: truncate(navigator.userAgent, 200),
            path: window.location.pathname,
          },
        }),
      }).catch(() => {
        // best-effort — error log fail é ironicamente OK
      });
    };

    const onError = (e: ErrorEvent) => {
      if (!shouldSample()) return;
      log({
        type: 'error',
        message: e.message ?? 'unknown',
        stack: e.error?.stack,
        url: e.filename,
        line: e.lineno,
        col: e.colno,
      });
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      if (!shouldSample()) return;
      const reason = e.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : JSON.stringify(reason).slice(0, 200);
      log({
        type: 'rejection',
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
