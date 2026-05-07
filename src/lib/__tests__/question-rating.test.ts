import { describe, expect, it } from 'vitest';

/**
 * Tests pra lógica de validação de body do /api/question-rating.
 * O endpoint usa supabase, então testamos só validação pura
 * (replicada inline pra manter sync sem mock pesado).
 */

type Body = { question_id?: unknown; rating?: unknown; comment?: unknown };

function validateBody(b: Body): { ok: boolean; error?: string } {
  if (typeof b.question_id !== 'string' || !b.question_id) {
    return { ok: false, error: 'question_id required' };
  }
  if (b.rating !== 1 && b.rating !== -1) {
    return { ok: false, error: 'rating must be 1 or -1' };
  }
  if (b.comment !== undefined && typeof b.comment !== 'string' && b.comment !== null) {
    return { ok: false, error: 'comment must be string or null' };
  }
  if (typeof b.comment === 'string' && b.comment.length > 500) {
    return { ok: false, error: 'comment too long' };
  }
  return { ok: true };
}

describe('question-rating body validation', () => {
  it('aceita rating 1', () => {
    expect(validateBody({ question_id: 'q1', rating: 1 })).toEqual({
      ok: true,
    });
  });

  it('aceita rating -1', () => {
    expect(validateBody({ question_id: 'q1', rating: -1 })).toEqual({
      ok: true,
    });
  });

  it('rejeita rating 0', () => {
    expect(
      validateBody({ question_id: 'q1', rating: 0 }).ok
    ).toBe(false);
  });

  it('rejeita rating 2', () => {
    expect(
      validateBody({ question_id: 'q1', rating: 2 }).ok
    ).toBe(false);
  });

  it('rejeita question_id vazio', () => {
    expect(validateBody({ question_id: '', rating: 1 }).ok).toBe(false);
  });

  it('rejeita question_id não-string', () => {
    expect(validateBody({ question_id: 42, rating: 1 }).ok).toBe(false);
  });

  it('aceita comment null', () => {
    expect(
      validateBody({ question_id: 'q', rating: 1, comment: null }).ok
    ).toBe(true);
  });

  it('aceita comment válido', () => {
    expect(
      validateBody({
        question_id: 'q',
        rating: 1,
        comment: 'gabarito errado',
      }).ok
    ).toBe(true);
  });

  it('rejeita comment > 500 chars', () => {
    expect(
      validateBody({
        question_id: 'q',
        rating: 1,
        comment: 'x'.repeat(501),
      }).ok
    ).toBe(false);
  });

  it('aceita comment com exatamente 500 chars', () => {
    expect(
      validateBody({
        question_id: 'q',
        rating: 1,
        comment: 'x'.repeat(500),
      }).ok
    ).toBe(true);
  });
});
