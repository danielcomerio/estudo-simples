/**
 * Helper pra salvar questões geradas por IA no banco local.
 * Reusado por AIGenerateButton, AIClozeFromTextButton, AIOCRButton.
 *
 * Aplica defaults consistentes:
 *  - origem: 'autoral'
 *  - fonte.gabarito_source: 'ia'
 *  - tags: ['gabarito-ia']
 *  - verificacao: 'pendente'
 *  - srs/stats vazios
 */

import { addQuestionLocal } from './store';
import type { GeneratedQuestion } from './ai-generate';

export function saveGeneratedQuestions(
  items: GeneratedQuestion[],
  userId: string
): { added: number; failed: number } {
  let added = 0;
  let failed = 0;
  for (const q of items) {
    try {
      addQuestionLocal(
        {
          type: q.type,
          disciplina_id: q.disciplina_id ?? null,
          tema: q.tema ?? null,
          banca_estilo: q.banca_estilo ?? null,
          dificuldade: q.dificuldade ?? null,
          payload: q.payload as never,
          tags: ['gabarito-ia'],
          origem: 'autoral',
          fonte: { gabarito_source: 'ia' },
          verificacao: 'pendente',
          srs: {
            dueDate: 0,
            repetitions: 0,
            easeFactor: 2.5,
            interval: 0,
            lastReviewed: null,
          },
          stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
          deleted_at: null,
          topico_id: null,
          concurso_id: null,
        },
        userId
      );
      added++;
    } catch (e) {
      console.warn('[ai-save] falha:', e);
      failed++;
    }
  }
  return { added, failed };
}
