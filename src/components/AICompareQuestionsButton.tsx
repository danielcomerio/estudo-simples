'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { Modal } from './Modal';
import { toast } from './Toast';
import { selectActiveQuestions, useStore } from '@/lib/store';

/**
 * Botão pra comparar 2 questões selecionadas em /banco. IA aponta
 * similaridades/diferenças. Útil pra entender se podem virar uma só
 * (consolidar) ou se são complementares.
 */
export function AICompareQuestionsButton({
  selectedIds,
}: {
  selectedIds: Set<string>;
}) {
  const provider = getDefaultProvider();
  const all = useStore(selectActiveQuestions);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;
  if (selectedIds.size !== 2) return null;

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    const ids = Array.from(selectedIds);
    const qa = all.find((q) => q.id === ids[0]);
    const qb = all.find((q) => q.id === ids[1]);
    if (!qa || !qb) {
      toast('Questão não encontrada', 'error');
      return;
    }
    setLoading(true);
    setText('');

    const enunA = (qa.payload as { enunciado?: string; frente?: string }).enunciado ??
      (qa.payload as { frente?: string }).frente ?? '';
    const enunB = (qb.payload as { enunciado?: string; frente?: string }).enunciado ??
      (qb.payload as { frente?: string }).frente ?? '';

    const promptBase = `Compare estas 2 questões de concurso. Em ≤200 palavras:
1. São o mesmo conceito? (sim/parcial/não)
2. Diferenças relevantes
3. Vale consolidar em uma só? (recomendação)

QUESTÃO A: ${enunA.slice(0, 400)}
QUESTÃO B: ${enunB.slice(0, 400)}

pt-BR, direto, markdown leve.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'compare-questions',
          cacheable: !personaPrompt,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
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
          if (!text) void ask();
        }}
        title={`Comparar 2 questões via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '4px 10px', fontSize: '0.82rem' }}
      >
        🤖 Comparar 2
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Comparação IA" maxWidth="720px">
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: '0 0 12px' }}>🤖 Comparação IA</h3>
            {loading && <p>Analisando…</p>}
            {text && (
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  padding: 12,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.92rem',
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
