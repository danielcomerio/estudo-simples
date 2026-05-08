'use client';

import { selectActiveQuestions, useStore, updateQuestionLocal } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

/**
 * Botão danger "↺ Resetar SRS" por disciplina.
 *
 * Zera srs (dueDate, repetitions, interval) e stats (attempts, correct,
 * wrong, history) de TODAS questões da disciplina. Não exclui as
 * questões — só limpa o progresso pra começar do zero.
 *
 * Confirm danger obrigatório.
 */
export function ResetDisciplinaButton({ disciplinaNome }: { disciplinaNome: string }) {
  const all = useStore(selectActiveQuestions);
  const qts = all.filter((q) => q.disciplina_id === disciplinaNome);

  if (qts.length === 0) return null;

  const handle = async () => {
    const ok = await confirmDialog({
      title: `Resetar progresso de ${disciplinaNome}`,
      message: `Vai zerar SRS e stats de TODAS as ${qts.length} questões dessa disciplina. As questões NÃO são excluídas, só o progresso. Não dá pra desfazer. Continuar?`,
      danger: true,
    });
    if (!ok) return;
    let count = 0;
    for (const q of qts) {
      updateQuestionLocal(q.id, () => ({
        srs: {
          dueDate: 0,
          repetitions: 0,
          easeFactor: 2.5,
          interval: 0,
          lastReviewed: null,
        },
        stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
      }));
      count++;
    }
    scheduleSync();
    toast(`✅ ${count} questão(ões) zerada(s)`, 'success');
  };

  return (
    <button
      type="button"
      className="ghost"
      onClick={handle}
      title={`Zera SRS e stats de ${qts.length} questões`}
      style={{ padding: '4px 10px', fontSize: '0.82rem', color: 'var(--danger)' }}
    >
      ↺ Resetar progresso
    </button>
  );
}
