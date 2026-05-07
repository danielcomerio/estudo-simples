'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { streamAIChat } from '@/lib/ai-stream';
import { toast } from './Toast';

/**
 * Botão "🤖 Avaliar minha resposta" no DiscursivaRunner. User cola
 * resposta dele + espelho oficial; IA dá nota (0-10) + feedback
 * detalhado por critério.
 *
 * BYO key (sem custo pro app).
 */
export function AIDiscursivaEvaluator({
  enunciado,
  espelho,
  resposta,
  rubrica,
}: {
  enunciado: string;
  espelho: string;
  resposta: string;
  rubrica?: Array<{ criterio: string; pontos: number }>;
}) {
  const provider = getDefaultProvider();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!provider) {
    return (
      <Link
        href="/configuracoes"
        title="Configure uma chave de IA pra usar"
        style={{
          fontSize: '0.85rem',
          color: 'var(--muted)',
          textDecoration: 'underline',
        }}
      >
        🤖 Configurar IA pra avaliação automática
      </Link>
    );
  }

  if (!resposta.trim()) {
    return null;
  }

  const abortRef = useRef<AbortController | null>(null);

  const ask = () => {
    if (!provider) return;
    setLoading(true);
    setResult('');
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Chave não configurada', 'error');
      setLoading(false);
      return;
    }
    const rubricaTxt =
      rubrica && rubrica.length > 0
        ? '\n\nCRITÉRIOS DE AVALIAÇÃO:\n' +
          rubrica
            .map((r, i) => `${i + 1}. ${r.criterio} (peso ${r.pontos})`)
            .join('\n')
        : '';
    const prompt = `Você é um corretor experiente de discursivas de concurso público brasileiro. Avalie de forma rigorosa e didática a resposta do candidato.

ENUNCIADO:
${enunciado}

ESPELHO OFICIAL (resposta-modelo):
${espelho}

RESPOSTA DO CANDIDATO:
${resposta}
${rubricaTxt}

Estrutura sua avaliação assim:
- **Nota geral**: 0 a 10 (justifique brevemente)
- **Pontos fortes**: 2-3 bullets curtos
- **Faltas/melhorias**: 2-3 bullets concretos
- **Sugestão de redação**: 1-2 frases de como reescrever o ponto mais fraco

Seja específico e útil. Em pt-BR. Max 400 palavras.`;

    abortRef.current?.abort();
    abortRef.current = streamAIChat(
      { provider, apiKey, prompt, kind: 'discursiva-eval' },
      {
        onChunk: (chunk) => setResult((prev) => (prev ?? '') + chunk),
        onDone: () => setLoading(false),
        onError: (msg) => {
          toast(msg, 'error');
          setLoading(false);
        },
      }
    );
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 14 }}>
      {!result && (
        <button
          type="button"
          onClick={ask}
          disabled={loading}
          style={{ padding: '8px 14px', fontSize: '0.9rem' }}
        >
          {loading
            ? 'Avaliando…'
            : `🤖 Pedir avaliação via ${provider === 'anthropic' ? 'Claude' : provider === 'openai' ? 'ChatGPT' : 'Gemini'}`}
        </button>
      )}
      {loading && result && (
        <button
          type="button"
          onClick={stop}
          className="ghost"
          style={{ padding: '4px 10px', fontSize: '0.78rem', marginLeft: 6 }}
        >
          ⏹ Parar
        </button>
      )}
      {result && (
        <div
          style={{
            marginTop: 8,
            padding: 14,
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
            borderLeft: '3px solid var(--primary)',
            fontSize: '0.92rem',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
            🤖 Avaliação por {PROVIDER_LABELS[provider]}
          </div>
          {result}
          <button
            type="button"
            className="ghost"
            onClick={() => setResult(null)}
            style={{
              padding: '2px 8px',
              fontSize: '0.78rem',
              marginTop: 10,
              display: 'block',
            }}
          >
            Pedir nova avaliação
          </button>
        </div>
      )}
    </div>
  );
}
