'use client';

/**
 * Cliente pra consumir SSE do `/api/ai/chat?stream=true`.
 *
 * Uso:
 *   const ctrl = streamAIChat(
 *     { provider, apiKey, prompt },
 *     {
 *       onChunk: (chunk) => setText(prev => prev + chunk),
 *       onDone: () => setLoading(false),
 *       onError: (msg) => setError(msg),
 *     }
 *   );
 *   // mais tarde, pra cancelar:
 *   ctrl.abort();
 *
 * Retorna AbortController pra permitir cancelamento (botão "parar").
 */

import type { AIProvider } from './ai-keys';

export type StreamHandlers = {
  onChunk: (chunk: string) => void;
  onDone?: () => void;
  onError?: (msg: string) => void;
};

export type StreamRequest = {
  provider: AIProvider;
  apiKey: string;
  prompt: string;
  model?: string;
  /**
   * Quando true, server faz lookup/store em ai_response_cache. Use SÓ
   * pra prompts determinísticos (ex: explicação de questão). NUNCA pra
   * conversas com histórico — cache key não captura turno anterior.
   */
  cacheable?: boolean;
};

export function streamAIChat(
  req: StreamRequest,
  handlers: StreamHandlers
): AbortController {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, stream: true }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => '');
        handlers.onError?.(t || `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        let inErrorEvent = false;

        for (const raw of lines) {
          const line = raw.trim();
          if (!line) {
            inErrorEvent = false;
            continue;
          }
          if (line.startsWith('event:')) {
            inErrorEvent = line.slice(6).trim() === 'error';
            continue;
          }
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            handlers.onDone?.();
            return;
          }
          if (inErrorEvent) {
            handlers.onError?.(payload);
            return;
          }
          handlers.onChunk(payload);
        }
      }
      handlers.onDone?.();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // Cancelamento esperado — não trata como erro
        return;
      }
      handlers.onError?.(e instanceof Error ? e.message : 'erro de stream');
    }
  })();

  return ctrl;
}
