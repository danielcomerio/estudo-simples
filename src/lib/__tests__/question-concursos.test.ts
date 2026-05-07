import { describe, expect, it } from 'vitest';
import {
  invalidateLinkCache,
  questionMatchesConcurso,
} from '../question-concursos';

describe('questionMatchesConcurso', () => {
  const C1 = '11111111-1111-1111-1111-111111111111';
  const C2 = '22222222-2222-2222-2222-222222222222';
  const C3 = '33333333-3333-3333-3333-333333333333';

  it('match via concurso_id direto (1:1 legacy)', () => {
    const links = new Map<string, Set<string>>();
    expect(
      questionMatchesConcurso({ id: 'q1', concurso_id: C1 }, C1, links)
    ).toBe(true);
  });

  it('match via question_concursos (N:N novo)', () => {
    const links = new Map([['q1', new Set([C2, C3])]]);
    expect(
      questionMatchesConcurso(
        { id: 'q1', concurso_id: null },
        C2,
        links
      )
    ).toBe(true);
    expect(
      questionMatchesConcurso(
        { id: 'q1', concurso_id: null },
        C3,
        links
      )
    ).toBe(true);
  });

  it('falha quando questão não tem nenhum vínculo com o concurso', () => {
    const links = new Map([['q1', new Set([C1])]]);
    expect(
      questionMatchesConcurso(
        { id: 'q1', concurso_id: C1 },
        C2,
        links
      )
    ).toBe(false);
  });

  it('falha quando questão não está em links nem tem concurso_id', () => {
    const links = new Map<string, Set<string>>();
    expect(
      questionMatchesConcurso(
        { id: 'q1', concurso_id: null },
        C1,
        links
      )
    ).toBe(false);
  });

  it('match dual: concurso_id direto + N:N pra outros', () => {
    const links = new Map([['q1', new Set([C2, C3])]]);
    // Primário
    expect(
      questionMatchesConcurso({ id: 'q1', concurso_id: C1 }, C1, links)
    ).toBe(true);
    // Adicional via link
    expect(
      questionMatchesConcurso({ id: 'q1', concurso_id: C1 }, C2, links)
    ).toBe(true);
  });

  it('concurso_id null sem links: false', () => {
    expect(
      questionMatchesConcurso({ id: 'q1', concurso_id: null }, C1, new Map())
    ).toBe(false);
    expect(
      questionMatchesConcurso({ id: 'q1' }, C1, new Map())
    ).toBe(false);
  });

  it('múltiplos concursos via link funciona pra cada um isoladamente', () => {
    const links = new Map([['q1', new Set([C1, C2, C3])]]);
    expect(
      questionMatchesConcurso({ id: 'q1', concurso_id: null }, C1, links)
    ).toBe(true);
    expect(
      questionMatchesConcurso({ id: 'q1', concurso_id: null }, C2, links)
    ).toBe(true);
    expect(
      questionMatchesConcurso({ id: 'q1', concurso_id: null }, C3, links)
    ).toBe(true);
  });
});

describe('invalidateLinkCache', () => {
  it('callable sem throw mesmo sem cache populada', () => {
    expect(() => invalidateLinkCache()).not.toThrow();
  });

  it('idempotente — chamadas múltiplas não quebram', () => {
    invalidateLinkCache();
    invalidateLinkCache();
    invalidateLinkCache();
    expect(true).toBe(true);
  });
});
