'use client';

import { useStore } from '@/lib/store';
import { saveGeneratedQuestions } from '@/lib/ai-save-generated';
import { scheduleSync } from '@/lib/sync';
import { toast } from './Toast';
import type { Question } from '@/lib/types';

/**
 * Cria uma cópia do flashcard com frente e verso TROCADOS — funciona
 * como segundo card SRS independente. Estilo Anki "Basic + reversed
 * card".
 *
 * Tag adicionada: `reverso-de-{id-curto}` pra rastreabilidade.
 */
export function FlashcardReverseButton({ question }: { question: Question }) {
  const userId = useStore((s) => s.userId);
  if (question.type !== 'flashcard') return null;
  const p = question.payload as { frente?: string; verso?: string };
  if (!p.frente || !p.verso) return null;

  const create = () => {
    if (!userId) return;
    const r = saveGeneratedQuestions(
      [
        {
          type: 'flashcard',
          disciplina_id: question.disciplina_id,
          payload: {
            frente: p.verso,
            verso: p.frente,
            notes_user: `Reverso de "${(p.frente ?? '').slice(0, 60)}"`,
          },
        },
      ],
      userId
    );
    scheduleSync();
    toast(
      r.added > 0 ? '✅ Card reverso criado' : '❌ Falha',
      r.added > 0 ? 'success' : 'error'
    );
  };

  return (
    <button
      type="button"
      onClick={create}
      title="Cria card SRS independente com frente↔verso trocados (estilo Anki Basic+reversed)"
      style={{ padding: '6px 12px', fontSize: '0.85rem', marginTop: 8 }}
    >
      🔁 Criar reverso
    </button>
  );
}
