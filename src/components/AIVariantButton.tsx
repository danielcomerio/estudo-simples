'use client';

import { useState } from 'react';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { Modal } from './Modal';
import { saveGeneratedQuestions } from '@/lib/ai-save-generated';
import { useStore } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { toast } from './Toast';
import type { Question } from '@/lib/types';

/**
 * Botão "🤖 Gerar variação" no Drawer pra questão objetiva. IA cria
 * 1-2 questões similares mas com twist (mesmo conceito, contexto/
 * gabarito diferente).
 */
type Variant = {
  enunciado: string;
  alternativas: Array<{ letra: string; texto: string; correta?: boolean }>;
  gabarito?: string;
  explicacao_geral?: string;
};

function parseVariants(text: string): Variant[] {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (v): v is Variant =>
          !!v &&
          typeof v.enunciado === 'string' &&
          Array.isArray(v.alternativas)
      )
      .slice(0, 3);
  } catch {
    return [];
  }
}

export function AIVariantButton({ question }: { question: Question }) {
  const provider = getDefaultProvider();
  const userId = useStore((s) => s.userId);
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  if (!provider || question.type !== 'objetiva') return null;

  const generate = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave', 'error');
      return;
    }
    setLoading(true);
    setVariants([]);

    const p = question.payload as {
      enunciado?: string;
      alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>;
      explicacao_geral?: string;
    };
    const ctx = `ORIGINAL:
Enunciado: ${p.enunciado}
Alternativas: ${(p.alternativas ?? []).map((a) => `${a.letra}) ${a.texto}${a.correta ? ' [CORRETA]' : ''}`).join(' | ')}
${p.explicacao_geral ? `Explicação: ${p.explicacao_geral}` : ''}`;

    const promptBase = `Gere 2 variações desta questão de concurso. Mesmo conceito MAS:
- Contexto/exemplo diferente
- Alternativas diferentes
- Pode mudar qual letra é a correta

${ctx}

Responda APENAS JSON: [{"enunciado":"...","alternativas":[{"letra":"A","texto":"...","correta":true},...],"gabarito":"A","explicacao_geral":"..."}]`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'variant-gen',
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        setLoading(false);
        return;
      }
      const parsed = parseVariants((j as { text: string }).text ?? '');
      if (parsed.length === 0) {
        toast('IA não retornou variações', 'warn');
        setLoading(false);
        return;
      }
      setVariants(parsed);
      setSelected(new Set(parsed.map((_, i) => i)));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!userId || selected.size === 0) return;
    const items = variants
      .filter((_, i) => selected.has(i))
      .map((v) => ({
        type: 'objetiva' as const,
        disciplina_id: question.disciplina_id,
        banca_estilo: question.banca_estilo,
        dificuldade: question.dificuldade,
        payload: {
          enunciado: v.enunciado,
          alternativas: v.alternativas,
          gabarito: v.gabarito ?? v.alternativas.find((a) => a.correta)?.letra,
          explicacao_geral: v.explicacao_geral,
        },
      }));
    const r = saveGeneratedQuestions(items, userId);
    scheduleSync();
    toast(`${r.added} variação(ões) criadas`, 'success');
    setOpen(false);
    setVariants([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (variants.length === 0) void generate();
        }}
        title={`Gerar variações via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '6px 12px', fontSize: '0.85rem', marginTop: 8 }}
      >
        🤖 Gerar variação
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Variações geradas" maxWidth="640px">
          <div style={{ padding: 12 }}>
            <h3 style={{ margin: '0 0 12px' }}>🤖 Variações</h3>
            {loading && <p>Gerando…</p>}
            {variants.map((v, i) => (
              <label
                key={i}
                style={{
                  display: 'block',
                  padding: 10,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  marginBottom: 10,
                  cursor: 'pointer',
                  background: selected.has(i) ? 'var(--bg-elev-2)' : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(i);
                    else next.delete(i);
                    setSelected(next);
                  }}
                  style={{ marginRight: 8 }}
                />
                <strong>{v.enunciado.slice(0, 200)}</strong>
                <ul style={{ marginTop: 6, fontSize: '0.85rem', paddingLeft: 18 }}>
                  {v.alternativas.map((a) => (
                    <li key={a.letra}>
                      {a.letra}) {a.texto.slice(0, 120)}{a.correta ? ' ✓' : ''}
                    </li>
                  ))}
                </ul>
              </label>
            ))}
            {variants.length > 0 && (
              <div className="row gap right">
                <button type="button" className="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={save}
                  disabled={selected.size === 0}
                >
                  Salvar {selected.size}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
