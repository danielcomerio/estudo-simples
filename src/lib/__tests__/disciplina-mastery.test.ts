import { describe, expect, it } from 'vitest';
import { computeMastery, rankAllDisciplinas } from '../disciplina-mastery';
import type { Question } from '../types';

function q(opts: {
  disc: string;
  attempts?: number;
  correct?: number;
  reps?: number;
}): Question {
  return {
    id: `q-${Math.random()}`,
    type: 'objetiva',
    disciplina_id: opts.disc,
    user_id: 'u',
    tema: null,
    banca_estilo: null,
    dificuldade: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    payload: { enunciado: 'x' } as never,
    srs: {
      dueDate: 0,
      repetitions: opts.reps ?? 0,
      easeFactor: 2.5,
      interval: 0,
      lastReviewed: null,
    },
    stats: {
      attempts: opts.attempts ?? 0,
      correct: opts.correct ?? 0,
      wrong: (opts.attempts ?? 0) - (opts.correct ?? 0),
      history: [],
    },
    deleted_at: null,
    topico_id: null,
    concurso_id: null,
  };
}

describe('computeMastery', () => {
  it('disciplina sem questões → score 0, sem badge', () => {
    const m = computeMastery('Vazio', []);
    expect(m.score).toBe(0);
    expect(m.badge).toBe('');
    expect(m.qts).toBe(0);
  });

  it('100% acerto + cobertura completa → score próximo a 100', () => {
    const qts = [
      q({ disc: 'X', attempts: 10, correct: 10, reps: 5 }),
      q({ disc: 'X', attempts: 10, correct: 10, reps: 5 }),
    ];
    const m = computeMastery('X', qts);
    expect(m.score).toBe(100);
    expect(m.badge).toBe('💎');
    expect(m.badgeName).toBe('Diamante');
  });

  it('badge Bronze (50-64)', () => {
    const qts = [q({ disc: 'X', attempts: 10, correct: 6, reps: 0 })];
    const m = computeMastery('X', qts);
    expect(m.score).toBeGreaterThanOrEqual(40);
    expect(m.score).toBeLessThan(80);
  });

  it('badge Ouro (80-94)', () => {
    const qts = [
      q({ disc: 'X', attempts: 10, correct: 9, reps: 5 }),
      q({ disc: 'X', attempts: 10, correct: 9, reps: 5 }),
    ];
    const m = computeMastery('X', qts);
    expect(m.score).toBeGreaterThanOrEqual(80);
  });

  it('filtra só questões da disciplina certa', () => {
    const qts = [
      q({ disc: 'X', attempts: 10, correct: 10 }),
      q({ disc: 'Y', attempts: 10, correct: 0 }),
    ];
    const m = computeMastery('X', qts);
    expect(m.qts).toBe(1);
    expect(m.acerto).toBe(100);
  });

  it('cobertura: % com >=2 revisões', () => {
    const qts = [
      q({ disc: 'X', attempts: 5, correct: 5, reps: 3 }),
      q({ disc: 'X', attempts: 5, correct: 5, reps: 0 }),
    ];
    const m = computeMastery('X', qts);
    expect(m.cobertura).toBe(50); // 1 de 2 com >=2 reps
  });
});

describe('rankAllDisciplinas', () => {
  it('ordena por score desc', () => {
    const qts = [
      q({ disc: 'A', attempts: 10, correct: 9, reps: 5 }),
      q({ disc: 'B', attempts: 10, correct: 3, reps: 0 }),
      q({ disc: 'C', attempts: 10, correct: 7, reps: 3 }),
    ];
    const ranking = rankAllDisciplinas(['A', 'B', 'C'], qts);
    expect(ranking[0].disciplina).toBe('A');
    expect(ranking[2].disciplina).toBe('B');
  });

  it('lista vazia retorna vazio', () => {
    expect(rankAllDisciplinas([], [])).toEqual([]);
  });
});
