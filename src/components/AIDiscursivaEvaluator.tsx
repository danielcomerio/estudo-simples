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
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';

/**
 * Botão "🤖 Avaliar minha resposta" no DiscursivaRunner. User cola
 * resposta dele + espelho oficial; IA dá nota (0-10) + feedback
 * detalhado por critério.
 *
 * BYO key (sem custo pro app).
 */
/** Extrai nota 0-10 do texto da avaliação. Procura padrões comuns:
 *  "Nota geral: 7,5/10", "Nota: 8", "**Nota geral**: 6.5". */
function parseNota(text: string): number | null {
  const m = text.match(/nota[^:]*[:\s]+\*{0,2}\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(10, n));
}

export function AIDiscursivaEvaluator({
  questionId,
  enunciado,
  espelho,
  resposta,
  rubrica,
  onGraded,
}: {
  questionId?: string;
  enunciado: string;
  espelho: string;
  resposta: string;
  rubrica?: Array<{ criterio: string; pontos: number }>;
  onGraded?: (nota: number) => void;
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

  const ask = async () => {
    if (!provider) return;
    setLoading(true);
    setResult('');
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Chave não configurada', 'error');
      setLoading(false);
      return;
    }
    const personaPrompt = await getActivePersonaPrompt();
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
      {
        provider,
        apiKey,
        prompt: withPersona(prompt, personaPrompt),
        kind: 'discursiva-eval',
      },
      {
        onChunk: (chunk) => setResult((prev) => (prev ?? '') + chunk),
        onDone: () => {
          setLoading(false);
          // Tenta extrair nota do texto final + notifica caller via callback
          setResult((cur) => {
            if (cur) {
              const nota = parseNota(cur);
              if (nota !== null) {
                onGraded?.(nota);
                if (questionId) {
                  // Persiste nota mais recente na questão.
                  void import('@/lib/store').then(({ updateQuestionLocal }) => {
                    updateQuestionLocal(questionId, (q) => {
                      const p = q.payload as Record<string, unknown>;
                      const grades = Array.isArray(p.discursiva_grades)
                        ? (p.discursiva_grades as Array<{ nota: number; at: number; provider: string }>).slice(-9)
                        : [];
                      grades.push({ nota, at: Date.now(), provider });
                      return {
                        ...q,
                        payload: { ...p, discursiva_grades: grades },
                      };
                    });
                  });
                }
              }
            }
            return cur;
          });
        },
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
