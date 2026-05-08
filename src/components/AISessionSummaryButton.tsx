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
import type { Question } from '@/lib/types';

/**
 * Botão "🤖 Resumir esta sessão" no Summary do Runner. IA olha as
 * questões erradas + acertadas + tempos e gera 1 parágrafo de
 * retrospectiva pra reflexão.
 */
export function AISessionSummaryButton({
  pool,
  startedAt,
  correct,
  wrong,
}: {
  pool: Question[];
  startedAt: number;
  correct: number;
  wrong: number;
}) {
  const provider = getDefaultProvider();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    setText('');

    // Coleta detalhe das erradas
    const erradas: string[] = [];
    let totalTimeMs = 0;
    for (const q of pool) {
      const hist = q.stats?.history ?? [];
      const sessionHist = hist.filter((h) => h.date >= startedAt);
      for (const h of sessionHist) {
        totalTimeMs += h.timeMs ?? 0;
        if (h.result === 'wrong' || h.result === 'timeout') {
          const p = q.payload as { enunciado?: string };
          erradas.push(`- [${q.disciplina_id ?? '—'}] ${(p.enunciado ?? '').slice(0, 150)}`);
        }
      }
    }

    const tempoMin = Math.round(totalTimeMs / 60000);
    const promptBase = `Estudante completou sessão de estudo: ${correct + wrong} questões em ~${tempoMin}min, ${correct} acertos e ${wrong} erros.

ERRADAS:
${erradas.slice(0, 8).join('\n') || '(nenhuma)'}

Escreva 1 parágrafo (max 100 palavras) de retrospectiva: padrões observados nas erradas, o que reforçar, sugestão pra próxima sessão. Tom direto, encorajador, pt-BR.`;

    const personaPrompt = await getActivePersonaPrompt();
    streamAIChat(
      {
        provider,
        apiKey,
        prompt: withPersona(promptBase, personaPrompt),
        kind: 'session-summary',
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
        title={`Resumo IA via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '6px 12px', fontSize: '0.85rem', marginTop: 12 }}
      >
        🤖 Resumir esta sessão
      </button>
    );
  }
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        background: 'var(--bg-elev-2)',
        borderLeft: '3px solid var(--primary)',
        borderRadius: 'var(--radius)',
        fontSize: '0.92rem',
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
      }}
    >
      <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 6 }}>
        🤖 {PROVIDER_LABELS[provider]} {loading && '…'}
      </div>
      {text}
    </div>
  );
}
