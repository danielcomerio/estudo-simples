'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { streamAIChat } from '@/lib/ai-stream';
import { toast } from './Toast';

/**
 * Botão "🤖 A vs B" — IA explica diferença sutil entre alternativa
 * correta e a "pegadinha" mais escolhida quando user erra.
 *
 * Usado no QuestionRunner após errar quando há alternativa escolhida.
 */
export function AICompareAlternativesButton({
  enunciado,
  altCorreta,
  altErrada,
}: {
  enunciado: string;
  altCorreta: { letra: string; texto: string };
  altErrada: { letra: string; texto: string };
}) {
  const provider = getDefaultProvider();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;
  if (altCorreta.letra === altErrada.letra) return null;

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    setText('');

    const promptBase = `Estudante errou questão de concurso público brasileiro. Em ≤80 palavras, explique a DIFERENÇA SUTIL entre a alternativa CORRETA e a alternativa ESCOLHIDA (que é a pegadinha). Foque no detalhe que distingue.

ENUNCIADO: ${enunciado.slice(0, 800)}

CORRETA (${altCorreta.letra}): ${altCorreta.texto}
ESCOLHIDA-ERRADA (${altErrada.letra}): ${altErrada.texto}

Responda direto, pt-BR, sem cumprimentos.`;

    const personaPrompt = await getActivePersonaPrompt();
    streamAIChat(
      {
        provider,
        apiKey,
        prompt: withPersona(promptBase, personaPrompt),
        kind: 'compare-alts',
        cacheable: !personaPrompt,
      },
      {
        onChunk: (chunk) => setText((cur) => (cur ?? '') + chunk),
        onDone: () => setLoading(false),
        onError: (msg) => {
          toast(msg, 'error');
          setLoading(false);
        },
      }
    );
  };

  if (text === null) {
    return (
      <button
        type="button"
        className="ghost"
        onClick={ask}
        disabled={loading}
        title={`Por que ${altCorreta.letra} e não ${altErrada.letra}? — via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '4px 10px', fontSize: '0.82rem', marginTop: 6 }}
      >
        🤖 Por que {altCorreta.letra} e não {altErrada.letra}?
      </button>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        background: 'var(--bg-elev-2)',
        borderLeft: '3px solid var(--warn, #d97706)',
        borderRadius: 'var(--radius)',
        fontSize: '0.88rem',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.5,
      }}
    >
      <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
        🤖 {altCorreta.letra} vs {altErrada.letra}
      </div>
      {text}
    </div>
  );
}
