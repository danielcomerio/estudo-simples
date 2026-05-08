'use client';

import { useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { Modal } from './Modal';
import { toast } from './Toast';

/**
 * Botão "🤖 Sintetizar disciplina" em /disciplinas. Pega 30 questões
 * aleatórias da disciplina e pede pra IA gerar um resumo dos tópicos
 * cobertos.
 */
export function AIDisciplinaSummary({ disciplinaNome }: { disciplinaNome: string }) {
  const provider = getDefaultProvider();
  const all = useStore(selectActiveQuestions);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const generate = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    setText('');

    const sample = all
      .filter((q) => q.disciplina_id === disciplinaNome)
      .filter((q) => q.type === 'objetiva')
      .sort(() => Math.random() - 0.5)
      .slice(0, 30);

    if (sample.length < 3) {
      toast('Disciplina precisa de mais questões pra resumo útil', 'warn');
      setLoading(false);
      return;
    }

    const ctx = sample
      .map((q, i) => {
        const p = q.payload as { enunciado?: string };
        return `${i + 1}. ${(p.enunciado ?? '').slice(0, 200)}`;
      })
      .join('\n');

    const promptBase = `Você é um professor de concurso. Analise os enunciados abaixo (amostra de ${sample.length} questões da disciplina "${disciplinaNome}") e gere um RESUMO ESTRUTURADO dos tópicos cobertos.

QUESTÕES:
${ctx}

Estrutura da resposta:
- Lista de 5-10 tópicos principais (use bullet points)
- Pra cada tópico: 1 frase explicando + estimativa de % de cobertura
- 2-3 dicas específicas de estudo

Use markdown, pt-BR, max 600 palavras.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'discipline-summary',
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        setLoading(false);
        return;
      }
      setText((j as { text: string }).text);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="ghost"
        onClick={() => {
          setOpen(true);
          if (!text) void generate();
        }}
        title={`Resumo gerado por ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '4px 10px', fontSize: '0.82rem' }}
      >
        🤖 Sintetizar
      </button>
      {open && (
        <Modal
          onClose={() => setOpen(false)}
          ariaLabel={`Resumo de ${disciplinaNome}`}
        >
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: '0 0 12px' }}>
              🤖 {disciplinaNome} — síntese
            </h3>
            {loading && <p>Analisando…</p>}
            {text && (
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  padding: 12,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.9rem',
                  lineHeight: 1.55,
                  maxHeight: '60vh',
                  overflowY: 'auto',
                }}
              >
                {text}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
