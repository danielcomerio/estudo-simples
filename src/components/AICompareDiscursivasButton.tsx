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

/**
 * Modal pra colar 2 respostas discursivas (sua + colega/IA) e pedir
 * IA pra apontar qual é melhor + critérios.
 */
export function AICompareDiscursivasButton({
  espelho,
  enunciado,
  respostaInicial,
}: {
  espelho?: string;
  enunciado?: string;
  respostaInicial?: string;
}) {
  const provider = getDefaultProvider();
  const [open, setOpen] = useState(false);
  const [respA, setRespA] = useState(respostaInicial ?? '');
  const [respB, setRespB] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!provider) return null;

  const ask = async () => {
    if (!respA.trim() || !respB.trim()) {
      toast('Preencha as 2 respostas', 'warn');
      return;
    }
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    setText('');

    const promptBase = `Compare 2 respostas discursivas de concurso público brasileiro.

${enunciado ? `ENUNCIADO: ${enunciado.slice(0, 600)}\n` : ''}
${espelho ? `ESPELHO OFICIAL: ${espelho.slice(0, 800)}\n` : ''}

RESPOSTA A:
${respA.slice(0, 2000)}

RESPOSTA B:
${respB.slice(0, 2000)}

Em ≤300 palavras (markdown):
1. Qual é melhor (A ou B)?
2. Pontos fortes de cada uma
3. Pontos fracos de cada uma
4. Sugestão de melhoria pra ambas

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
          kind: 'compare-discursivas',
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
        onClick={() => setOpen(true)}
        title={`Compare 2 respostas discursivas via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '4px 10px', fontSize: '0.82rem', marginTop: 6 }}
      >
        🤖 Comparar 2 respostas
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Comparar respostas" maxWidth="720px">
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: '0 0 12px' }}>🤖 Comparar 2 respostas</h3>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ fontSize: '0.85rem' }}>Resposta A:</span>
              <textarea
                value={respA}
                onChange={(e) => setRespA(e.target.value)}
                rows={6}
                style={{ width: '100%', fontSize: '0.88rem' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ fontSize: '0.85rem' }}>Resposta B:</span>
              <textarea
                value={respB}
                onChange={(e) => setRespB(e.target.value)}
                rows={6}
                style={{ width: '100%', fontSize: '0.88rem' }}
              />
            </label>
            <button
              type="button"
              className="primary"
              onClick={ask}
              disabled={loading || !respA.trim() || !respB.trim()}
            >
              {loading ? 'Analisando…' : 'Comparar'}
            </button>
            {text && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.92rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  maxHeight: '50vh',
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
