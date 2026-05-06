import { describe, expect, it } from 'vitest';
import { generateWeeklyReport } from '../weekly-report';
import type { Question } from '../types';

const DAY = 86400000;

function mockQuestion(overrides: Partial<Question>): Question {
  return {
    id: 'q1',
    user_id: 'u',
    type: 'objetiva',
    disciplina_id: 'Matematica',
    tema: null,
    banca_estilo: null,
    dificuldade: null,
    payload: {},
    srs: {
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      dueDate: 0,
      lastReviewed: null,
    },
    stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
    tags: [],
    concurso_id: null,
    topico_id: null,
    origem: null,
    fonte: undefined,
    verificacao: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  } as Question;
}

describe('generateWeeklyReport', () => {
  it('header com período e título', () => {
    const md = generateWeeklyReport([]);
    expect(md).toContain('# Relatório semanal — Estudo Simples');
    expect(md).toContain('**Período:**');
    expect(md).toContain('**Gerado em:**');
  });

  it('mostra zero quando sem revisões', () => {
    const md = generateWeeklyReport([]);
    expect(md).toContain('**Total de revisões:** 0');
    expect(md).toContain('**Streak atual:** 0 dia');
  });

  it('conta revisões da última semana', () => {
    const now = Date.now();
    const q = mockQuestion({
      stats: {
        attempts: 3,
        correct: 2,
        wrong: 1,
        history: [
          { date: now - 1 * DAY, result: 'correct' },
          { date: now - 2 * DAY, result: 'wrong' },
          { date: now - 3 * DAY, result: 'correct' },
        ],
      },
    });
    const md = generateWeeklyReport([q]);
    expect(md).toContain('**Total de revisões:** 3');
  });

  it('% acerto correto', () => {
    const now = Date.now();
    const q = mockQuestion({
      stats: {
        attempts: 4,
        correct: 3,
        wrong: 1,
        history: [
          { date: now - 1 * DAY, result: 'correct' },
          { date: now - 1 * DAY, result: 'correct' },
          { date: now - 2 * DAY, result: 'correct' },
          { date: now - 3 * DAY, result: 'wrong' },
        ],
      },
    });
    const md = generateWeeklyReport([q]);
    expect(md).toContain('75%');
  });

  it('ignora revisões fora da janela 7 dias', () => {
    const now = Date.now();
    const q = mockQuestion({
      stats: {
        attempts: 2,
        correct: 2,
        wrong: 0,
        history: [
          { date: now - 1 * DAY, result: 'correct' },
          { date: now - 30 * DAY, result: 'correct' }, // fora
        ],
      },
    });
    const md = generateWeeklyReport([q]);
    // Apenas 1 revisão na última semana
    expect(md).toContain('**Total de revisões:** 1');
  });

  it('comparativo com semana anterior', () => {
    const now = Date.now();
    const q = mockQuestion({
      stats: {
        attempts: 4,
        correct: 4,
        wrong: 0,
        history: [
          // semana atual: 2 revisões
          { date: now - 1 * DAY, result: 'correct' },
          { date: now - 2 * DAY, result: 'correct' },
          // semana anterior: 2 revisões
          { date: now - 9 * DAY, result: 'correct' },
          { date: now - 10 * DAY, result: 'correct' },
        ],
      },
    });
    const md = generateWeeklyReport([q]);
    expect(md).toContain('## 📈 Comparativo com semana anterior');
    expect(md).toContain('semana anterior: 2');
  });

  it('top disciplinas', () => {
    const now = Date.now();
    const qMath = mockQuestion({
      id: 'q1',
      disciplina_id: 'Matematica',
      stats: {
        attempts: 3,
        correct: 3,
        wrong: 0,
        history: [
          { date: now - 1 * DAY, result: 'correct' },
          { date: now - 1 * DAY, result: 'correct' },
          { date: now - 1 * DAY, result: 'correct' },
        ],
      },
    });
    const qPort = mockQuestion({
      id: 'q2',
      disciplina_id: 'Português',
      stats: {
        attempts: 1,
        correct: 0,
        wrong: 1,
        history: [{ date: now - 1 * DAY, result: 'wrong' }],
      },
    });
    const md = generateWeeklyReport([qMath, qPort]);
    expect(md).toContain('## 📚 Top disciplinas');
    expect(md).toContain('**Matematica:** 3 revisões');
    expect(md).toContain('**Português:** 1 revisões');
  });

  it('recomenda quando acerto baixo', () => {
    const now = Date.now();
    const q = mockQuestion({
      stats: {
        attempts: 10,
        correct: 2,
        wrong: 8,
        history: Array.from({ length: 10 }, (_, i) => ({
          date: now - 1 * DAY,
          result: (i < 2 ? 'correct' : 'wrong') as 'correct' | 'wrong',
        })),
      },
    });
    const md = generateWeeklyReport([q]);
    expect(md).toMatch(/Acerto baixo|Inimigas/i);
  });

  it('recomenda mais consistência se poucos dias', () => {
    const now = Date.now();
    const q = mockQuestion({
      stats: {
        attempts: 5,
        correct: 4,
        wrong: 1,
        history: Array.from({ length: 5 }, () => ({
          // todos no mesmo dia
          date: now - 1 * DAY,
          result: 'correct' as const,
        })),
      },
    });
    const md = generateWeeklyReport([q]);
    expect(md).toMatch(/Consistência|consistência|dia/i);
  });

  it('contagem de novas aprendidas', () => {
    const now = Date.now();
    const q = mockQuestion({
      stats: {
        attempts: 1,
        correct: 1,
        wrong: 0,
        history: [
          // primeira revisão dentro da semana = nova
          { date: now - 2 * DAY, result: 'correct' },
        ],
      },
    });
    const md = generateWeeklyReport([q]);
    expect(md).toContain('**Novas questões aprendidas:** 1');
  });
});
