import { describe, expect, it } from 'vitest';
import { getQuestionText, getQuestionAnswer, truncateText } from '../question-text';
import type { Question } from '../types';

function q(overrides: Partial<Question>): Question {
  return {
    id: 'x',
    user_id: 'u',
    type: 'objetiva',
    disciplina_id: null,
    tema: null,
    banca_estilo: null,
    dificuldade: null,
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
    payload: {} as never,
    srs: { dueDate: 0, repetitions: 0, easeFactor: 2.5, interval: 0, lastReviewed: null },
    stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
    deleted_at: null,
    topico_id: null,
    concurso_id: null,
    ...overrides,
  };
}

describe('getQuestionText', () => {
  it('objetiva → enunciado', () => {
    expect(getQuestionText(q({ payload: { enunciado: 'Pergunta?' } as never }))).toBe('Pergunta?');
  });
  it('flashcard → frente', () => {
    expect(
      getQuestionText(q({ type: 'flashcard', payload: { frente: 'F', verso: 'V' } as never }))
    ).toBe('F');
  });
  it('cloze → texto', () => {
    expect(
      getQuestionText(q({ type: 'cloze', payload: { texto: 'Capital {{c1::X}}' } as never }))
    ).toBe('Capital {{c1::X}}');
  });
  it('fallback → vazio', () => {
    expect(getQuestionText(q({ payload: {} as never }))).toBe('');
  });
});

describe('getQuestionAnswer', () => {
  it('flashcard → verso', () => {
    expect(
      getQuestionAnswer(q({ type: 'flashcard', payload: { frente: 'F', verso: 'V' } as never }))
    ).toBe('V');
  });
  it('objetiva com correta → letra + texto', () => {
    const result = getQuestionAnswer(
      q({
        payload: {
          alternativas: [
            { letra: 'A', texto: 'X' },
            { letra: 'B', texto: 'Y', correta: true },
          ],
        } as never,
      })
    );
    expect(result).toContain('B');
    expect(result).toContain('Y');
  });
  it('objetiva sem correta → gabarito', () => {
    expect(
      getQuestionAnswer(
        q({
          payload: {
            alternativas: [{ letra: 'A', texto: 'X' }],
            gabarito: 'A',
          } as never,
        })
      )
    ).toContain('A');
  });
});

describe('truncateText', () => {
  it('texto curto não muda', () => {
    expect(truncateText('curto', 100)).toBe('curto');
  });
  it('truncate em boundary de palavra', () => {
    const r = truncateText('uma frase com várias palavras aqui', 15);
    expect(r.length).toBeLessThanOrEqual(16);
    expect(r).toMatch(/…$/);
    expect(r).not.toContain('palavr');
  });
  it('truncate sem boundary próximo', () => {
    const r = truncateText('palavraúnicaenorme', 5);
    expect(r).toBe('palav…');
  });
});
