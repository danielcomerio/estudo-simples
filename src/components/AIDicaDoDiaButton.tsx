'use client';

import { useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { toast } from './Toast';

const PREFIX = 'estudo-simples:dica-do-dia:';

/**
 * Botão "💡 Dica do dia" pra disciplina. IA gera 1 dica curta (≤30
 * palavras) — conceito chave / armadilha / mnemônica. Cache 24h por
 * disciplina.
 */
export function AIDicaDoDiaButton({ disciplinaNome }: { disciplinaNome: string }) {
  const provider = getDefaultProvider();
  const all = useStore(selectActiveQuestions);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const todayKey = `${PREFIX}${disciplinaNome}:${new Date().toISOString().slice(0, 10)}`;

  const ask = async () => {
    const cached = (() => {
      try {
        return localStorage.getItem(todayKey);
      } catch {
        return null;
      }
    })();
    if (cached) {
      toast(`💡 ${cached}`, '');
      return;
    }
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);

    const sample = all
      .filter((q) => q.disciplina_id === disciplinaNome && q.type === 'objetiva')
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)
      .map((q) => (q.payload as { enunciado?: string }).enunciado ?? '')
      .join('\n');

    const promptBase = `Gere UMA dica curta (≤30 palavras) sobre "${disciplinaNome}" — pode ser: conceito chave, armadilha comum, mnemônica, regra prática. Direto, sem cumprimentos.

Amostra de questões:
${sample.slice(0, 1500)}

Resposta: 1 frase só, pt-BR.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'dica-do-dia',
          cacheable: !personaPrompt,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        return;
      }
      const text = (j as { text: string }).text?.trim();
      if (!text) {
        toast('IA não retornou dica', 'warn');
        return;
      }
      try {
        localStorage.setItem(todayKey, text);
      } catch {
        /* ignore */
      }
      toast(`💡 ${text}`, '');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className="ghost"
      onClick={ask}
      disabled={loading}
      title={`Dica do dia via ${PROVIDER_LABELS[provider]} (cache 24h)`}
      style={{ padding: '4px 10px', fontSize: '0.82rem' }}
    >
      💡 Dica do dia
    </button>
  );
}
