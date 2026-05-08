'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';

/**
 * Popover global que aparece quando user seleciona texto. Botão "🔍
 * Explicar" pede pra IA dar definição rápida.
 *
 * Esconde-se ao clicar fora ou Esc.
 */
export function AIExplainTermPopover() {
  const provider = getDefaultProvider();
  const [pos, setPos] = useState<{ x: number; y: number; text: string } | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (text.length < 3 || text.length > 100) {
        setPos(null);
        return;
      }
      const range = sel?.getRangeAt(0);
      if (!range) return;
      const rect = range.getBoundingClientRect();
      // Só ativa em containers que opt-in (data-explain="1")
      const node = range.startContainer.parentElement;
      const container = node?.closest('[data-explain="1"]');
      if (!container) {
        setPos(null);
        return;
      }
      setPos({
        x: rect.left + window.scrollX + rect.width / 2,
        y: rect.bottom + window.scrollY + 8,
        text,
      });
      setExplanation(null);
    };
    const click = (e: MouseEvent) => {
      if (popRef.current && popRef.current.contains(e.target as Node)) return;
      // ignore se ainda há seleção
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 2) return;
      setPos(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPos(null);
    };
    document.addEventListener('selectionchange', handler);
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('selectionchange', handler);
      document.removeEventListener('mousedown', click);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  if (!pos || !provider) return null;

  const ask = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) return;
    setLoading(true);
    setExplanation('');
    try {
      const personaPrompt = await getActivePersonaPrompt();
      const promptBase = `Explique de forma curta (max 60 palavras, 1-2 frases) o termo/conceito: "${pos.text}". Contexto: estudante de concurso público brasileiro. Direto, pt-BR.`;
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'explain-term',
          cacheable: !personaPrompt,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setExplanation(`Erro: ${j?.message ?? res.status}`);
      } else {
        setExplanation((j as { text: string }).text);
      }
    } catch (e) {
      setExplanation(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={popRef}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: 'translateX(-50%)',
        zIndex: 9000,
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        maxWidth: 320,
      }}
    >
      {!explanation && !loading && (
        <button
          type="button"
          onClick={ask}
          style={{ padding: '4px 10px', fontSize: '0.82rem' }}
          title={`Explicar "${pos.text.slice(0, 30)}"`}
        >
          🔍 Explicar
        </button>
      )}
      {loading && (
        <span className="muted" style={{ fontSize: '0.82rem' }}>
          🤖 Pensando…
        </span>
      )}
      {explanation && (
        <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
          <strong>{pos.text.slice(0, 60)}{pos.text.length > 60 ? '…' : ''}</strong>
          <div style={{ marginTop: 4 }}>{explanation}</div>
        </div>
      )}
    </div>
  );
}
