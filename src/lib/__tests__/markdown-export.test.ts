import { describe, expect, it } from 'vitest';
import { questionsToMarkdown } from '../markdown-export';
import type { Question } from '../types';

function baseQ(overrides: Partial<Question>): Question {
  return {
    id: 'q1',
    user_id: 'u',
    type: 'objetiva',
    disciplina_id: null,
    tema: null,
    banca_estilo: null,
    dificuldade: null,
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
    payload: { enunciado: '' } as never,
    srs: { dueDate: 0, repetitions: 0, easeFactor: 2.5, interval: 0, lastReviewed: null },
    stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
    deleted_at: null,
    topico_id: null,
    concurso_id: null,
    ...overrides,
  };
}

describe('questionsToMarkdown', () => {
  it('header com total e timestamp', () => {
    const md = questionsToMarkdown([]);
    expect(md).toContain('# Banco exportado');
    expect(md).toContain('Total: 0');
  });

  it('objetiva: enunciado + alternativas + gabarito', () => {
    const q = baseQ({
      type: 'objetiva',
      payload: {
        enunciado: 'Qual a capital?',
        alternativas: [
          { letra: 'A', texto: 'SP', correta: false },
          { letra: 'B', texto: 'Brasília', correta: true },
        ],
        gabarito: 'B',
        explicacao_geral: 'Capital federal desde 1960',
      } as never,
    });
    const md = questionsToMarkdown([q]);
    expect(md).toContain('Qual a capital?');
    expect(md).toContain('A)** SP');
    expect(md).toContain('B)** Brasília');
    expect(md).toContain('✓');
    expect(md).toContain('Gabarito: **B**');
    expect(md).toContain('Capital federal');
  });

  it('discursiva: enunciado + espelho', () => {
    const q = baseQ({
      type: 'discursiva',
      payload: {
        enunciado: 'Disserte sobre X',
        espelho_resposta: 'X é fundamental porque...',
      } as never,
    });
    const md = questionsToMarkdown([q]);
    expect(md).toContain('Disserte sobre X');
    expect(md).toContain('### Espelho');
    expect(md).toContain('X é fundamental');
  });

  it('cloze: texto + explicação', () => {
    const q = baseQ({
      type: 'cloze',
      payload: {
        texto: 'Capital é {{c1::Brasília}}',
        explicacao: 'Desde 1960',
      } as never,
    });
    const md = questionsToMarkdown([q]);
    expect(md).toContain('{{c1::Brasília}}');
    expect(md).toContain('### Explicação');
  });

  it('flashcard: F + V', () => {
    const q = baseQ({
      type: 'flashcard',
      payload: { frente: 'Quem foi Tiradentes?', verso: 'Joaquim José' } as never,
    });
    const md = questionsToMarkdown([q]);
    expect(md).toContain('**F:** Quem foi Tiradentes?');
    expect(md).toContain('**V:** Joaquim José');
  });

  it('inclui metadata: disciplina, banca, dificuldade, origem, tags', () => {
    const q = baseQ({
      disciplina_id: 'Direito',
      banca_estilo: 'FGV',
      dificuldade: 4,
      origem: 'real',
      tags: ['banca-fgv', 'art-5'],
      payload: { enunciado: 'Q' } as never,
    });
    const md = questionsToMarkdown([q]);
    expect(md).toContain('**Disciplina**: Direito');
    expect(md).toContain('**Banca**: FGV');
    expect(md).toContain('**Dificuldade**: 4/5');
    expect(md).toContain('**Origem**: real');
    expect(md).toContain('#banca-fgv');
    expect(md).toContain('#art-5');
  });

  it('separa questões com ---', () => {
    const q1 = baseQ({ id: '1', payload: { enunciado: 'A' } as never });
    const q2 = baseQ({ id: '2', payload: { enunciado: 'B' } as never });
    const md = questionsToMarkdown([q1, q2]);
    const matches = md.match(/^---$/gm);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});
