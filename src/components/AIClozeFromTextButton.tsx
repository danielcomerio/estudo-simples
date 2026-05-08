'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { useStore } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { saveGeneratedQuestions } from '@/lib/ai-save-generated';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import {
  buildClozeFromTextPrompt,
  parseAndValidate,
  type GeneratedQuestion,
} from '@/lib/ai-generate';
import { AIQuestionPreviewItem } from './AIQuestionPreviewItem';
import { toast } from './Toast';

/**
 * Botão "🤖 Cloze de texto" no toolbar do BancoList.
 *
 * User cola um texto (lei, doutrina, resumo, anotação) e IA gera
 * N cards cloze marcando os termos-chave. Reusa wizard preview do
 * AIGenerateButton.
 */
export function AIClozeFromTextButton() {
  const [open, setOpen] = useState(false);
  const provider = getDefaultProvider();

  if (!provider) {
    // Sem chave: null. Toolbar mostra link único consolidado.
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Gerar cloze de texto via ${PROVIDER_LABELS[provider]}`}
        style={{
          background: 'var(--bg-elev-2)',
          border: '1px solid var(--primary)',
          color: 'var(--primary)',
          fontWeight: 500,
        }}
      >
        🃏 Cloze de texto
      </button>
      {open && <Wizard onClose={() => setOpen(false)} />}
    </>
  );
}

type Step = 'config' | 'loading' | 'preview';

function Wizard({ onClose }: { onClose: () => void }) {
  const provider = getDefaultProvider();
  const userId = useStore((s) => s.userId);

  const [step, setStep] = useState<Step>('config');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<GeneratedQuestion[]>([]);
  const [discarded, setDiscarded] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [text, setText] = useState('');
  const [qtd, setQtd] = useState(5);
  const [disciplina, setDisciplina] = useState('');

  if (!provider) return null;

  async function generate() {
    if (text.trim().length < 50) {
      setError('Cole pelo menos 50 caracteres de texto');
      return;
    }
    setError(null);
    setStep('loading');
    const apiKey = getAIKey(provider!);
    if (!apiKey) {
      setError('Chave não configurada');
      setStep('config');
      return;
    }
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: buildClozeFromTextPrompt(
            text.trim().slice(0, 8000),
            Math.max(1, Math.min(20, qtd)),
            disciplina.trim() || undefined
          ),
          kind: 'generate',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message ?? `Erro do provider (${res.status})`);
        setStep('config');
        return;
      }
      const result = parseAndValidate((json as { text: string }).text, {
        topic: text.slice(0, 100),
        qtd,
        type: 'cloze',
        disciplina: disciplina.trim() || undefined,
      });
      if (result.items.length === 0) {
        setError(
          `Nenhum cloze válido foi gerado (${result.discarded} descartados). O texto pode ser muito curto ou sem termos claros.`
        );
        setStep('config');
        return;
      }
      setItems(result.items);
      setDiscarded(result.discarded);
      setSelected(new Set(result.items.map((_, i) => i)));
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede');
      setStep('config');
    }
  }

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function accept() {
    if (!userId) {
      toast('Não autenticado', 'error');
      return;
    }
    const toAdd = items.filter((_, i) => selected.has(i));
    const { added } = saveGeneratedQuestions(toAdd, userId);
    if (added > 0) {
      scheduleSync(500);
      toast(`${added} card(s) cloze adicionados ao banco.`, 'success');
      onClose();
    } else {
      toast('Nenhum card foi adicionado', 'warn');
    }
  }

  return (
    <Modal onClose={onClose} ariaLabel="Cloze de texto via IA" maxWidth={680}>
      <h2 style={{ margin: '0 0 6px' }}>🃏 Gerar cloze de texto</h2>
      <p
        className="muted"
        style={{ margin: '0 0 14px', fontSize: '0.85rem' }}
      >
        Cole um trecho (lei, doutrina, resumo, anotação) e a IA marca os
        termos-chave como lacunas. Tag <code>gabarito-ia</code> + revisão
        pendente.
      </p>

      {step === 'config' && (
        <>
          <div style={{ display: 'grid', gap: 10 }}>
            <label>
              <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                Texto fonte ({text.length} chars)
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 8000))}
                rows={10}
                placeholder="Cole aqui um trecho de doutrina, lei, resumo ou anotação. Mínimo 50 chars, máximo 8000."
                style={{
                  width: '100%',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 100px' }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  Quantidade
                </div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={qtd}
                  onChange={(e) =>
                    setQtd(parseInt(e.target.value, 10) || 1)
                  }
                />
              </label>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  Disciplina
                </div>
                <input
                  type="text"
                  value={disciplina}
                  onChange={(e) => setDisciplina(e.target.value)}
                  placeholder="Direito Constitucional"
                />
              </label>
            </div>
          </div>

          {error && (
            <p
              style={{
                color: 'var(--danger)',
                fontSize: '0.85rem',
                marginTop: 10,
              }}
            >
              ⚠ {error}
            </p>
          )}

          <div className="row gap" style={{ marginTop: 16 }}>
            <button type="button" className="primary" onClick={generate}>
              Gerar →
            </button>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {step === 'loading' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🤖</div>
          <div>Identificando termos-chave…</div>
          <div
            className="muted"
            style={{ fontSize: '0.82rem', marginTop: 8 }}
          >
            ~10-30s dependendo do tamanho
          </div>
        </div>
      )}

      {step === 'preview' && (
        <>
          <div
            className="muted"
            style={{
              fontSize: '0.85rem',
              marginBottom: 12,
              padding: 8,
              background: 'var(--bg-elev-2)',
              borderRadius: 6,
            }}
          >
            ✓ {items.length} cloze(s) válido(s){' '}
            {discarded > 0 && `· ${discarded} descartado(s)`}.
          </div>

          <div className="row gap" style={{ marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setSelected(new Set(items.map((_, i) => i)))}
            >
              Selecionar todos
            </button>
            <button type="button" onClick={() => setSelected(new Set())}>
              Limpar
            </button>
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              {selected.size}/{items.length}
            </span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
            {items.map((q, i) => (
              <AIQuestionPreviewItem
                key={i}
                question={q}
                checked={selected.has(i)}
                onToggle={() => toggle(i)}
              />
            ))}
          </ul>

          <div className="row gap">
            <button
              type="button"
              className="primary"
              onClick={accept}
              disabled={selected.size === 0}
            >
              ✓ Adicionar {selected.size} ao banco
            </button>
            <button type="button" onClick={() => setStep('config')}>
              ← Refazer
            </button>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
