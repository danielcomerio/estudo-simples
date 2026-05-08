import { describe, expect, it } from 'vitest';
import { pickBalancedSimulado } from '../simulado-balanceado';
import type { Question } from '../types';

function q(disc: string, opts: { attempts?: number; correct?: number } = {}): Question {
  return {
    id: `q-${Math.random()}`,
    user_id: 'u',
    type: 'objetiva',
    disciplina_id: disc,
    tema: null,
    banca_estilo: null,
    dificuldade: null,
    payload: { enunciado: 'x' } as never,
    srs: { dueDate: 0, repetitions: 0, easeFactor: 2.5, interval: 0, lastReviewed: null },
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

describe('pickBalancedSimulado', () => {
  it('weights vazios → []', () => {
    expect(pickBalancedSimulado([], [], 10)).toEqual([]);
  });

  it('totalN=0 → []', () => {
    expect(pickBalancedSimulado([q('A')], [{ disciplina: 'A', peso: 1 }], 0)).toEqual([]);
  });

  it('seleciona até totalN questões', () => {
    const qts = Array.from({ length: 20 }, (_, i) => q('A'));
    const r = pickBalancedSimulado(qts, [{ disciplina: 'A', peso: 1 }], 10);
    expect(r.length).toBeLessThanOrEqual(10);
  });

  it('respeita pesos: disciplina com peso maior recebe quota maior', () => {
    const qts = [
      ...Array.from({ length: 30 }, () => q('A')),
      ...Array.from({ length: 30 }, () => q('B')),
    ];
    const r = pickBalancedSimulado(
      qts,
      [
        { disciplina: 'A', peso: 3 },
        { disciplina: 'B', peso: 1 },
      ],
      20
    );
    const aCount = r.filter((q) => q.disciplina_id === 'A').length;
    const bCount = r.filter((q) => q.disciplina_id === 'B').length;
    // A com peso 3 deve ter mais que B
    expect(aCount).toBeGreaterThan(bCount);
  });

  it('dedup: nenhuma questão se repete', () => {
    const qts = Array.from({ length: 50 }, () => q('A'));
    const r = pickBalancedSimulado(qts, [{ disciplina: 'A', peso: 1 }], 30);
    const ids = new Set(r.map((q) => q.id));
    expect(ids.size).toBe(r.length);
  });

  it('só pega objetivas', () => {
    const flashcards: Question[] = [
      { ...q('A'), type: 'flashcard' as const },
      { ...q('A'), type: 'flashcard' as const },
    ];
    const objetivas = [q('A'), q('A')];
    const r = pickBalancedSimulado(
      [...flashcards, ...objetivas],
      [{ disciplina: 'A', peso: 1 }],
      10
    );
    expect(r.every((q) => q.type === 'objetiva')).toBe(true);
  });
});
