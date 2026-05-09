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
import type { Question } from '@/lib/types';

/**
 * Aparece no Drawer quando verificacao=duvidosa. IA propõe enunciado/
 * gabarito alternativo (read-only — user copia manualmente se quiser).
 */
export function AIFixDuvidosaButton({ question }: { question: Question }) {
  const provider = getDefaultProvider();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;
  if (question.verificacao !== 'duvidosa') return null;

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    setText('');

    const p = question.payload as {
      enunciado?: string;
      alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>;
      gabarito?: string;
      explicacao_geral?: string;
    };
    const promptBase = `Esta questão de concurso público brasileiro foi marcada como DUVIDOSA. Analise e proponha uma versão CORRIGIDA.

ENUNCIADO ATUAL: ${p.enunciado ?? ''}

ALTERNATIVAS:
${(p.alternativas ?? []).map((a) => `${a.letra}) ${a.texto}${a.correta ? ' [marcada correta]' : ''}`).join('\n')}

${p.gabarito ? `GABARITO ATUAL: ${p.gabarito}` : ''}
${p.explicacao_geral ? `EXPLICAÇÃO ATUAL: ${p.explicacao_geral}` : ''}

Em ≤300 palavras (markdown):
1. **Diagnóstico**: o que está duvidoso/errado nesta questão?
2. **Correção sugerida**: enunciado/alternativas/gabarito reformulados
3. **Justificativa**: por que essa é a correção correta

pt-BR, direto.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'fix-duvidosa',
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
        title={`IA sugere correção via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '6px 12px', fontSize: '0.85rem', marginTop: 8 }}
      >
        🤖 Sugerir correção
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Correção IA" maxWidth="640px">
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: '0 0 12px' }}>
              🤖 Correção sugerida (read-only)
            </h3>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 8 }}>
              IA é assistente — copie manualmente o que fizer sentido.
              Não aplica nada automaticamente.
            </p>
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
