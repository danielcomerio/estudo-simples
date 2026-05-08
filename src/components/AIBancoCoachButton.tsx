'use client';

import { useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import {
  getAIKey,
  getDefaultProvider,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { isOverdue } from '@/lib/srs';
import { Modal } from './Modal';
import { toast } from './Toast';

/**
 * Botão "🤖 O que fazer agora?" no /banco. IA olha estado do banco
 * (qts sem tags, % verificadas, vencidas, dom médio) e devolve
 * sugestão concreta de próxima ação.
 */
export function AIBancoCoachButton() {
  const provider = getDefaultProvider();
  const all = useStore(selectActiveQuestions);
  const [open, setOpen] = useState(false);
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

    const total = all.length;
    const semTags = all.filter((q) => !q.tags || q.tags.length === 0).length;
    const pendentes = all.filter((q) => q.verificacao === 'pendente').length;
    const vencidas = all.filter((q) => isOverdue(q.srs, Date.now())).length;
    const novas = all.filter((q) => (q.srs?.repetitions ?? 0) === 0).length;
    const tents = all.reduce((a, q) => a + (q.stats?.attempts ?? 0), 0);
    const corr = all.reduce((a, q) => a + (q.stats?.correct ?? 0), 0);
    const pctMedio = tents > 0 ? Math.round((corr / tents) * 100) : 0;

    const ctx = `Estado do banco do estudante:
- Total de questões: ${total}
- Sem tags: ${semTags}
- Verificação pendente: ${pendentes}
- Vencendo agora: ${vencidas}
- Nunca estudadas: ${novas}
- % acerto médio: ${pctMedio}% (em ${tents} tentativas totais)`;

    const promptBase = `Você é um coach de estudo. Olha o estado do banco e diga em 2-3 frases o QUE FAZER PRIMEIRO. Direto, acionável.

${ctx}

Responda APENAS com a sugestão (sem cumprimentos, sem listas longas). pt-BR.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'banco-coach',
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
        onClick={() => {
          setOpen(true);
          if (!text) void ask();
        }}
        title="Pede pra IA dizer o que fazer agora baseado no estado do seu banco"
        style={{ padding: '4px 10px', fontSize: '0.82rem' }}
      >
        🤖 Próxima ação
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Sugestão de próxima ação" maxWidth="480px">
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: '0 0 12px' }}>🤖 O que fazer agora?</h3>
            {loading && <p>Analisando…</p>}
            {text && (
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  padding: 12,
                  background: 'var(--primary-soft)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.92rem',
                  lineHeight: 1.55,
                }}
              >
                {text}
              </div>
            )}
            {text && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setText(null);
                  void ask();
                }}
                style={{ marginTop: 10, padding: '4px 10px', fontSize: '0.82rem' }}
              >
                ↻ Outra sugestão
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
