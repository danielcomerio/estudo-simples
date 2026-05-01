import { describe, expect, it } from 'vitest';
import {
  dedupeKey,
  detectType,
  extractItems,
  normalizeQuestion,
  safeParseJSON,
  validateQuestion,
} from '../validation';

describe('safeParseJSON', () => {
  it('parseia JSON válido', () => {
    const r = safeParseJSON('{"a":1}');
    expect(r.error).toBeNull();
    expect(r.value).toEqual({ a: 1 });
  });

  it('strip BOM no início (regressão da v1)', () => {
    const bom = '﻿{"a":1}';
    const r = safeParseJSON(bom);
    expect(r.error).toBeNull();
    expect(r.value).toEqual({ a: 1 });
  });

  it('retorna erro (não throw) em JSON inválido', () => {
    const r = safeParseJSON('{invalid');
    expect(r.error).not.toBeNull();
    expect(r.value).toBeNull();
  });

  it('retorna erro em string vazia', () => {
    const r = safeParseJSON('');
    expect(r.error).not.toBeNull();
  });

  it('strip espaços ao redor', () => {
    const r = safeParseJSON('   {"a":1}   ');
    expect(r.error).toBeNull();
    expect(r.value).toEqual({ a: 1 });
  });

  it('não vaza __proto__ em prototype (proteção implícita do JSON.parse)', () => {
    const r = safeParseJSON('{"__proto__":{"polluted":true}}');
    expect(r.error).toBeNull();
    // JSON.parse cria __proto__ como own property, mas não polui Object.prototype
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('detectType', () => {
  it('detecta objetiva por alternativas[]', () => {
    expect(detectType({ alternativas: [] })).toBe('objetiva');
  });

  it('detecta objetiva por tipo explícito', () => {
    expect(detectType({ tipo: 'objetiva' })).toBe('objetiva');
  });

  it('detecta discursiva por tipo, espelho_resposta ou tipo_discursiva', () => {
    expect(detectType({ tipo: 'discursiva' })).toBe('discursiva');
    expect(detectType({ espelho_resposta: 'x' })).toBe('discursiva');
    expect(detectType({ tipo_discursiva: 'parecer' })).toBe('discursiva');
  });

  it('rejeita inputs não-objeto (segurança contra input forjado)', () => {
    expect(detectType(null)).toBeNull();
    expect(detectType(undefined)).toBeNull();
    expect(detectType('string')).toBeNull();
    expect(detectType(42)).toBeNull();
    expect(detectType(true)).toBeNull();
    expect(detectType([])).toBeNull();
  });

  it('retorna null quando não há indícios', () => {
    expect(detectType({ qualquer_coisa: 'x' })).toBeNull();
  });
});

describe('validateQuestion', () => {
  const validObjetiva = {
    disciplina_id: 'portugues',
    enunciado: 'Qual?',
    alternativas: [
      { letra: 'A', texto: 'opção A' },
      { letra: 'B', texto: 'opção B', correta: true },
    ],
  };

  const validDiscursiva = {
    disciplina_id: 'direito',
    tipo: 'discursiva',
    enunciado: 'Disserte sobre X',
    espelho_resposta: 'A resposta esperada é...',
  };

  it('aceita objetiva válida', () => {
    const r = validateQuestion(validObjetiva);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type).toBe('objetiva');
  });

  it('aceita discursiva válida', () => {
    const r = validateQuestion(validDiscursiva);
    expect(r.ok).toBe(true);
  });

  it('rejeita non-object', () => {
    expect(validateQuestion(null).ok).toBe(false);
    expect(validateQuestion('string').ok).toBe(false);
    expect(validateQuestion([]).ok).toBe(false);
  });

  it('rejeita objetiva sem alternativas', () => {
    const { alternativas: _a, ...sem } = validObjetiva;
    const r = validateQuestion(sem);
    expect(r.ok).toBe(false);
  });

  it('rejeita objetiva com 1 só alternativa', () => {
    const r = validateQuestion({
      ...validObjetiva,
      alternativas: [{ letra: 'A', texto: 'única' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejeita objetiva sem nenhuma "correta:true" e sem "gabarito"', () => {
    const r = validateQuestion({
      ...validObjetiva,
      alternativas: [
        { letra: 'A', texto: 'a' },
        { letra: 'B', texto: 'b' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /gabarito/i.test(e))).toBe(true);
  });

  it('aceita objetiva com gabarito mas sem correta:true', () => {
    const r = validateQuestion({
      ...validObjetiva,
      alternativas: [
        { letra: 'A', texto: 'a' },
        { letra: 'B', texto: 'b' },
      ],
      gabarito: 'B',
    });
    expect(r.ok).toBe(true);
  });

  it('rejeita disciplina_id ausente ou não-string', () => {
    const r1 = validateQuestion({ ...validObjetiva, disciplina_id: undefined });
    const r2 = validateQuestion({ ...validObjetiva, disciplina_id: 42 });
    const r3 = validateQuestion({ ...validObjetiva, disciplina_id: '' });
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(r3.ok).toBe(false);
  });

  it('rejeita discursiva sem nenhum enunciado/comando', () => {
    const r = validateQuestion({
      disciplina_id: 'd',
      tipo: 'discursiva',
      espelho_resposta: 'x',
    });
    expect(r.ok).toBe(false);
  });

  it('rejeita discursiva sem espelho/rubrica/quesitos', () => {
    const r = validateQuestion({
      disciplina_id: 'd',
      tipo: 'discursiva',
      enunciado: 'q',
    });
    expect(r.ok).toBe(false);
  });

  it('aceita discursiva com quesitos[] (sem espelho)', () => {
    const r = validateQuestion({
      disciplina_id: 'd',
      tipo: 'discursiva',
      enunciado: 'q',
      quesitos: [{ pergunta: 'p', pontos_max: 10 }],
    });
    expect(r.ok).toBe(true);
  });
});

describe('normalizeQuestion — segurança', () => {
  it('strippa campos sensíveis: id, user_id, created_at, updated_at, deleted_at, srs, stats', () => {
    const malicious = {
      id: 'attacker-chosen-id',
      user_id: 'someone-elses-uid',
      created_at: '1970-01-01T00:00:00Z',
      updated_at: '1970-01-01T00:00:00Z',
      deleted_at: 'never',
      srs: { easeFactor: 999, interval: 9999, dueDate: 9e15, repetitions: 0, lastReviewed: 0 },
      stats: { attempts: 0, correct: 99999, wrong: 0, history: [] },
      disciplina_id: 'portugues',
      enunciado: 'Q?',
      alternativas: [
        { letra: 'A', texto: 'a' },
        { letra: 'B', texto: 'b', correta: true },
      ],
    };
    const r = normalizeQuestion(malicious as Record<string, unknown>, 'objetiva');
    // srs/stats sempre re-criados pelo normalize (defaults)
    expect(r.srs.easeFactor).toBe(2.5);
    expect(r.srs.interval).toBe(0);
    expect(r.srs.repetitions).toBe(0);
    expect(r.stats.attempts).toBe(0);
    expect(r.stats.correct).toBe(0);
    // Nunca propaga deleted_at do input
    expect(r.deleted_at).toBeNull();
    // E os campos top-level sensíveis nem aparecem no objeto retornado
    expect((r as Record<string, unknown>).id).toBeUndefined();
    expect((r as Record<string, unknown>).user_id).toBeUndefined();
    expect((r as Record<string, unknown>).created_at).toBeUndefined();
    // payload também não deve carregá-los (foram destructurados antes do ...rest)
    const p = r.payload as Record<string, unknown>;
    expect(p.id).toBeUndefined();
    expect(p.user_id).toBeUndefined();
    expect(p.srs).toBeUndefined();
    expect(p.stats).toBeUndefined();
  });

  it('tipo "tipo" do raw não vaza para o payload', () => {
    const r = normalizeQuestion(
      {
        disciplina_id: 'd',
        enunciado: 'q',
        tipo: 'objetiva',
        alternativas: [
          { letra: 'A', texto: 'a' },
          { letra: 'B', texto: 'b', correta: true },
        ],
      } as Record<string, unknown>,
      'objetiva'
    );
    expect((r.payload as Record<string, unknown>).tipo).toBeUndefined();
  });

  it('clampa dificuldade no range [1,5] (input não confiável)', () => {
    const mk = (d: unknown) =>
      normalizeQuestion(
        {
          disciplina_id: 'd',
          enunciado: 'q',
          dificuldade: d,
          alternativas: [
            { letra: 'A', texto: 'a' },
            { letra: 'B', texto: 'b', correta: true },
          ],
        } as Record<string, unknown>,
        'objetiva'
      );
    expect(mk(0).dificuldade).toBe(1);
    expect(mk(99).dificuldade).toBe(5);
    expect(mk(-5).dificuldade).toBe(1);
    expect(mk(3.7).dificuldade).toBe(4);
    expect(mk('forjado').dificuldade).toBeNull();
    expect(mk(undefined).dificuldade).toBeNull();
  });

  it('deduz gabarito a partir de correta:true se gabarito não veio', () => {
    const r = normalizeQuestion(
      {
        disciplina_id: 'd',
        enunciado: 'q',
        alternativas: [
          { letra: 'A', texto: 'a' },
          { letra: 'B', texto: 'b', correta: true },
        ],
      } as Record<string, unknown>,
      'objetiva'
    );
    const p = r.payload as { gabarito?: string };
    expect(p.gabarito).toBe('B');
  });

  it('strippa campos da hierarquia 0002 do payload (topico_id, concurso_id, tags)', () => {
    const r = normalizeQuestion(
      {
        disciplina_id: 'd',
        enunciado: 'q',
        topico_id: 'forjado',
        concurso_id: 'forjado',
        tags: ['x', 'y'],
        alternativas: [
          { letra: 'A', texto: 'a' },
          { letra: 'B', texto: 'b', correta: true },
        ],
      } as Record<string, unknown>,
      'objetiva'
    );
    const p = r.payload as Record<string, unknown>;
    expect(p.topico_id).toBeUndefined();
    expect(p.concurso_id).toBeUndefined();
    expect(p.tags).toBeUndefined();
    // E também não viraram top-level — round-trip de hierarquia é via UI.
    expect((r as Record<string, unknown>).topico_id).toBeUndefined();
    expect((r as Record<string, unknown>).concurso_id).toBeUndefined();
    expect((r as Record<string, unknown>).tags).toBeUndefined();
  });

  it('aplica correta:true a partir de gabarito se faltava', () => {
    const r = normalizeQuestion(
      {
        disciplina_id: 'd',
        enunciado: 'q',
        gabarito: 'A',
        alternativas: [
          { letra: 'A', texto: 'a' },
          { letra: 'B', texto: 'b' },
        ],
      } as Record<string, unknown>,
      'objetiva'
    );
    const p = r.payload as {
      alternativas: Array<{ letra: string; correta?: boolean }>;
    };
    expect(p.alternativas[0].correta).toBe(true);
    expect(p.alternativas[1].correta).toBeFalsy();
  });
});

describe('extractItems', () => {
  it('aceita array direto', () => {
    expect(extractItems([{ a: 1 }, { b: 2 }])).toHaveLength(2);
  });

  it('aceita { questions: [...] }', () => {
    expect(extractItems({ questions: [{ a: 1 }] })).toHaveLength(1);
  });

  it('aceita { items: [...] }', () => {
    expect(extractItems({ items: [{ a: 1 }, { b: 2 }] })).toHaveLength(2);
  });

  it('embrulha objeto único como array de 1', () => {
    expect(extractItems({ a: 1 })).toEqual([{ a: 1 }]);
  });

  it('retorna [] para primitivos/null', () => {
    expect(extractItems(null)).toEqual([]);
    expect(extractItems(undefined)).toEqual([]);
    expect(extractItems('string')).toEqual([]);
    expect(extractItems(42)).toEqual([]);
  });
});

describe('dedupeKey', () => {
  it('é determinístico', () => {
    const q = {
      disciplina_id: 'p',
      type: 'objetiva' as const,
      payload: { enunciado: 'X', alternativas: [] },
    };
    expect(dedupeKey(q)).toBe(dedupeKey(q));
  });

  it('mimica DB coalesce: enunciado primeiro, depois enunciado_completo', () => {
    const base = { disciplina_id: 'd', type: 'discursiva' as const };
    // Prefere enunciado quando ambos existem
    const k1 = dedupeKey({
      ...base,
      payload: { enunciado: 'foo', enunciado_completo: 'bar' },
    });
    expect(k1).toBe('d||foo');
    // Cai pra enunciado_completo se enunciado ausente
    const k2 = dedupeKey({ ...base, payload: { enunciado_completo: 'bar' } });
    expect(k2).toBe('d||bar');
  });

  it('CRÍTICO: enunciado vazio NÃO cai pra enunciado_completo (match SQL coalesce)', () => {
    // Bug real do user: 100 discursivas com enunciado:'' e conteúdo em
    // enunciado_completo. JS `||` tratava '' como falsy e usava
    // enunciado_completo, mas DB tratava '' como valor presente. Cliente
    // achava que eram únicas; DB rejeitava 99 como duplicatas (todas com
    // hash de `disc||''`). Esse teste garante que o cliente concorda com
    // o DB — após o fix, todas essas 100 caem em `disc||''` no cliente
    // tb, então o dedup local detecta e impede o import.
    const base = { disciplina_id: 'd', type: 'discursiva' as const };
    const k = dedupeKey({
      ...base,
      payload: { enunciado: '', enunciado_completo: 'bar' },
    });
    expect(k).toBe('d||');
  });

  it('comando NÃO entra no dedup (DB não usa)', () => {
    const base = { disciplina_id: 'd', type: 'discursiva' as const };
    const k1 = dedupeKey({ ...base, payload: { comando: 'A' } });
    const k2 = dedupeKey({ ...base, payload: { comando: 'B' } });
    // Sem enunciado/enunciado_completo, ambas viram 'd||' — match DB
    expect(k1).toBe('d||');
    expect(k2).toBe('d||');
    expect(k1).toBe(k2);
  });

  it('objetiva: enunciado vazio fica vazio (match DB)', () => {
    const k = dedupeKey({
      disciplina_id: 'p',
      type: 'objetiva',
      payload: { enunciado: '', alternativas: [] },
    });
    expect(k).toBe('p||');
  });

  it('disciplinas diferentes não colidem mesmo com enunciado igual', () => {
    const a = dedupeKey({
      disciplina_id: 'a',
      type: 'objetiva',
      payload: { enunciado: 'X', alternativas: [] },
    });
    const b = dedupeKey({
      disciplina_id: 'b',
      type: 'objetiva',
      payload: { enunciado: 'X', alternativas: [] },
    });
    expect(a).not.toBe(b);
  });

  it('disciplina_id null é tratado como string vazia (match DB coalesce)', () => {
    const k = dedupeKey({
      disciplina_id: null,
      type: 'objetiva',
      payload: { enunciado: 'X', alternativas: [] },
    });
    expect(k).toBe('||X');
  });
});
