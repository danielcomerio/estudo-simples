import { describe, expect, it } from 'vitest';
import {
  MAX_QUESTIONS_PER_SHARE,
  generateShareToken,
  maskEmail,
  sanitizeQuestionForShare,
  validateShareRequest,
} from '../sharing';
import type { Question } from '../types';

const sampleQuestion = (overrides?: Partial<Question>): Question => ({
  id: 'qid-1',
  user_id: 'uid-1',
  type: 'objetiva',
  disciplina_id: 'Direito Penal',
  tema: 'Crimes contra pessoa',
  banca_estilo: 'FGV',
  dificuldade: 3,
  payload: {
    enunciado: 'X',
    alternativas: [
      { letra: 'A', texto: 'a', correta: true },
      { letra: 'B', texto: 'b', correta: false },
    ],
    gabarito: 'A',
  },
  srs: {
    repetitions: 5,
    easeFactor: 2.6,
    interval: 14,
    dueDate: 1234567890,
    lastReviewed: 1234560000,
  },
  stats: {
    attempts: 10,
    correct: 8,
    wrong: 2,
    history: [],
  },
  created_at: '2026-01-01',
  updated_at: '2026-01-02',
  deleted_at: null,
  topico_id: 'topic-x',
  concurso_id: 'concurso-y',
  tags: ['art-121', 'banca-fgv'],
  origem: 'real',
  fonte: { banca: 'FGV', ano: 2024 },
  verificacao: 'verificada',
  disciplina_uuid: 'uuid-z',
  ...overrides,
});

describe('generateShareToken', () => {
  it('gera token de 32 chars hex sem hífens', () => {
    const t = generateShareToken();
    expect(t).toHaveLength(32);
    expect(t).toMatch(/^[a-f0-9]{32}$/);
  });

  it('é único entre chamadas', () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) tokens.add(generateShareToken());
    expect(tokens.size).toBe(100);
  });
});

describe('maskEmail', () => {
  it('mascara email padrão preservando domínio', () => {
    expect(maskEmail('danielhcomerio@gmail.com')).toBe('dani***@gmail.com');
  });

  it('email curto: até 4 chars visíveis', () => {
    expect(maskEmail('ab@x.co')).toBe('ab***@x.co');
    expect(maskEmail('a@b.c')).toBe('a***@b.c');
  });

  it('null/undefined/inválido: "Anônimo"', () => {
    expect(maskEmail(null)).toBe('Anônimo');
    expect(maskEmail(undefined)).toBe('Anônimo');
    expect(maskEmail('')).toBe('Anônimo');
    expect(maskEmail('sem-arroba')).toBe('Anônimo');
  });
});

describe('sanitizeQuestionForShare', () => {
  it('mantém campos educacionais', () => {
    const q = sampleQuestion();
    const s = sanitizeQuestionForShare(q);
    expect(s.type).toBe('objetiva');
    expect(s.disciplina_id).toBe('Direito Penal');
    expect(s.tema).toBe('Crimes contra pessoa');
    expect(s.banca_estilo).toBe('FGV');
    expect(s.dificuldade).toBe(3);
    expect(s.payload).toEqual(q.payload);
    expect(s.tags).toEqual(['art-121', 'banca-fgv']);
    expect(s.origem).toBe('real');
    expect(s.fonte).toEqual({ banca: 'FGV', ano: 2024 });
    expect(s.verificacao).toBe('verificada');
  });

  it('REMOVE dados pessoais (srs/stats/ids/timestamps)', () => {
    const q = sampleQuestion();
    const s = sanitizeQuestionForShare(q) as Record<string, unknown>;
    expect(s.id).toBeUndefined();
    expect(s.user_id).toBeUndefined();
    expect(s.srs).toBeUndefined();
    expect(s.stats).toBeUndefined();
    expect(s.created_at).toBeUndefined();
    expect(s.updated_at).toBeUndefined();
    expect(s.deleted_at).toBeUndefined();
    expect(s._dirty).toBeUndefined();
    expect(s.topico_id).toBeUndefined();
    expect(s.concurso_id).toBeUndefined();
    expect(s.disciplina_uuid).toBeUndefined();
  });

  it('omite tags vazias do output', () => {
    const q = sampleQuestion({ tags: [] });
    const s = sanitizeQuestionForShare(q) as Record<string, unknown>;
    expect(s.tags).toBeUndefined();
  });

  it('omite fonte vazia', () => {
    const q = sampleQuestion({ fonte: {} });
    const s = sanitizeQuestionForShare(q) as Record<string, unknown>;
    expect(s.fonte).toBeUndefined();
  });
});

