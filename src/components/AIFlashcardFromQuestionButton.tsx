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
 * Botão "🤖 Gerar flashcards" no Drawer da questão. Pede pra IA extrair
 * 1-3 flashcards do conceito da questão (frente/verso).
 *
 * Output JSON estrito: [{frente, verso}, ...]. User revisa antes de salvar.
 */

type Card = { frente: string; verso: string };

function parseCards(text: string): Card[] {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (c: unknown): c is Card =>
          typeof c === 'object' &&
          c !== null &&
          typeof (c as Card).frente === 'string' &&
          typeof (c as Card).verso === 'string'
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function AIFlashcardFromQuestionButton({ question }: { question: Question }) {
  const provider = getDefaultProvider();
  const userId = useStore((s) => s.userId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  if (!provider) return null;

  const generate = async () => {
    const apiKey = getAIKey(provider);
    if (!apiKey) {
      toast('Sem chave configurada', 'error');
      return;
    }
    setLoading(true);
    setCards([]);
    setSelected(new Set());

    const p = question.payload as {
      enunciado?: string;
      explicacao_geral?: string;
      alternativas?: Array<{ letra: string; texto: string; correta?: boolean }>;
    };
    const correta = p.alternativas?.find((a) => a.correta);
    const ctx = [
      `Questão: ${p.enunciado ?? ''}`,
      correta ? `Resposta correta: ${correta.texto}` : '',
      p.explicacao_geral ? `Explicação: ${p.explicacao_geral}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const promptBase = `Gere 1-3 flashcards a partir desta questão de concurso. Cada flashcard tem:
- frente: pergunta curta isolando UM conceito (não a questão original)
- verso: resposta direta + explicação curta (max 100 palavras)

${ctx}

Responda APENAS com JSON neste formato (array, sem markdown extra):
[{"frente":"...","verso":"..."}, ...]

Cada flashcard deve ser auto-suficiente — usável fora do contexto da questão.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'flashcard-from-question',
          cacheable: !personaPrompt,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.message ?? `Erro (${res.status})`, 'error');
        return;
      }
      const parsed = parseCards((j as { text: string }).text);
      if (parsed.length === 0) {
        toast('IA não retornou flashcards válidos', 'warn');
        return;
      }
      setCards(parsed);
      setSelected(new Set(parsed.map((_, i) => i)));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!userId || selected.size === 0) return;
    const items = cards
      .filter((_, i) => selected.has(i))
      .map((c) => ({
        type: 'flashcard' as const,
        disciplina_id: question.disciplina_id || 'sem-disciplina',
        payload: { frente: c.frente, verso: c.verso },
      }));
    const r = saveGeneratedQuestions(items, userId);
    scheduleSync();
    toast(`${r.added} flashcard(s) criados`, 'success');
    setOpen(false);
    setCards([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (cards.length === 0) void generate();
        }}
        title={`Gerar flashcards via ${PROVIDER_LABELS[provider]}`}
        style={{ padding: '6px 12px', fontSize: '0.85rem', marginTop: 8 }}
      >
        🤖 Gerar flashcards
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} ariaLabel="Flashcards gerados">
          <div style={{ padding: 12 }}>
            <h3 style={{ margin: '0 0 12px' }}>🤖 Flashcards gerados</h3>
            {loading && <p>Gerando…</p>}
            {!loading && cards.length === 0 && <p className="muted">Nada gerado.</p>}
            {cards.map((c, i) => (
              <label
                key={i}
                style={{
                  display: 'block',
                  padding: 10,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  marginBottom: 8,
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
                <strong>F:</strong> {c.frente}
                <br />
                <strong>V:</strong> {c.verso}
              </label>
            ))}
            {cards.length > 0 && (
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
                  Salvar {selected.size} card(s)
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
