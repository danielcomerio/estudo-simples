'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { toast } from './Toast';
import type { Question } from '@/lib/types';
import { updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';

/**
 * Botão "🤖 Gerar mnemônico" no Drawer. Pede pra IA criar uma sigla,
 * acrônimo ou frase mnemônica que ajuda a memorizar o conceito.
 *
 * Output guardado em payload.mnemonico (string).
 */
export function AIMnemonicButton({ question }: { question: Question }) {
  const provider = getDefaultProvider();
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const existing = (question.payload as { mnemonico?: string }).mnemonico;

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Chave IA não configurada', 'error');
      return;
    }
    setLoading(true);
    try {
      const p = question.payload as {
        enunciado?: string;
        explicacao_geral?: string;
        frente?: string;
        verso?: string;
      };
      const ctx = [
        p.enunciado ?? p.frente ?? '',
        p.explicacao_geral ?? p.verso ?? '',
      ]
        .filter(Boolean)
        .join('\n');

      const promptBase = `Crie uma mnemônica/acrônimo/frase memorizável pra esta questão de concurso público. Algo curto que o aluno pode lembrar (sigla, rima, frase visual).

CONTEXTO:
${ctx}

Responda APENAS com a mnemônica em 1-3 linhas (ex: "F.A.C.A. = Festas, Aniversários, Casamentos, Algo"). Sem explicação extra.
pt-BR.`;

      const personaPrompt = await getActivePersonaPrompt();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'mnemonic',
          cacheable: !personaPrompt,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        return;
      }
      const t = ((j as { text: string }).text ?? '').trim();
      if (!t) {
        toast('IA não retornou mnemônica', 'warn');
        return;
      }
      updateQuestionLocal(question.id, (cur) => ({
        ...cur,
        payload: { ...cur.payload, mnemonico: t },
      }));
      scheduleSync();
      toast('🧠 Mnemônica salva', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={ask}
        disabled={loading}
        title={`Gerar mnemônica via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
      >
        {loading ? 'Pensando…' : '🧠 Gerar mnemônica'}
      </button>
      {existing && (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            background: 'var(--bg-elev-2)',
            borderRadius: 'var(--radius)',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {existing}
        </div>
      )}
    </div>
  );
}