describe('validateShareRequest', () => {
  it('rejeita lista vazia', () => {
    expect(validateShareRequest({ questionIds: [] })).toEqual({
      ok: false,
      error: expect.stringContaining('ao menos 1'),
    });
  });

  it('rejeita lista acima do max', () => {
    const ids = Array.from(
      { length: MAX_QUESTIONS_PER_SHARE + 1 },
      (_, i) => String(i)
    );
    expect(validateShareRequest({ questionIds: ids }).ok).toBe(false);
  });

  it('aceita lista válida sem expiração', () => {
    expect(validateShareRequest({ questionIds: ['a', 'b'] })).toEqual({
      ok: true,
    });
  });

  it('aceita expiração entre 1 e 365', () => {
    expect(
      validateShareRequest({ questionIds: ['a'], expirationDays: 30 })
    ).toEqual({ ok: true });
  });

  it('rejeita expiração 0, negativa, > 36500 (100 anos) ou non-number', () => {
    expect(
      validateShareRequest({ questionIds: ['a'], expirationDays: 0 }).ok
    ).toBe(false);
    expect(
      validateShareRequest({ questionIds: ['a'], expirationDays: -5 }).ok
    ).toBe(false);
    expect(
      validateShareRequest({ questionIds: ['a'], expirationDays: 36501 }).ok
    ).toBe(false);
    expect(
      validateShareRequest({
        questionIds: ['a'],
        expirationDays: NaN,
      }).ok
    ).toBe(false);
  });

  it('aceita expiração "sem prazo" (36500 dias = 100 anos)', () => {
    expect(
      validateShareRequest({ questionIds: ['a'], expirationDays: 36500 }).ok
    ).toBe(true);
    expect(
      validateShareRequest({ questionIds: ['a'], expirationDays: 365 }).ok
    ).toBe(true);
  });

  it('rejeita Infinity', () => {
    expect(
      validateShareRequest({
        questionIds: ['a'],
        expirationDays: Infinity,
      }).ok
    ).toBe(false);
  });

  it('rejeita string como expirationDays', () => {
    expect(
      validateShareRequest({
        questionIds: ['a'],
        expirationDays: '30' as unknown as number,
      }).ok
    ).toBe(false);
  });

  it('rejeita questionIds não-array', () => {
    expect(
      validateShareRequest({
        questionIds: 'not-array' as unknown as string[],
      }).ok
    ).toBe(false);
  });

  it('aceita exatamente MAX_QUESTIONS_PER_SHARE', () => {
    const ids = Array.from(
      { length: MAX_QUESTIONS_PER_SHARE },
      (_, i) => String(i)
    );
    expect(validateShareRequest({ questionIds: ids }).ok).toBe(true);
  });
});

describe('sanitizeQuestionForShare — mais tipos', () => {
  it('flashcard: payload preserved', () => {
    const q = sampleQuestion({
      type: 'flashcard',
      payload: { frente: 'F', verso: 'V' },
    });
    const s = sanitizeQuestionForShare(q);
    expect(s.type).toBe('flashcard');
    expect((s.payload as { frente: string }).frente).toBe('F');
  });

  it('cloze: payload preserved', () => {
    const q = sampleQuestion({
      type: 'cloze',
      payload: { texto: '{{c1::ABC}}' },
    });
    const s = sanitizeQuestionForShare(q);
    expect(s.type).toBe('cloze');
    expect((s.payload as { texto: string }).texto).toBe('{{c1::ABC}}');
  });

  it('discursiva sem origem/fonte: omitidos', () => {
    const q = sampleQuestion({
      type: 'discursiva',
      origem: null,
      fonte: undefined,
      verificacao: null,
    });
    const s = sanitizeQuestionForShare(q) as Record<string, unknown>;
    expect(s.origem).toBeUndefined();
    expect(s.fonte).toBeUndefined();
    expect(s.verificacao).toBeUndefined();
  });

  it('disciplina_id null preservado', () => {
    const q = sampleQuestion({ disciplina_id: null });
    const s = sanitizeQuestionForShare(q);
    expect(s.disciplina_id).toBe(null);
  });

  it('serializa pra JSON sem vazar campos pessoais', () => {
    const q = sampleQuestion();
    const json = JSON.stringify(sanitizeQuestionForShare(q));
    // negativos:
    expect(json).not.toContain('uid-1');
    expect(json).not.toContain('topic-x');
    expect(json).not.toContain('uuid-z');
    expect(json).not.toContain('1234567890');
    // positivos:
    expect(json).toContain('Direito Penal');
    expect(json).toContain('FGV');
  });
});
